-- Retire the `dispatcher` role.
--
-- It held exactly what `support` holds, and two names for one set of powers is
-- how somebody ends up granting more than they meant to. `support` survives:
-- it is the column default, so it is the floor every account already sits on.
--
-- Written by hand. Postgres cannot drop a value from an enum, so the type is
-- rebuilt and the column recast. Nothing holds `dispatcher` today, but the
-- UPDATE runs first regardless so this is safe against any database it meets
-- later -- without it, the cast below would fail rather than migrate.

UPDATE "admin_users" SET "role" = 'support'::"Role" WHERE "role" = 'dispatcher'::"Role";

-- The default has to go before the type change; Postgres cannot cast it.
ALTER TABLE "admin_users" ALTER COLUMN "role" DROP DEFAULT;

ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('owner', 'finance', 'support');

ALTER TABLE "admin_users"
  ALTER COLUMN "role" TYPE "Role"
  USING ("role"::text::"Role");

ALTER TABLE "admin_users" ALTER COLUMN "role" SET DEFAULT 'support';

DROP TYPE "Role_old";
