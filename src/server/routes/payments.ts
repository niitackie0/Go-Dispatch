/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { asyncRouter } from '../http.js';
import { requireAdmin } from '../auth.js';
import { requirePermission } from '../permissions.js';
import { prisma } from '../prisma.js';
import { serializePayment } from '../serialize.js';

export const paymentsRouter = asyncRouter();

/**
  * How many rows a list endpoint will ever return.
  *
  * The console fetches the whole ledger and paginates it in the browser, which
  * is fine at three payments and is the whole table over the wire at thirty
  * thousand. Full server-side paging is a larger change than this needs today;
  * a cap is not that, but it does mean the query can never become unbounded,
  * and the response says when it has been cut so the interface can say so too
  * rather than quietly hiding older rows.
  */
export const LIST_CAP = 500;

paymentsRouter.get('/', requireAdmin, requirePermission('payments:read'), async (_req, res) => {
  const payments = await prisma.payment.findMany({
    include: { order: true },
    orderBy: { createdAt: 'desc' },
    take: LIST_CAP + 1,
  });

  const truncated = payments.length > LIST_CAP;
  const rows = truncated ? payments.slice(0, LIST_CAP) : payments;

  res.json({
    truncated,
    cap: LIST_CAP,
    payments: rows.map((p) => ({
      ...serializePayment(p),
      trackingCode: p.order?.trackingCode ?? 'UNKNOWN',
      senderName: p.order?.senderName ?? 'UNKNOWN',
      senderPhone: p.order?.senderPhone ?? 'UNKNOWN',
    })),
  });
});


/* ---------------------------------------------------------------------------
   THE DAY'S RECONCILIATION

   The question this answers is asked at six o'clock with a cash box open:
   how much money should be here, and who is holding the rest of it?

   Everything is settled by paidAt, not createdAt. A payment recorded on
   Tuesday for a parcel delivered on Monday belongs to Tuesday's takings --
   that is the day the money moved, and the day somebody has to account for it.

   The split that matters is not by payment method, it is by WHERE THE MONEY
   PHYSICALLY IS:

     in the office   an admin recorded it, so it arrived here
     with a courier  collected at a door and not yet handed in

   A method breakdown cannot answer that. Mobile money and cash both come
   through as `manual`, and the difference between them is who is standing
   where, which is what recordedByAdminId actually records.
   --------------------------------------------------------------------------- */
paymentsRouter.get('/day', requireAdmin, requirePermission('payments:read'), async (req, res) => {
  const raw = typeof req.query.date === 'string' ? req.query.date : '';
  const anchor = raw ? new Date(`${raw}T00:00:00`) : new Date();
  if (Number.isNaN(anchor.getTime())) {
    return res.status(400).json({ error: 'Use a date like 2026-08-19' });
  }

  const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  const [settled, deliveredUnpaid] = await Promise.all([
    prisma.payment.findMany({
      where: { status: 'success', paidAt: { gte: start, lt: end } },
      include: { order: { include: { rider: true } } },
      orderBy: { paidAt: 'asc' },
    }),
    // Delivered today and still owing. This is the number that should be zero
    // by close, and the reason to walk over to somebody's desk when it is not.
    prisma.order.findMany({
      where: { status: 'delivered', paymentStatus: { not: 'paid' }, updatedAt: { gte: start, lt: end } },
      select: { trackingCode: true, priceAmount: true, currency: true, rider: { select: { name: true } } },
    }),
  ]);

  const sum = (rows: { amount: number }[]) => rows.reduce((t, r) => t + r.amount, 0);

  const inOffice = settled.filter((p) => p.recordedByAdminId !== null);
  const withCourier = settled.filter((p) => p.recordedByAdminId === null);

  // Who is carrying what. Named per courier because the follow-up is a
  // conversation with a person, not a query.
  const byCourier = new Map<string, { amount: number; count: number }>();
  for (const p of withCourier) {
    const name = p.order?.rider?.name ?? 'Unattributed';
    const row = byCourier.get(name) ?? { amount: 0, count: 0 };
    row.amount += p.amount;
    row.count += 1;
    byCourier.set(name, row);
  }

  res.json({
    date: start.toISOString().slice(0, 10),
    currency: settled[0]?.currency ?? 'GHS',

    total: sum(settled),
    count: settled.length,

    inOffice: { amount: sum(inOffice), count: inOffice.length },
    withCouriers: { amount: sum(withCourier), count: withCourier.length },

    couriers: [...byCourier.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.amount - a.amount),

    // Every line, so a disputed figure can be traced rather than argued about.
    lines: settled.map((p) => ({
      trackingCode: p.order?.trackingCode ?? 'UNKNOWN',
      amount: p.amount,
      provider: p.provider,
      at: (p.paidAt ?? p.createdAt).toISOString(),
      heldBy: p.recordedByAdminId ? 'office' : (p.order?.rider?.name ?? 'a courier'),
      note: p.note ?? undefined,
    })),

    owing: {
      amount: deliveredUnpaid.reduce((t, o) => t + o.priceAmount, 0),
      count: deliveredUnpaid.length,
      orders: deliveredUnpaid.map((o) => ({
        trackingCode: o.trackingCode,
        amount: o.priceAmount,
        rider: o.rider?.name ?? undefined,
      })),
    },
  });
});
