-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "destinationTown" VARCHAR(64);

-- AlterTable
ALTER TABLE "pricing_config" DROP COLUMN "large",
DROP COLUMN "medium",
DROP COLUMN "small",
ADD COLUMN     "baseAmount" INTEGER NOT NULL DEFAULT 5000,
ADD COLUMN     "includedKg" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "perExtraKgAmount" INTEGER NOT NULL DEFAULT 1000;

