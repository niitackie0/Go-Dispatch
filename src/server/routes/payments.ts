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

/** RFC 4180 quoting: wrap in quotes, double any quote inside. */
function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value).replace(/[\r\n]+/g, ' ');
  return `"${text.replace(/"/g, '""')}"`;
}

paymentsRouter.get('/export', requireAdmin, requirePermission('payments:read'), async (_req, res) => {
  const payments = await prisma.payment.findMany({
    include: { order: true },
    orderBy: { createdAt: 'desc' },
  });

  const rows = [
    'Payment ID,Order Tracking,Sender,Phone,Amount (GHS),Provider,Reference,Status,Paid At,Recorded By,Notes',
  ];

  for (const p of payments) {
    rows.push(
      [
        csvCell(p.id),
        csvCell(p.order?.trackingCode ?? 'N/A'),
        csvCell(p.order?.senderName ?? 'N/A'),
        csvCell(p.order?.senderPhone ?? 'N/A'),
        (p.amount / 100).toFixed(2),
        csvCell(p.provider),
        csvCell(p.providerReference ?? ''),
        csvCell(p.status),
        csvCell(p.paidAt ? p.paidAt.toLocaleDateString() : 'N/A'),
        csvCell(p.recordedByAdminId ? 'Admin' : 'Gateway'),
        csvCell(p.note ?? ''),
      ].join(',')
    );
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader(
    'Content-Disposition',
    'attachment; filename=go-dispatch-payments-export.csv'
  );
  res.status(200).send(rows.join('\n') + '\n');
});

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
