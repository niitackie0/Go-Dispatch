/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Prisma } from '@prisma/client';
import { CONTACT_PHONE, SMS_SENDER_ID_REGISTERED, BRAND_NAME } from '../brand.js';
import { formatAmount } from '../pricing.js';
import { smsCost, toGhanaMsisdn, toGsm7 } from './sms.js';

/**
 * Customer notifications — queued, never sent inline.
 *
 * Nothing here talks to a network. Rows land in the `notifications` table and
 * stop there until an SMS provider is chosen (Arkesel, Hubtel and mNotify were
 * the candidates, for cost and for a registered "GO DISPATCH" sender ID).
 *
 * Three decisions are baked in and worth keeping:
 *
 *  - Queued, not inline. A provider outage must never fail a customer's
 *    booking, so the write goes in the same transaction as the thing that
 *    caused it, and delivery is somebody else's problem later.
 *  - Rendered at write time. The message text is fixed when the event happens,
 *    so editing this file later cannot rewrite what a customer was already
 *    told.
 *  - Addressed at write time too. Whether a message goes to the sender or the
 *    recipient is a property of the event, decided here (see AUDIENCE), not
 *    something the sender has to work out.
 *
 * The unique constraint on (orderId, event) is what makes this safe to call
 * from the automation pass: the pass runs every 60 seconds and re-reads the
 * same orders, so a second attempt to queue the same event is discarded rather
 * than texting somebody twice.
 *
 * WHAT EARNS A MESSAGE
 *
 * Every SMS is billed, on every order, forever, so each one has to carry
 * something the customer would otherwise have to ring up and ask:
 *
 *   booking_confirmed  sender     the receipt, and the code everything else
 *                                 is tracked with. One per BOOKING, not one
 *                                 per parcel.
 *   price_confirmed    sender     only when weighing changed the price. The
 *                                 terms page promises we say so before we
 *                                 dispatch, and this is that promise.
 *   rider_assigned     sender     who is coming and on what number, so an
 *                                 unknown caller at the gate is expected.
 *   out_for_delivery   RECIPIENT  the only person who has to be somewhere,
 *                                 and the only one who needs cash ready.
 *   delivered          sender     the outcome they paid for, and what was
 *                                 collected at the door.
 *   cancelled          sender     silence here is the worst failure in the
 *                                 system: a parcel that is simply never
 *                                 collected, with no explanation.
 *
 * And what does NOT earn one:
 *
 *   payment_received   folded into booking_confirmed. A prepaid order is
 *                      confirmed by the same automation pass that sees the
 *                      payment, so these two arrived in the same second
 *                      saying halves of one sentence, and were billed twice.
 *                      Retained in the enum for rows already written.
 *   delivered (to the recipient)  they are standing in front of the rider.
 */

export type NotificationEvent =
  | 'booking_confirmed'
  | 'payment_received'
  | 'price_confirmed'
  | 'rider_assigned'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

/** Who each message is for. The one that goes to the recipient is deliberate. */
const AUDIENCE: Record<NotificationEvent, 'sender' | 'recipient'> = {
  booking_confirmed: 'sender',
  payment_received: 'sender',
  price_confirmed: 'sender',
  rider_assigned: 'sender',
  out_for_delivery: 'recipient',
  delivered: 'sender',
  cancelled: 'sender',
};

/** What a template may draw on. Everything optional is absent on some orders. */
export interface OrderFacts {
  id: string;
  trackingCode: string;
  senderName: string;
  senderPhone: string;
  recipientName: string;
  recipientPhone: string;
  dropoffAddress?: string | null;
  destinationRegion?: string | null;
  priceAmount: number;
  currency: string;
  paymentStatus: string;
  paymentTiming?: string | null;
  payer?: string | null;
  actualWeightKg?: unknown;
  bookingId?: string | null;
  riderName?: string | null;
  riderPhone?: string | null;
}

/** Facts about the wider event that are not on the order row itself. */
export interface NotificationContext {
  /** Set when several parcels were booked together — one message covers them all. */
  bookingReference?: string;
  parcelCount?: number;
  /** What the price was before the parcel was weighed. */
  previousAmount?: number;
}

/** "Ama Serwaa" -> "Ama". Shorter, and how anyone would actually address them. */
function firstName(full: string): string {
  return (full || '').trim().split(/\s+/)[0] || full;
}

/** Decimal-ish values arrive from Prisma as Decimal; this only ever prints them. */
function kg(value: unknown): string {
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : '';
}

/**
 * The message a customer receives.
 *
 * Kept to ONE SEGMENT. An SMS is 160 characters only while every character is
 * in the GSM-7 alphabet, so the text is deliberately plain: no em dashes, no
 * curly quotes, no accents that survive sanitising. See src/server/sms.ts.
 *
 * There is no "reply STOP" footer, on purpose. These are transactional
 * messages about a parcel somebody has actually sent, not marketing, and the
 * footer would cost about 25 characters on every message we ever send.
 */
function render(
  event: NotificationEvent,
  order: OrderFacts,
  context: NotificationContext
): string {
  const code = order.trackingCode;
  const phone = CONTACT_PHONE;
  const amount = formatAmount(order.priceAmount, order.currency);

  switch (event) {
    case 'booking_confirmed': {
      // Several parcels in one visit is one message with the reference that
      // finds them all, not one message per tracking code.
      if (context.bookingReference && (context.parcelCount ?? 1) > 1) {
        return `Booked: ${context.parcelCount} parcels. Reference ${context.bookingReference} tracks them all. We weigh each one and confirm the price then. Call ${phone}.`;
      }
      if (order.paymentStatus === 'paid') {
        return `Payment received, and your parcel is booked. Your code is ${code}. Track it with that code or call ${phone}.`;
      }
      if (order.paymentTiming === 'prepaid') {
        return `Booked. Your code is ${code}. We collect once your payment lands. Call ${phone} if you need a hand.`;
      }
      return `Booked. Your code is ${code}. Payment is due on delivery. Track it with that code or call ${phone}.`;
    }

    // Retained so old rows still render. No longer queued.
    case 'payment_received':
      return `Payment received for ${code}. Thank you.`;

    case 'price_confirmed': {
      const was = context.previousAmount;
      const weight = kg(order.actualWeightKg);
      const weighed = weight ? `${code} weighed ${weight}kg.` : `${code} has been weighed.`;
      return was !== undefined
        ? `${weighed} The price is ${amount}, not the ${formatAmount(was, order.currency)} estimated. Call ${phone} if that is a problem.`
        : `${weighed} The price is ${amount}. Call ${phone} if that is a problem.`;
    }

    case 'rider_assigned': {
      const rider = order.riderName ? firstName(order.riderName) : null;
      if (!rider) return `A rider is on the way to collect ${code}. He will call you when he arrives.`;
      return order.riderPhone
        ? `${rider} is on the way to collect ${code}. He will call when he arrives. His number is ${order.riderPhone}.`
        : `${rider} is on the way to collect ${code}. He will call you when he arrives.`;
    }

    // The only message that goes to somebody who did not book with us, so it
    // says who it is from and why they are hearing from us.
    case 'out_for_delivery': {
      const to = firstName(order.recipientName);
      const from = firstName(order.senderName);
      const owes = order.payer === 'recipient' && order.paymentStatus !== 'paid';
      return owes
        ? `Hello ${to}, a parcel from ${from} reaches you today. Code ${code}. Have ${amount} ready for the rider. Call ${phone}.`
        : `Hello ${to}, a parcel from ${from} reaches you today. Code ${code}. The rider will call you. Call ${phone}.`;
    }

    case 'delivered': {
      const to = firstName(order.recipientName);
      const collected = order.paymentTiming === 'on_delivery' && order.paymentStatus === 'paid';
      return collected
        ? `${code} was delivered to ${to}. ${amount} was collected. Thank you.`
        : `${code} was delivered to ${to}. Thank you for choosing us.`;
    }

    case 'cancelled':
      return order.paymentStatus === 'paid'
        ? `${code} has been cancelled. We will call you about your refund. Any questions, call ${phone}.`
        : `${code} has been cancelled and you have not been charged. Call ${phone} if this is a mistake.`;
  }
}

/**
 * The finished message, ready to hand a provider.
 *
 * The brand prefix is temporary. A registered alphanumeric sender ID puts
 * "GO DISPATCH" in the FROM field, where it costs nothing; until that is
 * approved, messages arrive from a shortcode and have to name us in the body,
 * which costs 13 characters on every single one. Flip
 * SMS_SENDER_ID_REGISTERED in src/brand.ts the day it is live.
 */
export function renderMessage(
  event: NotificationEvent,
  order: OrderFacts,
  context: NotificationContext = {}
): string {
  const body = render(event, order, context);
  const prefixed = SMS_SENDER_ID_REGISTERED ? body : `${BRAND_NAME}: ${body}`;
  return toGsm7(prefixed);
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
  order: OrderFacts,
  context: NotificationContext = {}
): Promise<boolean> {
  const audience = AUDIENCE[event];
  const raw = audience === 'recipient' ? order.recipientPhone : order.senderPhone;

  // A number a provider will not accept is not worth a row. Queuing it would
  // only mean a permanent failure to retry and investigate later.
  const msisdn = toGhanaMsisdn(raw);
  if (!msisdn) {
    console.warn(`[notify] ${event} for ${order.trackingCode}: no sendable ${audience} number (${raw ?? 'none'})`);
    return false;
  }

  // One confirmation per booking, not one per parcel. Somebody sending four
  // parcels in one visit gets one text with the reference that finds all four,
  // rather than four texts in the same second with four different codes.
  if (event === 'booking_confirmed' && order.bookingId) {
    const already = await tx.notification.findFirst({
      where: { event, order: { bookingId: order.bookingId } },
      select: { id: true },
    });
    if (already) return false;
  }

  const message = renderMessage(event, order, context);
  const cost = smsCost(message);
  if (cost.segments > 1) {
    // Not fatal — the message still goes — but it is billed twice, so it wants
    // to be visible in the log rather than only in the invoice.
    console.warn(
      `[notify] ${event} for ${order.trackingCode} is ${cost.segments} segments (${cost.length} chars, ${cost.encoding})`
    );
  }

  const result = await tx.notification.createMany({
    data: [{ orderId: order.id, event, recipient: msisdn, message }],
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
 * notifies prepaid ones. `queued` is deliberately absent: the automation pass
 * queues `rider_assigned` itself, because only it knows which rider got the
 * job and on what number.
 */
const STATUS_EVENTS: Partial<Record<string, NotificationEvent>> = {
  confirmed: 'booking_confirmed',
  in_transit: 'out_for_delivery',
  delivered: 'delivered',
  cancelled: 'cancelled',
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
