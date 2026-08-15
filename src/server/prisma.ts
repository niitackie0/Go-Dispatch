/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Loaded here rather than relying on the caller: ESM evaluates imported modules
// before the importing module's body runs, so a dotenv.config() call in
// server.ts would fire too late for this file to see DATABASE_URL.
import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Copy the pooled Neon connection string into .env.'
  );
}

/**
 * The app connects through Neon's pooled endpoint. Migrations use the direct
 * endpoint instead — see prisma.config.ts for why they differ.
 */
const adapter = new PrismaPg({ connectionString });

export const prisma = new PrismaClient({ adapter });
