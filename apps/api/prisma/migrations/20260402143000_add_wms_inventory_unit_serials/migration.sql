-- CreateSequence
CREATE SEQUENCE "wms_inventory_units_serialNo_seq";

-- AlterTable
ALTER TABLE "wms_inventory_units"
ADD COLUMN "serialNo" BIGINT,
ADD COLUMN "batchSequence" INTEGER;

-- SetDefault
ALTER TABLE "wms_inventory_units"
ALTER COLUMN "serialNo" SET DEFAULT nextval('"wms_inventory_units_serialNo_seq"');

-- SequenceOwnership
ALTER SEQUENCE "wms_inventory_units_serialNo_seq"
OWNED BY "wms_inventory_units"."serialNo";

-- BackfillSerials
UPDATE "wms_inventory_units"
SET "serialNo" = nextval('"wms_inventory_units_serialNo_seq"')
WHERE "serialNo" IS NULL;

-- BackfillBatchSequence
WITH ranked_units AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "lotId"
      ORDER BY "receivedAt" ASC, "createdAt" ASC, "id" ASC
    ) AS row_number
  FROM "wms_inventory_units"
)
UPDATE "wms_inventory_units" units
SET "batchSequence" = ranked_units.row_number
FROM ranked_units
WHERE units."id" = ranked_units."id";

-- BackfillUnitBarcodes
UPDATE "wms_inventory_units"
SET "unitBarcode" = 'WCU' || LPAD("serialNo"::text, 9, '0');

-- SetNotNull
ALTER TABLE "wms_inventory_units"
ALTER COLUMN "serialNo" SET NOT NULL,
ALTER COLUMN "batchSequence" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "wms_inventory_units_serialNo_key"
ON "wms_inventory_units"("serialNo");

-- CreateIndex
CREATE UNIQUE INDEX "wms_inventory_units_lotId_batchSequence_key"
ON "wms_inventory_units"("lotId", "batchSequence");
