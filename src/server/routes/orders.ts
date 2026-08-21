/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Prisma } from '@prisma/client';
import { asyncRouter } from '../http.js';
import { LIVE_ORDER_STATUSES } from '../../types.js';
import type { OrderStatus, PackageSize, Payer, PaymentTiming } from '../../types.js';
import { AUTOMATION_ACTOR } from '../../brand.js';
import { requireAdmin } from '../auth.js';
import { requirePermission } from '../permissions.js';
import { canTransition, checkUndo, isTerminal, nextStatuses, UNDO_NOTE_PREFIX } from '../../transitions.js';
import { isRegion, REGION_NAMES } from '../../regions.js';
import { quote, sizeForWeight } from '../../pricing.js';
import { currentRule } from './pricing.js';
import { runAutomations, RIDER_TOKEN_TTL_MS } from '../automations.js';
import { notifyForStatus, unqueueForStatus } from '../notifications.js';
import { randomToken, withTrackingCode } from '../ids.js';
import { prisma } from '../prisma.js';
import { ORDER_RIDERS, serializeHistory, serializeOrder, serializePayment } from '../serialize.js';
import { publicActionLimit, publicReadLimit, publicWriteLimit } from '../rateLimit.js';
import { LIST_CAP } from './payments.js';
import { senderMayCancel } from '../../transitions.js';
import { phoneSearchVariants, storablePhone, toE164 } from '../../phone.js';
import { queueNotification } from '../notifications.js';

export const ordersRouter = asyncRouter();

const PACKAGE_SIZES: PackageSize[] = ['small', 'medium', 'large'];
/** The statuses an admin may name. Retired ones are deliberately absent. */
const ORDER_STATUSES: OrderStatus[] = LIVE_ORDER_STATUSES;



/* ---------------------------------------------------------------------------
   PUBLIC TRACKING LOOKUP
   Registered before '/:id' — Express would otherwise match "track" as an id.
   --------------------------------------------------------------------------- */
ordersRouter.get('/track', publicReadLimit, async (req, res) => {
  const query = req.query.q;
  if (typeof query !== 'string' || !query.trim()) {
    return res
      .status(400)
      .json({ error: 'Search query (tracking code or phone number) is required' });
  }

  // Phone matching is an EXACT comparison. It used to be a substring match,
  // which meant searching "0" returned nearly every order in the system.
  //
  // Exact against several forms of the same number, though: rows are stored
  // canonically now, but a customer types 024..., +233... or 233... more or
  // less at random, and rows written before normalisation hold whatever was
  // typed that day.
  const phones = phoneSearchVariants(query);
  const code = query.trim().toUpperCase();

  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { trackingCode: code },
        // A sender's booking reference finds every parcel booked with it. It
        // was handed out at booking but matched nothing here, so anyone who
        // pasted the reference they were given was told their parcel did not
        // exist. One box, and it takes whichever code the customer has.
        { booking: { reference: code } },
        { senderPhone: { in: phones } },
        { recipientPhone: { in: phones } },
      ],
    },
    include: { statusHistory: { orderBy: { changedAt: 'asc' } } },
  });

  if (orders.length === 0) {
    return res.status(404).json({
      error: 'Nothing found for that tracking code, booking reference or phone number',
    });
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
   PUBLIC CANCELLATION

   A sender who changes their mind should not have to telephone an office to
   undo something they did on a website ninety seconds ago. But cancelling a
   parcel is a write on somebody else's record, so it asks for two things: the
   tracking code, and the phone number the parcel was booked with. The code
   alone travels in a text message and is quotable by anyone who glances at a
   phone; the pair is something only the people involved have.

   And it is only offered before money and before a courier -- see
   SENDER_CANCELLABLE in src/transitions.ts. After that it is a refund and a
   wasted trip, and both want a person.
   --------------------------------------------------------------------------- */
ordersRouter.post('/cancel', publicActionLimit, async (req, res) => {
  const { trackingCode, phone } = req.body ?? {};

  if (typeof trackingCode !== 'string' || typeof phone !== 'string') {
    return res.status(400).json({ error: 'Tracking code and phone number are required' });
  }

  const order = await prisma.order.findUnique({
    where: { trackingCode: trackingCode.trim().toUpperCase() },
  });

  // Same answer for "no such parcel" and "wrong number", so this cannot be
  // used to find out which tracking codes are real.
  const given = toE164(phone);
  const matches =
    !!order &&
    !!given &&
    (toE164(order.senderPhone) === given || toE164(order.recipientPhone) === given);

  if (!matches) {
    return res.status(404).json({
      error: 'We could not match that tracking code and phone number.',
    });
  }

  if (order.status === 'cancelled') {
    // Already done is not a failure. Saying so lets a double-tap end quietly.
    return res.json({ success: true, status: 'cancelled', alreadyCancelled: true });
  }

  if (!senderMayCancel(order.status)) {
    return res.status(409).json({
      error:
        'This parcel is already being handled, so it cannot be cancelled online. ' +
        'Please call 054 030 4994 and we will sort it out.',
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id: order.id }, data: { status: 'cancelled' } });
    await tx.statusHistory.create({
      data: {
        orderId: order.id,
        status: 'cancelled',
        note: 'Cancelled by the sender from the tracking page',
        // No admin did this, and the history must not imply one did.
        changedByName: 'Customer',
      },
    });
    await queueNotification(tx, 'cancelled', order);
  });

  res.json({ success: true, status: 'cancelled' });
});

/* ---------------------------------------------------------------------------
   PUBLIC BOOKING
   --------------------------------------------------------------------------- */
ordersRouter.post('/book', publicWriteLimit, async (req, res) => {
  const {
    senderName,
    senderPhone,
    pickupAddress,
    pickupNotes,
    recipientName,
    recipientPhone,
    dropoffAddress,
    dropoffNotes,
    packageWeightKg,
    packageDescription,
    destinationRegion,
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
    !dropoffAddress
  ) {
    return res.status(400).json({ error: 'Missing required fields for parcel booking' });
  }

  // We collect in Accra and deliver to a fixed list of regions. A booking for
  // anywhere else is a job we cannot actually do.
  if (!isRegion(destinationRegion)) {
    return res.status(400).json({
      error: 'Choose a region we deliver to',
      allowed: REGION_NAMES,
    });
  }

  const weightKg = Number(packageWeightKg);
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    return res.status(400).json({ error: 'Parcel weight is required' });
  }
  if (weightKg > 100) {
    return res.status(400).json({ error: 'For parcels over 100kg, please call 054 030 4994' });
  }

  // The price is computed here, never accepted from the browser. The booking
  // form quotes with the same function so the customer sees this figure first.
  let rule;
  try {
    rule = await currentRule();
  } catch {
    return res.status(500).json({ error: 'Pricing is not configured' });
  }
  const basePrice = quote(weightKg, rule).total;
  const size = sizeForWeight(weightKg);
  const pricing = { currency: rule.currency };

  // paymentTiming is retired -- there is one moment now, after the parcel is
  // weighed at the office -- but the column is still written so old rows and
  // any client still sending the field keep their shape.
  const resolvedTiming: PaymentTiming =
    paymentTiming ?? (paymentProvider === 'momo' ? 'prepaid' : 'on_delivery');
  const resolvedPayer: Payer = payer ?? 'sender';

  // ACCEPTED STRAIGHT AWAY, whoever is paying. Money is no longer a gate on the
  // front of the process: a rider goes out, collects, and the parcel is weighed
  // and billed at the office. The gate moved to the other end -- nothing goes
  // on a bus until it is paid for (see ALLOWED_TRANSITIONS, at_office -> paid).
  const status: OrderStatus = 'confirmed';

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
          senderPhone: storablePhone(senderPhone),
          pickupAddress,
          pickupNotes: pickupNotes || null,
          recipientName,
          recipientPhone: storablePhone(recipientPhone),
          dropoffAddress,
          dropoffNotes: dropoffNotes || null,
          destinationRegion,
          packageSize: size,
          packageWeightKg: weightKg,
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
          note: `Order submitted and accepted. ${resolvedPayer} pays once it is weighed`,
          changedByName: AUTOMATION_ACTOR,
        },
      });

      // Every booking is accepted on the spot now, so this is where the
      // sender is told we have it. The bill follows after weighing.
      await notifyForStatus(tx, status, { ...order, riderName: null });

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
    include: ORDER_RIDERS,
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
ordersRouter.get('/', requireAdmin, requirePermission('orders:read'), async (req, res) => {
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

  // Capped for the same reason as the ledger — see LIST_CAP in payments.ts.
  // The board filters and sorts in the browser, so an uncapped query is the
  // whole orders table on every load once this business has a year behind it.
  const rows = await prisma.order.findMany({
    where,
    include: ORDER_RIDERS,
    orderBy: { createdAt: 'desc' },
    take: LIST_CAP + 1,
  });

  const truncated = rows.length > LIST_CAP;

  res.json({
    truncated,
    cap: LIST_CAP,
    orders: (truncated ? rows.slice(0, LIST_CAP) : rows).map(serializeOrder),
  });
});

/* ---------------------------------------------------------------------------
   ADMIN: ORDER DETAIL
   --------------------------------------------------------------------------- */
ordersRouter.get('/:id', requireAdmin, requirePermission('orders:read'), async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: {
      collectionRider: true,
      stationRider: true,
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
ordersRouter.patch('/:id/status', requireAdmin, requirePermission('orders:write'), async (req, res) => {
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

  /**
   * Only legal moves, enforced here rather than trusted from the console.
   *
   * This matters beyond tidiness: the automation pass reconciles payment for
   * an on-delivery order the moment it reads `delivered`, so a jump straight
   * from `requested` would invent a settled payment for a parcel nobody had
   * collected.
   *
   * An owner may override — a parcel turns up in a van, a wrong button gets
   * pressed — but must say why, and the override is recorded as such.
   */
  const { force } = req.body ?? {};
  const from = existing.status as OrderStatus;
  const to = status as OrderStatus;

  // Checked before legality so this says "already delivered" rather than the
  // confusing "cannot move from delivered to delivered".
  if (from === to) {
    return res.status(400).json({ error: `This order is already ${to}.` });
  }

  const legal = canTransition(from, to);
  let overridden = false;

  if (!legal) {
    if (!force) {
      const allowed = nextStatuses(from);
      return res.status(400).json({
        error: isTerminal(from)
          ? `This order is ${from} and cannot change further.`
          : `Cannot move from ${from} to ${to}.`,
        allowed,
      });
    }
    if (admin.role !== 'owner') {
      return res.status(403).json({ error: 'Only an owner can override the delivery workflow.' });
    }
    if (!note?.trim()) {
      return res.status(400).json({ error: 'An override needs a reason. Add a note explaining it.' });
    }
    overridden = true;
  }

  const history = await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: existing.id },
      data: { status: to },
    });
    await notifyForStatus(tx, to, { ...existing, riderName: null });

    return tx.statusHistory.create({
      data: {
        orderId: existing.id,
        status: to,
        note: overridden
          ? `OVERRIDE ${from} → ${to}: ${note.trim()}`
          : note || `Status updated from ${from} to ${to}`,
        changedByAdminId: admin.id,
        changedByName: admin.name,
      },
    });
  });

  await runAutomations();

  const settled = await prisma.order.findUnique({
    where: { id: existing.id },
    include: ORDER_RIDERS,
  });

  res.json({
    success: true,
    order: settled ? serializeOrder(settled) : null,
    history: serializeHistory(history),
  });
});

/* ---------------------------------------------------------------------------
   ADMIN: HAND A LEG TO A DIFFERENT RIDER
   --------------------------------------------------------------------------- */

/**
 * Move a parcel from one courier to another, or take it off a courier entirely.
 *
 * WHICH LEG is not a parameter — it is read off the parcel's status, because
 * only one of the two can be in play at a time. Before the office it is the
 * collection; after payment it is the run to the station. Asking the caller to
 * say which would only let them say the wrong one.
 *
 * The automation only ever assigns to a rider who is FREE, which is right for
 * the normal case and useless for the one that actually needs a human: a bike
 * breaks down, somebody is sent home ill, a parcel is handed over at a junction
 * because two riders are going the same way. None of those are states the
 * assigner can reach on its own, and without this the parcel stays with
 * whoever cannot carry it.
 *
 * So this is deliberately a manual override and behaves like one -- it will put
 * a second parcel on a rider who is already carrying one, because the person
 * clicking can see the road and the assigner cannot. What it will NOT do is
 * assign to somebody who is off the fleet: that flag means "not working here",
 * and no view of the road changes it.
 *
 * Passing riderId: null unassigns, dropping the parcel back to the status it
 * waits in — `confirmed` for a collection, `paid` for a station run — so the
 * automation can pick it up again on its next pass.
 */
ordersRouter.patch('/:id/rider', requireAdmin, requirePermission('orders:write'), async (req, res) => {
  const admin = req.admin!;
  const { riderId } = req.body ?? {};

  if (riderId !== null && typeof riderId !== 'string') {
    return res.status(400).json({ error: 'Choose a rider, or clear the assignment' });
  }

  const existing = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: ORDER_RIDERS,
  });
  if (!existing) return res.status(404).json({ error: 'Order not found' });

  // A dispatched or cancelled parcel is a record, not a job. Changing who
  // carried it would rewrite history.
  if (existing.status === 'dispatched' || existing.status === 'cancelled') {
    return res.status(400).json({
      error: `This parcel is ${existing.status} and its courier is part of the record.`,
    });
  }

  /**
   * Which leg this is, and what the parcel falls back to without a rider.
   *
   * `at_office` has no leg at all: the parcel is sitting on a shelf waiting for
   * money, in nobody's hands. Assigning a rider to it would mark somebody busy
   * for a parcel they cannot move.
   */
  const stationLeg = existing.status === 'paid' || existing.status === 'to_station';
  if (existing.status === 'at_office') {
    return res.status(400).json({
      error: 'This parcel is at the office waiting to be paid for. It goes to a rider once it clears.',
    });
  }

  const currentId = stationLeg ? existing.stationRiderId : existing.collectionRiderId;
  const previousRider = stationLeg ? existing.stationRider : existing.collectionRider;
  const waitingStatus = stationLeg ? 'paid' : 'confirmed';
  const carryingStatus = stationLeg ? 'to_station' : 'queued';

  if (currentId === riderId) {
    return res.status(400).json({
      error: riderId ? 'That parcel is already with this rider.' : 'That parcel has no rider.',
    });
  }

  let rider = null;
  if (riderId) {
    rider = await prisma.rider.findUnique({ where: { id: riderId } });
    if (!rider) return res.status(404).json({ error: 'Rider not found' });
    if (!rider.active) {
      return res.status(400).json({
        error: `${rider.name} is off the fleet. Put them back on first.`,
      });
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    // A parcel already picked up stays picked up. It is physically in a bag,
    // and rewriting its status to match the paperwork would tell the customer
    // it had been un-collected.
    const status = existing.status === 'picked_up'
      ? existing.status
      : riderId
        ? carryingStatus
        : waitingStatus;

    const order = await tx.order.update({
      where: { id: existing.id },
      data: {
        ...(stationLeg ? { stationRiderId: riderId } : { collectionRiderId: riderId }),
        status,
        // A courier handed a parcel needs a working link for it, and the old
        // one is fine to keep: it is scoped to the order, not to the person.
        ...(riderId
          ? {
              riderToken: existing.riderToken ?? randomToken(),
              riderTokenExpiresAt: new Date(Date.now() + RIDER_TOKEN_TTL_MS),
            }
          : {}),
      },
      include: ORDER_RIDERS,
    });

    if (rider) {
      await tx.rider.update({ where: { id: rider.id }, data: { available: false } });
    }

    // Free the rider we took it off, unless they are still carrying something
    // else on either leg. The automation's release rule runs once a minute; a
    // rider handing over a job should not wait for it.
    if (previousRider) {
      const [collecting, running] = await Promise.all([
        tx.order.count({
          where: {
            collectionRiderId: previousRider.id,
            status: { in: ['queued', 'picked_up'] },
          },
        }),
        tx.order.count({
          where: { stationRiderId: previousRider.id, status: 'to_station' },
        }),
      ]);
      if (collecting + running === 0) {
        await tx.rider.update({ where: { id: previousRider.id }, data: { available: true } });
      }
    }

    const leg = stationLeg ? 'station run' : 'collection';
    const note = rider
      ? previousRider
        ? `${leg} reassigned from ${previousRider.name} to ${rider.name}`
        : `${leg} assigned to ${rider.name}`
      : `Taken off ${previousRider?.name ?? 'the courier'} — back in the queue`;

    const history = await tx.statusHistory.create({
      data: {
        orderId: order.id,
        status: order.status,
        note,
        changedByAdminId: admin.id,
        changedByName: admin.name,
      },
    });

    /**
     * The customer was told a name, and only for the collection.
     *
     * `rider_assigned` is unique per (orderId, event), which is what stops the
     * automation texting twice. Here that constraint gets in the way: while the
     * original is still PENDING it can be deleted and re-queued, so the sender
     * only ever receives the truth. Once it has been SENT the constraint holds
     * and no second text is possible -- deleting a sent row would only destroy
     * the record of having told them.
     *
     * That case is handed back to the caller rather than swallowed, because
     * somebody is expecting a call from a rider who is no longer coming, and a
     * phone call is the repair.
     *
     * The station leg says nothing either way. Nobody was told who was taking
     * the parcel across town, so nobody has to be un-told.
     */
    let customerToldPreviousRider = false;

    if (!stationLeg) {
      const pending = await tx.notification.deleteMany({
        where: { orderId: order.id, event: 'rider_assigned', status: 'pending' },
      });
      const alreadySent = await tx.notification.findFirst({
        where: { orderId: order.id, event: 'rider_assigned' },
        select: { id: true },
      });

      if (rider && !alreadySent) {
        await queueNotification(tx, 'rider_assigned', {
          ...order,
          riderName: rider.name,
          riderPhone: rider.phone,
        });
      }

      customerToldPreviousRider = Boolean(alreadySent) && pending.count === 0;
    }

    return { order, history, customerToldPreviousRider };
  });

  res.json({
    success: true,
    order: serializeOrder(result.order),
    history: serializeHistory(result.history),
    leg: stationLeg ? 'station' : 'collection',
    previousRiderName: previousRider?.name ?? null,
    customerToldPreviousRider: result.customerToldPreviousRider,
  });
});

/* ---------------------------------------------------------------------------
   ADMIN: PUT IT ON THE BUS
   --------------------------------------------------------------------------- */

/**
 * Record the bus, and end our part in the parcel.
 *
 * This is the last thing that happens to an order and the only place the car
 * number is ever written. Both ends are texted it in the same transaction,
 * because that number is the only handle either of them has on the parcel once
 * it has left us -- a dispatch recorded without the messages going out is a
 * parcel nobody can find.
 *
 * TWO MESSAGES, TWO EVENTS. The (orderId, event) unique constraint means one
 * event can only reach one person, so the sender and the recipient get
 * separately-worded messages under separate events rather than one event bent
 * to serve both.
 *
 * Refused unless the parcel is paid for. Past the station there is nothing we
 * can do to collect, and nobody of ours at the far end to do it.
 */
ordersRouter.post('/:id/dispatch', requireAdmin, requirePermission('orders:write'), async (req, res) => {
  const admin = req.admin!;
  const raw = req.body?.busCarNumber;

  if (typeof raw !== 'string' || !raw.trim()) {
    return res.status(400).json({ error: 'The bus car number is required' });
  }

  // Registrations are read off the back of a bus and typed in a hurry. Spacing
  // and case vary; the characters do not.
  const busCarNumber = raw.trim().toUpperCase().replace(/\s+/g, ' ');
  if (busCarNumber.length > 32) {
    return res.status(400).json({ error: 'That car number is too long to be one' });
  }

  const existing = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: ORDER_RIDERS,
  });
  if (!existing) return res.status(404).json({ error: 'Order not found' });

  if (existing.status === 'dispatched') {
    return res.status(400).json({
      error: `This parcel already went on car ${existing.busCarNumber ?? 'unknown'}.`,
    });
  }
  if (existing.status === 'cancelled') {
    return res.status(400).json({ error: 'This parcel was cancelled.' });
  }
  if (existing.paymentStatus !== 'paid') {
    return res.status(400).json({
      error: 'This parcel has not been paid for. Nothing goes on a bus before it clears.',
    });
  }
  if (!canTransition(existing.status as OrderStatus, 'dispatched')) {
    return res.status(400).json({
      error: `A parcel cannot go from ${existing.status} straight onto a bus.`,
    });
  }

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.update({
      where: { id: existing.id },
      data: {
        status: 'dispatched',
        busCarNumber,
        // The link dies with the job. Nothing further can be done to this
        // parcel, so a courier's old link should stop opening it.
        riderToken: null,
        riderTokenExpiresAt: null,
      },
      include: ORDER_RIDERS,
    });

    const history = await tx.statusHistory.create({
      data: {
        orderId: order.id,
        status: 'dispatched',
        note: `On the bus, car ${busCarNumber}`,
        changedByAdminId: admin.id,
        changedByName: admin.name,
      },
    });

    const toSender = await queueNotification(tx, 'dispatched_sender', order);
    const toRecipient = await queueNotification(tx, 'dispatched_recipient', order);

    // Free the station rider. Their leg, and the parcel, are finished.
    if (order.stationRiderId) {
      const stillRunning = await tx.order.count({
        where: { stationRiderId: order.stationRiderId, status: 'to_station' },
      });
      const stillCollecting = await tx.order.count({
        where: {
          collectionRiderId: order.stationRiderId,
          status: { in: ['queued', 'picked_up'] },
        },
      });
      if (stillRunning + stillCollecting === 0) {
        await tx.rider.update({
          where: { id: order.stationRiderId },
          data: { available: true },
        });
      }
    }

    return { order, history, toSender, toRecipient };
  });

  res.json({
    success: true,
    order: serializeOrder(result.order),
    history: serializeHistory(result.history),
    // Which messages actually queued. A number we could not text is not a
    // failure of the dispatch, but it is something the office should know
    // about while the parcel is still in front of them.
    textedSender: result.toSender,
    textedRecipient: result.toRecipient,
  });
});

/* ---------------------------------------------------------------------------
   ADMIN: UNDO THE LAST STATUS CHANGE
   --------------------------------------------------------------------------- */

/**
 * Take back the step just taken.
 *
 * Advancing an order is one click on a table row, and the row under the
 * pointer is not always the row that was meant. Before this, the only way back
 * was an owner-only override with a written reason — which is right for
 * repairing history days later, and far too heavy for a misclick noticed two
 * seconds after it happened.
 *
 * So undo is narrow on purpose. It reverses exactly one step, only within
 * UNDO_WINDOW_MS, and only when a person took that step: automation's own
 * moves are refused, because the next pass would simply take them again.
 * checkUndo() in src/transitions.ts holds those rules and the console imports
 * the same function to decide whether to offer the button.
 *
 * What makes it safe is that the side effects come back with it, in the same
 * transaction as the status:
 *
 *  - the payment automation invented when the order hit `delivered` is voided,
 *    and the order goes back to owing money;
 *  - the rider freed by that delivery is put back on the job;
 *  - the notification queued for the undone step is dropped from the outbox,
 *    so nobody is texted about a delivery that did not happen.
 *
 * An undo is itself recorded in status_history. Nothing is erased — the board
 * goes back, the audit trail only ever moves forward.
 */
ordersRouter.post('/:id/undo', requireAdmin, requirePermission('orders:write'), async (req, res) => {
  const admin = req.admin!;
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';

  const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    return res.status(404).json({ error: 'Order not found' });
  }

  // Newest first, and by id as a tie-break: rows written inside one
  // transaction can share a millisecond, and which of them came first decides
  // what "the last change" means.
  const rows = await prisma.statusHistory.findMany({
    where: { orderId: existing.id },
    orderBy: [{ changedAt: 'desc' }, { id: 'desc' }],
    take: 50,
  });

  const check = checkUndo(rows, existing.status as OrderStatus, AUTOMATION_ACTOR);
  if (check.ok === false) {
    return res.status(400).json({ error: check.reason });
  }

  const from = check.from;
  const to = check.previous;

  const history = await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: existing.id },
      data: { status: to },
    });

    // Void the payment automation created for a delivery that is being taken
    // back. Marked failed rather than deleted: revenue only counts `success`,
    // so the figures correct themselves while the row stays in the ledger as
    // evidence of what happened. A payment a person recorded by hand is left
    // alone — that one is somebody's word that money changed hands.
    if (from === 'delivered') {
      const auto = await tx.payment.findFirst({
        where: {
          orderId: existing.id,
          status: 'success',
          recordedByAdminId: null,
          note: { startsWith: 'Auto-reconciled' },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (auto) {
        await tx.payment.update({
          where: { id: auto.id },
          data: {
            status: 'failed',
            note: `${auto.note ?? 'Auto-reconciled'} — voided when ${admin.name} undid the delivery`,
          },
        });

        const stillPaid = await tx.payment.count({
          where: { orderId: existing.id, status: 'success' },
        });
        if (stillPaid === 0) {
          await tx.order.update({
            where: { id: existing.id },
            data: { paymentStatus: 'pending' },
          });
        }
      }
    }

    // The parcel is back in somebody's hands, so that courier is busy again.
    // Without this the automation pass would hand them a second job while the
    // first is still in their bag.
    //
    // WHICH courier depends on which leg we have gone back to: undoing a drop
    // at the office belongs to the rider who collected it, undoing a dispatch
    // belongs to the one who took it to the station.
    const backOnCollection = to === 'queued' || to === 'picked_up';
    const backOnStationRun = to === 'to_station';
    const restore = backOnCollection
      ? existing.collectionRiderId
      : backOnStationRun
        ? existing.stationRiderId
        : null;

    if (restore) {
      await tx.rider.update({ where: { id: restore }, data: { available: false } });
    }

    await unqueueForStatus(tx, from, existing.id);

    return tx.statusHistory.create({
      data: {
        orderId: existing.id,
        status: to,
        note: reason
          ? `${UNDO_NOTE_PREFIX}${from} → ${to}: ${reason}`
          : `${UNDO_NOTE_PREFIX}${from} → ${to} — reverted the change made by ${check.by}`,
        changedByAdminId: admin.id,
        changedByName: admin.name,
      },
    });
  });

  // No automation pass here, deliberately. The rules run on a timer anyway,
  // and running one now would re-apply whatever was just undone before the
  // response even reached the browser.
  const settled = await prisma.order.findUnique({
    where: { id: existing.id },
    include: ORDER_RIDERS,
  });

  res.json({
    success: true,
    from,
    to,
    order: settled ? serializeOrder(settled) : null,
    history: serializeHistory(history),
  });
});

/* ---------------------------------------------------------------------------
   ADMIN: RECORD A PAYMENT BY HAND
   --------------------------------------------------------------------------- */
ordersRouter.post('/:id/pay', requireAdmin, requirePermission('payments:write'), async (req, res) => {
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
    include: ORDER_RIDERS,
  });

  res.json({
    success: true,
    order: settled ? serializeOrder(settled) : null,
    payment: serializePayment(payment),
  });
});
