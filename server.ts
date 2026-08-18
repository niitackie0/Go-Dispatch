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
import { runAutomations } from './src/server/automations.js';
import { prisma } from './src/server/prisma.js';
import { securityHeaders, trustProxyHops } from './src/server/security.js';
import { drainOutbox, outboxSummary } from './src/server/outbox.js';
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

const app = express();
const PORT = 3000;

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

app.use(securityHeaders);

// A body limit, said out loud. Express defaults to 100kb; the largest thing
// anyone legitimately posts here is a twenty-parcel booking, which is nowhere
// near it.
app.use(express.json({ limit: '64kb' }));

/**
 * Health check.
 *
 * Answers only if the database answers. A health check that returns 200 while
 * Postgres is unreachable will keep a broken instance in the load balancer and
 * tell the uptime monitor everything is fine, which is worse than having none.
 *
 * The query is a literal with nothing interpolated into it -- the one piece of
 * raw SQL in the codebase, and it stays that way.
 */
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch (err) {
    console.error('[health] database unreachable', err);
    res.status(503).json({ ok: false, error: 'Database unreachable' });
  }
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

// Anything a route handler threw or rejected with lands here. Details stay in
// the log; the client gets a generic message rather than a stack trace.
app.use('/api', (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[api] unhandled error', err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

/**
 * Automation tick — runs the rules on a timer so time-based transitions
 * (e.g. auto-queueing when a pickup window opens) happen on their own,
 * without waiting for someone to click something in the dashboard.
 */
const AUTOMATION_TICK_MS = 60 * 1000;
setInterval(() => {
  runAutomations()
    .then((actions) => {
      if (actions.length > 0) {
        console.log(`[automation] ${actions.length} action(s):`, actions.join(' | '));
      }
    })
    .catch((err) => console.error('[automation] tick failed', err));
}, AUTOMATION_TICK_MS);

/**
 * Outbox tick — sends the notifications the rules queued.
 *
 * Separate from the automation tick on purpose: automation only ever touches
 * our own database and can safely run every minute forever, while this one
 * talks to a paid third party and sends things to customers that cannot be
 * unsent. It stays dormant until SMS_PROVIDER is set in .env.
 */
const OUTBOX_TICK_MS = 30 * 1000;
if (smsEnabled()) {
  outboxSummary()
    .then((summary) => console.log(`[outbox] sending is ON via ${smsProviderName()} — ${summary}`))
    .catch(() => {});

  setInterval(() => {
    drainOutbox()
      .then((r) => {
        if (r.sent || r.failed || r.retrying) {
          console.log(`[outbox] sent ${r.sent}, retrying ${r.retrying}, failed ${r.failed}`);
        }
      })
      .catch((err) => console.error('[outbox] drain failed', err));
  }, OUTBOX_TICK_MS);
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
    app.get('/admin.html', (_req, res) => {
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
    console.log(`GO DISPATCH server listening on http://localhost:${PORT}`);
    console.log(`  customer site  http://localhost:${PORT}/`);
    console.log(`  console        http://localhost:${PORT}${ADMIN_PATH}`);
  });
}

startServer();
