/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { asyncRouter } from '../http.js';
import type { OrderStatus, RiderJob } from '../../types.js';
import { runAutomations } from '../automations.js';
import { prisma } from '../prisma.js';
import { notifyForStatus } from '../notifications.js';

/* ============================================================
   RIDER SELF-SERVICE (token-based, no admin login)
   A courier gets a link containing an opaque per-order token.
   The token can ONLY drive the physical steps of its own order —
   it can't read the fleet, touch pricing, or jump the workflow.
   ============================================================ */

export const riderRouter = asyncRouter();

/** The only transitions a courier is permitted to make, and only in order. */
const RIDER_NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  queued: 'picked_up',
  picked_up: 'in_transit',
  in_transit: 'delivered',
};

const INVALID_LINK = 'This delivery link is not valid or has expired.';

/**
 * Resolves a rider token, rejecting unknown and expired ones alike so an old
 * link shared in a WhatsApp group stops working.
 */
async function findOrderByRiderToken(token: string) {
  if (!token) return null;

  const order = await prisma.order.findUnique({
    where: { riderToken: token },
    include: { rider: true },
  });
  if (!order) return null;

  if (order.riderTokenExpiresAt && order.riderTokenExpiresAt.getTime() <= Date.now()) {
    return null;
  }

  return order;
}

riderRouter.get('/:token', async (req, res) => {
  const order = await findOrderByRiderToken(req.params.token);
  if (!order) {
    return res.status(404).json({ error: INVALID_LINK });
  }

  const job: RiderJob = {
    trackingCode: order.trackingCode,
    status: order.status,
    riderName: order.rider?.name ?? undefined,
    senderName: order.senderName,
    senderPhone: order.senderPhone,
    pickupAddress: order.pickupAddress,
    pickupNotes: order.pickupNotes ?? undefined,
    recipientName: order.recipientName,
    recipientPhone: order.recipientPhone,
    dropoffAddress: order.dropoffAddress,
    dropoffNotes: order.dropoffNotes ?? undefined,
    // Sent so the courier's Navigate link can name the region. "Asokwa" alone
    // finds three places in Ghana; "Asokwa, Ashanti" finds one.
    destinationRegion: order.destinationRegion ?? undefined,
    packageSize: order.packageSize,
    packageWeightKg: order.packageWeightKg.toNumber(),
    packageDescription: order.packageDescription,
    scheduledPickupAt: order.scheduledPickupAt.toISOString(),
    priceAmount: order.priceAmount,
    currency: order.currency,
    paymentStatus: order.paymentStatus,
    cashToCollect:
      order.paymentTiming === 'on_delivery' && order.paymentStatus !== 'paid',
    payer: order.payer,
  };

  res.json(job);
});

/** Courier advances the physical step (picked up -> in transit -> delivered). */
riderRouter.post('/:token/status', async (req, res) => {
  const order = await findOrderByRiderToken(req.params.token);
  if (!order) {
    return res.status(404).json({ error: INVALID_LINK });
  }

  const next = RIDER_NEXT_STATUS[order.status];
  if (!next) {
    return res.status(400).json({
      error: `No further update is available for this parcel (currently ${order.status.replace('_', ' ')}).`,
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id: order.id }, data: { status: next } });
    await notifyForStatus(tx, next, order);
    await tx.statusHistory.create({
      data: {
        orderId: order.id,
        status: next,
        note: `Marked "${next.replace('_', ' ')}" by courier in the field`,
        changedByName: order.rider?.name ?? 'Courier',
      },
    });
  });

  // Delivering an on-delivery order auto-reconciles its payment here.
  await runAutomations();

  const settled = await prisma.order.findUnique({ where: { id: order.id } });
  res.json({ success: true, status: settled?.status ?? next });
});

/** Courier records cash taken from the customer. */
riderRouter.post('/:token/collect', async (req, res) => {
  const order = await findOrderByRiderToken(req.params.token);
  if (!order) {
    return res.status(404).json({ error: INVALID_LINK });
  }
  if (order.paymentStatus === 'paid') {
    return res.status(400).json({ error: 'This parcel is already marked as paid.' });
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: { paymentStatus: 'paid' },
    });
    await tx.payment.create({
      data: {
        orderId: order.id,
        amount: order.priceAmount,
        currency: order.currency,
        provider: 'manual',
        status: 'success',
        paidAt: new Date(),
        note: `Cash collected in the field by ${order.rider?.name ?? 'courier'}`,
      },
    });
    await tx.statusHistory.create({
      data: {
        orderId: order.id,
        status: order.status,
        note: `Payment collected by courier (GHS ${(order.priceAmount / 100).toFixed(2)})`,
        changedByName: order.rider?.name ?? 'Courier',
      },
    });
  });

  res.json({ success: true, paymentStatus: 'paid' });
});
