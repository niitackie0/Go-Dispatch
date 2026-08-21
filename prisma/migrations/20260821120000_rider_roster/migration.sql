-- Split "on the roster" from "free right now".
--
-- `available` was carrying both meanings, and the automation pass owns it: the
-- release rule sets it back to true the moment a rider's last job finishes. So
-- an owner who took somebody off the fleet by clearing that flag would find
-- them assigned work again on the next pass -- a rider who has left the company
-- collecting a parcel because a boolean was asked to mean two things.
--
-- `active` is the employment fact, written only by an owner. `available` stays
-- the automation's, meaning nothing more than "not carrying a parcel". The
-- assignment query now asks for both.
--
-- Existing rows default to active: everybody already on the fleet stays on it.

ALTER TABLE "riders" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

-- The old index answered half the question the assignment query now asks.
DROP INDEX IF EXISTS "riders_available_idx";
CREATE INDEX "riders_active_available_idx" ON "riders"("active", "available");
