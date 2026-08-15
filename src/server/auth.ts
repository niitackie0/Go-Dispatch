/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { hash, verify } from '@node-rs/argon2';
import type { NextFunction, Request, Response } from 'express';
import type { AdminRole, AdminUser } from '../types.js';
import { hashToken, randomToken } from './ids.js';
import { prisma } from './prisma.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: AdminUser;
      /** Id of the session this request authenticated with. */
      sessionId?: string;
    }
  }
}

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Writing lastSeenAt on every request would be a write per API call. */
const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000;

export const MIN_PASSWORD_LENGTH = 12;

function toAdminUser(row: {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  createdAt: Date;
}): AdminUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    createdAt: row.createdAt.toISOString(),
  };
}

export interface RequestMeta {
  userAgent?: string;
  ipAddress?: string;
}

export function requestMeta(req: Request): RequestMeta {
  return {
    userAgent: req.headers['user-agent']?.slice(0, 400),
    ipAddress: req.ip,
  };
}

/**
 * Verifies credentials and opens a session.
 *
 * Returns null for both "no such account" and "wrong password" so the response
 * cannot be used to discover which admin emails exist.
 */
export async function login(
  email: unknown,
  password: unknown,
  meta: RequestMeta = {}
): Promise<{ token: string; user: AdminUser } | null> {
  if (typeof email !== 'string' || typeof password !== 'string') return null;

  const admin = await prisma.adminUser.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  if (!admin) return null;

  const ok = await verify(admin.passwordHash, password).catch(() => false);
  if (!ok) return null;

  // The raw token goes to the client; only its hash is persisted.
  const token = randomToken();
  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      adminUserId: admin.id,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      userAgent: meta.userAgent ?? null,
      ipAddress: meta.ipAddress ?? null,
    },
  });

  return { token, user: toAdminUser(admin) };
}

export async function revokeSession(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token || null;
}

/**
 * Resolves a bearer token to its admin, or null if it is unknown or expired.
 * Expired rows are deleted on encounter, which keeps the table tidy without a
 * separate cleanup job at this scale.
 */
async function resolveSession(
  token: string
): Promise<{ admin: AdminUser; sessionId: string } | null> {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { adminUser: true },
  });
  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  if (Date.now() - session.lastSeenAt.getTime() > LAST_SEEN_THROTTLE_MS) {
    await prisma.session
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
      .catch(() => {});
  }

  return { admin: toAdminUser(session.adminUser), sessionId: session.id };
}

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Unauthorized. Auth token missing' });
    return;
  }

  try {
    const resolved = await resolveSession(token);
    if (!resolved) {
      res.status(401).json({ error: 'Unauthorized. Invalid or expired token' });
      return;
    }
    req.admin = resolved.admin;
    req.sessionId = resolved.sessionId;
  } catch (err) {
    // Express 4 does not catch rejections from async middleware, so a database
    // blip here would otherwise take the process down.
    console.error('[auth] session lookup failed', err);
    res.status(503).json({ error: 'Service temporarily unavailable' });
    return;
  }

  next();
}

/* -------------------------------------------------------------------------
   Account self-service
   ------------------------------------------------------------------------- */

export type PasswordChangeFailure = 'wrong-password' | 'too-short' | 'same-password';

/**
 * Deliberately a flat shape rather than a discriminated union: tsconfig has no
 * `strict`, and without strictNullChecks TypeScript will not narrow one.
 */
export interface PasswordChangeResult {
  ok: boolean;
  reason?: PasswordChangeFailure;
  revokedSessions?: number;
}

/**
 * Changes the signed-in user's own password.
 *
 * Requires the current password even though the caller already holds a valid
 * session: it is what stops someone who walked up to an unlocked laptop from
 * silently taking the account over.
 *
 * Every other session is revoked on success — if the reason for changing it was
 * that someone else knows it, leaving their session alive defeats the point.
 */
export async function changeOwnPassword(
  adminId: string,
  currentSessionId: string,
  currentPassword: unknown,
  newPassword: unknown
): Promise<PasswordChangeResult> {
  if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, reason: 'too-short' };
  }
  if (typeof currentPassword !== 'string') {
    return { ok: false, reason: 'wrong-password' };
  }
  if (currentPassword === newPassword) {
    return { ok: false, reason: 'same-password' };
  }

  const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });
  if (!admin) return { ok: false, reason: 'wrong-password' };

  const ok = await verify(admin.passwordHash, currentPassword).catch(() => false);
  if (!ok) return { ok: false, reason: 'wrong-password' };

  const passwordHash = await hash(newPassword);

  const [, revoked] = await prisma.$transaction([
    prisma.adminUser.update({ where: { id: adminId }, data: { passwordHash } }),
    prisma.session.deleteMany({
      where: { adminUserId: adminId, id: { not: currentSessionId } },
    }),
  ]);

  return { ok: true, revokedSessions: revoked.count };
}

export interface SessionSummary {
  id: string;
  current: boolean;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
}

export async function listSessions(
  adminId: string,
  currentSessionId: string
): Promise<SessionSummary[]> {
  const sessions = await prisma.session.findMany({
    where: { adminUserId: adminId, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: 'desc' },
  });

  return sessions.map((s) => ({
    id: s.id,
    current: s.id === currentSessionId,
    userAgent: s.userAgent,
    ipAddress: s.ipAddress,
    createdAt: s.createdAt.toISOString(),
    lastSeenAt: s.lastSeenAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
  }));
}

/** Signs the account out everywhere except the session making the request. */
export async function revokeOtherSessions(
  adminId: string,
  currentSessionId: string
): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: { adminUserId: adminId, id: { not: currentSessionId } },
  });
  return result.count;
}

/** Revokes one specific session, but only if it belongs to this account. */
export async function revokeSessionById(
  adminId: string,
  sessionId: string
): Promise<boolean> {
  const result = await prisma.session.deleteMany({
    where: { id: sessionId, adminUserId: adminId },
  });
  return result.count > 0;
}

/* -------------------------------------------------------------------------
   Login rate limiting
   ------------------------------------------------------------------------- */

/**
 * Fixed-window rate limit on login attempts, keyed by client IP.
 *
 * In-memory is adequate here: this runs as a single instance, and the limit is
 * a brute-force speed bump rather than a security boundary.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attempts = new Map<string, { count: number; resetAt: number }>();

export function loginRateLimit(req: Request, res: Response, next: NextFunction): void {
  const key = req.ip ?? 'unknown';
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    next();
    return;
  }

  if (entry.count >= MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    res.set('Retry-After', String(retryAfter));
    res.status(429).json({ error: 'Too many login attempts. Try again later.' });
    return;
  }

  entry.count += 1;
  next();
}
