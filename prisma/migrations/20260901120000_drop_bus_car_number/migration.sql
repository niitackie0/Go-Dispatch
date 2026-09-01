-- We no longer capture or text the bus/car registration. Dispatch still marks
-- a parcel as on the bus and notifies both ends, but there is nothing to type
-- in and nothing to store. Existing values are lost with this column.
ALTER TABLE "orders" DROP COLUMN "busCarNumber";
