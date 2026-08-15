/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { asyncRouter } from '../http.js';
import {
  changeOwnPassword,
  listSessions,
  login,
  loginRateLimit,
  MIN_PASSWORD_LENGTH,
  requestMeta,
  requireAdmin,
  revokeOtherSessions,
  revokeSession,
  revokeSessionById,
} from '../auth.js';

export const authRouter = asyncRouter();

authRouter.post('/login', loginRateLimit, async (req, res) => {
  const { email, password } = req.body ?? {};

  try {
    const result = await login(email, password, requestMeta(req));
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

/** Change your own password. Signs out every other device on success. */
authRouter.post('/password', requireAdmin, async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};

  const result = await changeOwnPassword(
    req.admin!.id,
    req.sessionId!,
    currentPassword,
    newPassword
  );

  if (result.ok) {
    return res.json({ success: true, revokedSessions: result.revokedSessions });
  }

  const messages: Record<string, string> = {
    'wrong-password': 'Your current password is not correct',
    'too-short': `New password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    'same-password': 'The new password must be different from the current one',
  };

  // 400 rather than 401: the session is valid, the supplied password is not.
  res.status(400).json({
    error: messages[result.reason ?? ''] ?? 'Could not change password',
  });
});

/** Where this account is currently signed in. */
authRouter.get('/sessions', requireAdmin, async (req, res) => {
  res.json(await listSessions(req.admin!.id, req.sessionId!));
});

/** Sign out everywhere except here. */
authRouter.delete('/sessions', requireAdmin, async (req, res) => {
  const count = await revokeOtherSessions(req.admin!.id, req.sessionId!);
  res.json({ success: true, revokedSessions: count });
});

authRouter.delete('/sessions/:id', requireAdmin, async (req, res) => {
  if (req.params.id === req.sessionId) {
    return res
      .status(400)
      .json({ error: 'Use logout to end the session you are currently using' });
  }

  // Scoped to the caller's own sessions, so an id from another account is a 404
  // rather than a way to sign other people out.
  const revoked = await revokeSessionById(req.admin!.id, req.params.id);
  if (!revoked) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.json({ success: true });
});
