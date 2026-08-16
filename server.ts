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
import { adminsRouter } from './src/server/routes/admins.js';
import { authRouter } from './src/server/routes/auth.js';
import { ordersRouter } from './src/server/routes/orders.js';
import { paymentsRouter } from './src/server/routes/payments.js';
import { pricingRouter } from './src/server/routes/pricing.js';
import { bookingsRouter } from './src/server/routes/bookings.js';
import { reportsRouter } from './src/server/routes/reports.js';
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
app.use('/api/reports', reportsRouter);
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
