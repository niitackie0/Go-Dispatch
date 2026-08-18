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
 * THREE ROLES, NOT FOUR. There used to be a `dispatcher` as well, holding
 * exactly what `support` holds. Support began read-only, but the job as it is
 * actually done is moving parcels through their statuses and telling riders
 * where to go -- so the two converged, and two names for one set of powers is
 * a trap: somebody eventually assumes they differ and hands out more than they
 * meant to. The console had already fallen into it, describing Support as
 * read-only while it carried orders:write.
 *
 * `support` is the survivor because it is the word this business uses for the
 * person who answers the phone and works the board, and because it is the
 * schema default -- an account created without an explicit role lands here, so
 * this list is also the floor.
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
  // Reconciles money. Can read orders for context but cannot dispatch them.
  finance: ['orders:read', 'payments:read', 'payments:write', 'revenue:read'],
  // Answers the phone AND works the board: moves parcels through their
  // statuses and passes jobs to riders. No money, no pricing, no staff.
  // This is the default role, so it is also the least any account can hold.
  support: ['orders:read', 'orders:write', 'riders:read'],
};

export function can(role: AdminRole | undefined, capability: Capability): boolean {
  if (!role) return false;
  return CAPABILITIES[role]?.includes(capability) ?? false;
}

export function capabilitiesFor(role: AdminRole): Capability[] {
  return [...(CAPABILITIES[role] ?? [])];
}
