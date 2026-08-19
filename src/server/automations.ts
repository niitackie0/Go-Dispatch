/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AUTOMATION_ACTOR } from '../brand.js';
import { randomToken } from './ids.js';
import { queueNotification } from './notifications.js';
import { prisma } from './prisma.js';

/** Auto-queue an order once its pickup is within the hour. */
const QUEUE_WINDOW_MS = 60 * 60 * 1000;

/** How long a courier's self-service link stays usable once issued. */
export const RIDER_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Automation rules engine.
 *
 * Deliberately only automates ADMINISTRATIVE transitions — physical states
 * (picked_up / in_transit / delivered) are never invented here, they require a
 * real signal from a rider.
 *
 * The whole pass runs in one transaction. Each rule writes two or three rows
 * (order + history, or order + payment + history) that must land together, and
 * later rules read the rows earlier ones wrote — Rule B picks up orders that
 * Rule A confirmed in the same pass, exactly as the original loop did.
 *
 * Returns human-readable actions taken, for logging.
 */
export async function runAutomations(): Promise<string[]> {
  const actions: string[] = [];

  await prisma.$transaction(async (tx) => {
    // ---- Rule A: payment received -> auto-confirm ---------------------------
    // Prepaid orders sit in awaiting_payment and cannot dispatch until paid.
    const toConfirm = await tx.order.findMany({
      where: { status: 'awaiting_payment', paymentStatus: 'paid' },
    });

    for (const order of toConfirm) {
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'confirmed' },
      });
      await tx.statusHistory.create({
        data: {
          orderId: order.id,
          status: 'confirmed',
          note: 'Auto-confirmed — payment received',
          changedByName: AUTOMATION_ACTOR,
        },
      });
      // One message, not two: this pass sees the payment and confirms the
      // booking in the same breath, and the confirmation says both.
      await queueNotification(tx, 'booking_confirmed', { ...order, paymentStatus: 'paid' });
      actions.push(`auto-confirmed ${order.trackingCode}`);
    }

    // ---- Release riders whose job has finished ------------------------------
    // Runs BEFORE assignment, not after, so a rider who finished a drop is
    // available to the queue in this same pass. Previously the release happened
    // at the end, so a freed rider sat idle until the next tick — up to a
    // minute of avoidable delay on every handover.
    //
    // The token is left in place so the courier's page still renders straight
    // after they mark delivered; riderTokenExpiresAt retires it later.
    const finished = await tx.order.findMany({
      where: {
        status: { in: ['delivered', 'cancelled'] },
        riderId: { not: null },
        rider: { available: false },
      },
      include: { rider: true },
    });

    for (const order of finished) {
      if (!order.rider) continue;

      // Only release if this rider has nothing else live. Freeing on the first
      // finished order would hand them a second parcel while still carrying one.
      const stillCarrying = await tx.order.count({
        where: {
          riderId: order.rider.id,
          status: { in: ['queued', 'picked_up', 'in_transit'] },
        },
      });
      if (stillCarrying > 0) continue;

      await tx.rider.update({
        where: { id: order.rider.id },
        data: { available: true },
      });
      actions.push(`freed rider ${order.rider.name}`);
    }

    // ---- Rule B: pickup window + free rider -> auto-queue -------------------
    // Capacity lives here, not at confirmation: an order stays "confirmed
    // (awaiting rider)" for as long as the fleet is busy.
    const due = await tx.order.findMany({
      where: {
        status: 'confirmed',
        scheduledPickupAt: { lte: new Date(Date.now() + QUEUE_WINDOW_MS) },
      },
      orderBy: { scheduledPickupAt: 'asc' },
    });

    if (due.length > 0) {
      const freeRiders = await tx.rider.findMany({
        where: { available: true },
        orderBy: { createdAt: 'asc' },
      });

      for (const order of due) {
        const rider = freeRiders.shift();
        if (!rider) {
          // Fleet fully committed. Say so once, with the size of the backlog,
          // rather than failing silently — a queue that never drains should be
          // visible in the log, not inferred from orders that stay confirmed.
          const waiting = due.length - due.indexOf(order);
          actions.push(`no free rider — ${waiting} order(s) waiting on capacity`);
          break;
        }

        await tx.rider.update({
          where: { id: rider.id },
          data: { available: false },
        });
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'queued',
            riderId: rider.id,
            riderToken: order.riderToken ?? randomToken(),
            riderTokenExpiresAt: new Date(Date.now() + RIDER_TOKEN_TTL_MS),
          },
        });
        await tx.statusHistory.create({
          data: {
            orderId: order.id,
            status: 'queued',
            note: `Auto-queued — assigned to ${rider.name}`,
            changedByName: AUTOMATION_ACTOR,
          },
        });
        await queueNotification(tx, 'rider_assigned', {
          ...order,
          riderName: rider.name,
          riderPhone: rider.phone,
        });
        actions.push(`auto-queued ${order.trackingCode} -> ${rider.name}`);
      }
    }

    // ---- Rule C: delivered on-delivery order -> auto-reconcile payment ------
    const toReconcile = await tx.order.findMany({
      where: {
        status: 'delivered',
        paymentTiming: 'on_delivery',
        paymentStatus: { not: 'paid' },
      },
    });

    for (const order of toReconcile) {
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
          note: `Auto-reconciled — cash collected on delivery (${order.payer})`,
        },
      });
      await tx.statusHistory.create({
        data: {
          orderId: order.id,
          status: 'delivered',
          note: 'Payment auto-reconciled — collected on delivery',
          changedByName: AUTOMATION_ACTOR,
        },
      });
      actions.push(`auto-reconciled ${order.trackingCode}`);
    }

  });

  return actions;
}
