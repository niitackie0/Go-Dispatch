/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { OrderStatus } from './types.js';

/**
 * Which status an order may move to, from each status it can be in.
 *
 * Shared deliberately, the same way capabilities are: the server imports this
 * to ENFORCE (see src/server/routes/orders.ts) and the admin console imports it
 * to decide which buttons to draw. One table, so the console cannot offer a
 * move the server will refuse.
 *
 * Riders have their own, stricter table in src/server/routes/rider.ts — they
 * may only walk the delivery path forwards and may not cancel.
 *
 * This file must stay free of server-only imports so it can be bundled.
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  // A new booking either needs paying for, or is confirmed outright when the
  // money is due on delivery.
  requested: ['awaiting_payment', 'confirmed', 'cancelled'],
  // Normally cleared by automation when payment lands; an admin may also
  // confirm by hand after taking payment another way.
  awaiting_payment: ['confirmed', 'cancelled'],
  confirmed: ['queued', 'cancelled'],
  queued: ['picked_up', 'cancelled'],
  picked_up: ['in_transit', 'cancelled'],
  in_transit: ['delivered', 'cancelled'],
  // Terminal. Reopening a finished order is an override, not a transition.
  delivered: [],
  cancelled: [],
};

/** The statuses an order in `from` may legally move to. */
export function nextStatuses(from: OrderStatus): readonly OrderStatus[] {
  return ALLOWED_TRANSITIONS[from] ?? [];
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return nextStatuses(from).includes(to);
}

/**
 * The single step the "Advance" button takes — the happy path forwards,
 * ignoring cancellation.
 *
 * `awaiting_payment` deliberately has no advance action: it is payment-gated
 * and clears itself once the money lands, so offering a button here would
 * invite an admin to dispatch something nobody has paid for.
 */
export function advanceStatus(from: OrderStatus): OrderStatus | null {
  if (from === 'awaiting_payment') return null;
  return nextStatuses(from).find((s) => s !== 'cancelled') ?? null;
}

export function isTerminal(status: OrderStatus): boolean {
  return nextStatuses(status).length === 0;
}
