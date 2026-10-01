/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dotenv/config';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { prisma } from './src/server/prisma.js';
import { canonicalHost, securityHeaders, trustProxyHops } from './src/server/security.js';
import { catchProcessFailures, report, requestId } from './src/server/errors.js';
import { drainOutbox, outboxSummary } from './src/server/outbox.js';
import { startOutboxWorker } from './src/server/outboxWorker.js';
import { smsEnabled, smsProviderName } from './src/server/smsProvider.js';
import { adminsRouter } from './src/server/routes/admins.js';
import { authRouter } from './src/server/routes/auth.js';
import { ordersRouter } from './src/server/routes/orders.js';
import { paymentsRouter } from './src/server/routes/payments.js';
import { pricingRouter } from './src/server/routes/pricing.js';
import { bookingsRouter } from './src/server/routes/bookings.js';
import { riderRouter } from './src/server/routes/rider.js';
import { ridersRouter } from './src/server/routes/riders.js';
import { statsRouter } from './src/server/routes/stats.js';

// Registered before the app exists, because a failure during start-up is
// exactly as worth hearing about as one during a request.
catchProcessFailures();

const app = express();

/**
 * The port is the host's to choose.
 *
 * Render, Fly and every other platform hand it over in the environment and
 * expect the process to bind to exactly that one -- a hardcoded 3000 gets the
 * service marked unhealthy and rolled back, having never received a request.
 * 3000 stays as the local default.
 */
const PORT = Number(process.env.PORT) || 3000;

/**
 * Where the operations console lives.
 *
 * Not a secret -- the console is protected by a password, not by its address --
 * but /admin is the first thing any scanner tries, and there is no reason to
 * hand it a login form to hammer. Set ADMIN_PATH in .env to move it.
 */
const ADMIN_PATH = process.env.ADMIN_PATH || '/ops';

/**
 * Whether X-Forwarded-For can be believed. Off unless declared -- see
 * src/server/security.ts for why neither default is safe to assume.
 */
const proxyHops = trustProxyHops();
if (proxyHops === false) {
  app.disable('trust proxy');
} else {
  app.set('trust proxy', proxyHops);
}

// Express announces itself on every response by default. It tells an attacker
// which CVE list to read and tells a customer nothing.
app.disable('x-powered-by');

app.use(requestId);
app.use(securityHeaders);

// go-dispatch.onrender.com sends visitors to godispatchgh.com and stops being
// a second copy of the site. Registered here, ahead of everything, but it
// exempts /api/health itself -- see the note in security.ts for why that
// exemption cannot be left to registration order.
app.use(canonicalHost);

// A body limit, said out loud. Express defaults to 100kb; the largest thing
// anyone legitimately posts here is a twenty-parcel booking, which is nowhere
// near it.
app.use(express.json({ limit: '64kb' }));

/**
 * Health check.
 *
 * Answers only if the database answers the questions this app actually asks.
 *
 * This was `SELECT 1` until now, and on 30 August that cost us days. The
 * bus-model migrations had been applied to production from a laptop --
 * `orders.riderId` renamed to `collectionRiderId`, statuses rewritten --
 * while the deployed code still selected the old columns. Every endpoint that
 * touched an order returned 500. This endpoint returned a cheerful 200
 * throughout, and it was not lying: Postgres was in perfect health. What had
 * broken was the agreement between the schema and the client, and a literal
 * asks about neither.
 *
 * So it now reads one real row from each of the three tables whose loss or
 * corruption ends the business. Going through the generated client is the
 * point -- it proves three things `SELECT 1` cannot:
 *
 *   - the connection works, which is all the literal ever proved
 *   - every column the client selects still exists on the table, which is
 *     exactly what went wrong in August
 *   - this role is permitted to read it, which is what will go wrong the day
 *     the app is switched off `neondb_owner` onto the limited role
 *
 * Empty tables still prove the first two. Postgres validates the column list
 * when it plans the query, whether or not a row comes back.
 *
 * The cost is three `LIMIT 1` reads on indexed tables. That is a small bill
 * for never again serving 500s from behind a green light -- but it must not
 * be a STANDING one, and until 1 October it was.
 *
 * Render probes this path repeatedly for as long as the instance is up, and
 * each probe ran the three reads. A Neon compute scales to zero only after 5
 * minutes with no queries, so the probe alone held the database awake for
 * every minute the web process was -- the same bill as the automation tick
 * described further down, sent by the host instead of by a timer.
 *
 * Two rules now decide whether a probe is allowed to reach the database:
 *
 *   - An answer is good for HEALTH_FRESH_MS. Probes inside that window get the
 *     remembered answer, so a database that breaks while the site is in use
 *     still turns this red within a minute.
 *   - A healthy answer is only re-checked if the API has served somebody since
 *     it was given. The thing this check exists to catch is requests failing
 *     behind a green light; with no requests there is nothing to fail, and
 *     asking anyway is exactly the query that stops the compute sleeping. The
 *     first probe after the next real request checks again.
 *
 * A failing answer is the exception: it is re-checked every window whether or
 * not anyone is being served, because a red light that stays red after the
 * fault has healed gets a healthy instance restarted.
 *
 * The first probe after boot always asks. That is the August case -- a deploy
 * whose client disagrees with the schema -- and it is still caught before the
 * new instance takes traffic.
 */
const HEALTH_FRESH_MS = 60 * 1000;

let lastHealth: { ok: boolean; at: number } | null = null;
let healthInFlight: Promise<boolean> | null = null;
let servedSinceHealthCheck = false;

// Registered ahead of the routers so every API request is seen, including the
// ones that go on to fail. Static files do not count: a bot fetching the
// homepage has asked the database nothing.
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api/') && req.path !== '/api/health') {
    servedSinceHealthCheck = true;
  }
  next();
});

/** The real check. Shared while in flight, so a burst of probes costs one. */
function checkDatabase(): Promise<boolean> {
  if (healthInFlight) return healthInFlight;

  servedSinceHealthCheck = false;
  // No `select`, deliberately. Naming columns here would narrow the query to
  // the few we listed and reintroduce the blind spot -- the check works
  // precisely because the client asks for everything it believes is there.
  healthInFlight = Promise.all([
    prisma.order.findFirst(),
    prisma.payment.findFirst(),
    prisma.adminUser.findFirst(),
  ])
    .then(() => true)
    .catch((err) => {
      // Reported, not merely logged: the database being unreachable -- or the
      // schema having moved out from under the code -- is the one failure where
      // somebody should be told before a customer notices.
      report(err, { at: 'health' });
      return false;
    })
    .then((ok) => {
      lastHealth = { ok, at: Date.now() };
      healthInFlight = null;
      return ok;
    });

  return healthInFlight;
}

app.get('/api/health', async (_req, res) => {
  const last = lastHealth;
  const stale = !last || Date.now() - last.at >= HEALTH_FRESH_MS;
  const worthAsking = !last || !last.ok || servedSinceHealthCheck;

  const ok = !last || (stale && worthAsking) ? await checkDatabase() : last.ok;

  if (ok) {
    res.json({ ok: true });
    return;
  }
  // Vague on purpose. This is the most reachable thing we serve: public, and
  // exempt from the canonical-host redirect so Render can probe it. Column
  // names and role names go to the error feed with a reference, not to
  // whoever happened to ask.
  res.status(503).json({ ok: false, error: 'Database check failed' });
});

// API
app.use('/api/auth', authRouter);
app.use('/api/admins', adminsRouter);
app.use('/api/pricing', pricingRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/riders', ridersRouter);
app.use('/api/rider', riderRouter);

/**
 * An unknown /api path is a 404 in JSON.
 *
 * Without this it falls through to the SPA catch-all at the bottom of the
 * file and answers 200 with index.html -- so a typo'd endpoint looks like a
 * success to whoever called it, `res.ok` is true, and the failure surfaces
 * later as a JSON parse error on "<!doctype html". Registered after every
 * router and before the error handler, which is the only place it works.
 */
app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

/**
 * Anything a route handler threw or rejected with lands here.
 *
 * The stack stays in the log; the caller gets a sentence and a reference. The
 * reference is the useful half — it is what lets somebody ringing the office
 * about "an error" be matched to the line that explains it, instead of both
 * sides guessing.
 */
app.use('/api', (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const ref = (req as Request & { id?: string }).id;
  report(err, { at: 'api', ref, method: req.method, path: req.originalUrl });

  if (!res.headersSent) {
    res.status(500).json({ error: 'Something went wrong', reference: ref });
  }
});

/**
 * THE AUTOMATION TICK IS GONE. It ran the rules every 60 seconds inside this
 * process; it was removed on 20 September because it spent the month's
 * database.
 *
 * Neon's free plan allows 100 CU-hours per project and suspends the compute
 * for the rest of the billing period once they are gone, and a compute only
 * scales to zero after 5 minutes with no queries -- which a query every minute
 * never permits. So the tick did not cost a minute of compute per minute of
 * work. It cost every minute this process was alive, on either machine: .env
 * points a laptop at the same endpoint production uses, so every `npm run dev`
 * session held the same compute open too. The month ran out mid-month.
 *
 * The rules themselves did not move. runAutomations() is called directly by
 * routes/bookings.ts, routes/orders.ts and routes/rider.ts, immediately after
 * the write that should trigger it -- a booking is still accepted, a courier
 * still assigned, a rider still released, at the moment the thing happens. The
 * interval only ever added the half that is purely about the clock.
 *
 * That half now rides on the console. routes/orders.ts sweeps the rules on
 * every admin board read, throttled to one pass per 20 seconds, and the
 * console refreshes itself every 30 while somebody is using it -- so while the
 * office is at the board, the clock-driven rules run about as often as the
 * timer ran them, on requests that were already holding the database awake.
 * Nothing is added to the bill.
 *
 * "Using it" is narrower than "open", since 1 October. The refresh stops when
 * the tab is hidden or nobody has touched the console for five minutes
 * (src/hooks/useLiveRefresh.ts), because a tab left open on the office PC was
 * doing overnight exactly what the timer had done. The first movement on
 * coming back reads the board, and that read runs the rules.
 *
 * When the console is shut or unattended, nothing runs. A pickup window that
 * opens overnight is queued by the first thing that happens in the morning --
 * which is what a free instance, asleep since 15 minutes after the last
 * request, was already going to give. If that ever stops being good enough, the answer is a cron
 * calling one endpoint, the shape .github/workflows/backup.yml already uses,
 * and not a timer inside a process that is billed for staying awake.
 */

/**
 * Outbox worker — sends the notifications the rules queued.
 *
 * Separate from the automation pass on purpose: automation only ever touches
 * our own database, while this talks to a paid third party and sends things to
 * customers that cannot be unsent. It stays dormant until SMS_PROVIDER is set
 * in .env.
 *
 * It was a 30-second setInterval until 1 October, and it is not one now for
 * the reason the automation tick is gone: it queried the database on every
 * tick, with an empty outbox as readily as a full one, and so never let the
 * compute sleep. The worker drains once at boot, again whenever a message is
 * queued, and otherwise only while something is still waiting to go --
 * src/server/outboxWorker.ts has the detail. Idle, it holds no timer.
 *
 * NOT ON A LAPTOP, unless asked. `.env` on a development machine has carried
 * the production database and a live provider key, which made every
 * `npm run dev` a second sender working the same outbox as production -- two
 * processes, each with a one-at-a-time guard that cannot see the other, and
 * real customers at the far end. Outside production the worker therefore
 * needs SMS_SEND_IN_DEV=1 said out loud. This gates the automatic worker
 * only: `npm run sms:outbox -- --send` is somebody deciding to send, and
 * still works.
 */
const isProduction = process.env.NODE_ENV === 'production';
const sendingAllowedHere = isProduction || process.env.SMS_SEND_IN_DEV === '1';

if (smsEnabled() && sendingAllowedHere) {
  outboxSummary()
    .then((summary) => console.log(`[outbox] sending is ON via ${smsProviderName()} — ${summary}`))
    .catch(() => {});

  if (!isProduction) {
    console.warn(
      '[outbox] WARNING: this is not production and SMS_SEND_IN_DEV=1 is set. ' +
        'Messages queued in the database this process is connected to WILL be sent to real phones.'
    );
  }

  startOutboxWorker({
    drain: () => drainOutbox(),
    onError: (err) => report(err, { at: 'outbox' }),
    onDrained: (r) => {
      console.log(`[outbox] sent ${r.sent}, retrying ${r.retrying}, failed ${r.failed}`);
    },
  });
} else if (smsEnabled()) {
  console.warn(
    '[outbox] sending is OFF in this process: SMS_PROVIDER is set but NODE_ENV is not production. ' +
      'Messages still queue. If DATABASE_URL here is the production database, production will send them. ' +
      'Set SMS_SEND_IN_DEV=1 to send from this machine.'
  );
} else {
  console.log('[outbox] sending is OFF. Messages queue up; set SMS_PROVIDER in .env to send them.');
}

// VITE MIDDLEWARE INTERACTION (For dev environment) OR STATIC SERVE (For prod)
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    // Vite's dev server resolves a URL to any HTML file sitting at the project
    // root, so /admin and /admin.html both reach the console however ADMIN_PATH
    // is set. Blocked here so development matches production, where the same
    // two addresses are refused.
    app.use((req, res, next) => {
      const requested = req.path.toLowerCase().replace(/\/$/, '');
      const isEntryByFilename = requested === '/admin.html' || requested === '/index.html';
      const isOldAdminPath = requested === '/admin' && ADMIN_PATH.toLowerCase() !== '/admin';
      if (isEntryByFilename || isOldAdminPath) {
        res.status(404).send('Not found');
        return;
      }
      next();
    });

    // Registered before vite's middleware, whose SPA fallback would otherwise
    // answer this path with the customer app.
    app.get(ADMIN_PATH, async (req, res, next) => {
      try {
        const template = await fs.promises.readFile(path.resolve('admin.html'), 'utf-8');
        const html = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html', 'X-Robots-Tag': 'noindex, nofollow' }).end(html);
      } catch (err) {
        vite.ssrFixStacktrace(err as Error);
        next(err);
      }
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');

    // The console is reachable at ADMIN_PATH and nowhere else. Without this,
    // express.static would happily serve the same page at /admin.html, and
    // moving the path would have bought nothing.
    //
    // /admin needs its own refusal for a different reason: it is not a file,
    // so static never sees it, and the SPA catch-all at the bottom would hand
    // back the customer site with a 200. That is not an exposure -- the
    // console bundle is not in that page -- but development 404s this path,
    // and a guard that behaves differently in the environment that matters is
    // not a guard.
    // Conditional, because ADMIN_PATH is allowed to BE /admin. Refusing it
    // unconditionally would register ahead of the console's own route below
    // and lock the operator out of their own console.
    const refuse = ['/admin.html'];
    if (ADMIN_PATH.toLowerCase() !== '/admin') refuse.push('/admin');

    app.get(refuse, (_req, res) => {
      res.status(404).send('Not found');
    });

    app.get(ADMIN_PATH, (_req, res) => {
      res.set('X-Robots-Tag', 'noindex, nofollow').sendFile(path.join(distPath, 'admin.html'));
    });

    app.use(express.static(distPath, { index: false }));

    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    if (process.env.NODE_ENV === 'production') {
      console.log(`GO DISPATCH listening on :${PORT} — console at ${ADMIN_PATH}`);
    } else {
      console.log(`GO DISPATCH server listening on http://localhost:${PORT}`);
      console.log(`  customer site  http://localhost:${PORT}/`);
      console.log(`  console        http://localhost:${PORT}${ADMIN_PATH}`);
    }
  });
}

startServer();
