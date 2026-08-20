/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NextFunction, Request, Response } from 'express';
import crypto from 'node:crypto';

/**
 * Where errors go, now that nobody is reading stdout.
 *
 * The checklist asks for Sentry. This is the same job without a vendor, an
 * account or a dependency, because the constraint on this project is that
 * everything is free and stays free:
 *
 *   always      one structured line in the log, with a reference
 *   optionally  the same thing posted to a webhook, if one is configured
 *
 * A webhook is the part that matters. An error in a log file is an error
 * nobody has seen; the same error in a phone notification is one somebody can
 * act on. Any free Slack or Discord incoming webhook works — set
 * ERROR_WEBHOOK_URL and it starts posting. Unset, this is exactly the logging
 * that was here before, only structured.
 *
 * If Sentry is ever wanted, `report` is the only function that has to change.
 */

const WEBHOOK = process.env.ERROR_WEBHOOK_URL;

/**
 * The same error, over and over, must not become the outage.
 *
 * A crash loop or a database that has gone away produces the identical error
 * hundreds of times a minute. Posting each one buries the first — the only one
 * that told you anything — and on a free webhook it will get you rate limited
 * into silence at the exact moment you need it. One message per distinct error
 * per ten minutes; the log still has every occurrence.
 */
const COOLDOWN_MS = 10 * 60 * 1000;
const lastSent = new Map<string, number>();

function shouldPost(fingerprint: string): boolean {
  const now = Date.now();
  const previous = lastSent.get(fingerprint);
  if (previous && now - previous < COOLDOWN_MS) return false;
  lastSent.set(fingerprint, now);

  // The map is bounded by the number of distinct errors, which should be
  // small; if it is not, that is itself worth knowing.
  if (lastSent.size > 200) lastSent.clear();
  return true;
}

export interface ErrorContext {
  /** Where it happened, in words: 'api', 'outbox', 'automation', 'process'. */
  at: string;
  /** The reference given to the customer, so a report can be tied to a log. */
  ref?: string;
  method?: string;
  path?: string;
}

/**
 * Log an error, and tell somebody if a webhook is configured.
 *
 * Never throws and never awaits: a failing error reporter must not become the
 * error, and must not hold up the response that is already going wrong.
 */
export function report(err: unknown, context: ErrorContext): void {
  const error = err instanceof Error ? err : new Error(String(err));
  const where = [context.method, context.path].filter(Boolean).join(' ');

  console.error(
    `[${context.at}]${context.ref ? ` ref=${context.ref}` : ''}${where ? ` ${where}` : ''} ` +
      `${error.name}: ${error.message}`,
    error.stack ?? ''
  );

  if (!WEBHOOK) return;

  const fingerprint = `${context.at}:${error.name}:${error.message}`;
  if (!shouldPost(fingerprint)) return;

  const text =
    `GO DISPATCH — ${context.at}\n` +
    `${error.name}: ${error.message}\n` +
    (where ? `${where}\n` : '') +
    (context.ref ? `ref ${context.ref}\n` : '') +
    (error.stack ?? '').split('\n').slice(1, 4).join('\n');

  // Slack and Discord both accept { content } or { text }; sending both means
  // one shape works for either without asking which was configured.
  void fetch(WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, content: text }),
  }).catch(() => {
    // Deliberately silent. If the webhook is down there is nowhere left to
    // report that to, and a loop of failures reporting failures is worse than
    // the original problem.
  });
}

/**
 * A short reference on every request.
 *
 * When something breaks, the customer is shown this and nothing else. It is
 * what turns "it said something went wrong" into a line somebody can find in a
 * log, which is the whole difference between a report you can act on and one
 * you cannot.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = crypto.randomBytes(4).toString('hex');
  (req as Request & { id?: string }).id = id;
  res.setHeader('X-Request-Id', id);
  next();
}

/**
 * The two ways a Node process dies without anyone being told.
 *
 * An unhandled promise rejection terminates the process on modern Node, and an
 * uncaught exception always has. Either way the instance goes down, and on a
 * free one the next visitor pays a cold start for something nobody knows
 * happened. These handlers do not prevent that — they make sure it is
 * reported first.
 *
 * Neither swallows the failure. A process in an unknown state should end and
 * be replaced, not limp on serving requests from a heap it no longer
 * understands; the point is only that it says why on the way out.
 */
export function catchProcessFailures(): void {
  process.on('unhandledRejection', (reason) => {
    report(reason, { at: 'process/unhandledRejection' });
    // Give the log line and the webhook a moment to leave before exiting.
    setTimeout(() => process.exit(1), 500).unref();
  });

  process.on('uncaughtException', (err) => {
    report(err, { at: 'process/uncaughtException' });
    setTimeout(() => process.exit(1), 500).unref();
  });
}
