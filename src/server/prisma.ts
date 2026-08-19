/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Loaded here rather than relying on the caller: ESM evaluates imported modules
// before the importing module's body runs, so a dotenv.config() call in
// server.ts would fire too late for this file to see DATABASE_URL.
import 'dotenv/config';

import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Copy the pooled Neon connection string into .env.'
  );
}

/**
 * The connection pool, configured rather than defaulted.
 *
 * The adapter was previously handed a connection string and left to node-pg's
 * defaults. Two of those defaults were wrong for this deployment in ways that
 * only show up on a bad day:
 *
 * `connectionTimeoutMillis` defaults to 0, which means wait forever. With Neon
 * unreachable — suspended compute, a network fault, the account lapsed — every
 * request would queue for a connection that was never coming, hold its socket,
 * and time out somewhere far away, if at all. The customer sees a page that
 * never finishes rather than a page that says something went wrong. Ten
 * seconds is longer than a healthy connection has ever taken and short enough
 * to still be an error rather than a hang.
 *
 * `statement_timeout` defaults to none, so one slow query pins a connection
 * until it finishes. With a pool of ten, a handful of those is the whole
 * application.
 *
 * The rest is small: keepAlive because the hop from Frankfurt to London is a
 * long-lived socket across somebody else's NAT, and application_name so these
 * connections are identifiable in Neon's monitoring rather than being an
 * anonymous ten.
 */
const pool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 20_000,
  query_timeout: 20_000,
  keepAlive: true,
  application_name: 'go-dispatch',
});

/**
 * An idle connection failing is normal and must not be fatal.
 *
 * Neon closes idle connections, networks blink, and the pooler recycles. When
 * that happens to a client sitting idle in the pool, node-pg emits `error` on
 * the pool — and an EventEmitter `error` event with no listener is thrown as
 * an uncaught exception, which ends the process.
 *
 * On a free instance that is not a blip: the process dies, and the next
 * visitor pays a cold start for a fault that had already healed. The pool
 * discards the dead client and makes another one; all this listener does is
 * let it.
 */
pool.on('error', (err) => {
  console.error('[db] idle client dropped, pool will replace it:', err.message);
});

export const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
