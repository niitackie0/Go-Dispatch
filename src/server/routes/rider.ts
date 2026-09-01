/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { asyncRouter } from '../http.js';
import { currentRider, ORDER_RIDERS } from '../serialize.js';
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

/**
 * The only transitions a courier is permitted to make, and only in order.
 *
 * THE COLLECTION LEG ONLY: pick the parcel up from the sender, and drop it at
 * the office. That is the whole of what a courier can assert from a phone.
 *
 * The station leg deliberately stops here. Marking a parcel dispatched texts
 * both the sender and the recipient, so it is confirmed at the office by
 * somebody who can see the parcel actually went, rather than from a phone at
 * a roadside.
 */
const RIDER_NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  queued: 'picked_up',
  picked_up: 'at_office',
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
    include: ORDER_RIDERS,
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
    riderName: currentRider(order)?.name ?? undefined,
    senderName: order.senderName,
    senderPhone: order.senderPhone,
    pickupAddress: order.pickupAddress,
    pickupNotes: order.pickupNotes ?? undefined,
    recipientName: order.recipientName,
    recipientPhone: order.recipientPhone,
    dropoffAddress: order.dropoffAddress,
    dropoffNotes: order.dropoffNotes ?? undefined,
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
        changedByName: currentRider(order)?.name ?? 'Courier',
      },
    });
  });

  // A parcel reaching the office frees its collection rider, which the next
  // pass would do anyway -- running it here means the rider is available
  // before they have put their phone back in their pocket.
  await runAutomations();

  const settled = await prisma.order.findUnique({ where: { id: order.id } });
  res.json({ success: true, status: settled?.status ?? next });
});

/* THE CASH-COLLECTION ENDPOINT IS GONE.
 *
 * A courier used to be able to record money taken from a customer at the door.
 * Nobody pays at a door any more: the parcel is weighed at the office, the bill
 * goes out by SMS, and it is settled by MoMo before anything is put on a bus.
 * An endpoint that marks a parcel paid on a courier's say-so is now a way to
 * dispatch something nobody has paid for.
 */
