/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Prisma } from '@prisma/client';

/**
 * Customer notifications — queued, never sent inline.
 *
 * Nothing here talks to a network. Rows land in the `notifications` table and
 * stop there until an SMS provider is chosen (Arkesel, Hubtel or mNotify were
 * the candidates, for cost and for a registered "WAYPOINT" sender ID).
 *
 * Two decisions are baked in and worth keeping:
 *
 *  - Queued, not inline. A provider outage must never fail a customer's
 *    booking, so the write goes in the same transaction as the thing that
 *    caused it, and delivery is somebody else's problem later.
 *  - Rendered at write time. The message text is fixed when the event happens,
 *    so editing this file later cannot rewrite what a customer was already
 *    told.
 *
 * The unique constraint on (orderId, event) is what makes this safe to call
 * from the automation pass: the pass runs every 60 seconds and re-reads the
 * same orders, so a second attempt to queue the same event is discarded rather
 * than texting somebody twice.
 */

export type NotificationEvent =
  | 'booking_confirmed'
  | 'payment_received'
  | 'rider_assigned'
  | 'out_for_delivery'
  | 'delivered';

interface OrderFacts {
  id: string;
  trackingCode: string;
  senderName: string;
  senderPhone: string;
  recipientName: string;
  dropoffAddress: string;
  riderName?: string | null;
}

/**
 * The message a customer would receive.
 *
 * Kept short deliberately: an SMS is billed per 160 characters, and these go
 * out on every order.
 */
function render(event: NotificationEvent, order: OrderFacts): string {
  const code = order.trackingCode;
  switch (event) {
    case 'booking_confirmed':
      return `GO DISPATCH: booking confirmed. Your tracking code is ${code}. Track it on our site or call 054 030 4994.`;
    case 'payment_received':
      return `GO DISPATCH: payment received for ${code}. Thank you.`;
    case 'rider_assigned':
      return order.riderName
        ? `GO DISPATCH: ${order.riderName} is collecting ${code}.`
        : `GO DISPATCH: a rider has been assigned to ${code}.`;
    case 'out_for_delivery':
      return `GO DISPATCH: ${code} is on its way to ${order.recipientName}.`;
    case 'delivered':
      return `GO DISPATCH: ${code} was delivered to ${order.recipientName}. Thank you for choosing GO DISPATCH.`;
  }
}

/**
 * Queue a notification, ignoring it if this order already has one for this
 * event.
 *
 * Takes a transaction client so the row lands atomically with the change that
 * triggered it — an order cannot end up confirmed with no notification queued,
 * or notified about something that later rolled back.
 */
export async function queueNotification(
  tx: Prisma.TransactionClient,
  event: NotificationEvent,
  order: OrderFacts
): Promise<boolean> {
  // The customer who booked is the one we contact. Notifying the recipient
  // needs their consent, which we do not currently capture at booking.
  const recipient = order.senderPhone?.trim();
  if (!recipient) return false;

  const result = await tx.notification.createMany({
    data: [
      {
        orderId: order.id,
        event,
        recipient,
        message: render(event, order),
      },
    ],
    // Relies on the (orderId, event) unique constraint. createMany with skip
    // avoids a findFirst-then-insert race between two automation passes.
    skipDuplicates: true,
  });

  return result.count > 0;
}

/**
 * The notification a status change earns, if any.
 *
 * `confirmed` is here for pay-on-delivery bookings, which are confirmed the
 * moment they are placed and so never pass through the payment rule that
 * notifies prepaid ones. `queued` is deliberately absent: Rule B queues
 * `rider_assigned` itself, because only it knows which rider got the job.
 */
const STATUS_EVENTS: Partial<Record<string, NotificationEvent>> = {
  confirmed: 'booking_confirmed',
  in_transit: 'out_for_delivery',
  delivered: 'delivered',
};

/**
 * Queue whatever a move into `status` warrants. Safe to call on every status
 * change — statuses with nothing to say return false, and the unique
 * constraint absorbs repeats.
 */
export async function notifyForStatus(
  tx: Prisma.TransactionClient,
  status: string,
  order: OrderFacts
): Promise<boolean> {
  const event = STATUS_EVENTS[status];
  if (!event) return false;
  return queueNotification(tx, event, order);
}

/**
 * Take back the message a status earned, when that status is undone.
 *
 * Only `pending` rows are removed. Once something has been sent the customer
 * has read it, and deleting the row would only lose the record of having told
 * them — the honest repair for that is the next message, not a quiet delete.
 *
 * The row is deleted rather than marked, because (orderId, event) is unique:
 * leaving a cancelled row behind would block the notification that a genuine
 * re-delivery should send.
 */
export async function unqueueForStatus(
  tx: Prisma.TransactionClient,
  status: string,
  orderId: string
): Promise<number> {
  const event = STATUS_EVENTS[status];
  if (!event) return 0;

  const { count } = await tx.notification.deleteMany({
    where: { orderId, event, status: 'pending' },
  });
  return count;
}
