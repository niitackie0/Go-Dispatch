/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Prisma } from '@prisma/client';
import { CONTACT_PHONE, SMS_SENDER_ID_REGISTERED, BRAND_NAME, smsTrackingLink } from '../brand.js';
import { formatAmount } from '../pricing.js';
import { localPhone } from '../phone.js';
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
 *   booking_confirmed     sender     MULTI-PARCEL VISITS ONLY. One text for the
 *                                    whole visit carrying the reference that
 *                                    finds every parcel in it. A single parcel
 *                                    gets nothing here -- see rider_assigned.
 *   rider_assigned        sender     the receipt AND the collection notice in
 *                                    one: we have the request, who is coming,
 *                                    on what number, and the tracking code.
 *   payment_request       PAYER      the bill. Sent once the parcel has been
 *                                    weighed at the office, to whoever the
 *                                    `payer` column names -- which may be the
 *                                    recipient, so that variant says who the
 *                                    parcel is from. Nothing goes on a bus
 *                                    before this is settled.
 *   dispatched_sender     sender     it is on the bus.
 *   dispatched_recipient  RECIPIENT  it is on the bus, and that it is theirs to
 *                                    collect at the station. Without this they
 *                                    do not know a parcel is coming at all.
 *   cancelled             sender     silence here is the worst failure in the
 *                                    system: a parcel that is simply never
 *                                    collected, with no explanation.
 *
 * TWO EVENTS FOR ONE DISPATCH MESSAGE. The unique constraint below is per
 * (orderId, event), which is what stops the automation texting twice -- and it
 * means one event can only ever reach one person. Dispatch has to reach both
 * ends, so it is two events carrying two differently-worded messages rather
 * than one event bent into serving two audiences.
 *
 * And what does NOT earn one:
 *
 *   payment_received   folded into booking_confirmed, then made redundant
 *                      entirely: payment_request is followed by the dispatch
 *                      message, which is itself the proof the money landed.
 *   anything after the bus  our job ends when the parcel is handed over at the
 *                      station. We cannot see the far end, so we cannot honestly
 *                      say a parcel was collected -- and a message that guesses
 *                      is worse than no message.
 *
 * RETIRED with the door-delivery model: price_confirmed (became the bill),
 * out_for_delivery and delivered (nobody is bringing it to a door). They still
 * render, because rows written under that model record what customers were
 * actually told and must read back as they were sent.
 */

export type NotificationEvent =
  | 'booking_confirmed'
  | 'rider_assigned'
  | 'payment_request'
  | 'dispatched_sender'
  | 'dispatched_recipient'
  | 'cancelled'
  // Retired. Nothing queues these; they render so old rows still read.
  | 'payment_received'
  | 'price_confirmed'
  | 'out_for_delivery'
  | 'delivered';

/**
 * Who each message is for.
 *
 * `payer` is resolved per order rather than fixed here, because the bill goes
 * to whoever is paying and that is a property of the parcel, not of the event.
 */
type Audience = 'sender' | 'recipient' | 'payer';

const AUDIENCE: Record<NotificationEvent, Audience> = {
  booking_confirmed: 'sender',
  rider_assigned: 'sender',
  payment_request: 'payer',
  dispatched_sender: 'sender',
  // The only message that reaches somebody who never dealt with us, and the
  // one that matters most: without it they would not know a parcel is coming.
  dispatched_recipient: 'recipient',
  cancelled: 'sender',

  payment_received: 'sender',
  price_confirmed: 'sender',
  out_for_delivery: 'recipient',
  delivered: 'sender',
};

/** The audience for this event on this parcel, with `payer` settled. */
function audienceFor(event: NotificationEvent, order: OrderFacts): 'sender' | 'recipient' {
  const audience = AUDIENCE[event];
  if (audience !== 'payer') return audience;
  return order.payer === 'recipient' ? 'recipient' : 'sender';
}

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
  /** Whichever rider holds the leg this message is about. */
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
 * ONE SKELETON, every event:
 *
 *     Dear {name}
 *     {what happened}. {what it costs you}. Use {code} to track it here: {link}
 *
 * The greeting is its own line — that is renderMessage's doing, not this
 * function's, which returns the second line only. Two rules hold the shape:
 *
 *  - The link goes LAST, with nothing after it. A full stop touching a URL is
 *    swallowed into the link by some handsets, and a customer who taps a
 *    404 does not try again.
 *  - The code is spelled out even though the link ends in it. The link is for
 *    tapping; the code is for reading back down the phone, and those are two
 *    different acts by two different people.
 *
 * Kept to ONE SEGMENT. An SMS is 160 characters only while every character is
 * in the GSM-7 alphabet, so the text is deliberately plain: no em dashes, no
 * curly quotes, no accents that survive sanitising. See src/server/sms.ts.
 *
 * There is no "reply STOP" footer, on purpose. These are transactional
 * messages about a parcel somebody has actually sent, not marketing, and the
 * footer would cost about 25 characters on every message we ever send.
 *
 * Two events end on the phone number instead of a link. `delivered` and
 * `cancelled` are the end of the parcel's story: there is nothing left to
 * watch, and on a cancellation a number to call is worth more than a page to
 * look at.
 */
function render(
  event: NotificationEvent,
  order: OrderFacts,
  context: NotificationContext
): string {
  const code = order.trackingCode;
  const phone = CONTACT_PHONE;
  const amount = formatAmount(order.priceAmount, order.currency);
  const track = (target: string) => `to track it here: ${smsTrackingLink(target)}`;

  switch (event) {
    case 'booking_confirmed': {
      // Several parcels in one visit is one message with the reference that
      // finds them all, not one message per tracking code.
      if (context.bookingReference && (context.parcelCount ?? 1) > 1) {
        const ref = context.bookingReference;
        return `We have your ${context.parcelCount} parcels. Prices confirm when we weigh each one. Use ${ref} to track them here: ${smsTrackingLink(ref)}`;
      }
      // One variant, because there is now only one way it goes: we weigh it at
      // the office and ask for the money then. The old paid / prepaid / due-on-
      // delivery split described a door delivery that does not happen.
      return `We have your parcel. The price confirms when we weigh it. Use ${code} ${track(code)}`;
    }

    /**
     * The booking receipt AND the collection notice, in one message.
     *
     * These used to be two texts. The first said "we have your parcel" — which
     * was not true, the parcel was still in the customer's hands — and it
     * carried the same tracking code the second one carried, usually less than
     * an hour later. Merged into the one moment where there is something to say.
     *
     * THIS MESSAGE IS TWO SEGMENTS, AND THAT IS DELIBERATE. It runs to about
     * 205 characters, so every parcel is billed twice for it. The wording is
     * the owner's, chosen knowing the cost: it greets the customer properly,
     * says the request was received, names the rider, gives his number, and
     * still hands over the code and the link.
     *
     * If it ever needs to come back under 160, the link is where the room is —
     * 38 characters, on a message that already carries the code. Do not trim
     * the prose to get there without asking; it has been asked and answered.
     *
     * The number prints in local form (0244123456) rather than as stored
     * (+233244123456), because that is how a Ghanaian reads a number back.
     */
    case 'rider_assigned': {
      const rider = order.riderName ? firstName(order.riderName) : null;
      const who = rider ?? 'A rider';
      const tail = `Use ${code} to track your parcel here ${smsTrackingLink(code)}`;
      return order.riderPhone
        ? `We have received your delivery request and your order has been assigned to ${who}. He will call you from ${localPhone(order.riderPhone)}\n\n${tail}`
        : `We have received your delivery request and your order has been assigned to ${who}. He will call you when he arrives\n\n${tail}`;
    }

    /**
     * The bill, and the only message that asks for anything.
     *
     * It goes to whoever is paying, which may be the recipient — somebody who
     * never dealt with us — so that variant names the sender. No tracking link
     * on either: the action here is a MoMo transfer, and 38 characters of URL
     * would buy nothing that the number and the code do not already give.
     */
    case 'payment_request': {
      const was = context.previousAmount;
      const weight = kg(order.actualWeightKg);
      const weighed = weight ? `weighed ${weight}kg` : 'has been weighed';
      const pay = `Pay ${amount} by MoMo to ${phone} and it goes on the bus.`;

      if (order.payer === 'recipient') {
        const from = firstName(order.senderName);
        return `${from} has sent you a parcel, ${code}. It ${weighed}. ${pay}`;
      }
      return was !== undefined
        ? `${code} ${weighed}, so the price is ${amount}, not ${formatAmount(was, order.currency)}. Pay by MoMo to ${phone} and it goes on the bus.`
        : `${code} ${weighed}. ${pay}`;
    }

    /**
     * On the bus. The reason this is the one event that texts two people: once
     * it has left us, the tracking link is the only handle either end has on
     * the parcel.
     */
    case 'dispatched_sender': {
      const to = firstName(order.recipientName);
      return `Your parcel to ${to} is on the bus\n\nUse ${code} to track here ${smsTrackingLink(code)}`;
    }

    case 'dispatched_recipient': {
      const from = firstName(order.senderName);
      return `Your parcel from ${from} is on the bus\n\nUse ${code} to track here ${smsTrackingLink(code)}`;
    }

    case 'cancelled':
      return order.paymentStatus === 'paid'
        ? `${code} has been cancelled. We will call you about your refund. Call ${phone}.`
        : `${code} has been cancelled and you have not been charged. Call ${phone} if this is a mistake.`;

    // ---- Retired. Rendered only so rows written before the bus model still
    // read back as what the customer was actually told.
    case 'payment_received':
      return `Payment received for ${code}. Thank you.`;

    case 'price_confirmed': {
      const was = context.previousAmount;
      const weight = kg(order.actualWeightKg);
      const weighed = weight ? `${code} weighed ${weight}kg` : `${code} has been weighed`;
      return was !== undefined
        ? `${weighed}, so the price is ${amount}, not ${formatAmount(was, order.currency)}. Track it here: ${smsTrackingLink(code)}`
        : `${weighed} and the price is ${amount}. Track it here: ${smsTrackingLink(code)}`;
    }

    case 'out_for_delivery': {
      const from = firstName(order.senderName);
      const owes = order.payer === 'recipient' && order.paymentStatus !== 'paid';
      const tail = `Track it here: ${smsTrackingLink(code)}`;
      return owes
        ? `${from} has sent you a parcel, arriving today. Have ${amount} ready for the rider. ${tail}`
        : `${from} has sent you a parcel, arriving today. The rider will call you. ${tail}`;
    }

    case 'delivered': {
      const to = firstName(order.recipientName);
      const collected = order.paymentTiming === 'on_delivery' && order.paymentStatus === 'paid';
      return collected
        ? `${code} was delivered to ${to} and ${amount} was collected. Thank you.`
        : `${code} was delivered to ${to}. Thank you for choosing us.`;
    }
  }
}

/**
 * The finished message, ready to hand a provider.
 *
 *     Dear Ama
 *     Henry has sent you a parcel, arriving today. Have GHS 60.00 ready for
 *     the rider. Track it here: godispatchgh.com/t/GD-4821-330
 *
 * The greeting is a line of its own. A newline is in the GSM-7 basic set and
 * costs exactly one character (src/server/sms.ts), which is cheaper than the
 * comma and space it replaces — so the structure is free, and the message
 * reads as a notification rather than a paragraph.
 *
 * THE BRAND PREFIX is temporary and is why this function still has a fallback
 * in it. A registered alphanumeric sender ID puts "GO DISPATCH" in the FROM
 * field, where it costs nothing; until then messages arrive from a shortcode
 * and must name us in the body, which costs 13 characters of every message.
 * Flip SMS_SENDER_ID_REGISTERED in src/brand.ts the day it is live and every
 * template gets those characters back.
 *
 * At full length — prefix AND greeting — two variants exceed one segment: a
 * booking of several parcels, and an arriving-today to a long name owing a
 * three-figure amount. Both fit the moment either the prefix or the greeting
 * goes. So the greeting is what gives way, and note that this is only ever
 * reached while the prefix is present — which means the message still says
 * who it is from. An unnamed text from a shortcode with a URL in it is the
 * shape of every smishing message in circulation here; an unnamed text that
 * opens "GO DISPATCH:" is not.
 */
export function renderMessage(
  event: NotificationEvent,
  order: OrderFacts,
  context: NotificationContext = {}
): string {
  // Addressed to whoever the event is for: the sender on most, the recipient
  // on the dispatch message, and whoever is paying on the bill.
  const audience = audienceFor(event, order);
  const name = firstName(audience === 'recipient' ? order.recipientName : order.senderName);

  const brand = (text: string) => (SMS_SENDER_ID_REGISTERED ? text : `${BRAND_NAME}: ${text}`);
  const body = render(event, order, context);

  const plain = toGsm7(brand(body));
  if (!name) return plain;

  const greeted = toGsm7(brand(`Dear ${name}\n${body}`));
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
  const audience = audienceFor(event, order);
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
 * Deliberately short, because most of the messages in this system are not
 * earned by a status alone:
 *
 *  - `queued` is absent: only the automation pass knows WHICH rider took the
 *    job and on what number, so it queues rider_assigned itself.
 *  - `at_office` is absent: the bill cannot be written until the parcel has
 *    been weighed, which is a separate act from arriving.
 *  - `dispatched` is absent: it sends to two people under two different
 *    events, and routes/orders.ts queues both when it puts the parcel on the
 *    bus.
 */
const STATUS_EVENTS: Partial<Record<string, NotificationEvent>> = {
  // `confirmed` is deliberately absent. A single booking used to earn a text
  // here saying "we have your parcel" -- which was not true, the parcel was
  // still with the customer -- carrying a tracking code the collection notice
  // repeated less than an hour later. The two are now one message, sent when a
  // rider is actually assigned. See rider_assigned.
  //
  // The COST of that: a parcel booked for tomorrow is silent until roughly an
  // hour before pickup, and a parcel nobody can be assigned to is silent until
  // somebody frees up. A multi-parcel booking still gets its own confirmation,
  // because merging there would mean one text per parcel instead of one.
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
