/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Prisma } from '@prisma/client';
import { asyncRouter } from '../http.js';
import type { OrderStatus, PackageSize, Payer, PaymentTiming } from '../../types.js';
import { requireAdmin } from '../auth.js';
import { runAutomations } from '../automations.js';
import { withTrackingCode } from '../ids.js';
import { prisma } from '../prisma.js';
import { serializeHistory, serializeOrder, serializePayment } from '../serialize.js';

export const ordersRouter = asyncRouter();

const PACKAGE_SIZES: PackageSize[] = ['small', 'medium', 'large'];
const ORDER_STATUSES: OrderStatus[] = [
  'requested',
  'awaiting_payment',
  'confirmed',
  'queued',
  'picked_up',
  'in_transit',
  'delivered',
  'cancelled',
];

/** Phone numbers are stored as typed, so match both the trimmed and de-spaced forms. */
function phoneCandidates(raw: string): string[] {
  const trimmed = raw.trim();
  return [...new Set([trimmed, trimmed.replace(/\s+/g, '')])];
}

/* ---------------------------------------------------------------------------
   PUBLIC TRACKING LOOKUP
   Registered before '/:id' — Express would otherwise match "track" as an id.
   --------------------------------------------------------------------------- */
ordersRouter.get('/track', async (req, res) => {
  const query = req.query.q;
  if (typeof query !== 'string' || !query.trim()) {
    return res
      .status(400)
      .json({ error: 'Search query (tracking code or phone number) is required' });
  }

  // Phone matching is an EXACT comparison. It used to be a substring match,
  // which meant searching "0" returned nearly every order in the system.
  const phones = phoneCandidates(query);
  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { trackingCode: query.trim().toUpperCase() },
        { senderPhone: { in: phones } },
        { recipientPhone: { in: phones } },
      ],
    },
    include: { statusHistory: { orderBy: { changedAt: 'asc' } } },
  });

  if (orders.length === 0) {
    return res
      .status(404)
      .json({ error: 'No orders found matching tracking code or phone number' });
  }

  // Trimmed to what a customer needs to see — no pricing, payment provider,
  // rider token or admin attribution.
  res.json(
    orders.map((order) => ({
      id: order.id,
      trackingCode: order.trackingCode,
      senderName: order.senderName,
      recipientName: order.recipientName,
      pickupAddress: order.pickupAddress,
      dropoffAddress: order.dropoffAddress,
      packageSize: order.packageSize,
      packageDescription: order.packageDescription,
      scheduledPickupAt: order.scheduledPickupAt.toISOString(),
      status: order.status,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt.toISOString(),
      timeline: order.statusHistory.map((h) => ({
        status: h.status,
        note: h.note ?? undefined,
        changedAt: h.changedAt.toISOString(),
      })),
    }))
  );
});

/* ---------------------------------------------------------------------------
   PUBLIC BOOKING
   --------------------------------------------------------------------------- */
ordersRouter.post('/book', async (req, res) => {
  const {
    senderName,
    senderPhone,
    pickupAddress,
    pickupNotes,
    recipientName,
    recipientPhone,
    dropoffAddress,
    dropoffNotes,
    packageSize,
    packageWeightKg,
    packageDescription,
    scheduledPickupAt,
    paymentProvider,
    payer,
    paymentTiming,
  } = req.body ?? {};

  if (
    !senderName ||
    !senderPhone ||
    !pickupAddress ||
    !recipientName ||
    !recipientPhone ||
    !dropoffAddress ||
    !packageSize
  ) {
    return res.status(400).json({ error: 'Missing required fields for parcel booking' });
  }

  if (!PACKAGE_SIZES.includes(packageSize)) {
    return res.status(400).json({ error: 'Invalid package size' });
  }

  const pricing = await prisma.pricingConfig.findUnique({ where: { id: 1 } });
  if (!pricing) {
    return res.status(500).json({ error: 'Pricing is not configured' });
  }

  const size = packageSize as PackageSize;
  const basePrice = pricing[size];

  // Legacy mapping kept so existing clients keep working:
  // MoMo = pay up front, manual = settle at the door.
  const resolvedTiming: PaymentTiming =
    paymentTiming ?? (paymentProvider === 'momo' ? 'prepaid' : 'on_delivery');
  const resolvedPayer: Payer = payer ?? 'sender';

  // Prepaid orders are payment-gated: they park in awaiting_payment and cannot
  // confirm or dispatch until money lands. Pay-on-delivery orders are accepted
  // straight away but carry a visible "payment due" flag until reconciled.
  const isPrepaid = resolvedTiming === 'prepaid';
  const status: OrderStatus = isPrepaid ? 'awaiting_payment' : 'confirmed';

  const scheduled = scheduledPickupAt ? new Date(scheduledPickupAt) : new Date();
  if (Number.isNaN(scheduled.getTime())) {
    return res.status(400).json({ error: 'Invalid scheduled pickup time' });
  }

  // Order, its first history row and any pending MoMo payment must land
  // together — a booking with no audit trail is not a booking.
  const created = await withTrackingCode((trackingCode) =>
    prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          trackingCode,
          senderName,
          senderPhone,
          pickupAddress,
          pickupNotes: pickupNotes || null,
          recipientName,
          recipientPhone,
          dropoffAddress,
          dropoffNotes: dropoffNotes || null,
          packageSize: size,
          packageWeightKg: Number(packageWeightKg) || 1,
          packageDescription: packageDescription || 'Parcel Delivery',
          scheduledPickupAt: scheduled,
          priceAmount: basePrice,
          currency: pricing.currency,
          status,
          paymentStatus: 'pending',
          payer: resolvedPayer,
          paymentTiming: resolvedTiming,
        },
      });

      await tx.statusHistory.create({
        data: {
          orderId: order.id,
          status,
          note: isPrepaid
            ? `Order submitted — awaiting payment from ${resolvedPayer}`
            : `Order submitted and auto-confirmed — payment due on delivery (${resolvedPayer})`,
          changedByName: 'Waypoint Automation',
        },
      });

      if (paymentProvider === 'momo') {
        await tx.payment.create({
          data: {
            orderId: order.id,
            amount: basePrice,
            currency: pricing.currency,
            provider: 'momo',
            status: 'pending',
          },
        });
      }

      return order;
    })
  );

  await runAutomations();

  // Re-read: automations may already have queued this order and assigned a
  // rider, and the caller should see the settled state.
  const settled = await prisma.order.findUnique({
    where: { id: created.id },
    include: { rider: true },
  });

  res.status(201).json({
    success: true,
    order: serializeOrder(settled ?? created),
    trackingCode: created.trackingCode,
  });
});

/* ---------------------------------------------------------------------------
   ADMIN: LIST WITH FILTERS
   --------------------------------------------------------------------------- */
ordersRouter.get('/', requireAdmin, async (req, res) => {
  const { status, search, startDate, endDate } = req.query;

  const where: Prisma.OrderWhereInput = {};

  if (typeof status === 'string' && ORDER_STATUSES.includes(status as OrderStatus)) {
    where.status = status as OrderStatus;
  }

  if (typeof search === 'string' && search.trim()) {
    const q = search.trim();
    const insensitive = { contains: q, mode: 'insensitive' } as const;
    where.OR = [
      { trackingCode: insensitive },
      { senderName: insensitive },
      { senderPhone: { contains: q } },
      { recipientName: insensitive },
      { recipientPhone: { contains: q } },
      { pickupAddress: insensitive },
      { dropoffAddress: insensitive },
    ];
  }

  const createdAt: Prisma.DateTimeFilter = {};
  if (typeof startDate === 'string' && !Number.isNaN(Date.parse(startDate))) {
    createdAt.gte = new Date(startDate);
  }
  if (typeof endDate === 'string' && !Number.isNaN(Date.parse(endDate))) {
    createdAt.lte = new Date(endDate);
  }
  if (createdAt.gte || createdAt.lte) {
    where.createdAt = createdAt;
  }

  const orders = await prisma.order.findMany({
    where,
    include: { rider: true },
    orderBy: { createdAt: 'desc' },
  });

  res.json(orders.map(serializeOrder));
});

/* ---------------------------------------------------------------------------
   ADMIN: ORDER DETAIL
   --------------------------------------------------------------------------- */
ordersRouter.get('/:id', requireAdmin, async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: {
      rider: true,
      statusHistory: { orderBy: { changedAt: 'desc' } },
      payments: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  res.json({
    order: serializeOrder(order),
    history: order.statusHistory.map(serializeHistory),
    payments: order.payments.map(serializePayment),
  });
});

/* ---------------------------------------------------------------------------
   ADMIN: UPDATE STATUS
   --------------------------------------------------------------------------- */
ordersRouter.patch('/:id/status', requireAdmin, async (req, res) => {
  const { status, note } = req.body ?? {};
  const admin = req.admin!;

  if (!status) {
    return res.status(400).json({ error: 'New status is required' });
  }
  if (!ORDER_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Unknown status' });
  }

  const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const history = await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: existing.id },
      data: { status: status as OrderStatus },
    });
    return tx.statusHistory.create({
      data: {
        orderId: existing.id,
        status: status as OrderStatus,
        note: note || `Status updated from ${existing.status} to ${status}`,
        changedByAdminId: admin.id,
        changedByName: admin.name,
      },
    });
  });

  await runAutomations();

  const settled = await prisma.order.findUnique({
    where: { id: existing.id },
    include: { rider: true },
  });

  res.json({
    success: true,
    order: settled ? serializeOrder(settled) : null,
    history: serializeHistory(history),
  });
});

/* ---------------------------------------------------------------------------
   ADMIN: RECORD A PAYMENT BY HAND
   --------------------------------------------------------------------------- */
ordersRouter.post('/:id/pay', requireAdmin, async (req, res) => {
  const { amount, note, providerReference } = req.body ?? {};
  const admin = req.admin!;

  const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const payAmount = typeof amount === 'number' ? amount : existing.priceAmount;

  const payment = await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: existing.id },
      data: { paymentStatus: 'paid' },
    });

    const created = await tx.payment.create({
      data: {
        orderId: existing.id,
        amount: payAmount,
        currency: existing.currency,
        provider: 'manual',
        providerReference: providerReference || null,
        status: 'success',
        paidAt: new Date(),
        recordedByAdminId: admin.id,
        note: note || 'Manually marked as paid by administrator',
      },
    });

    await tx.statusHistory.create({
      data: {
        orderId: existing.id,
        status: existing.status,
        note: `Payment marked as PAID manually (Recorded: GHS ${(payAmount / 100).toFixed(2)})`,
        changedByAdminId: admin.id,
        changedByName: admin.name,
      },
    });

    return created;
  });

  await runAutomations();

  const settled = await prisma.order.findUnique({
    where: { id: existing.id },
    include: { rider: true },
  });

  res.json({
    success: true,
    order: settled ? serializeOrder(settled) : null,
    payment: serializePayment(payment),
  });
});
