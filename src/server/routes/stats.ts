/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Prisma } from '@prisma/client';
import { asyncRouter } from '../http.js';
import type { DashboardStats, OrderStatus } from '../../types.js';
import { requireAdmin } from '../auth.js';
import { can, requirePermission } from '../permissions.js';
import { prisma } from '../prisma.js';

export const statsRouter = asyncRouter();

/**
 * A payment counts towards the period it was settled in, falling back to when
 * it was created if it has no paidAt.
 */
function settledSince(since: Date): Prisma.PaymentWhereInput {
  return {
    status: 'success',
    OR: [{ paidAt: { gte: since } }, { paidAt: null, createdAt: { gte: since } }],
  };
}

async function sumRevenue(where: Prisma.PaymentWhereInput): Promise<number> {
  const result = await prisma.payment.aggregate({ where, _sum: { amount: true } });
  return result._sum.amount ?? 0;
}

statsRouter.get('/', requireAdmin, requirePermission('orders:read'), async (req, res) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Turnover is not everyone's business — support gets the counts needed to
  // run the road operation and nothing about money. The figures are not merely
  // hidden in the UI; they are never queried.
  const showRevenue = can(req.admin!.role, 'revenue:read');

  // Summed in the database rather than by walking every payment in memory.
  const [today, week, month, allTime, grouped] = await Promise.all([
    showRevenue ? sumRevenue(settledSince(todayStart)) : 0,
    showRevenue ? sumRevenue(settledSince(oneWeekAgo)) : 0,
    showRevenue ? sumRevenue(settledSince(oneMonthAgo)) : 0,
    showRevenue ? sumRevenue({ status: 'success' }) : 0,
    prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  // The dashboard expects every status present, including the zeroes.
  const counts: Record<OrderStatus, number> = {
    requested: 0,
    confirmed: 0,
    queued: 0,
    picked_up: 0,
    at_office: 0,
    paid: 0,
    to_station: 0,
    dispatched: 0,
    cancelled: 0,
    // Retired, but a database that predates the bus model still holds rows in
    // them, and the dashboard expects every key present.
    awaiting_payment: 0,
    in_transit: 0,
    delivered: 0,
  };
  for (const row of grouped) {
    counts[row.status] = row._count._all;
  }

  const stats: DashboardStats = {
    ...(showRevenue ? { revenue: { today, week, month, allTime } } : {}),
    counts,
  };

  res.json(stats);
});
