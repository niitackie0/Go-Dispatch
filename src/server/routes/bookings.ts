/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import { asyncRouter } from '../http.js';
import { requireAdmin } from '../auth.js';
import { requirePermission } from '../permissions.js';
import { prisma } from '../prisma.js';
import { runAutomations } from '../automations.js';
import { withTrackingCode } from '../ids.js';
import { serializeOrder } from '../serialize.js';
import { isRegion, REGION_NAMES } from '../../regions.js';
import { quote, sizeForWeight } from '../../pricing.js';
import { currentRule } from './pricing.js';
import { queueNotification } from '../notifications.js';

export const bookingsRouter = asyncRouter();

/**
 * Bookings: one sender, one pickup, several parcels to different regions.
 *
 * Each parcel is still its own order with its own tracking code, rider and
 * status, because they travel separately and arrive on different days. The
 * booking groups them so the sender has one reference for the lot.
 *
 * Two rules from the way the office actually works:
 *
 *  - The price quoted here is an ESTIMATE. Parcels are weighed at the counter,
 *    and the weighed figure is what is charged. Nothing is dispatched before
 *    that happens, and the response says so explicitly so the customer is told
 *    rather than surprised.
 *  - The recipient pays, per parcel. Three parcels are three separate bills
 *    settled at three different doors, so no payment row is created up front.
 */

const MAX_PARCELS = 20;

/** Sender-facing reference, distinct from the per-parcel tracking codes. */
function bookingReference(): string {
  return `GDB-${crypto.randomInt(1000, 10000)}-${crypto.randomInt(100, 1000)}`;
}

bookingsRouter.post('/', async (req, res) => {
  const {
    senderName,
    senderPhone,
    pickupAddress,
    pickupNotes,
    scheduledPickupAt,
    parcels,
  } = req.body ?? {};

  if (!senderName || !senderPhone || !pickupAddress) {
    return res.status(400).json({ error: 'Your name, phone number and pickup address are required' });
  }
  if (!Array.isArray(parcels) || parcels.length === 0) {
    return res.status(400).json({ error: 'Add at least one parcel' });
  }
  if (parcels.length > MAX_PARCELS) {
    return res.status(400).json({ error: `That is more than ${MAX_PARCELS} parcels — please call us` });
  }

  const scheduled = scheduledPickupAt ? new Date(scheduledPickupAt) : new Date();
  if (Number.isNaN(scheduled.getTime())) {
    return res.status(400).json({ error: 'Invalid collection time' });
  }

  // Validate every parcel before writing any of them, and report the index so
  // the form can point at the row that is wrong rather than the whole booking.
  const checked: {
    region: string;
    dropoffAddress: string;
    dropoffNotes?: string;
    recipientName: string;
    recipientPhone: string;
    description: string;
    weightKg: number;
  }[] = [];

  for (let i = 0; i < parcels.length; i++) {
    const p = parcels[i] ?? {};
    const at = { parcel: i + 1 };

    if (!isRegion(p.destinationRegion)) {
      return res.status(400).json({ ...at, error: 'Choose a region we deliver to', allowed: REGION_NAMES });
    }
    if (!p.dropoffAddress?.trim()) {
      return res.status(400).json({ ...at, error: 'Delivery address is required' });
    }
    if (!p.recipientName?.trim() || !p.recipientPhone?.trim()) {
      return res.status(400).json({ ...at, error: "The recipient's name and phone number are required" });
    }

    const weightKg = Number(p.packageWeightKg);
    if (!Number.isFinite(weightKg) || weightKg <= 0) {
      return res.status(400).json({ ...at, error: 'Give us a rough weight so we can estimate' });
    }
    if (weightKg > 100) {
      return res.status(400).json({ ...at, error: 'For parcels over 100kg, please call 054 030 4994' });
    }

    checked.push({
      region: p.destinationRegion,
      dropoffAddress: p.dropoffAddress.trim(),
      dropoffNotes: p.dropoffNotes?.trim() || undefined,
      recipientName: p.recipientName.trim(),
      recipientPhone: p.recipientPhone.trim(),
      description: p.packageDescription?.trim() || 'Parcel',
      weightKg,
    });
  }

  let rule;
  try {
    rule = await currentRule();
  } catch {
    return res.status(500).json({ error: 'Pricing is not configured' });
  }

  // Booking and every parcel land together: a booking that half-exists is
  // worse than one that failed outright.
  const created = await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.create({
      data: {
        reference: bookingReference(),
        senderName,
        senderPhone,
        pickupAddress,
        pickupNotes: pickupNotes || null,
        scheduledPickupAt: scheduled,
      },
    });

    const orders = [];
    for (const p of checked) {
      const estimate = quote(p.weightKg, rule).total;

      const order = await withTrackingCode((trackingCode) =>
        tx.order.create({
          data: {
            trackingCode,
            bookingId: booking.id,
            senderName,
            senderPhone,
            pickupAddress,
            pickupNotes: pickupNotes || null,
            recipientName: p.recipientName,
            recipientPhone: p.recipientPhone,
            dropoffAddress: p.dropoffAddress,
            dropoffNotes: p.dropoffNotes ?? null,
            destinationRegion: p.region,
            packageSize: sizeForWeight(p.weightKg),
            packageWeightKg: p.weightKg,
            packageDescription: p.description,
            scheduledPickupAt: scheduled,
            // An estimate until the parcel is weighed. priceConfirmedAt stays
            // null, which is what marks it provisional everywhere else.
            priceAmount: estimate,
            currency: rule.currency,
            status: 'requested',
            paymentStatus: 'pending',
            // The person receiving it settles the bill at the door.
            payer: 'recipient',
            paymentTiming: 'on_delivery',
          },
        })
      );

      await tx.statusHistory.create({
        data: {
          orderId: order.id,
          status: 'requested',
          note: `Booked with ${booking.reference} — estimated ${rule.currency} ${(estimate / 100).toFixed(2)}, price confirmed on weighing`,
          changedByName: 'GO DISPATCH Automation',
        },
      });

      orders.push(order);
    }

    // One confirmation for the visit, carrying the reference that finds every
    // parcel in it — not one text per tracking code, all in the same second.
    await queueNotification(tx, 'booking_confirmed', orders[0], {
      bookingReference: booking.reference,
      parcelCount: orders.length,
    });

    return { booking, orders };
  });

  await runAutomations();

  const settled = await prisma.order.findMany({
    where: { bookingId: created.booking.id },
    include: { rider: true },
    orderBy: { createdAt: 'asc' },
  });

  const estimatedTotal = settled.reduce((sum, o) => sum + o.priceAmount, 0);

  res.status(201).json({
    success: true,
    reference: created.booking.reference,
    parcels: settled.map(serializeOrder),
    estimatedTotal,
    currency: rule.currency,
    // Said plainly, because the customer is told rather than surprised.
    priceIsEstimate: true,
    note: 'This is an estimate. We weigh every parcel at our office and the weighed price is what the recipient pays.',
  });
});

/* ---------------------------------------------------------------------------
   WEIGH-IN — the office scale sets the real price.
   --------------------------------------------------------------------------- */
bookingsRouter.patch('/parcels/:id/weight', requireAdmin, requirePermission('orders:write'), async (req, res) => {
  const weightKg = Number(req.body?.actualWeightKg);
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    return res.status(400).json({ error: 'Enter the weight from the scale' });
  }
  if (weightKg > 100) {
    return res.status(400).json({ error: 'Over 100kg needs to be handled by arrangement' });
  }

  const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Parcel not found' });

  // Re-pricing something already paid for would leave the ledger disagreeing
  // with the order.
  if (existing.paymentStatus === 'paid') {
    return res.status(400).json({ error: 'This parcel has already been paid for and cannot be re-priced' });
  }

  let rule;
  try {
    rule = await currentRule();
  } catch {
    return res.status(500).json({ error: 'Pricing is not configured' });
  }

  const priced = quote(weightKg, rule).total;
  const was = existing.priceAmount;

  const updated = await prisma.$transaction(async (tx) => {
    const order = await tx.order.update({
      where: { id: existing.id },
      data: {
        actualWeightKg: weightKg,
        packageSize: sizeForWeight(weightKg),
        priceAmount: priced,
        currency: rule.currency,
        priceConfirmedAt: new Date(),
      },
      include: { rider: true },
    });

    await tx.statusHistory.create({
      data: {
        orderId: order.id,
        status: order.status,
        note:
          priced === was
            ? `Weighed at ${weightKg}kg — price unchanged at ${rule.currency} ${(priced / 100).toFixed(2)}`
            : `Weighed at ${weightKg}kg — price ${rule.currency} ${(was / 100).toFixed(2)} to ${(priced / 100).toFixed(2)}`,
        changedByAdminId: req.admin!.id,
        changedByName: req.admin!.name,
      },
    });

    // The terms page promises we get in touch before dispatching a parcel that
    // weighed more than declared, rather than charging the difference quietly.
    // This is that promise, and it is only worth a message when the figure
    // actually moved — "your price is unchanged" is a text nobody needs.
    if (priced !== was) {
      await queueNotification(tx, 'price_confirmed', order, { previousAmount: was });
    }

    return order;
  });

  res.json({
    success: true,
    order: serializeOrder(updated),
    previousAmount: was,
    changed: priced !== was,
  });
});

/* ---------------------------------------------------------------------------
   A sender's whole booking, by reference. Public: the reference is the secret.
   --------------------------------------------------------------------------- */
bookingsRouter.get('/:reference', async (req, res) => {
  const booking = await prisma.booking.findUnique({
    where: { reference: req.params.reference.trim().toUpperCase() },
    include: { orders: { include: { rider: true }, orderBy: { createdAt: 'asc' } } },
  });

  if (!booking) return res.status(404).json({ error: 'No booking found with that reference' });

  res.json({
    reference: booking.reference,
    senderName: booking.senderName,
    pickupAddress: booking.pickupAddress,
    scheduledPickupAt: booking.scheduledPickupAt.toISOString(),
    parcels: booking.orders.map(serializeOrder),
    total: booking.orders.reduce((sum, o) => sum + o.priceAmount, 0),
    allConfirmed: booking.orders.every((o) => o.priceConfirmedAt !== null),
  });
});
