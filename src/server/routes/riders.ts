/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { toE164, formatPhone } from '../../phone.js';
import type { FleetRider } from '../../types.js';
import { requireAdmin } from '../auth.js';
import { QUEUE_WINDOW_MS } from '../automations.js';
import { asyncRouter } from '../http.js';
import { requirePermission } from '../permissions.js';
import { prisma } from '../prisma.js';
import { serializeRider } from '../serialize.js';

/* ============================================================
   THE FLEET — the roster of couriers, managed by an owner.

   Riders are NOT staff accounts. Nothing here creates a login,
   a password or a role: a courier works from a per-order link
   (see routes/rider.ts) that can only move its own parcel
   through its physical steps. Adding somebody here adds a name,
   a phone number and one unit of delivery capacity — nothing
   that can reach the console.

   Support may READ this list, because they have to know who is
   out and on what number. Only an owner may change it: hiring
   is not a decision that belongs to whoever is on the phone.
   ============================================================ */

export const ridersRouter = asyncRouter();

/** A collection is in this rider's hands while it is in one of these. */
const COLLECTION_LIVE = ['queued', 'picked_up'] as const;

/** A station run is in their hands while it is in this one. */
const STATION_LIVE = ['to_station'] as const;

/** Prisma's unique-constraint violation, i.e. the phone is already on the fleet. */
function isDuplicate(err: unknown): boolean {
  return (err as { code?: string })?.code === 'P2002';
}

/**
 * A phone number, or the reason it cannot be one.
 *
 * Riders are the one place a Ghanaian mobile is genuinely required. A customer
 * may hand us a landline or a foreign number and we store what they typed
 * (src/phone.ts explains why), but a courier's number is what a waiting
 * customer is told to expect a call from — it goes out in the rider_assigned
 * SMS — and it is the unique key that stops one person being added twice.
 */
function riderPhone(raw: unknown): { phone: string } | { error: string } {
  if (typeof raw !== 'string' || !raw.trim()) {
    return { error: 'A phone number is required' };
  }
  const phone = toE164(raw);
  if (!phone) {
    return { error: 'That is not a Ghanaian mobile number. Expected something like 024 481 5203' };
  }
  return { phone };
}

/**
 * Counts for one rider, in the two numbers the fleet page shows.
 *
 * Both legs count. A rider may be collecting one parcel and running another to
 * the station, and either way they are carrying something.
 *
 * `delivered` counts finished work of both kinds -- collections that reached
 * the office and station runs that reached a bus. It is the number that makes
 * deleting somebody destructive, so it must not miss a leg.
 */
async function jobCounts(riderId: string): Promise<{ carrying: number; delivered: number }> {
  const [collecting, running, collected, dispatched] = await Promise.all([
    prisma.order.count({
      where: { collectionRiderId: riderId, status: { in: [...COLLECTION_LIVE] } },
    }),
    prisma.order.count({
      where: { stationRiderId: riderId, status: { in: [...STATION_LIVE] } },
    }),
    prisma.order.count({
      where: {
        collectionRiderId: riderId,
        status: { in: ['at_office', 'paid', 'to_station', 'dispatched'] },
      },
    }),
    prisma.order.count({ where: { stationRiderId: riderId, status: 'dispatched' } }),
  ]);
  return { carrying: collecting + running, delivered: collected + dispatched };
}

/**
 * The roster, and the size of the queue waiting on it.
 *
 * `waiting` is the whole argument for this page. Orders are never assigned to a
 * rider who is busy — they hold at `confirmed` until somebody frees up — so a
 * backlog is not an error anywhere, it is simply a number that grows quietly.
 * Shown next to the fleet, it says the one thing the roster is for: whether
 * there are enough people on it.
 */
ridersRouter.get('/', requireAdmin, requirePermission('riders:read'), async (_req, res) => {
  const riders = await prisma.rider.findMany({
    orderBy: [{ active: 'desc' }, { createdAt: 'asc' }],
  });

  const fleet: FleetRider[] = await Promise.all(
    riders.map(async (rider) => ({
      ...serializeRider(rider),
      ...(await jobCounts(rider.id)),
    }))
  );

  // Exactly the set the automation pass tries to assign each minute: confirmed,
  // and due for pickup within the window. Anything in here has no rider because
  // there was no free rider to give it.
  const waiting = await prisma.order.count({
    where: {
      status: 'confirmed',
      scheduledPickupAt: { lte: new Date(Date.now() + QUEUE_WINDOW_MS) },
    },
  });

  res.json({ riders: fleet, waiting });
});

ridersRouter.post('/', requireAdmin, requirePermission('riders:manage'), async (req, res) => {
  const { name } = req.body ?? {};

  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const phone = riderPhone(req.body?.phone);
  if ('error' in phone) {
    return res.status(400).json({ error: phone.error });
  }

  try {
    const created = await prisma.rider.create({
      data: { name: name.trim(), phone: phone.phone },
    });
    // A new rider is on the roster and carrying nothing, so the next automation
    // pass can hand them the oldest order that has been waiting on capacity.
    res.status(201).json({ ...serializeRider(created), carrying: 0, delivered: 0 });
  } catch (err) {
    if (isDuplicate(err)) {
      return res.status(409).json({ error: 'That number is already on the fleet' });
    }
    throw err;
  }
});

/**
 * Rename, renumber, or take somebody off the fleet.
 *
 * `active` is the important one. Taking a rider off does NOT touch the parcels
 * already in their hands — those stay theirs until they are delivered or
 * reassigned — it only stops the automation giving them anything new. That is
 * the honest behaviour for somebody who has finished their shift, gone on
 * leave, or left: their history stays intact and they can be switched back on
 * without re-typing a thing.
 */
ridersRouter.patch('/:id', requireAdmin, requirePermission('riders:manage'), async (req, res) => {
  const target = await prisma.rider.findUnique({ where: { id: req.params.id } });
  if (!target) {
    return res.status(404).json({ error: 'Rider not found' });
  }

  const data: { name?: string; phone?: string; active?: boolean } = {};

  if (req.body?.name !== undefined) {
    if (typeof req.body.name !== 'string' || !req.body.name.trim()) {
      return res.status(400).json({ error: 'Name cannot be empty' });
    }
    data.name = req.body.name.trim();
  }

  if (req.body?.phone !== undefined) {
    const phone = riderPhone(req.body.phone);
    if ('error' in phone) {
      return res.status(400).json({ error: phone.error });
    }
    data.phone = phone.phone;
  }

  if (req.body?.active !== undefined) {
    if (typeof req.body.active !== 'boolean') {
      return res.status(400).json({ error: 'active must be true or false' });
    }
    data.active = req.body.active;
  }

  try {
    const updated = await prisma.rider.update({ where: { id: target.id }, data });
    const counts = await jobCounts(updated.id);
    res.json({ ...serializeRider(updated), ...counts });
  } catch (err) {
    if (isDuplicate(err)) {
      return res.status(409).json({ error: 'That number is already on the fleet' });
    }
    throw err;
  }
});

/**
 * Delete a rider — only one who has never been given a parcel.
 *
 * Order.riderId is ON DELETE SET NULL, so removing somebody with history would
 * not fail: it would quietly blank the rider off every delivery they ever made,
 * and the day's cash-with-couriers figure along with them. That is a silent
 * loss of a record we are keeping precisely so it can be checked later.
 *
 * So deletion is reserved for what it is actually for — a row added by mistake
 * ten seconds ago — and everybody else is deactivated instead, which keeps the
 * history and stops the work.
 */
ridersRouter.delete('/:id', requireAdmin, requirePermission('riders:manage'), async (req, res) => {
  const target = await prisma.rider.findUnique({ where: { id: req.params.id } });
  if (!target) {
    return res.status(404).json({ error: 'Rider not found' });
  }

  const orders = await prisma.order.count({
    where: {
      OR: [{ collectionRiderId: target.id }, { stationRiderId: target.id }],
    },
  });
  if (orders > 0) {
    const parcels = `${orders} parcel${orders === 1 ? '' : 's'}`;
    return res.status(409).json({
      error: `${target.name} has ${parcels} on record. Deactivate instead, or their name is blanked off every one of them.`,
    });
  }

  await prisma.rider.delete({ where: { id: target.id } });
  res.json({ success: true, name: target.name, phone: formatPhone(target.phone) });
});
