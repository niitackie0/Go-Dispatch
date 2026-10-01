/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DrainResult } from './outbox.js';
import { onNotificationQueued } from './outboxSignal.js';

/**
 * Decides WHEN the outbox is drained. outbox.ts decides what a drain does.
 *
 * This replaced a setInterval in server.ts that drained every 30 seconds for
 * as long as the process lived. Every one of those was a query, an empty
 * outbox answered it just as readily as a full one, and a Neon compute needs
 * five minutes without a query before it scales to zero -- so the timer alone
 * was enough to keep the database billed around the clock. It is the same
 * mistake as the automation tick removed on 20 September, in the one timer
 * that survived it.
 *
 * The worker is now idle unless it has a reason not to be. There are three:
 *
 *   BOOT.   One drain shortly after start. Anything queued before a restart,
 *           or while the free instance was asleep, has no other way of being
 *           noticed -- nobody is going to ring the bell for it again.
 *
 *   A ROW WAS QUEUED.   queueNotification rings outboxSignal, and a drain
 *           follows a couple of seconds later. The row is written inside a
 *           transaction that has not committed when the bell rings, so that
 *           first look can come up empty; the worker therefore keeps looking
 *           until a drain has run a clear `settleMs` after the last bell. In
 *           practice that is two drains per burst of activity, on a database
 *           the activity itself had already woken.
 *
 *   SOMETHING IS STILL WAITING.   A drain reports how long until a pending row
 *           is next due (DrainResult.waitMs). A backlog longer than one batch
 *           is picked up a tick later, as before. A row on its retry backoff
 *           is picked up when the backoff expires -- one timer set for that
 *           moment, not a poll every 30 seconds until it arrives.
 *
 * Otherwise there is no timer at all, and nothing here touches the database.
 *
 * WHAT THIS DOES NOT CHANGE. It only ever calls the drain it was given, one
 * call at a time, and the `draining` guard inside drainOutbox is untouched --
 * a second call that did overlap would still be turned away there. No message
 * is selected, marked or sent by this file, so there is no new path by which
 * one could go twice.
 *
 * WHAT IT COSTS. A timer does not survive the process. A retry due in two
 * hours is lost when the free instance sleeps after fifteen quiet minutes, and
 * is sent by the boot drain when the next visitor wakes it. That was already
 * true of the interval; it is only more visible written down.
 */

export interface OutboxWorkerOptions {
  /** The drain to run. Always drainOutbox, except under test. */
  drain: () => Promise<DrainResult>;
  /** Where a failed drain is reported. */
  onError: (err: unknown) => void;
  /** Called after any drain that actually did something. */
  onDrained?: (result: DrainResult) => void;

  /** Delay before the drain at boot. */
  bootDelayMs?: number;
  /** Delay between the bell and the drain, to give the transaction time to commit. */
  kickDelayMs?: number;
  /** The gap between drains while there is a backlog. The old tick. */
  tickMs?: number;
  /** How long after the last bell the worker keeps looking before it trusts an empty outbox. */
  settleMs?: number;
  /** Waits after consecutive failed drains. Past the last one, the worker stops. */
  errorBackoffMs?: number[];
}

/**
 * How long to wait before the next drain, or null to go idle.
 *
 * Pure, and exported so it can be checked without a database or a clock.
 */
export function nextDrainDelay(
  result: Pick<DrainResult, 'skipped' | 'waitMs'>,
  msSinceLastKick: number,
  tickMs: number,
  settleMs: number
): number | null {
  // The drain did not run -- something else in this process held the guard --
  // so it learned nothing. Ask again a tick later.
  if (result.skipped) return tickMs;

  // Rows are pending. Never sooner than a tick, which keeps a long backlog
  // going out in steady batches rather than one burst; and a second late
  // rather than a millisecond early, so the row is due when the drain asks.
  if (result.waitMs !== null) return Math.max(tickMs, result.waitMs + 1000);

  // Nothing pending that this drain could see. If the bell rang recently, the
  // transaction that rang it may simply not have committed yet.
  if (msSinceLastKick < settleMs) return tickMs;

  return null;
}

export function startOutboxWorker(options: OutboxWorkerOptions): { stop: () => void } {
  const {
    drain,
    onError,
    onDrained,
    bootDelayMs = 5_000,
    kickDelayMs = 2_000,
    tickMs = 30_000,
    // Prisma gives an interactive transaction 5 seconds before it is rolled
    // back, so 30 is several times longer than any bell can stay unanswered.
    settleMs = 30_000,
    // A failed drain says nothing about whether rows are waiting, so it is
    // retried -- but on a widening delay and not forever. A database that is
    // down for an hour gains nothing from being asked 120 times, and one that
    // is merely suspended for the month must not be the reason this process
    // never rests. After the last wait the next bell, or the next boot, starts
    // it again.
    errorBackoffMs = [30_000, 60_000, 5 * 60_000, 15 * 60_000],
  } = options;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let timerDueAt = 0;
  let running = false;
  let lastKickAt = Number.NEGATIVE_INFINITY;
  let failures = 0;
  let kickedWhileRunning = false;
  let stopped = false;

  /** Arrange a drain `delayMs` from now, unless one is already due sooner. */
  const schedule = (delayMs: number) => {
    if (stopped) return;
    const dueAt = Date.now() + delayMs;
    if (timer !== null) {
      if (timerDueAt <= dueAt) return;
      clearTimeout(timer);
    }
    timerDueAt = dueAt;
    timer = setTimeout(run, delayMs);
    // Never hold the process open for this; the HTTP server is what does that.
    timer.unref?.();
  };

  const run = async () => {
    timer = null;
    // A bell rang while a drain was still sending. Never a second drain
    // alongside it: the one in flight looks again promptly when it finishes.
    if (running) {
      kickedWhileRunning = true;
      return;
    }
    running = true;
    kickedWhileRunning = false;

    let delay: number | null;
    try {
      const result = await drain();
      failures = 0;
      if (result.sent || result.failed || result.retrying) onDrained?.(result);
      delay = nextDrainDelay(result, Date.now() - lastKickAt, tickMs, settleMs);
    } catch (err) {
      onError(err);
      delay = failures < errorBackoffMs.length ? errorBackoffMs[failures] : null;
      failures += 1;
    } finally {
      running = false;
    }

    if (kickedWhileRunning) delay = Math.min(delay ?? kickDelayMs, kickDelayMs);
    if (delay !== null) schedule(delay);
  };

  onNotificationQueued(() => {
    lastKickAt = Date.now();
    // A fresh message is a fresh reason to try, whatever went wrong before.
    failures = 0;
    schedule(kickDelayMs);
  });

  schedule(bootDelayMs);

  return {
    stop: () => {
      stopped = true;
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  };
}
