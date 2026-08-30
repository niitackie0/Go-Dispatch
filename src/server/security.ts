/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NextFunction, Request, Response } from 'express';
import { PUBLIC_ORIGIN } from '../brand.js';

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
    res.set('Content-Security-Policy', CSP);
  }

  next();
}

/**
 * What this page is allowed to load, and from where.
 *
 * Written from what the built output actually asks for rather than from a
 * template, because a policy loose enough to never break is a policy that
 * stops nothing:
 *
 *   script-src 'self'        Vite emits two module scripts and no inline ones,
 *                            so this needs no 'unsafe-inline' and no nonce --
 *                            which is the whole value of having a CSP. An
 *                            injected <script> has nowhere to run.
 *
 *   style-src 'unsafe-inline'  Reluctantly. React writes style attributes
 *                            (animation delays, the header gradient) and CSP
 *                            treats those as inline styles. Injected CSS can
 *                            deface a page; it cannot read a session or call
 *                            an endpoint, so this is the cheap half of the
 *                            trade and script-src is the expensive one.
 *
 *   fonts.googleapis.com     src/index.css imports Inter and JetBrains Mono.
 *   fonts.gstatic.com        The stylesheet comes from the first host and the
 *                            font files from the second; both are needed or
 *                            the page silently falls back to system fonts.
 *
 *   img-src data:            The favicon is an inline SVG data URI.
 *
 *   connect-src 'self'       Every fetch in this app is same-origin. If that
 *                            ever stops being true, this line is the one that
 *                            will say so, loudly, in the console.
 *
 * Development is exempt: Vite injects inline scripts and opens a websocket for
 * hot reload, and a policy that has to allow those is not the policy running in
 * production anyway.
 */
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
].join('; ');

/**
 * One address, not two.
 *
 * Adding godispatchgh.com to Render does not take go-dispatch.onrender.com
 * away — both keep answering, with the same site, on the same certificate.
 * That is two live copies of a shop, and it costs three separate things:
 * Google indexes whichever it finds first and splits the ranking across both,
 * a customer who bookmarked the old one never sees the new one, and an SMS
 * that says godispatchgh.com is not obviously the same business as the tab
 * somebody already has open.
 *
 * So the old address stops serving and starts pointing. 301 rather than 302,
 * because this is permanent and a permanent redirect is the only one search
 * engines transfer ranking through.
 *
 * TWO THINGS THIS DELIBERATELY DOES NOT DO:
 *
 *  - It does not touch /api/health. Render polls that endpoint on the
 *    onrender host to decide whether this instance is alive, and a 301 is not
 *    a 200 — redirecting it would mark a perfectly healthy service unhealthy
 *    and roll the deploy back. This is the whole reason the path check is
 *    here rather than the middleware simply being registered later, where a
 *    reorder could silently undo it.
 *
 *  - It only ever redirects away from `.onrender.com`. Not "any host that is
 *    not canonical" — that reads as tidier and is a trap: Render's internal
 *    health probes, an IP-based request and anything else unforeseen would be
 *    bounced too. The old public address is a known, finite thing, so name it.
 */
export function canonicalHost(req: Request, res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV !== 'production') return next();
  if (req.path === '/api/health') return next();

  // req.hostname strips any :port and, with trust proxy set, reads
  // X-Forwarded-Host — which is the name the customer actually typed.
  if (!req.hostname.toLowerCase().endsWith('.onrender.com')) return next();

  res.redirect(301, `${PUBLIC_ORIGIN}${req.originalUrl}`);
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
