/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SMS_SENDER_ID } from '../brand.js';
import { toGhanaMsisdn } from './sms.js';

/**
 * The one place that talks to an SMS provider.
 *
 * Everything above this file deals in queued rows; everything below is HTTP.
 * Keeping the boundary here means a change of provider is a change to this
 * file, and that swapping Arkesel for Hubtel later cannot touch the rules about
 * WHO gets told WHAT, which is the part with the business logic in it.
 *
 * OFF BY DEFAULT. With SMS_PROVIDER unset, send() reports itself disabled and
 * no request leaves the building. That is deliberate: the outbox accumulates
 * rows from every booking made while sending was being built, and switching the
 * worker on is a decision to text every one of those real phone numbers at
 * once. It should be somebody's decision, taken once, in .env.
 */

export type SendOutcome =
  | { ok: true; providerReference?: string }
  /** Retrying might work: network trouble, rate limits, provider having a bad day. */
  | { ok: false; permanent: false; error: string }
  /** Retrying cannot help: the number is wrong, the sender ID is not approved. */
  | { ok: false; permanent: true; error: string };

/** Whether sending is switched on at all. */
export function smsEnabled(): boolean {
  return Boolean(process.env.SMS_PROVIDER && process.env.SMS_API_KEY);
}

export function smsProviderName(): string {
  return process.env.SMS_PROVIDER || 'none';
}

const ARKESEL_SEND_URL = 'https://sms.arkesel.com/api/v2/sms/send';
const ARKESEL_BALANCE_URL = 'https://sms.arkesel.com/api/v2/clients/balance-details';
const TIMEOUT_MS = 15_000;

async function postJson(url: string, apiKey: string, body: unknown): Promise<{ status: number; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return { status: res.status, text: await res.text() };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Send one message through Arkesel.
 *
 * The sender ID must be registered with them and is capped at 11 characters;
 * an unapproved one is rejected outright rather than silently replaced, which
 * is why that failure is treated as permanent — retrying it forever would just
 * burn the queue.
 */
async function sendViaArkesel(to: string, message: string, apiKey: string): Promise<SendOutcome> {
  let response: { status: number; text: string };

  try {
    response = await postJson(ARKESEL_SEND_URL, apiKey, {
      sender: SMS_SENDER_ID,
      message,
      recipients: [to],
    });
  } catch (err) {
    // Timeouts and DNS failures say nothing about the message itself.
    return { ok: false, permanent: false, error: `network: ${(err as Error).message}` };
  }

  let parsed: any = null;
  try {
    parsed = JSON.parse(response.text);
  } catch {
    /* Not JSON. The raw text is kept in the error below. */
  }

  if (response.status >= 200 && response.status < 300 && parsed?.status === 'success') {
    // The shape of `data` has varied across their API versions, so the id is
    // dug out defensively rather than assumed — a missing reference is worth
    // far less than a false failure.
    const first = Array.isArray(parsed.data) ? parsed.data[0] : parsed.data;
    const providerReference =
      first?.id ?? first?.message_id ?? first?.messageId ?? undefined;
    return { ok: true, providerReference: providerReference ? String(providerReference) : undefined };
  }

  const detail = (parsed?.message ?? parsed?.status ?? response.text ?? '').toString().slice(0, 300);

  // 429 and 5xx are the provider's problem and worth another go. Everything
  // else in the 4xx range is ours, and will fail identically next time.
  const permanent = response.status >= 400 && response.status < 500 && response.status !== 429;

  return { ok: false, permanent, error: `HTTP ${response.status}: ${detail}` };
}

/**
 * Send a message, whoever the provider happens to be.
 *
 * The number is normalised here as well as at queue time — this is the last
 * point before it leaves, and a provider rejecting a malformed number costs a
 * retry cycle to discover.
 */
export async function sendSms(to: string, message: string): Promise<SendOutcome> {
  if (!smsEnabled()) {
    return { ok: false, permanent: false, error: 'SMS is switched off (SMS_PROVIDER unset)' };
  }

  const msisdn = toGhanaMsisdn(to);
  if (!msisdn) {
    return { ok: false, permanent: true, error: `not a Ghanaian mobile number: ${to}` };
  }

  const provider = process.env.SMS_PROVIDER!.toLowerCase();
  const apiKey = process.env.SMS_API_KEY!;

  switch (provider) {
    case 'arkesel':
      return sendViaArkesel(msisdn, message, apiKey);
    default:
      return { ok: false, permanent: true, error: `unknown SMS_PROVIDER "${provider}"` };
  }
}

/**
 * What is left in the account.
 *
 * Worth checking before switching sending on, and worth watching afterwards:
 * an empty balance is indistinguishable from an outage in the failure log, and
 * it is the one that a top-up fixes.
 */
export async function smsBalance(): Promise<string> {
  if (!smsEnabled()) return 'SMS is switched off (SMS_PROVIDER unset)';
  if (process.env.SMS_PROVIDER!.toLowerCase() !== 'arkesel') {
    return `no balance check implemented for ${process.env.SMS_PROVIDER}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ARKESEL_BALANCE_URL, {
      headers: { 'api-key': process.env.SMS_API_KEY! },
      signal: controller.signal,
    });
    return (await res.text()).slice(0, 300);
  } catch (err) {
    return `could not reach the provider: ${(err as Error).message}`;
  } finally {
    clearTimeout(timer);
  }
}
