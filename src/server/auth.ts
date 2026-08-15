/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { verify } from '@node-rs/argon2';
import type { NextFunction, Request, Response } from 'express';
import type { AdminRole, AdminUser } from '../types.js';
import { hashToken, randomToken } from './ids.js';
import { prisma } from './prisma.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: AdminUser;
    }
  }
}

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

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

/**
 * Verifies credentials and opens a session.
 *
 * Returns null for both "no such account" and "wrong password" so the response
 * cannot be used to discover which admin emails exist.
 */
export async function login(
  email: unknown,
  password: unknown
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
async function resolveSession(token: string): Promise<AdminUser | null> {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { adminUser: true },
  });
  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return toAdminUser(session.adminUser);
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
    const admin = await resolveSession(token);
    if (!admin) {
      res.status(401).json({ error: 'Unauthorized. Invalid or expired token' });
      return;
    }
    req.admin = admin;
  } catch (err) {
    // Express 4 does not catch rejections from async middleware, so a database
    // blip here would otherwise take the process down.
    console.error('[auth] session lookup failed', err);
    res.status(503).json({ error: 'Service temporarily unavailable' });
    return;
  }

  next();
}

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
