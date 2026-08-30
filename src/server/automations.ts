/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AUTOMATION_ACTOR } from '../brand.js';
import { randomToken } from './ids.js';
import { queueNotification } from './notifications.js';
import { prisma } from './prisma.js';

/**
 * Auto-queue a collection once its pickup is within the hour.
 *
 * Exported because the fleet page counts the same set to show how many orders
 * are waiting on capacity, and a second copy of this number would mean the
 * console reporting a backlog the assigner does not agree it has.
 */
export const QUEUE_WINDOW_MS = 60 * 60 * 1000;

/** How long a courier's self-service link stays usable once issued. */
export const RIDER_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** A collection rider still has the parcel while it is in one of these. */
const COLLECTION_LIVE = ['queued', 'picked_up'] as const;

/** A station rider still has it while it is in this one. */
const STATION_LIVE = ['to_station'] as const;

/**
 * Automation rules engine.
 *
 * Deliberately only automates ADMINISTRATIVE transitions — physical states
 * (picked_up / at_office / dispatched) are never invented here, they require a
 * real signal from a rider or from the office.
 *
 * TWO LEGS, TWO ASSIGNMENTS. A parcel is carried by a rider from the sender to
 * the office, and then by a rider from the office to the bus station. They are
 * usually different people and each is freed at the end of their OWN leg —
 * which is the whole reason the order carries two rider columns. When there was
 * one, a rider who collected a parcel stayed marked busy for as long as the
 * parcel existed, so the fleet reported no free capacity and the assigner, which
 * only gives work to free riders, stopped handing out collections entirely.
 *
 * The whole pass runs in one transaction. Each rule writes two or three rows
 * that must land together, and later rules read what earlier ones wrote.
 *
 * Returns human-readable actions taken, for logging.
 */
export async function runAutomations(): Promise<string[]> {
  const actions: string[] = [];

  await prisma.$transaction(async (tx) => {
    // ---- Rule A: money landed -> the parcel may travel ----------------------
    // `at_office` is where a parcel waits for its bill to be settled. Nothing
    // goes on a bus before this: past the station there is no leverage and
    // nobody of ours at the far end.
    const toRelease = await tx.order.findMany({
      where: { status: 'at_office', paymentStatus: 'paid' },
    });

    for (const order of toRelease) {
      await tx.order.update({ where: { id: order.id }, data: { status: 'paid' } });
      await tx.statusHistory.create({
        data: {
          orderId: order.id,
          status: 'paid',
          note: 'Payment received — ready for the station',
          changedByName: AUTOMATION_ACTOR,
        },
      });
      actions.push(`paid ${order.trackingCode}`);
    }

    // ---- Free the riders whose leg has finished -----------------------------
    // Runs BEFORE assignment, not after, so somebody who has just finished is
    // available to the queue in this same pass rather than sitting idle for up
    // to a minute on every handover.
    //
    // Each leg is checked against its own column. A rider who dropped a parcel
    // at the office is free even though the parcel is still very much alive —
    // their part of it is over.
    const busy = await tx.rider.findMany({ where: { available: false } });

    for (const rider of busy) {
      const [collecting, running] = await Promise.all([
        tx.order.count({
          where: { collectionRiderId: rider.id, status: { in: [...COLLECTION_LIVE] } },
        }),
        tx.order.count({
          where: { stationRiderId: rider.id, status: { in: [...STATION_LIVE] } },
        }),
      ]);

      if (collecting + running === 0) {
        await tx.rider.update({ where: { id: rider.id }, data: { available: true } });
        actions.push(`freed rider ${rider.name}`);
      }
    }

    /**
     * Hand the next parcels to whoever is free.
     *
     * Shared by both legs because the rule is identical either way: take the
     * riders who are on the fleet and carrying nothing, oldest first, and give
     * them the longest-waiting parcels. When the fleet runs out, say so once
     * with the size of the backlog rather than failing silently — a queue that
     * never drains should be visible in the log, not inferred from orders that
     * stay put.
     */
    const assign = async (
      due: { id: string; trackingCode: string; riderToken: string | null }[],
      leg: 'collection' | 'station'
    ) => {
      if (due.length === 0) return;

      const free = await tx.rider.findMany({
        where: { active: true, available: true },
        orderBy: { createdAt: 'asc' },
      });

      for (const order of due) {
        const rider = free.shift();
        if (!rider) {
          const waiting = due.length - due.indexOf(order);
          actions.push(`no free rider — ${waiting} ${leg}(s) waiting on capacity`);
          break;
        }

        await tx.rider.update({ where: { id: rider.id }, data: { available: false } });
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: leg === 'collection' ? 'queued' : 'to_station',
            ...(leg === 'collection'
              ? { collectionRiderId: rider.id }
              : { stationRiderId: rider.id }),
            riderToken: order.riderToken ?? randomToken(),
            riderTokenExpiresAt: new Date(Date.now() + RIDER_TOKEN_TTL_MS),
          },
        });
        await tx.statusHistory.create({
          data: {
            orderId: order.id,
            status: leg === 'collection' ? 'queued' : 'to_station',
            note:
              leg === 'collection'
                ? `Auto-queued — ${rider.name} collecting`
                : `Auto-queued — ${rider.name} running it to the station`,
            changedByName: AUTOMATION_ACTOR,
          },
        });

        // Only the collection earns a text. The sender is told who is coming to
        // their door; nobody needs to hear that a parcel crossed the office
        // yard, and the dispatch message carries the part that matters.
        if (leg === 'collection') {
          const full = await tx.order.findUnique({ where: { id: order.id } });
          if (full) {
            await queueNotification(tx, 'rider_assigned', {
              ...full,
              riderName: rider.name,
              riderPhone: rider.phone,
            });
          }
        }

        actions.push(`auto-queued ${order.trackingCode} (${leg}) -> ${rider.name}`);
      }
    };

    // ---- Rule B: pickup window + free rider -> assign the collection --------
    // Capacity lives here, not at confirmation: an order stays "confirmed
    // (awaiting rider)" for as long as the fleet is busy. Nothing is ever given
    // to a rider who is carrying something, and nothing is dropped — due orders
    // hold, oldest pickup first, and the release above means a rider who has
    // just finished takes the front of the queue in this same pass.
    await assign(
      await tx.order.findMany({
        where: {
          status: 'confirmed',
          scheduledPickupAt: { lte: new Date(Date.now() + QUEUE_WINDOW_MS) },
        },
        orderBy: { scheduledPickupAt: 'asc' },
        select: { id: true, trackingCode: true, riderToken: true },
      }),
      'collection'
    );

    // ---- Rule C: paid for -> assign the run to the station ------------------
    // No window on this one. A paid parcel is sitting in the office costing us
    // shelf space and the customer their patience, so it goes as soon as there
    // is somebody to take it. Oldest first, which is the order they were paid.
    await assign(
      await tx.order.findMany({
        where: { status: 'paid' },
        orderBy: { updatedAt: 'asc' },
        select: { id: true, trackingCode: true, riderToken: true },
      }),
      'station'
    );
  });

  return actions;
}
