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

   The split is by WHO PUT THE ROW THERE:

     recorded by staff   somebody at the office saw the money and said so
     recorded by itself  a provider callback settled it with no human involved

   That used to be "in the office" versus "with a courier", because money was
   collected at doors and carried back. It is not any more: nothing is paid at a
   door, the bill is settled by MoMo after the parcel is weighed at the office,
   and a parcel does not go on a bus until it clears. So the question the panel
   answers changed with it -- from "where is the cash" to "what did we take, and
   how much of it did a person have to key in".

   The number to watch is `owing`: parcels sitting at the office, weighed and
   billed, that nobody has paid for. Those are not going anywhere, and by close
   the list should be empty.
   --------------------------------------------------------------------------- */
paymentsRouter.get('/day', requireAdmin, requirePermission('payments:read'), async (req, res) => {
  const raw = typeof req.query.date === 'string' ? req.query.date : '';
  const anchor = raw ? new Date(`${raw}T00:00:00`) : new Date();
  if (Number.isNaN(anchor.getTime())) {
    return res.status(400).json({ error: 'Use a date like 2026-08-19' });
  }

  const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  const [settled, unpaidAtOffice] = await Promise.all([
    prisma.payment.findMany({
      where: { status: 'success', paidAt: { gte: start, lt: end } },
      include: { order: true },
      orderBy: { paidAt: 'asc' },
    }),
    // Weighed, billed, and stuck. NOT filtered by date on purpose: a parcel
    // that has sat unpaid since Tuesday is more of a problem today than one
    // billed this morning, and a day-scoped query is exactly what would hide it.
    prisma.order.findMany({
      where: { status: 'at_office', paymentStatus: { not: 'paid' } },
      select: {
        trackingCode: true,
        priceAmount: true,
        currency: true,
        payer: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'asc' },
    }),
  ]);

  const sum = (rows: { amount: number }[]) => rows.reduce((t, r) => t + r.amount, 0);

  const byStaff = settled.filter((p) => p.recordedByAdminId !== null);
  const automatic = settled.filter((p) => p.recordedByAdminId === null);

  res.json({
    date: start.toISOString().slice(0, 10),
    currency: settled[0]?.currency ?? 'GHS',

    total: sum(settled),
    count: settled.length,

    recordedByStaff: { amount: sum(byStaff), count: byStaff.length },
    automatic: { amount: sum(automatic), count: automatic.length },

    // Every line, so a disputed figure can be traced rather than argued about.
    lines: settled.map((p) => ({
      trackingCode: p.order?.trackingCode ?? 'UNKNOWN',
      amount: p.amount,
      provider: p.provider,
      at: (p.paidAt ?? p.createdAt).toISOString(),
      recordedBy: p.recordedByAdminId ? 'staff' : 'automatic',
      note: p.note ?? undefined,
    })),

    owing: {
      amount: unpaidAtOffice.reduce((t, o) => t + o.priceAmount, 0),
      count: unpaidAtOffice.length,
      orders: unpaidAtOffice.map((o) => ({
        trackingCode: o.trackingCode,
        amount: o.priceAmount,
        // Who to chase. On a recipient-pays parcel that is not the person who
        // booked it, which is the whole reason this is worth printing.
        payer: o.payer,
        waitingSince: o.updatedAt.toISOString(),
      })),
    },
  });
});
