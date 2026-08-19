import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import type { OrderStatus, PackageSize, PaymentStatus, PaymentTiming } from '../src/types.js';
import { randomToken } from '../src/server/ids.js';
import { quote, sizeForWeight } from '../src/pricing.js';
import { CONTACT_PHONE } from '../src/brand.js';

/**
 * Every phone number in this file, and it is deliberately the office's own.
 *
 * These orders exist to be worked through the console, and every status change
 * queues a message. Sending is live. An invented number that happens to be a
 * real Ghanaian mobile means a stranger gets three texts about a parcel they
 * never sent -- which is exactly what happened on 19 Aug 2026, to
 * 0244 815 203, because this file used to contain plausible fakes.
 *
 * Pointing them at GO DISPATCH means the only phone a demo can reach is the
 * one belonging to the people running the demo. It also makes the messages
 * useful: you can read what a customer would have received.
 */
const DEMO_PHONE = CONTACT_PHONE.replace(/\s/g, '');

/**
 * Demo orders, so the board, the drawer and the tracking timeline have
 * something real-shaped to render.
 *
 * Deliberately separate from prisma/seed.ts: seed creates the baseline a real
 * deployment needs, this invents deliveries. Keeping them apart means running
 * the seed in production can never conjure parcels.
 *
 * NOTHING HERE QUEUES A NOTIFICATION. Orders are written straight to the
 * tables rather than through POST /api/bookings, so no message reaches the
 * outbox and no phone is texted. That is the point: with sending switched on,
 * seeding through the real endpoint would spend Arkesel credit and text
 * whatever numbers appear below. It also means this does NOT exercise the
 * booking path -- to test that, place one real booking on the live site.
 *
 * The three cover the states the board is built to distinguish:
 *   overdue and unassigned  · on the road with a courier  · owing money
 *
 * Every phone number is the office's own -- see DEMO_PHONE below.
 *
 * Idempotent by tracking code. `npm run wipe:orders` clears them again.
 */

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to load demo fixtures with NODE_ENV=production.');
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const now = Date.now();
const day = 24 * 60 * 60 * 1000;
const hour = 60 * 60 * 1000;
const at = (offsetMs: number) => new Date(now + offsetMs);

interface Fixture {
  trackingCode: string;
  senderName: string;
  senderPhone: string;
  pickupAddress: string;
  pickupNotes: string;
  recipientName: string;
  recipientPhone: string;
  dropoffAddress: string;
  dropoffNotes: string;
  /** One of the regions in src/regions.ts — the board shows it on every row. */
  destinationRegion: string;
  packageWeightKg: number;
  packageDescription: string;
  scheduledPickupAt: Date;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  /** Who settles the bill. The booking form sends recipient/on_delivery. */
  payer: 'sender' | 'recipient';
  paymentTiming: PaymentTiming;
  createdAt: Date;
  /** Index into the seeded rider pool, for jobs already on the road. */
  riderIndex?: number;
  timeline: { status: OrderStatus; note: string; byAdmin?: boolean; atMs: number }[];
  payment?: {
    provider: 'momo' | 'manual';
    providerReference?: string;
    note?: string;
    paidAtMs: number;
    byAdmin?: boolean;
  };
}

const FIXTURES: Fixture[] = [
  // 1. Late and nobody is carrying it. Sorts to the top of the board and is
  //    the reason the "Unassigned" marker is red.
  {
    trackingCode: 'GD-3184-207',
    senderName: 'Akosua Frimpong',
    senderPhone: DEMO_PHONE,
    pickupAddress: 'Shop 4, Kwame Nkrumah Circle, Accra',
    pickupNotes: 'Above the pharmacy, ask for Akosua',
    recipientName: 'Kofi Boadu',
    recipientPhone: DEMO_PHONE,
    dropoffAddress: 'Plot 22, Ahodwo Road, Kumasi',
    dropoffNotes: 'Green gate opposite the school',
    destinationRegion: 'Ashanti',
    packageWeightKg: 2,
    packageDescription: 'Two boxes of phone accessories',
    scheduledPickupAt: at(-1 * day + 9 * hour),
    status: 'requested',
    paymentStatus: 'pending',
    payer: 'recipient',
    paymentTiming: 'on_delivery',
    createdAt: at(-1 * day - 2 * hour),
    timeline: [
      { status: 'requested', note: 'Booked online', atMs: -1 * day - 2 * hour },
    ],
  },

  // 2. Moving, with a courier and a paid bill. Exercises the initials avatar,
  //    the rider link, and a timeline with something in it.
  {
    trackingCode: 'GD-7429-618',
    senderName: 'Nana Yaa Owusu',
    senderPhone: DEMO_PHONE,
    pickupAddress: '14 Ring Road East, Osu, Accra',
    pickupNotes: 'Reception will hand it over',
    recipientName: 'Selorm Dzidzor',
    recipientPhone: DEMO_PHONE,
    dropoffAddress: 'House 8, Ahoe, Ho',
    dropoffNotes: 'Call on arrival, the road is unmarked',
    destinationRegion: 'Volta',
    packageWeightKg: 5,
    packageDescription: 'Legal documents and a laptop',
    scheduledPickupAt: at(-6 * hour),
    status: 'in_transit',
    paymentStatus: 'paid',
    payer: 'sender',
    paymentTiming: 'prepaid',
    createdAt: at(-1 * day),
    riderIndex: 0,
    timeline: [
      { status: 'requested', note: 'Booked online', atMs: -1 * day },
      { status: 'awaiting_payment', note: 'Weighed at 5kg — price GHS 50.00 to 70.00', byAdmin: true, atMs: -1 * day + hour },
      { status: 'confirmed', note: 'Mobile money received', byAdmin: true, atMs: -1 * day + 2 * hour },
      { status: 'queued', note: 'Assigned to courier', atMs: -8 * hour },
      { status: 'picked_up', note: 'Collected from Osu', atMs: -6 * hour },
      { status: 'in_transit', note: 'On the road to Ho', atMs: -4 * hour },
    ],
    payment: {
      provider: 'momo',
      providerReference: 'MTN-4471902',
      note: 'Paid before dispatch',
      paidAtMs: -1 * day + 2 * hour,
      byAdmin: true,
    },
  },

  // 3. Weighed, priced, and waiting on the money. Puts a figure in Outstanding.
  {
    trackingCode: 'GD-9052-341',
    senderName: 'Ibrahim Mahama',
    senderPhone: DEMO_PHONE,
    pickupAddress: 'Block B, Spintex Road, Accra',
    pickupNotes: 'Warehouse side entrance',
    recipientName: 'Fatima Alhassan',
    recipientPhone: DEMO_PHONE,
    dropoffAddress: 'Near Aboabo Market, Tamale',
    dropoffNotes: '',
    destinationRegion: 'Northern',
    packageWeightKg: 8,
    packageDescription: 'Fabric samples, one roll',
    scheduledPickupAt: at(1 * day + 13 * hour),
    status: 'awaiting_payment',
    paymentStatus: 'pending',
    payer: 'sender',
    paymentTiming: 'prepaid',
    createdAt: at(-3 * hour),
    timeline: [
      { status: 'requested', note: 'Booked online', atMs: -3 * hour },
      { status: 'awaiting_payment', note: 'Weighed at 8kg — price GHS 50.00 to 100.00', byAdmin: true, atMs: -2 * hour },
    ],
  },
];

async function main() {
  const riders = await prisma.rider.findMany({ orderBy: { createdAt: 'asc' } });
  const admin = await prisma.adminUser.findFirst({ orderBy: { createdAt: 'asc' } });

  if (riders.length === 0 || !admin) {
    console.error('Run `npm run db:seed` first — fixtures need riders and an admin.');
    process.exit(1);
  }

  // Priced by the same function the booking form quotes from and the server
  // charges by, against the rule actually in the database. A fixture with a
  // handwritten price is a fixture that disagrees with the product the moment
  // somebody edits pricing.
  const config = await prisma.pricingConfig.findUnique({ where: { id: 1 } });
  if (!config) {
    console.error('Run `npm run db:seed` first — pricing is not configured.');
    process.exit(1);
  }
  const rule = {
    baseAmount: config.baseAmount,
    includedKg: config.includedKg,
    perExtraKgAmount: config.perExtraKgAmount,
    currency: config.currency,
  };

  let created = 0;

  for (const fixture of FIXTURES) {
    const existing = await prisma.order.findUnique({
      where: { trackingCode: fixture.trackingCode },
    });
    if (existing) continue;

    const rider =
      fixture.riderIndex !== undefined ? riders[fixture.riderIndex] : undefined;

    const priceAmount = quote(fixture.packageWeightKg, rule).total;

    await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          trackingCode: fixture.trackingCode,
          senderName: fixture.senderName,
          senderPhone: fixture.senderPhone,
          pickupAddress: fixture.pickupAddress,
          pickupNotes: fixture.pickupNotes,
          recipientName: fixture.recipientName,
          recipientPhone: fixture.recipientPhone,
          dropoffAddress: fixture.dropoffAddress,
          dropoffNotes: fixture.dropoffNotes,
          destinationRegion: fixture.destinationRegion,
          packageSize: sizeForWeight(fixture.packageWeightKg),
          packageWeightKg: fixture.packageWeightKg,
          packageDescription: fixture.packageDescription,
          scheduledPickupAt: fixture.scheduledPickupAt,
          priceAmount,
          // Weighed already, so the price is settled rather than an estimate.
          priceConfirmedAt: at(0),
          currency: rule.currency,
          status: fixture.status,
          paymentStatus: fixture.paymentStatus,
          payer: fixture.payer,
          paymentTiming: fixture.paymentTiming,
          createdAt: fixture.createdAt,
          ...(rider
            ? {
                riderId: rider.id,
                riderToken: randomToken(),
                riderTokenExpiresAt: at(7 * day),
              }
            : {}),
        },
      });

      for (const step of fixture.timeline) {
        await tx.statusHistory.create({
          data: {
            orderId: order.id,
            status: step.status,
            note: step.note,
            changedAt: at(step.atMs),
            ...(step.byAdmin
              ? { changedByAdminId: admin.id, changedByName: admin.name }
              : { changedByName: 'GO DISPATCH Automation' }),
          },
        });
      }

      if (fixture.payment) {
        await tx.payment.create({
          data: {
            orderId: order.id,
            amount: priceAmount,
            currency: rule.currency,
            provider: fixture.payment.provider,
            providerReference: fixture.payment.providerReference ?? null,
            status: 'success',
            paidAt: at(fixture.payment.paidAtMs),
            createdAt: at(fixture.payment.paidAtMs),
            note: fixture.payment.note ?? null,
            ...(fixture.payment.byAdmin ? { recordedByAdminId: admin.id } : {}),
          },
        });
      }

      // A courier already carrying a job is not available for another.
      if (rider) {
        await tx.rider.update({
          where: { id: rider.id },
          data: { available: false },
        });
      }
    });

    created += 1;
  }

  console.log(
    created > 0
      ? `✔ created ${created} demo order(s)`
      : '✔ demo orders already present — nothing to do'
  );

  console.log('  no messages queued — these never went through the booking endpoint');

  const withToken = await prisma.order.findFirst({
    where: { riderToken: { not: null } },
    select: { trackingCode: true, riderToken: true },
  });
  if (withToken) {
    console.log(`  rider link: /rider/${withToken.riderToken}  (${withToken.trackingCode})`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
