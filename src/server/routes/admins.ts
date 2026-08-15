/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { hash } from '@node-rs/argon2';
import { ADMIN_ROLES, type AdminRole, type AdminUser } from '../../types.js';
import { requireAdmin } from '../auth.js';
import { asyncRouter } from '../http.js';
import { requirePermission } from '../permissions.js';
import { prisma } from '../prisma.js';

export const adminsRouter = asyncRouter();

const MIN_PASSWORD_LENGTH = 12;

function serializeAdmin(row: {
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

const SELECT = { id: true, name: true, email: true, role: true, createdAt: true } as const;

/** Prisma's unique-constraint violation, i.e. the email is taken. */
function isDuplicate(err: unknown): boolean {
  return (err as { code?: string })?.code === 'P2002';
}

async function ownerCount(): Promise<number> {
  return prisma.adminUser.count({ where: { role: 'owner' } });
}

adminsRouter.get('/', requireAdmin, requirePermission('staff:manage'), async (_req, res) => {
  const admins = await prisma.adminUser.findMany({
    select: SELECT,
    orderBy: { createdAt: 'asc' },
  });
  res.json(admins.map(serializeAdmin));
});

adminsRouter.post('/', requireAdmin, requirePermission('staff:manage'), async (req, res) => {
  const { name, email, password, role } = req.body ?? {};

  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }
  if (typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'A valid email is required' });
  }
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return res
      .status(400)
      .json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
  }
  if (!ADMIN_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Unknown role' });
  }

  try {
    const created = await prisma.adminUser.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
        passwordHash: await hash(password),
      },
      select: SELECT,
    });
    res.status(201).json(serializeAdmin(created));
  } catch (err) {
    if (isDuplicate(err)) {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }
    throw err;
  }
});

adminsRouter.patch('/:id', requireAdmin, requirePermission('staff:manage'), async (req, res) => {
  const { name, role, password } = req.body ?? {};
  const actor = req.admin!;

  const target = await prisma.adminUser.findUnique({ where: { id: req.params.id } });
  if (!target) {
    return res.status(404).json({ error: 'Account not found' });
  }

  const data: { name?: string; role?: AdminRole; passwordHash?: string } = {};

  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Name cannot be empty' });
    }
    data.name = name.trim();
  }

  if (password !== undefined) {
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      return res
        .status(400)
        .json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }
    data.passwordHash = await hash(password);
  }

  if (role !== undefined && role !== target.role) {
    if (!ADMIN_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Unknown role' });
    }
    // Demoting the last owner would leave nobody able to manage staff or
    // pricing, and no way back in short of editing the database by hand.
    if (target.role === 'owner' && (await ownerCount()) <= 1) {
      return res.status(409).json({ error: 'The last owner cannot be demoted' });
    }
    if (target.id === actor.id && role !== 'owner') {
      return res.status(409).json({ error: 'You cannot remove your own owner access' });
    }
    data.role = role;
  }

  const updated = await prisma.adminUser.update({
    where: { id: target.id },
    data,
    select: SELECT,
  });

  res.json(serializeAdmin(updated));
});

adminsRouter.delete('/:id', requireAdmin, requirePermission('staff:manage'), async (req, res) => {
  const actor = req.admin!;

  const target = await prisma.adminUser.findUnique({ where: { id: req.params.id } });
  if (!target) {
    return res.status(404).json({ error: 'Account not found' });
  }
  if (target.id === actor.id) {
    return res.status(409).json({ error: 'You cannot delete your own account' });
  }
  if (target.role === 'owner' && (await ownerCount()) <= 1) {
    return res.status(409).json({ error: 'The last owner cannot be deleted' });
  }

  // Sessions cascade, so a removed account is signed out everywhere at once.
  await prisma.adminUser.delete({ where: { id: target.id } });

  res.json({ success: true });
});
