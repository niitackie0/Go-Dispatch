/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Print every SMS the system can send, as a customer would receive it.
 *
 *     npm run sms:preview
 *
 * Reads nothing and writes nothing — it renders the real templates from
 * src/server/notifications.ts against a worked example, so the copy can be read
 * by whoever has to approve it, and so the cost of each message is visible
 * before it is being paid on every order.
 *
 * The number that matters is SEGMENTS. One is the target. Two is double the
 * bill, forever, for a sentence that could have been shorter.
 */

import { renderMessage, type NotificationEvent, type OrderFacts, type NotificationContext } from '../src/server/notifications.js';
import { smsCost } from '../src/server/sms.js';
import { SMS_SENDER_ID, SMS_SENDER_ID_REGISTERED } from '../src/brand.js';

const base: OrderFacts = {
  id: 'demo',
  trackingCode: 'GD-4821-330',
  senderName: 'Henry Tackie',
  senderPhone: '0554431300',
  recipientName: 'Ama Serwaa',
  recipientPhone: '0241234567',
  dropoffAddress: 'Asokwa, Kumasi',
  destinationRegion: 'Ashanti',
  priceAmount: 6000,
  currency: 'GHS',
  paymentStatus: 'pending',
  paymentTiming: 'on_delivery',
  payer: 'recipient',
  actualWeightKg: 4.2,
};

const cases: { event: NotificationEvent; to: string; when: string; order?: Partial<OrderFacts>; context?: NotificationContext }[] = [
  {
    event: 'booking_confirmed',
    to: 'sender',
    when: 'one parcel, paying on delivery',
  },
  {
    event: 'booking_confirmed',
    to: 'sender',
    when: 'one parcel, paid up front',
    order: { paymentStatus: 'paid', paymentTiming: 'prepaid', payer: 'sender' },
  },
  {
    event: 'booking_confirmed',
    to: 'sender',
    when: 'prepaid, payment not in yet',
    order: { paymentTiming: 'prepaid', payer: 'sender' },
  },
  {
    event: 'booking_confirmed',
    to: 'sender',
    when: 'three parcels booked together',
    context: { bookingReference: 'GDB-4821-330', parcelCount: 3 },
  },
  {
    event: 'price_confirmed',
    to: 'sender',
    when: 'weighed heavier than declared',
    context: { previousAmount: 5000 },
  },
  {
    event: 'rider_assigned',
    to: 'sender',
    when: 'rider has a number on file',
    order: { riderName: 'Kwesi Mensah', riderPhone: '0244123456' },
  },
  {
    event: 'rider_assigned',
    to: 'sender',
    when: 'no number on file',
    order: { riderName: 'Kwesi Mensah' },
  },
  {
    event: 'out_for_delivery',
    to: 'RECIPIENT',
    when: 'recipient owes the money',
  },
  {
    event: 'out_for_delivery',
    to: 'RECIPIENT',
    when: 'already paid for',
    order: { paymentStatus: 'paid', payer: 'sender', paymentTiming: 'prepaid' },
  },
  {
    event: 'out_for_delivery',
    to: 'RECIPIENT',
    when: 'WORST CASE: long names, three-figure amount',
    order: {
      senderName: 'Kwabena Adjei-Mensah',
      recipientName: 'Emmanuella Boatemaa',
      priceAmount: 15000,
    },
  },
  {
    event: 'booking_confirmed',
    to: 'sender',
    when: 'WORST CASE: a company name in the name field',
    order: { senderName: 'Ghana Commercial Enterprises Limited' },
    context: { bookingReference: 'GDB-4821-330', parcelCount: 12 },
  },
  {
    event: 'delivered',
    to: 'sender',
    when: 'cash collected at the door',
    order: { paymentStatus: 'paid' },
  },
  {
    event: 'delivered',
    to: 'sender',
    when: 'was prepaid',
    order: { paymentStatus: 'paid', paymentTiming: 'prepaid', payer: 'sender' },
  },
  {
    event: 'cancelled',
    to: 'sender',
    when: 'nothing had been paid',
  },
  {
    event: 'cancelled',
    to: 'sender',
    when: 'already paid for',
    order: { paymentStatus: 'paid' },
  },
];

console.log(
  `\nSender ID "${SMS_SENDER_ID}" is ${SMS_SENDER_ID_REGISTERED ? 'registered — messages carry no brand prefix' : 'NOT registered yet — every message carries a "GO DISPATCH: " prefix costing 13 characters'}\n`
);

let worst = 1;

for (const c of cases) {
  const message = renderMessage(c.event, { ...base, ...c.order }, c.context ?? {});
  const cost = smsCost(message);
  worst = Math.max(worst, cost.segments);

  const flag =
    cost.segments > 1
      ? '  <-- BILLED TWICE'
      : cost.remaining < 20
        ? '  <-- TIGHT, a longer name would push this to two segments'
        : '';
  console.log(`${c.event}  ->  ${c.to}   (${c.when})`);
  console.log(`  "${message}"`);
  console.log(`  ${cost.length} chars, ${cost.encoding}, ${cost.segments} segment${cost.segments === 1 ? '' : 's'}, ${cost.remaining} left${flag}\n`);
}

console.log(
  worst === 1
    ? 'Every message fits one segment.\n'
    : `WARNING: the longest message takes ${worst} segments.\n`
);
