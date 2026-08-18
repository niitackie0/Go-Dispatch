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

/* ---------------------------------------------------------------------------
   UNDO
   --------------------------------------------------------------------------- */

/**
 * How long after a status change it can still be taken back.
 *
 * Undo is for the misclick you notice immediately — the wrong row on the
 * dispatch board, the wrong button in the drawer. It is deliberately not a
 * general "edit history" tool: past the window, moving an order backwards is
 * an owner override, which demands a written reason and is recorded as one.
 */
export const UNDO_WINDOW_MS = 10 * 60 * 1000;

/** The shape of a status_history row, as either side of the wire has it. */
export interface HistoryRow {
  status: OrderStatus;
  changedAt: string | Date;
  note?: string | null;
  changedByName?: string | null;
  changedByAdminId?: string | null;
}

/** The prefix an undo writes on the history row it leaves behind. */
export const UNDO_NOTE_PREFIX = 'UNDO ';

export type UndoCheck =
  | {
      ok: true;
      previous: OrderStatus;
      from: OrderStatus;
      by: string;
      changedAt: Date;
      /**
       * True when the step being reversed was itself an undo — so this one is
       * a redo, and the console says so. The operation is identical either
       * way; only the word for it changes.
       */
      wasUndo: boolean;
    }
  | { ok: false; reason: string };

/**
 * Whether the last status change can be undone, and what it would go back to.
 *
 * Shared for the same reason ALLOWED_TRANSITIONS is: the server refuses undos
 * that fail these rules, and the console hides the button when they fail, so
 * it cannot offer an undo the API will reject.
 *
 * `rows` must be the order's status history, newest first.
 *
 * Finding the step to reverse is not simply "the newest row": a payment
 * recorded against an order writes a history row carrying the order's CURRENT
 * status, so the newest row is often a note rather than a transition. What is
 * wanted is the OLDEST row of the newest unbroken run of rows in the current
 * status — that is the row that actually moved the order here.
 */
export function checkUndo(
  rows: readonly HistoryRow[],
  current: OrderStatus,
  automationActor: string,
  now: number = Date.now()
): UndoCheck {
  let i = 0;
  while (i < rows.length && rows[i].status === current) i++;

  if (i === 0) {
    return { ok: false, reason: 'There is no recorded change to undo.' };
  }
  if (i >= rows.length) {
    return { ok: false, reason: 'This order has not changed status since it was booked.' };
  }

  const entered = rows[i - 1];
  const previous = rows[i].status;
  const changedAt = new Date(entered.changedAt);
  const age = now - changedAt.getTime();

  // A step the rules engine took is not a misclick, and the next automation
  // pass would simply take it again a minute later.
  if (!entered.changedByAdminId && entered.changedByName === automationActor) {
    return {
      ok: false,
      reason: 'Automation made this change. Reversing it needs an owner override with a reason.',
    };
  }

  if (age > UNDO_WINDOW_MS) {
    const mins = Math.round(UNDO_WINDOW_MS / 60000);
    return {
      ok: false,
      reason: `Undo is only available for ${mins} minutes after a change. Use an owner override with a reason.`,
    };
  }

  return {
    ok: true,
    previous,
    from: current,
    by: entered.changedByName || 'a member of staff',
    changedAt,
    wasUndo: (entered.note ?? '').startsWith(UNDO_NOTE_PREFIX),
  };
}
