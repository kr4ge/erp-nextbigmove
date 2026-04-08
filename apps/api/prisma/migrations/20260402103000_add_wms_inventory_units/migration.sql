-- AlterTable
ALTER TABLE "wms_sku_profiles"
ADD COLUMN "isSerialized" BOOLEAN NOT NULL DEFAULT true;

-- CreateEnum
CREATE TYPE "WmsInventoryUnitStatus" AS ENUM (
  'AVAILABLE',
  'RESERVED',
  'PICKED',
  'PACKED',
  'DISPATCHED',
  'RETURNED',
  'DAMAGED',
  'ADJUSTED_OUT'
);

-- CreateTable
CREATE TABLE "wms_inventory_units" (
  "id" UUID NOT NULL,
  "unitBarcode" TEXT NOT NULL,
  "warehouseId" UUID NOT NULL,
  "locationId" UUID NOT NULL,
  "lotId" UUID NOT NULL,
  "skuProfileId" UUID,
  "receiptItemId" UUID,
  "sourceAdjustmentItemId" UUID,
  "sku" TEXT NOT NULL,
  "productName" TEXT NOT NULL,
  "variationId" TEXT,
  "variationName" TEXT,
  "barcode" TEXT,
  "status" "WmsInventoryUnitStatus" NOT NULL DEFAULT 'AVAILABLE',
  "lastMovementType" "WmsInventoryMovementType" NOT NULL DEFAULT 'RECEIPT',
  "lastReferenceType" VARCHAR(64),
  "lastReferenceId" VARCHAR(64),
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "consumedAt" TIMESTAMP(3),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "wms_inventory_units_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wms_inventory_units_unitBarcode_key" ON "wms_inventory_units"("unitBarcode");

-- CreateIndex
CREATE INDEX "wms_inventory_units_warehouseId_status_receivedAt_idx" ON "wms_inventory_units"("warehouseId", "status", "receivedAt");

-- CreateIndex
CREATE INDEX "wms_inventory_units_locationId_status_receivedAt_idx" ON "wms_inventory_units"("locationId", "status", "receivedAt");

-- CreateIndex
CREATE INDEX "wms_inventory_units_lotId_status_idx" ON "wms_inventory_units"("lotId", "status");

-- CreateIndex
CREATE INDEX "wms_inventory_units_skuProfileId_status_idx" ON "wms_inventory_units"("skuProfileId", "status");

-- CreateIndex
CREATE INDEX "wms_inventory_units_sku_status_idx" ON "wms_inventory_units"("sku", "status");

-- CreateIndex
CREATE INDEX "wms_inventory_units_variationId_status_idx" ON "wms_inventory_units"("variationId", "status");

-- CreateIndex
CREATE INDEX "wms_inventory_units_lastReferenceType_lastReferenceId_idx" ON "wms_inventory_units"("lastReferenceType", "lastReferenceId");

-- AddForeignKey
ALTER TABLE "wms_inventory_units"
ADD CONSTRAINT "wms_inventory_units_warehouseId_fkey"
FOREIGN KEY ("warehouseId") REFERENCES "wms_warehouses"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_inventory_units"
ADD CONSTRAINT "wms_inventory_units_locationId_fkey"
FOREIGN KEY ("locationId") REFERENCES "wms_locations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_inventory_units"
ADD CONSTRAINT "wms_inventory_units_lotId_fkey"
FOREIGN KEY ("lotId") REFERENCES "wms_inventory_lots"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_inventory_units"
ADD CONSTRAINT "wms_inventory_units_skuProfileId_fkey"
FOREIGN KEY ("skuProfileId") REFERENCES "wms_sku_profiles"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_inventory_units"
ADD CONSTRAINT "wms_inventory_units_receiptItemId_fkey"
FOREIGN KEY ("receiptItemId") REFERENCES "wms_stock_receipt_items"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_inventory_units"
ADD CONSTRAINT "wms_inventory_units_sourceAdjustmentItemId_fkey"
FOREIGN KEY ("sourceAdjustmentItemId") REFERENCES "wms_inventory_adjustment_items"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
