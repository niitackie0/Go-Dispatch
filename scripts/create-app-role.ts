/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Create the least-privilege role the application connects as.
 *
 *     npx tsx scripts/create-app-role.ts            # show what it would do
 *     npx tsx scripts/create-app-role.ts --apply    # do it
 *
 * WHY THIS EXISTS. The app connected as `neondb_owner`, the Neon project owner,
 * which can DROP the schema it reads. Nothing in the product ever issues DDL at
 * runtime -- Prisma Client only ever does DML, and migrations run separately on
 * DIRECT_URL during the build. So the runtime credential was carrying an
 * authority it never once used, and a SQL injection or a leaked pooled string
 * was the difference between reading data and losing the business.
 *
 * THE SPLIT this sets up:
 *
 *   DIRECT_URL    neondb_owner      migrations, DDL, `prisma migrate deploy`
 *   DATABASE_URL  go_dispatch_app   the running app: SELECT/INSERT/UPDATE/DELETE
 *
 * The app role gets no CREATE on the schema, so it cannot add, alter or drop a
 * table even if something contrives to make it try.
 *
 * DEFAULT PRIVILEGES are the part that is easy to get wrong. Every migration
 * creates its tables as `neondb_owner`, and a grant issued today says nothing
 * about a table created tomorrow -- so the app would break on the first deploy
 * that adds one. `ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner` is what makes
 * the grant apply to tables that do not exist yet. Run as the owner, because
 * only the creating role's defaults matter.
 *
 * Safe to re-run. Creating the role is skipped if it exists; the grants are
 * idempotent. Re-running with --apply rotates the password.
 */

import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { Client } from 'pg';

const APP_ROLE = 'go_dispatch_app';

/** Alphanumeric only: this ends up in a URL, and escaping is a footgun. */
function password(length = 32): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  return Array.from(crypto.randomFillSync(new Uint32Array(length)))
    .map((n) => alphabet[n % alphabet.length])
    .join('');
}

/**
 * The owner connection. Deliberately DIRECT_URL, not DATABASE_URL: role and
 * grant changes should not go through the pooler, and DATABASE_URL is the very
 * thing being replaced.
 */
function ownerUrl(): string {
  const url = process.env.DIRECT_URL;
  if (!url) throw new Error('DIRECT_URL is not set. It must point at the non-pooler Neon host.');
  if (url.includes('-pooler')) throw new Error('DIRECT_URL points at the pooler. Use the direct host.');
  return url;
}

/** Everything the app role needs, and nothing else. */
function grants(role: string): string[] {
  return [
    `GRANT CONNECT ON DATABASE neondb TO ${role}`,
    `GRANT USAGE ON SCHEMA public TO ${role}`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${role}`,
    `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${role}`,
    // Tables and sequences that do not exist yet -- i.e. every future migration.
    `ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${role}`,
    `ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${role}`,
    // Belt and braces: PUBLIC has CREATE on `public` in Postgres 14 and below.
    // Neon runs 17, where it does not -- this makes the intent explicit anyway.
    `REVOKE CREATE ON SCHEMA public FROM ${role}`,
  ];
}

async function main() {
  const apply = process.argv.includes('--apply');
  const pw = password();

  const client = new Client({ connectionString: ownerUrl() });
  await client.connect();

  try {
    const who = await client.query('SELECT current_user, current_database() db');
    console.log(`connected as ${who.rows[0].current_user} to ${who.rows[0].db}\n`);

    const existing = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [APP_ROLE]);
    const exists = existing.rowCount === 1;

    const statements = [
      exists
        ? `ALTER ROLE ${APP_ROLE} WITH LOGIN PASSWORD '<generated>'`
        : `CREATE ROLE ${APP_ROLE} WITH LOGIN PASSWORD '<generated>'`,
      ...grants(APP_ROLE),
    ];

    if (!apply) {
      console.log(exists ? `Role ${APP_ROLE} exists -- would rotate its password.\n` : `Role ${APP_ROLE} does not exist -- would create it.\n`);
      statements.forEach((s) => console.log('  ' + s));
      console.log('\nNothing was changed. Re-run with --apply.');
      return;
    }

    // The password is parameterised nowhere -- CREATE ROLE takes no parameters --
    // so it comes from the alphabet above and never from input.
    await client.query(
      exists
        ? `ALTER ROLE ${APP_ROLE} WITH LOGIN PASSWORD '${pw}'`
        : `CREATE ROLE ${APP_ROLE} WITH LOGIN PASSWORD '${pw}'`
    );
    console.log(exists ? `rotated password for ${APP_ROLE}` : `created role ${APP_ROLE}`);

    for (const statement of grants(APP_ROLE)) {
      await client.query(statement);
      console.log('  ' + statement.replace(/\s+/g, ' ').slice(0, 92));
    }

    // What the app will actually connect with. Same host, same database, same
    // sslmode as DIRECT_URL -- only the credential changes, and the pooler host
    // is restored because the app should keep using it.
    const url = new URL(ownerUrl());
    url.username = APP_ROLE;
    url.password = pw;
    url.hostname = url.hostname.replace(/^([^.]+)\./, '$1-pooler.');

    // Written straight into .env rather than printed. A password that goes to
    // stdout is a password in a scrollback buffer, a screen share and a support
    // ticket; this one only ever exists in the file that already holds the
    // others. Read it back out of .env when filling in Render.
    const envPath = '.env';
    const before = fs.readFileSync(envPath, 'utf8');
    const line = `DATABASE_URL=${url.toString()}`;
    const after = /^DATABASE_URL=.*$/m.test(before)
      ? before.replace(/^DATABASE_URL=.*$/m, line)
      : before.trimEnd() + '\n' + line + '\n';
    fs.writeFileSync(envPath, after);

    console.log(`\nDATABASE_URL in ${envPath} now connects as ${APP_ROLE}.`);
    console.log(`Copy that line into Render as well -- the deployed app is still on the old credential until you do.`);
    console.log('DIRECT_URL is unchanged, and must stay the owner: migrations need DDL.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
