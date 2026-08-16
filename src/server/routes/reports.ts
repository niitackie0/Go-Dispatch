/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Response } from 'express';
import { asyncRouter } from '../http.js';
import { requireAdmin } from '../auth.js';
import { can, requirePermission } from '../permissions.js';
import { prisma } from '../prisma.js';

export const reportsRouter = asyncRouter();

/**
 * Downloadable reports.
 *
 * Generated on the server, not from whatever the console happens to have
 * loaded: the dashboard paginates to 10 rows, and a report built from that
 * would quietly under-report. These queries read the whole range.
 *
 * CSV rather than a spreadsheet format because it opens in Excel, Sheets and
 * every accounting package without a library on either end.
 */

/**
 * Escape a value for CSV.
 *
 * The leading-character guard matters: a cell beginning =, +, - or @ is
 * executed as a formula when the file is opened in Excel, which is how a
 * customer-supplied name becomes code running on the finance machine.
 */
function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(cell).join(',')];
  for (const row of rows) lines.push(row.map(cell).join(','));
  // BOM so Excel opens UTF-8 correctly — without it, Ghanaian names with
  // accents arrive mangled.
  return '﻿' + lines.join('\r\n') + '\r\n';
}

function sendCsv(res: Response, filename: string, csv: string): void {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

const money = (pesewas: number) => (pesewas / 100).toFixed(2);
const day = (d: Date) => d.toISOString().slice(0, 10);

/** Parse the range, defaulting to the last 30 days. */
function range(req: { query: Record<string, unknown> }): { from: Date; to: Date; label: string } {
  const now = new Date();
  const rawFrom = typeof req.query.from === 'string' ? new Date(req.query.from) : null;
  const rawTo = typeof req.query.to === 'string' ? new Date(req.query.to) : null;

  const from =
    rawFrom && !Number.isNaN(rawFrom.getTime())
      ? rawFrom
      : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // An end date is a whole day, not midnight at its start.
  const to = rawTo && !Number.isNaN(rawTo.getTime()) ? rawTo : now;
  to.setHours(23, 59, 59, 999);

  return { from, to, label: `${day(from)}_to_${day(to)}` };
}

/* ---------------------------------------------------------------------------
   PAYMENTS — what came in. Finance and owner only.
   --------------------------------------------------------------------------- */
reportsRouter.get('/payments.csv', requireAdmin, requirePermission('payments:read'), async (req, res) => {
  const { from, to, label } = range(req);

  const payments = await prisma.payment.findMany({
    where: { OR: [{ paidAt: { gte: from, lte: to } }, { paidAt: null, createdAt: { gte: from, lte: to } }] },
    include: { order: { select: { trackingCode: true, senderName: true, senderPhone: true, destinationRegion: true } } },
    orderBy: { createdAt: 'asc' },
  });

  sendCsv(
    res,
    `go-dispatch-payments_${label}.csv`,
    toCsv(
      ['Date', 'Tracking code', 'Sender', 'Phone', 'Region', 'Amount', 'Currency', 'Method', 'Status', 'Provider reference', 'Note'],
      payments.map((p) => [
        day(p.paidAt ?? p.createdAt),
        p.order?.trackingCode,
        p.order?.senderName,
        p.order?.senderPhone,
        p.order?.destinationRegion,
        money(p.amount),
        p.currency,
        p.provider,
        p.status,
        p.providerReference,
        p.note,
      ])
    )
  );
});

/* ---------------------------------------------------------------------------
   ORDERS — what we moved. Price columns omitted for roles without revenue.
   --------------------------------------------------------------------------- */
reportsRouter.get('/orders.csv', requireAdmin, requirePermission('orders:read'), async (req, res) => {
  const { from, to, label } = range(req);
  const showMoney = can(req.admin!.role, 'revenue:read');

  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: from, lte: to } },
    include: { rider: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const headers = [
    'Booked', 'Tracking code', 'Status', 'Region', 'Pickup', 'Delivery address',
    'Sender', 'Sender phone', 'Recipient', 'Recipient phone', 'Weight (kg)', 'Rider',
    ...(showMoney ? ['Price', 'Currency', 'Payment status'] : []),
  ];

  sendCsv(
    res,
    `go-dispatch-orders_${label}.csv`,
    toCsv(
      headers,
      orders.map((o) => [
        day(o.createdAt),
        o.trackingCode,
        o.status,
        o.destinationRegion,
        o.pickupAddress,
        o.dropoffAddress,
        o.senderName,
        o.senderPhone,
        o.recipientName,
        o.recipientPhone,
        o.packageWeightKg.toString(),
        o.rider?.name,
        ...(showMoney ? [money(o.priceAmount), o.currency, o.paymentStatus] : []),
      ])
    )
  );
});

/* ---------------------------------------------------------------------------
   REVENUE BY DAY — the summary an accountant actually wants.
   --------------------------------------------------------------------------- */
reportsRouter.get('/revenue.csv', requireAdmin, requirePermission('revenue:read'), async (req, res) => {
  const { from, to, label } = range(req);

  const payments = await prisma.payment.findMany({
    where: {
      status: 'success',
      OR: [{ paidAt: { gte: from, lte: to } }, { paidAt: null, createdAt: { gte: from, lte: to } }],
    },
    select: { amount: true, paidAt: true, createdAt: true, provider: true, currency: true },
  });

  // Grouped in memory rather than SQL: this is at most a few thousand rows for
  // a range anyone would actually export, and it keeps the date bucketing in
  // the same timezone as the rest of the app.
  const byDay = new Map<string, { momo: number; manual: number; count: number; currency: string }>();
  for (const p of payments) {
    const key = day(p.paidAt ?? p.createdAt);
    const row = byDay.get(key) ?? { momo: 0, manual: 0, count: 0, currency: p.currency };
    if (p.provider === 'momo') row.momo += p.amount;
    else row.manual += p.amount;
    row.count += 1;
    byDay.set(key, row);
  }

  const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
  const total = days.reduce((sum, [, r]) => sum + r.momo + r.manual, 0);

  sendCsv(
    res,
    `go-dispatch-revenue_${label}.csv`,
    toCsv(
      ['Date', 'Payments', 'Mobile Money', 'Cash / manual', 'Total', 'Currency'],
      [
        ...days.map(([d, r]) => [d, r.count, money(r.momo), money(r.manual), money(r.momo + r.manual), r.currency]),
        [],
        ['TOTAL', payments.length, '', '', money(total), days[0]?.[1].currency ?? 'GHS'],
      ]
    )
  );
});

/* ---------------------------------------------------------------------------
   SUMMARY — the same numbers as JSON, so the console can preview a range
   before anyone downloads it.
   --------------------------------------------------------------------------- */
reportsRouter.get('/summary', requireAdmin, requirePermission('orders:read'), async (req, res) => {
  const { from, to } = range(req);
  const showMoney = can(req.admin!.role, 'revenue:read');

  const [orders, delivered, cancelled, payments] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: from, lte: to } } }),
    prisma.order.count({ where: { createdAt: { gte: from, lte: to }, status: 'delivered' } }),
    prisma.order.count({ where: { createdAt: { gte: from, lte: to }, status: 'cancelled' } }),
    showMoney
      ? prisma.payment.aggregate({
          where: {
            status: 'success',
            OR: [{ paidAt: { gte: from, lte: to } }, { paidAt: null, createdAt: { gte: from, lte: to } }],
          },
          _sum: { amount: true },
          _count: { _all: true },
        })
      : null,
  ]);

  res.json({
    from: day(from),
    to: day(to),
    orders,
    delivered,
    cancelled,
    ...(showMoney
      ? { revenue: payments?._sum.amount ?? 0, paymentCount: payments?._count._all ?? 0 }
      : {}),
  });
});
