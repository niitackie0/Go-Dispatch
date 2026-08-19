/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NextFunction, Request, Response } from 'express';

/**
 * Fixed-window rate limiting, keyed by client IP.
 *
 * The login limiter in auth.ts wrote this pattern first; this is the same idea
 * made reusable, because the public endpoints need it more than login does.
 * Login only guards a password. These guard things that cost money or hand out
 * customer records:
 *
 *   - booking creation writes rows AND queues an SMS we are billed for
 *   - tracking answers with a customer's name, addresses and history
 *
 * In-memory is adequate at this scale: one instance, one process. It is a
 * speed bump, not a security boundary — the boundary is that the data behind
 * these endpoints is no longer worth stealing at scale.
 *
 * NOTE ON req.ip: behind a proxy this is the PROXY's address unless Express is
 * told to trust it, which would make every visitor share one bucket. server.ts
 * sets `trust proxy` from the environment for exactly this reason. Trusting it
 * blindly is worse than not trusting it at all — X-Forwarded-For is a client
 * header, and a spoofed one turns every limiter here into a no-op.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  /** Length of the window. */
  windowMs: number;
  /** How many requests one address may make within it. */
  max: number;
  /** Shown to the caller. Say what they hit, not that they are suspicious. */
  message: string;
}

/**
 * Buckets are swept lazily rather than on a timer: an expired entry is
 * rewritten on the owner's next request, and the periodic sweep below stops
 * addresses that never come back from accumulating forever.
 */
const SWEEP_EVERY_MS = 10 * 60 * 1000;

export function rateLimit({ windowMs, max, message }: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, SWEEP_EVERY_MS);
  // Never hold the process open for a cleanup timer.
  sweep.unref?.();

  return function limiter(req: Request, res: Response, next: NextFunction): void {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (bucket.count >= max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      res.status(429).json({ error: message });
      return;
    }

    bucket.count += 1;
    next();
  };
}

/**
 * Public reads: tracking lookups and booking references.
 *
 * Generous enough that a customer refreshing a tracking page never meets it,
 * tight enough that walking the code space stops being practical. A tracking
 * code is GD-NNNN-NNN — about 8.1 million of them — which sounds like a lot
 * until you divide it by an unlimited request rate.
 */
export const publicReadLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Too many lookups. Wait a minute and try again.',
});

/**
 * Public writes: booking.
 *
 * Ten bookings an hour from one address is far more than a real sender makes
 * and far less than a script needs to be worth writing. This one also guards
 * the SMS balance, since every booking queues a message we pay to send.
 */
/**
 * Cancelling, which is a write but not a booking.
 *
 * Its own bucket rather than sharing publicWriteLimit: mistyping the phone
 * number three times must not use up the allowance somebody needs to make a
 * booking afterwards. Twenty an hour is far more than one person cancelling
 * a parcel and far less than useful for guessing at phone numbers.
 */
export const publicActionLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: 'Too many attempts. Wait a while, or call 054 030 4994.',
});

export const publicWriteLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'That is a lot of bookings from one place. Please call 054 030 4994.',
});
