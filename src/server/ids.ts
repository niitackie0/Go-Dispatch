/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'node:crypto';

/**
 * Opaque token for admin sessions and rider links.
 *
 * These are bearer credentials — a rider token alone advances an order's
 * state — so they come from the CSPRNG, never Math.random().
 */
export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

/**
 * Sessions store this, not the token itself, so a database leak cannot be
 * replayed as a login.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Customer-facing code, e.g. WP-4821-330. */
export function generateTrackingCode(): string {
  const num1 = crypto.randomInt(1000, 10000);
  const num2 = crypto.randomInt(100, 1000);
  return `WP-${num1}-${num2}`;
}

/** Prisma's unique-constraint violation. */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: string }).code === 'P2002'
  );
}

/**
 * Runs `create` with a fresh tracking code, retrying if the code is already
 * taken.
 *
 * The code space is ~8.1M, so by the birthday paradox collisions become likely
 * well before the business has that many orders. The unique index makes a
 * collision fail loudly instead of pointing two customers at one parcel; this
 * turns that failure into a retry.
 */
export async function withTrackingCode<T>(
  create: (trackingCode: string) => Promise<T>,
  attempts = 5
): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await create(generateTrackingCode());
    } catch (err) {
      if (isUniqueViolation(err) && i < attempts - 1) continue;
      throw err;
    }
  }
  throw new Error('Could not allocate a unique tracking code');
}
