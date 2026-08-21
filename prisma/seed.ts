import 'dotenv/config';
import crypto from 'node:crypto';
import { hash } from '@node-rs/argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * Seeds the baseline rows a fresh GO DISPATCH database needs: the price list
 * and one admin account.
 *
 * Deliberately NOT the fleet. Riders are added from the console by an owner --
 * see the note where they used to be.
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

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'owner@godispatch.local';

async function main() {
  await prisma.pricingConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, ...PRICING },
  });
  console.log('✔ pricing config');

  // NO RIDERS. The fleet starts empty and is filled in by an owner from the
  // console (Fleet section), because a courier is a real person with a real
  // handset: an invented one is a name on the dispatch board that nobody can
  // ring, and a unit of capacity the assigner will hand a live parcel to.
  //
  // The three that used to be seeded here -- Kwesi, Yaw and Abena -- were
  // exactly that, and they were indistinguishable on screen from staff who
  // actually exist.
  console.log('- no riders seeded; add them in the console');

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
        name: 'GO DISPATCH Owner',
        email: ADMIN_EMAIL,
        role: 'owner',
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
