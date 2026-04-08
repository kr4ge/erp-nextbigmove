-- CreateEnum
CREATE TYPE "WmsInventoryAdjustmentType" AS ENUM ('OPENING', 'INCREASE', 'DECREASE', 'WRITE_OFF');

-- CreateEnum
CREATE TYPE "WmsInventoryAdjustmentStatus" AS ENUM ('POSTED', 'CANCELED');

-- CreateTable
CREATE TABLE "wms_inventory_adjustments" (
  "id" UUID NOT NULL,
  "adjustmentCode" TEXT NOT NULL,
  "warehouseId" UUID NOT NULL,
  "locationId" UUID NOT NULL,
  "actorUserId" UUID,
  "adjustmentType" "WmsInventoryAdjustmentType" NOT NULL,
  "status" "WmsInventoryAdjustmentStatus" NOT NULL DEFAULT 'POSTED',
  "reason" TEXT NOT NULL,
  "notes" TEXT,
  "happenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "totalItems" INTEGER NOT NULL DEFAULT 0,
  "totalQuantityDelta" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "totalCostDelta" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'PHP',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "wms_inventory_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wms_inventory_adjustment_items" (
  "id" UUID NOT NULL,
  "adjustmentId" UUID NOT NULL,
  "lineNo" INTEGER NOT NULL,
  "sku" TEXT NOT NULL,
  "productName" TEXT NOT NULL,
  "variationId" TEXT,
  "variationName" TEXT,
  "barcode" TEXT,
  "quantity" DECIMAL(14,4) NOT NULL,
  "quantityDelta" DECIMAL(14,4) NOT NULL,
  "unitCost" DECIMAL(14,2),
  "totalCostDelta" DECIMAL(14,2) NOT NULL,
  "resultLotCode" TEXT,
  "resultLotId" UUID,
  "notes" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "wms_inventory_adjustment_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wms_inventory_adjustments_adjustmentCode_key" ON "wms_inventory_adjustments"("adjustmentCode");

-- CreateIndex
CREATE INDEX "wms_inventory_adjustments_warehouseId_happenedAt_idx" ON "wms_inventory_adjustments"("warehouseId", "happenedAt");

-- CreateIndex
CREATE INDEX "wms_inventory_adjustments_locationId_happenedAt_idx" ON "wms_inventory_adjustments"("locationId", "happenedAt");

-- CreateIndex
CREATE INDEX "wms_inventory_adjustments_actorUserId_happenedAt_idx" ON "wms_inventory_adjustments"("actorUserId", "happenedAt");

-- CreateIndex
CREATE INDEX "wms_inventory_adjustments_adjustmentType_happenedAt_idx" ON "wms_inventory_adjustments"("adjustmentType", "happenedAt");

-- CreateIndex
CREATE INDEX "wms_inventory_adjustments_status_happenedAt_idx" ON "wms_inventory_adjustments"("status", "happenedAt");

-- CreateIndex
CREATE INDEX "wms_inventory_adjustment_items_adjustmentId_lineNo_idx" ON "wms_inventory_adjustment_items"("adjustmentId", "lineNo");

-- CreateIndex
CREATE INDEX "wms_inventory_adjustment_items_sku_idx" ON "wms_inventory_adjustment_items"("sku");

-- CreateIndex
CREATE INDEX "wms_inventory_adjustment_items_resultLotCode_idx" ON "wms_inventory_adjustment_items"("resultLotCode");

-- AddForeignKey
ALTER TABLE "wms_inventory_adjustments"
ADD CONSTRAINT "wms_inventory_adjustments_warehouseId_fkey"
FOREIGN KEY ("warehouseId") REFERENCES "wms_warehouses"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_inventory_adjustments"
ADD CONSTRAINT "wms_inventory_adjustments_locationId_fkey"
FOREIGN KEY ("locationId") REFERENCES "wms_locations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_inventory_adjustments"
ADD CONSTRAINT "wms_inventory_adjustments_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_inventory_adjustment_items"
ADD CONSTRAINT "wms_inventory_adjustment_items_adjustmentId_fkey"
FOREIGN KEY ("adjustmentId") REFERENCES "wms_inventory_adjustments"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_inventory_adjustment_items"
ADD CONSTRAINT "wms_inventory_adjustment_items_resultLotId_fkey"
FOREIGN KEY ("resultLotId") REFERENCES "wms_inventory_lots"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
