-- One booking per filled-in form, however many times Book is pressed.
--
-- The column is only a place to put the key; the unique index is the mechanism.
-- A second submit carrying the same key collides, the route catches the
-- collision and hands back the booking that already exists, and the sender sees
-- their confirmation instead of a second set of parcels.
--
-- Nullable, because bookings taken over the phone have no form behind them and
-- every booking made before today has no key. NULLs do not collide with each
-- other in a Postgres unique index, which is exactly the behaviour wanted here.

ALTER TABLE "bookings" ADD COLUMN "idempotencyKey" VARCHAR(64);

CREATE UNIQUE INDEX "bookings_idempotencyKey_key" ON "bookings"("idempotencyKey");
