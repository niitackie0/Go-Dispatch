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

paymentsRouter.get('/', requireAdmin, requirePermission('payments:read'), async (_req, res) => {
  const payments = await prisma.payment.findMany({
    include: { order: true },
    orderBy: { createdAt: 'desc' },
  });

  res.json(
    payments.map((p) => ({
      ...serializePayment(p),
      trackingCode: p.order?.trackingCode ?? 'UNKNOWN',
      senderName: p.order?.senderName ?? 'UNKNOWN',
      senderPhone: p.order?.senderPhone ?? 'UNKNOWN',
    }))
  );
});
