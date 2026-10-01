/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The bell between "a message was queued" and "the worker should look".
 *
 * The outbox worker used to wake every 30 seconds whether or not there was
 * anything to send, and each wake was a database query -- which never lets a
 * Neon compute reach the five quiet minutes it needs to scale to zero. The
 * worker is now idle until told there is work, and this is how it is told.
 *
 * Its own file, with no imports, for two reasons. notifications.ts promises
 * that nothing in it talks to a network or needs a provider, and importing the
 * worker to ring it would drag both in. And a script that imports
 * notifications.ts to render or queue something must not start a sender by
 * accident: with no listener registered, ringing the bell does nothing.
 *
 * Only server.ts registers one, and only when sending is switched on.
 */

let listener: (() => void) | null = null;

/** Called once, by the outbox worker when it starts. */
export function onNotificationQueued(fn: () => void): void {
  listener = fn;
}

/**
 * Called by queueNotification each time it writes a row.
 *
 * That write is inside a transaction which has not committed yet, and may
 * still roll back. This is a hint that something is probably coming, not a
 * promise that it is there -- the worker is built to look, find nothing, and
 * look once more.
 */
export function notificationQueued(): void {
  listener?.();
}
