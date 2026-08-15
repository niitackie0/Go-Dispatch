/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { asyncRouter } from '../http.js';
import { login, loginRateLimit, requireAdmin, revokeSession } from '../auth.js';

export const authRouter = asyncRouter();

authRouter.post('/login', loginRateLimit, async (req, res) => {
  const { email, password } = req.body ?? {};

  try {
    const result = await login(email, password);
    if (!result) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    res.json(result);
  } catch (err) {
    console.error('[auth] login failed', err);
    res.status(503).json({ error: 'Service temporarily unavailable' });
  }
});

authRouter.get('/me', requireAdmin, (req, res) => {
  res.json({ user: req.admin });
});

authRouter.post('/logout', async (req, res) => {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    await revokeSession(header.slice('Bearer '.length).trim());
  }
  res.json({ success: true });
});
