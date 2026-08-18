/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Clear the order book, and nothing else.
 *
 *     npm run wipe:orders            # shows what would go, deletes nothing
 *     npm run wipe:orders -- --confirm
 *
 * For the day before go-live, when the board is full of parcels sent from
 * "Ofankor South" to "heney" and every phone number is your own. Test bookings
 * left in a live system are not merely untidy: they sit in the money owed,
 * they age into the "needs attention" queue, and one of them will eventually
 * be dispatched to a real courier.
 *
 * WHAT IT REMOVES
 *   orders, and by cascade their status history, payments and queued messages
 *   bookings, which are only a wrapper around orders and are meaningless alone
 *
 * WHAT IT KEEPS
 *   staff accounts, riders, pricing, and the sessions you are signed in with
 *
 * Riders are set back to available afterwards. A courier is marked unavailable
 * while carrying a parcel, and deleting the parcel out from under that flag
 * would leave them permanently busy with nothing.
 *
 * There is no way to undo this. That is why it does nothing without --confirm.
 */

import 'dotenv/config';
import { prisma } from '../src/server/prisma.js';

async function main() {
  const confirmed = process.argv.includes('--confirm');

  const orders = await prisma.order.findMany({
    select: {
      id: true,
      trackingCode: true,
      status: true,
      senderName: true,
      recipientName: true,
      priceAmount: true,
      currency: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const [bookings, payments, history, queued] = await Promise.all([
    prisma.booking.count(),
    prisma.payment.count(),
    prisma.statusHistory.count(),
    prisma.notification.count(),
  ]);

  if (orders.length === 0) {
    console.log('\n  The order book is already empty.\n');
    return;
  }

  console.log(`\n  ${orders.length} order(s):\n`);
  for (const o of orders) {
    console.log(
      `    ${o.trackingCode}  ${o.status.padEnd(17)}` +
        `${o.senderName} -> ${o.recipientName}  ` +
        `${o.currency} ${(o.priceAmount / 100).toFixed(2)}`
    );
  }

  console.log(
    `\n  Going with them: ${bookings} booking(s), ${payments} payment(s), ` +
      `${history} history row(s), ${queued} queued message(s).`
  );
  console.log('  Staying: staff accounts, riders, pricing.\n');

  if (!confirmed) {
    console.log('  Nothing deleted. Re-run with --confirm to go ahead.\n');
    return;
  }

  // One transaction: a half-wiped order book is worse than a full one.
  const result = await prisma.$transaction(async (tx) => {
    // Explicit rather than leaning on the cascades, so this still reads
    // correctly to somebody who has not memorised the schema.
    const messages = await tx.notification.deleteMany({});
    const paid = await tx.payment.deleteMany({});
    const rows = await tx.statusHistory.deleteMany({});
    const gone = await tx.order.deleteMany({});
    const wrappers = await tx.booking.deleteMany({});
    const freed = await tx.rider.updateMany({ data: { available: true } });
    return { messages, paid, rows, gone, wrappers, freed };
  });

  console.log(`  Deleted ${result.gone.count} order(s), ${result.wrappers.count} booking(s),`);
  console.log(`          ${result.paid.count} payment(s), ${result.rows.count} history row(s),`);
  console.log(`          ${result.messages.count} queued message(s).`);
  console.log(`  ${result.freed.count} rider(s) set back to available.\n`);
}

main()
  .catch((err) => {
    console.error('\n  Failed:', err instanceof Error ? err.message : err, '\n');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
