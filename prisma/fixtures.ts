import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import type { OrderStatus, PackageSize, PaymentStatus, PaymentTiming } from '../src/types.js';
import { randomToken } from '../src/server/ids.js';

/**
 * Development fixtures — demo orders so the dashboard, charts and tracking
 * timeline have something to render.
 *
 * Deliberately separate from prisma/seed.ts: seed creates the baseline a real
 * deployment needs, this creates fake deliveries. Keeping them apart means
 * running the seed in production can never invent orders.
 *
 * Idempotent by tracking code.
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
  packageSize: PackageSize;
  packageWeightKg: number;
  packageDescription: string;
  scheduledPickupAt: Date;
  priceAmount: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentTiming: PaymentTiming;
  createdAt: Date;
  /** Index into the seeded rider pool, for jobs already on the road. */
  riderIndex?: number;
  timeline: { status: OrderStatus; note: string; byAdmin?: boolean; atMs: number }[];
  payment?: {
    amount: number;
    provider: 'momo' | 'manual';
    providerReference?: string;
    note?: string;
    paidAtMs: number;
    byAdmin?: boolean;
  };
}

const FIXTURES: Fixture[] = [
  {
    trackingCode: 'WP-8293-102',
    senderName: 'Ama Osei',
    senderPhone: '0244123456',
    pickupAddress: 'Block C, Airport Residential Area, Accra',
    pickupNotes: 'Opposite the French School, ring gate bell',
    recipientName: 'Kofi Mensah',
    recipientPhone: '0207987654',
    dropoffAddress: 'House No. 12, Ring Road Central, Kokomlemle, Accra',
    dropoffNotes: 'Next to the MTN office',
    packageSize: 'small',
    packageWeightKg: 1.2,
    packageDescription: 'Important contract documents and office keys',
    scheduledPickupAt: at(-4 * day),
    priceAmount: 2500,
    status: 'delivered',
    paymentStatus: 'paid',
    paymentTiming: 'prepaid',
    createdAt: at(-4 * day),
    timeline: [
      { status: 'requested', note: 'Order submitted online by customer', atMs: -4 * day },
      { status: 'confirmed', note: 'Admin confirmed pickup coordinates and package details', byAdmin: true, atMs: -4 * day + 30 * 60 * 1000 },
      { status: 'queued', note: 'Assigned to courier route B7', byAdmin: true, atMs: -4 * day + 2 * hour },
      { status: 'picked_up', note: 'Courier picked up package from sender', atMs: -4 * day + 3 * hour },
      { status: 'in_transit', note: 'On the way to Kokomlemle', atMs: -4 * day + 4 * hour },
      { status: 'delivered', note: 'Delivered and signed for by recipient', atMs: -3 * day },
    ],
    payment: {
      amount: 2500,
      provider: 'momo',
      providerReference: 'MTN-MOMO-88291039',
      paidAtMs: -4 * day,
    },
  },
  {
    trackingCode: 'WP-4012-948',
    senderName: 'Ekow Taylor',
    senderPhone: '0553112233',
    pickupAddress: 'Teshie Estates, near Bush Road, Accra',
    pickupNotes: 'Blue gate near the taxi rank',
    recipientName: 'Abena Appiah',
    recipientPhone: '0244998877',
    dropoffAddress: 'SSNIT Flats, Block B, Madina, Accra',
    dropoffNotes: 'Third floor, Room 304',
    packageSize: 'medium',
    packageWeightKg: 4.5,
    packageDescription: 'Handmade leather shoes and kente cloth bundle',
    scheduledPickupAt: at(-2 * day),
    priceAmount: 5000,
    status: 'in_transit',
    paymentStatus: 'paid',
    paymentTiming: 'prepaid',
    createdAt: at(-2 * day),
    riderIndex: 0,
    timeline: [
      { status: 'requested', note: 'Order submitted online by customer', atMs: -2 * day },
      { status: 'confirmed', note: 'Payment confirmed, pickup scheduled', byAdmin: true, atMs: -2 * day + hour },
      { status: 'queued', note: 'Assigned to courier', byAdmin: true, atMs: -2 * day + 2 * hour },
      { status: 'picked_up', note: 'Package collected from Teshie', atMs: -6 * hour },
      { status: 'in_transit', note: 'Courier is en route to Madina', atMs: -4 * hour },
    ],
    payment: {
      amount: 5000,
      provider: 'manual',
      note: 'Admin confirmed payment screenshot on WhatsApp. Reference: GIB-9921',
      paidAtMs: -2 * day,
      byAdmin: true,
    },
  },
  {
    trackingCode: 'WP-7721-309',
    senderName: 'Yaa Boateng',
    senderPhone: '0277334455',
    pickupAddress: 'East Legon, Lagos Avenue, Accra',
    pickupNotes: 'Behind the Shell station',
    recipientName: 'Kwame Asante',
    recipientPhone: '0501122446',
    dropoffAddress: 'Dzorwulu, near Fiesta Royale Hotel, Accra',
    dropoffNotes: 'Drop at security desk',
    packageSize: 'large',
    packageWeightKg: 12.0,
    packageDescription: 'Kitchen blender and electronic food scale',
    scheduledPickupAt: at(-1 * day),
    priceAmount: 9000,
    status: 'queued',
    paymentStatus: 'pending',
    paymentTiming: 'on_delivery',
    createdAt: at(-1 * day),
    riderIndex: 1,
    timeline: [
      { status: 'requested', note: 'Order submitted online by customer', atMs: -1 * day },
      { status: 'confirmed', note: 'Details verified, sender ready with item', byAdmin: true, atMs: -1 * day + 2 * hour },
      { status: 'queued', note: 'Placed in queue for pickup dispatch', byAdmin: true, atMs: -12 * hour },
    ],
  },
  {
    trackingCode: 'WP-9923-014',
    senderName: 'John Doe',
    senderPhone: '0243009988',
    pickupAddress: 'Osu, Danquah Circle, Accra',
    pickupNotes: 'Above the pharmacy',
    recipientName: 'Richard Mills',
    recipientPhone: '0204455667',
    dropoffAddress: 'Labone, near Metro TV, Accra',
    dropoffNotes: 'Gate has a palm tree outside',
    packageSize: 'small',
    packageWeightKg: 0.5,
    packageDescription: 'Replacement charger and laptop power adapter',
    scheduledPickupAt: at(-5 * 60 * 1000),
    priceAmount: 2500,
    status: 'confirmed',
    paymentStatus: 'pending',
    paymentTiming: 'on_delivery',
    createdAt: at(-3 * hour),
    timeline: [
      { status: 'requested', note: 'Order submitted online by customer', atMs: -3 * hour },
      { status: 'confirmed', note: 'Confirmed with sender', byAdmin: true, atMs: -2 * hour },
    ],
  },
  {
    trackingCode: 'WP-1048-552',
    senderName: 'Sarah Lamptey',
    senderPhone: '0544881122',
    pickupAddress: 'Spintex Road, near Kotobabi Junction, Accra',
    pickupNotes: 'Inside the Accra Mall Complex back parking',
    recipientName: 'Michael Tagoe',
    recipientPhone: '0244665544',
    dropoffAddress: 'Tema Community 6, near the Harbor, Tema',
    dropoffNotes: 'Warehouse B',
    packageSize: 'large',
    packageWeightKg: 18.2,
    packageDescription: 'Automotive replacement filters and engine gaskets',
    scheduledPickupAt: at(1 * day),
    priceAmount: 9000,
    status: 'requested',
    paymentStatus: 'pending',
    paymentTiming: 'on_delivery',
    createdAt: at(-1 * hour),
    timeline: [
      { status: 'requested', note: 'New booking requested online', atMs: -1 * hour },
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

  let created = 0;

  for (const fixture of FIXTURES) {
    const existing = await prisma.order.findUnique({
      where: { trackingCode: fixture.trackingCode },
    });
    if (existing) continue;

    const rider =
      fixture.riderIndex !== undefined ? riders[fixture.riderIndex] : undefined;

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
          packageSize: fixture.packageSize,
          packageWeightKg: fixture.packageWeightKg,
          packageDescription: fixture.packageDescription,
          scheduledPickupAt: fixture.scheduledPickupAt,
          priceAmount: fixture.priceAmount,
          currency: 'GHS',
          status: fixture.status,
          paymentStatus: fixture.paymentStatus,
          payer: 'sender',
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
            amount: fixture.payment.amount,
            currency: 'GHS',
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
