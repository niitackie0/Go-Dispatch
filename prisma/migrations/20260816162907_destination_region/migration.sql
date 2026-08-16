-- The customer picks a region, not a town: three of the advertised towns
-- (Cape Coast, Winneba, Swedru) share one region, so the town alone was never
-- the unit being chosen. Renamed rather than dropped so any existing value
-- carries over.
ALTER TABLE "orders" RENAME COLUMN "destinationTown" TO "destinationRegion";
