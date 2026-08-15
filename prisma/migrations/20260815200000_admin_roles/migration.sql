-- Staff roles move from a free-text column to an enum.
--
-- Written by hand: Prisma's generated version drops and recreates the column,
-- which would discard every existing admin's role. This converts in place.

CREATE TYPE "Role" AS ENUM ('owner', 'dispatcher', 'finance', 'support');

-- The default has to go before the type change; Postgres cannot cast it.
ALTER TABLE "admin_users" ALTER COLUMN "role" DROP DEFAULT;

-- Existing accounts were all the generic "admin", which meant full access —
-- so they become owner. Anything unrecognised falls back to least privilege.
ALTER TABLE "admin_users"
  ALTER COLUMN "role" TYPE "Role"
  USING (
    CASE "role"
      WHEN 'admin' THEN 'owner'
      WHEN 'owner' THEN 'owner'
      WHEN 'dispatcher' THEN 'dispatcher'
      WHEN 'finance' THEN 'finance'
      ELSE 'support'
    END
  )::"Role";

ALTER TABLE "admin_users" ALTER COLUMN "role" SET DEFAULT 'support';
