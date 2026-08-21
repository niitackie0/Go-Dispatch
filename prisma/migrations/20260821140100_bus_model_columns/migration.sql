-- Two rider legs, and the bus.
--
-- A parcel is carried by two different people: one collects it from the sender
-- and brings it to the office, another runs it from the office to the station.
-- Each is freed at the end of their own leg. One riderId column could not say
-- that -- it pinned a collection rider to the parcel for the whole of its life,
-- which is why every rider who had ever collected anything showed as busy.
--
-- RENAMED rather than dropped and recreated: the existing assignments are real
-- collections, and they keep their rider.

ALTER TABLE "orders" RENAME COLUMN "riderId" TO "collectionRiderId";
ALTER INDEX "orders_riderId_idx" RENAME TO "orders_collectionRiderId_idx";

ALTER TABLE "orders" ADD COLUMN "stationRiderId" TEXT;
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_stationRiderId_fkey"
  FOREIGN KEY ("stationRiderId") REFERENCES "riders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "orders_stationRiderId_idx" ON "orders"("stationRiderId");

-- What both ends are texted, and the only handle either of them has on the
-- parcel once it leaves us.
ALTER TABLE "orders" ADD COLUMN "busCarNumber" VARCHAR(32);

-- Move the parcels that are mid-flight onto the new model. CURRENT STATE ONLY:
-- status_history is left exactly as written, because it records what was true
-- at the time and no later model changes that.
--
--   awaiting_payment -> at_office   money is now asked for at the office,
--                                   after weighing, which is where these are
--   in_transit       -> to_station  it was on its way to the station
--   delivered        -> dispatched  the furthest we can honestly claim
UPDATE "orders" SET "status" = 'at_office'  WHERE "status" = 'awaiting_payment';
UPDATE "orders" SET "status" = 'to_station' WHERE "status" = 'in_transit';
UPDATE "orders" SET "status" = 'dispatched' WHERE "status" = 'delivered';
