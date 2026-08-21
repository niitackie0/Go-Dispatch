/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Prisma } from '@prisma/client';
import { CONTACT_PHONE, SMS_SENDER_ID_REGISTERED, BRAND_NAME, smsTrackingLink } from '../brand.js';
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
 *
 * THE LINK. `link` is the tap-through to this parcel's tracking page, or null
 * when there was no room for it — renderMessage decides which, and calls this
 * twice to find out (see the ladder there). Two rules keep the two versions
 * honest:
 *
 *  - It replaces, never adds. The link takes the place of "Track it with that
 *    code" and of the "call us" tail, because that tail exists only to tell
 *    somebody how to find out more and the link does that better. At 38
 *    characters it could not simply be appended: almost nothing would fit.
 *  - The facts do not move. The tracking code, the price, the weight, the
 *    rider, what is owed at the door — all of it reads identically either way.
 *    The code stays printed in full even though the link ends in it, because
 *    it is the thing a customer reads back down the phone.
 *
 * Two events deliberately get no link. `delivered` and `cancelled` are the end
 * of the parcel's story: there is nothing left to watch, and on a cancellation
 * a number to call is worth more than a page to look at.
 */
function render(
  event: NotificationEvent,
  order: OrderFacts,
  context: NotificationContext,
  link: string | null
): string {
  const code = order.trackingCode;
  const phone = CONTACT_PHONE;
  const amount = formatAmount(order.priceAmount, order.currency);

  switch (event) {
    case 'booking_confirmed': {
      // Several parcels in one visit is one message with the reference that
      // finds them all, not one message per tracking code.
      if (context.bookingReference && (context.parcelCount ?? 1) > 1) {
        // The link IS the reference, spelled out in its own last characters,
        // so printing it twice is the one redundancy this message cannot
        // afford — it is the longest one we send.
        return link
          ? `your ${context.parcelCount} parcels are booked. Prices confirm when we weigh each one. Track all ${context.parcelCount}: ${link}`
          : `your ${context.parcelCount} parcels are booked. Reference ${context.bookingReference} tracks them all. Prices confirm when we weigh each one. Call ${phone}.`;
      }
      if (order.paymentStatus === 'paid') {
        return link
          ? `payment received and your parcel is booked. Code ${code}. Track: ${link}`
          : `payment received and your parcel is booked. Code ${code}. Track it with that code or call ${phone}.`;
      }
      if (order.paymentTiming === 'prepaid') {
        return link
          ? `your parcel is booked. Code ${code}. We collect once your payment lands. Track: ${link}`
          : `your parcel is booked. Code ${code}. We collect once your payment lands. Call ${phone} if you need a hand.`;
      }
      return link
        ? `your parcel is booked. Code ${code}. Payment is due on delivery. Track: ${link}`
        : `your parcel is booked. Code ${code}. Payment is due on delivery. Track it with that code or call ${phone}.`;
    }

    // Retained so old rows still render. No longer queued.
    case 'payment_received':
      return `payment received for ${code}. Thank you.`;

    case 'price_confirmed': {
      const was = context.previousAmount;
      const weight = kg(order.actualWeightKg);
      const weighed = weight ? `${code} weighed ${weight}kg.` : `${code} has been weighed.`;
      if (was !== undefined) {
        const tail = link ? `Track: ${link}` : `Call ${phone}.`;
        return `${weighed} The price is ${amount}, not the ${formatAmount(was, order.currency)} estimated. ${tail}`;
      }
      return link
        ? `${weighed} The price is ${amount}. Track: ${link}`
        : `${weighed} The price is ${amount}. Call ${phone} if that is a problem.`;
    }

    case 'rider_assigned': {
      const rider = order.riderName ? firstName(order.riderName) : null;
      // This one has no "how to find out more" tail to trade away, so the link
      // is genuinely extra weight and survives only on the shorter variants.
      const tail = link ? ` Track: ${link}` : '';
      if (!rider) return `a rider is on the way to collect ${code}. He will call you when he arrives.${tail}`;
      return order.riderPhone
        ? `${rider} is on the way to collect ${code}. He will call from ${order.riderPhone} when he arrives.${tail}`
        : `${rider} is on the way to collect ${code}. He will call you when he arrives.${tail}`;
    }

    // The only message that goes to somebody who did not book with us, so it
    // says who it is from and why they are hearing from us.
    case 'out_for_delivery': {
      const from = firstName(order.senderName);
      const owes = order.payer === 'recipient' && order.paymentStatus !== 'paid';
      const tail = link ? `Track: ${link}` : `Call ${phone}.`;
      return owes
        ? `a parcel from ${from} reaches you today. Code ${code}. Have ${amount} ready for the rider. ${tail}`
        : `a parcel from ${from} reaches you today. Code ${code}. The rider will call you. ${tail}`;
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
  // Addressed to whoever the event is for: the sender on most, the recipient
  // on the one that reaches somebody who never dealt with us. A name is worth
  // its ~12 characters here — an unaddressed text about a parcel reads like
  // every scam message anybody in Ghana has ever received.
  const audience = AUDIENCE[event];
  const name = firstName(audience === 'recipient' ? order.recipientName : order.senderName);

  const brand = (text: string) => (SMS_SENDER_ID_REGISTERED ? text : `${BRAND_NAME}: ${text}`);
  const greet = (text: string) => (name ? `Dear ${name}, ${text}` : text);
  const finish = (text: string) => toGsm7(brand(greet(text)));

  // What the link points at: the booking reference when one message covers
  // several parcels — it finds all of them (src/server/routes/orders.ts) —
  // and the parcel's own code otherwise.
  const grouped = context.bookingReference && (context.parcelCount ?? 1) > 1;
  const link = smsTrackingLink(grouped ? context.bookingReference! : order.trackingCode);

  // The link goes in if, and only if, it is free. It is 38 characters against a
  // 160-character budget already carrying a 13-character brand prefix, so on
  // the longer templates there is simply no room, and a second segment is a
  // doubled bill on every order forever — a worse deal than a customer typing
  // a code they have been given anyway.
  const linked = finish(render(event, order, context, link));
  if (smsCost(linked).segments === 1) return linked;

  // No room. Back to the message as it reads without one, and the original
  // economy below it.
  const body = render(event, order, context, null);
  const greeted = finish(body);
  if (!name) return greeted;

  // The greeting is a courtesy; the message is the point. Somebody who typed a
  // very long name, or a company name, into the name field must not cost twice
  // the postage for it — so if the courtesy is what tips this into a second
  // billed segment, the courtesy goes.
  //
  // Note the order: the link is dropped before the name is, never the other
  // way round. A text with a URL in it and no name on it is the exact shape of
  // every smishing message in circulation here, and a tap-through is not worth
  // teaching customers to trust that shape.
  const plain = toGsm7(brand(body));
  return smsCost(greeted).segments > smsCost(plain).segments ? plain : greeted;
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
