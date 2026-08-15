/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NextFunction, Request, Response } from 'express';
import type { AdminRole } from '../types.js';

/**
 * What a role is allowed to do.
 *
 * The whole authorisation model is this one table. Scattering role checks
 * through handlers is how systems end up with an endpoint nobody remembered to
 * guard — here, an unlisted capability is denied by construction.
 */
export type Capability =
  | 'orders:read'
  | 'orders:write'
  | 'payments:read'
  | 'payments:write'
  | 'pricing:write'
  | 'riders:read'
  | 'revenue:read'
  | 'staff:manage';

const CAPABILITIES: Record<AdminRole, readonly Capability[]> = {
  owner: [
    'orders:read',
    'orders:write',
    'payments:read',
    'payments:write',
    'pricing:write',
    'riders:read',
    'revenue:read',
    'staff:manage',
  ],
  // Runs the road operation: dispatch and fleet, but no money and no pricing.
  dispatcher: ['orders:read', 'orders:write', 'riders:read'],
  // Reconciles money. Can read orders for context but cannot dispatch them.
  finance: ['orders:read', 'payments:read', 'payments:write', 'revenue:read'],
  // Answers customer calls. Reads only.
  support: ['orders:read', 'riders:read'],
};

export function can(role: AdminRole, capability: Capability): boolean {
  return CAPABILITIES[role]?.includes(capability) ?? false;
}

export function capabilitiesFor(role: AdminRole): Capability[] {
  return [...(CAPABILITIES[role] ?? [])];
}

/**
 * Gate a route on a capability. Composes after requireAdmin, which is what
 * puts req.admin in place.
 */
export function requirePermission(capability: Capability) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const admin = req.admin;

    if (!admin) {
      // requireAdmin missing from the chain — a wiring bug, not a user error.
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!can(admin.role, capability)) {
      res.status(403).json({ error: 'Your role does not allow this action' });
      return;
    }

    next();
  };
}
