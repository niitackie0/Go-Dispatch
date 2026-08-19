/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { prisma } from './prisma.js';
import { sendSms, smsEnabled, smsProviderName } from './smsProvider.js';

/**
 * The worker that drains the notification outbox.
 *
 * src/server/notifications.ts decides what to say and writes a row. This sends
 * it. Nothing else in the app knows a provider exists, which is what lets a
 * booking succeed while the SMS network is down: the row lands in the same
 * transaction as the order, and delivery becomes this file's problem, later.
 *
 * RETRIES. A failure is not a verdict on the message, so each row gets five
 * attempts on a widening delay, and only then gives up. A failure that IS a
 * verdict — an unregistered sender ID, a number that is not a Ghanaian mobile —
 * is marked permanent by the provider layer and fails immediately, because
 * retrying it four more times only wastes a day finding out the same thing.
 *
 * ONE AT A TIME. `draining` stops two ticks overlapping. Sending is the one
 * operation here that cannot be taken back, so it is better for a tick to be
 * skipped than for a customer to be texted twice.
 */

/** How long to wait after each failed attempt before trying again. */
const BACKOFF_MS = [
  60_000, // 1 minute
  5 * 60_000, // 5 minutes
  30 * 60_000, // half an hour
  2 * 60 * 60_000, // 2 hours
];

const MAX_ATTEMPTS = 5;

/** Sent per tick. Enough to clear a backlog steadily without a burst of traffic. */
const BATCH_SIZE = 20;

let draining = false;

export interface DrainResult {
  sent: number;
  failed: number;
  retrying: number;
  skipped: string | null;
}

/**
 * Send everything currently due.
 *
 * `dryRun` renders and reports what would go out without contacting anybody —
 * the only safe way to look at a queue that has been accumulating real phone
 * numbers while sending was being built.
 */
export async function drainOutbox(options: { dryRun?: boolean } = {}): Promise<DrainResult> {
  const result: DrainResult = { sent: 0, failed: 0, retrying: 0, skipped: null };

  if (!options.dryRun && !smsEnabled()) {
    result.skipped = 'SMS is switched off (set SMS_PROVIDER in .env to enable)';
    return result;
  }

  if (draining) {
    result.skipped = 'a drain is already running';
    return result;
  }
  draining = true;

  try {
    const now = new Date();
    const due = await prisma.notification.findMany({
      where: {
        status: 'pending',
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      orderBy: { createdAt: 'asc' },
      take: BATCH_SIZE,
    });

    for (const row of due) {
      if (options.dryRun) {
        console.log(`[outbox] WOULD SEND to ${row.recipient} (${row.event}): ${row.message}`);
        result.sent += 1;
        continue;
      }

      const outcome = await sendSms(row.recipient, row.message);

      // Compared explicitly: this tsconfig has strict off, where truthiness
      // alone does not narrow a discriminated union.
      if (outcome.ok === true) {
        await prisma.notification.update({
          where: { id: row.id },
          data: {
            status: 'sent',
            sentAt: new Date(),
            attempts: row.attempts + 1,
            providerReference: outcome.providerReference ?? null,
            lastError: null,
            nextAttemptAt: null,
          },
        });
        result.sent += 1;
        continue;
      }

      const attempts = row.attempts + 1;
      const giveUp = outcome.permanent || attempts >= MAX_ATTEMPTS;

      await prisma.notification.update({
        where: { id: row.id },
        data: {
          status: giveUp ? 'failed' : 'pending',
          attempts,
          lastError: outcome.error.slice(0, 500),
          nextAttemptAt: giveUp
            ? null
            : new Date(Date.now() + (BACKOFF_MS[attempts - 1] ?? BACKOFF_MS[BACKOFF_MS.length - 1])),
        },
      });

      if (giveUp) {
        result.failed += 1;
        console.error(
          `[outbox] giving up on ${row.event} to ${row.recipient} after ${attempts}: ${outcome.error}`
        );
      } else {
        result.retrying += 1;
      }
    }
  } finally {
    draining = false;
  }

  return result;
}

/** A one-line summary of what is waiting, for the log on boot. */
export async function outboxSummary(): Promise<string> {
  const grouped = await prisma.notification.groupBy({
    by: ['status'],
    _count: { _all: true },
  });
  const counts = grouped.map((g) => `${g._count._all} ${g.status}`).join(', ') || 'empty';
  return `outbox: ${counts} (provider: ${smsProviderName()})`;
}
