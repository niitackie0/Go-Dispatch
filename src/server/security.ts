/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NextFunction, Request, Response } from 'express';

/**
 * Response headers that close the browser-side holes.
 *
 * Written out rather than pulled from helmet: it is nine headers, we want to
 * know what every one of them does, and a dependency that runs on every
 * request is a dependency worth not having when the alternative is this file.
 *
 * HSTS is deliberately not set in development. Once a browser has seen it for
 * localhost it refuses plain HTTP there for the max-age — which is a very
 * confusing afternoon.
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Do not let the browser guess a type we did not send. Stops a text file
  // being executed because it happened to start with something script-shaped.
  res.set('X-Content-Type-Options', 'nosniff');

  // Nothing here is meant to be framed. Clickjacking a status button that
  // marks a parcel delivered is a small attack with a real cost.
  res.set('X-Frame-Options', 'DENY');

  // Send the origin to other sites, never the path. Tracking URLs and the
  // console's own address should not travel in a Referer header.
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // We ask for none of these. Saying so explicitly means an injected script
  // cannot either.
  res.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');

  // Cross-origin reads of our JSON are nobody's business.
  res.set('Cross-Origin-Resource-Policy', 'same-origin');

  if (process.env.NODE_ENV === 'production') {
    res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
}

/**
 * How many proxies sit in front of us.
 *
 * Express reads req.ip from X-Forwarded-For, which is a header the client can
 * write. Trusting it when nothing is in front of us lets anyone claim any
 * address and walk straight through every rate limit; not trusting it when a
 * proxy IS in front puts every visitor in one bucket, so the first person to
 * mistype a password locks out the rest.
 *
 * So it is neither on nor off by default — it is declared. Set TRUST_PROXY to
 * the number of hops your host adds (Render and Fly are 1) when you deploy.
 */
export function trustProxyHops(): number | false {
  const raw = process.env.TRUST_PROXY?.trim();
  if (!raw) return false;

  const hops = Number(raw);
  if (!Number.isInteger(hops) || hops < 0) {
    console.warn(`[security] TRUST_PROXY="${raw}" is not a hop count — ignoring it, req.ip will be the socket address`);
    return false;
  }
  return hops;
}
