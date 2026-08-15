import 'dotenv/config';
import crypto from 'node:crypto';
import { hash } from '@node-rs/argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * Seeds the baseline rows a fresh Waypoint database needs: the price list,
 * one admin account, and the starting courier pool.
 *
 * Idempotent — every write is an upsert, so running it twice is harmless.
 * It deliberately does NOT create sample orders; those belong in a separate
 * dev-only fixture script, not in something that may touch production.
 */

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/** Prices in integer pesewas. 2500 == GHS 25.00. */
const PRICING = {
  small: 2500,
  medium: 5000,
  large: 9000,
  currency: 'GHS',
};

const RIDERS = [
  { name: 'Kwesi Boateng', phone: '0244777001' },
  { name: 'Yaw Antwi', phone: '0244777002' },
  { name: 'Abena Nkrumah', phone: '0244777003' },
];

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@waypoint.com';

async function main() {
  await prisma.pricingConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, ...PRICING },
  });
  console.log('✔ pricing config');

  for (const rider of RIDERS) {
    await prisma.rider.upsert({
      where: { phone: rider.phone },
      update: {},
      create: rider,
    });
  }
  console.log(`✔ ${RIDERS.length} riders`);

  const existingAdmin = await prisma.adminUser.findUnique({
    where: { email: ADMIN_EMAIL },
  });

  if (existingAdmin) {
    console.log(`✔ admin ${ADMIN_EMAIL} already exists — password left alone`);
  } else {
    // Never hardcode a password. Take one from the environment if provided,
    // otherwise mint a strong random one and print it exactly once.
    const provided = process.env.SEED_ADMIN_PASSWORD;
    const password = provided ?? crypto.randomBytes(15).toString('base64url');

    await prisma.adminUser.create({
      data: {
        name: 'Waypoint Dispatch Admin',
        email: ADMIN_EMAIL,
        role: 'admin',
        passwordHash: await hash(password),
      },
    });

    console.log(`✔ admin created: ${ADMIN_EMAIL}`);
    if (!provided) {
      console.log('');
      console.log('  Generated password (shown once — save it now):');
      console.log(`    ${password}`);
      console.log('');
    }
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
