/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Bring stored phone numbers onto one canonical form.
 *
 *     npm run phones:normalise            # shows what would change
 *     npm run phones:normalise -- --confirm
 *
 * Bookings taken before src/phone.ts existed hold whatever the person typed:
 * `0244815203`, `024 481 5203`, `+233244815203`. Tracking looks a number up by
 * exact comparison, so those three are three different customers as far as the
 * search is concerned, and one of them gets told their parcel does not exist.
 *
 * New writes are already canonical. This is only for what predates that.
 *
 * SAFE TO RUN TWICE. A number already in `+233…` form normalises to itself, so
 * a second run reports nothing to do. Numbers that are not Ghanaian mobiles —
 * landlines, foreign numbers, typos — are left exactly as they are, and listed
 * at the end so somebody can look at them rather than discovering them later.
 */

import 'dotenv/config';
import { prisma } from '../src/server/prisma.js';
import { toE164 } from '../src/phone.js';

interface Change {
  table: string;
  id: string;
  field: string;
  from: string;
  to: string;
}

async function main() {
  const confirmed = process.argv.includes('--confirm');

  const changes: Change[] = [];
  const oddities: { table: string; label: string; value: string }[] = [];

  const orders = await prisma.order.findMany({
    select: { id: true, trackingCode: true, senderPhone: true, recipientPhone: true },
  });
  for (const o of orders) {
    for (const field of ['senderPhone', 'recipientPhone'] as const) {
      const from = o[field];
      const to = toE164(from);
      if (!to) oddities.push({ table: 'orders', label: `${o.trackingCode} ${field}`, value: from });
      else if (to !== from) changes.push({ table: 'orders', id: o.id, field, from, to });
    }
  }

  const bookings = await prisma.booking.findMany({
    select: { id: true, reference: true, senderPhone: true },
  });
  for (const b of bookings) {
    const to = toE164(b.senderPhone);
    if (!to) oddities.push({ table: 'bookings', label: `${b.reference} senderPhone`, value: b.senderPhone });
    else if (to !== b.senderPhone) {
      changes.push({ table: 'bookings', id: b.id, field: 'senderPhone', from: b.senderPhone, to });
    }
  }

  const riders = await prisma.rider.findMany({ select: { id: true, name: true, phone: true } });
  for (const r of riders) {
    const to = toE164(r.phone);
    if (!to) oddities.push({ table: 'riders', label: `${r.name} phone`, value: r.phone });
    else if (to !== r.phone) changes.push({ table: 'riders', id: r.id, field: 'phone', from: r.phone, to });
  }

  if (changes.length === 0) {
    console.log('\n  Every stored number is already canonical.\n');
  } else {
    console.log(`\n  ${changes.length} number(s) to rewrite:\n`);
    for (const c of changes) {
      console.log(`    ${c.table.padEnd(9)} ${c.from.padEnd(18)} -> ${c.to}`);
    }
  }

  if (oddities.length > 0) {
    console.log(`\n  ${oddities.length} left alone — not Ghanaian mobile numbers:\n`);
    for (const o of oddities) {
      console.log(`    ${o.table.padEnd(9)} ${o.label.padEnd(28)} ${o.value}`);
    }
    console.log('\n  These are reachable by a person and not by our SMS provider.');
  }

  if (changes.length === 0) return;

  if (!confirmed) {
    console.log('\n  Nothing written. Re-run with --confirm.\n');
    return;
  }

  // One transaction. Half-normalised is the state this script exists to end.
  await prisma.$transaction(
    changes.map((c) => {
      const data = { [c.field]: c.to };
      if (c.table === 'orders') return prisma.order.update({ where: { id: c.id }, data });
      if (c.table === 'bookings') return prisma.booking.update({ where: { id: c.id }, data });
      return prisma.rider.update({ where: { id: c.id }, data });
    })
  );

  console.log(`\n  Rewrote ${changes.length} number(s).\n`);
}

main()
  .catch((err) => {
    console.error('\n  Failed:', err instanceof Error ? err.message : err, '\n');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
