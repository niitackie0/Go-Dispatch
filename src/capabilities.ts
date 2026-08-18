/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AdminRole } from './types.js';

/**
 * What each role is allowed to do.
 *
 * Shared deliberately: the server imports this to ENFORCE (see
 * src/server/permissions.ts) and the admin UI imports it to decide which
 * controls to render. One table, so the console can never offer a button the
 * server will refuse — and no second copy to drift out of step.
 *
 * This file must stay free of server-only imports so it can be bundled.
 *
 * NOTE ON dispatcher AND support: they now hold exactly the same capabilities.
 * Support was read-only, but the job as it is actually done is moving parcels
 * through their statuses and telling riders where to go, which is dispatch.
 * Two names for one set of powers is a trap -- somebody will eventually assume
 * they differ -- so one of them should go. Now is the cheapest moment: no
 * account holds either.
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

export const CAPABILITIES: Record<AdminRole, readonly Capability[]> = {
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
  // Answers the phone AND works the board: moves parcels through their
  // statuses and passes jobs to riders. Identical to dispatcher on purpose --
  // see the note above about the two names.
  support: ['orders:read', 'orders:write', 'riders:read'],
};

export function can(role: AdminRole | undefined, capability: Capability): boolean {
  if (!role) return false;
  return CAPABILITIES[role]?.includes(capability) ?? false;
}

export function capabilitiesFor(role: AdminRole): Capability[] {
  return [...(CAPABILITIES[role] ?? [])];
}
