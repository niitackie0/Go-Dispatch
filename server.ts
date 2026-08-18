/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dotenv/config';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { runAutomations } from './src/server/automations.js';
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

app.use(express.json());

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
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GO DISPATCH server listening on http://localhost:${PORT}`);
  });
}

startServer();
