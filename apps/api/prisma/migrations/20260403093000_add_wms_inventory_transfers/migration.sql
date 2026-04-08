-- CreateEnum
CREATE TYPE "WmsInventoryTransferType" AS ENUM (
  'PUT_AWAY',
  'RELOCATION'
);

-- CreateTable
CREATE TABLE "wms_inventory_transfers" (
  "id" UUID NOT NULL,
  "transferCode" TEXT NOT NULL,
  "warehouseId" UUID NOT NULL,
  "fromLocationId" UUID NOT NULL,
  "toLocationId" UUID NOT NULL,
  "actorUserId" UUID,
  "transferType" "WmsInventoryTransferType" NOT NULL,
  "notes" TEXT,
  "happenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "totalUnits" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "wms_inventory_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wms_inventory_transfer_items" (
  "id" UUID NOT NULL,
  "transferId" UUID NOT NULL,
  "lineNo" INTEGER NOT NULL,
  "unitId" UUID NOT NULL,
  "serialNo" BIGINT NOT NULL,
  "batchSequence" INTEGER NOT NULL,
  "unitBarcode" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "productName" TEXT NOT NULL,
  "variationId" TEXT,
  "variationName" TEXT,
  "barcode" TEXT,
  "lotId" UUID,
  "lotCode" TEXT,
  "unitCost" DECIMAL(14,2),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "wms_inventory_transfer_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wms_inventory_transfers_transferCode_key"
ON "wms_inventory_transfers"("transferCode");

-- CreateIndex
CREATE INDEX "wms_inventory_transfers_warehouseId_happenedAt_idx"
ON "wms_inventory_transfers"("warehouseId", "happenedAt");

-- CreateIndex
CREATE INDEX "wms_inventory_transfers_fromLocationId_happenedAt_idx"
ON "wms_inventory_transfers"("fromLocationId", "happenedAt");

-- CreateIndex
CREATE INDEX "wms_inventory_transfers_toLocationId_happenedAt_idx"
ON "wms_inventory_transfers"("toLocationId", "happenedAt");

-- CreateIndex
CREATE INDEX "wms_inventory_transfers_actorUserId_happenedAt_idx"
ON "wms_inventory_transfers"("actorUserId", "happenedAt");

-- CreateIndex
CREATE INDEX "wms_inventory_transfers_transferType_happenedAt_idx"
ON "wms_inventory_transfers"("transferType", "happenedAt");

-- CreateIndex
CREATE UNIQUE INDEX "wms_inventory_transfer_items_transferId_lineNo_key"
ON "wms_inventory_transfer_items"("transferId", "lineNo");

-- CreateIndex
CREATE INDEX "wms_inventory_transfer_items_unitId_createdAt_idx"
ON "wms_inventory_transfer_items"("unitId", "createdAt");

-- CreateIndex
CREATE INDEX "wms_inventory_transfer_items_lotId_idx"
ON "wms_inventory_transfer_items"("lotId");

-- CreateIndex
CREATE INDEX "wms_inventory_transfer_items_sku_idx"
ON "wms_inventory_transfer_items"("sku");

-- CreateIndex
CREATE INDEX "wms_inventory_transfer_items_unitBarcode_idx"
ON "wms_inventory_transfer_items"("unitBarcode");

-- AddForeignKey
ALTER TABLE "wms_inventory_transfers"
ADD CONSTRAINT "wms_inventory_transfers_warehouseId_fkey"
FOREIGN KEY ("warehouseId") REFERENCES "wms_warehouses"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_inventory_transfers"
ADD CONSTRAINT "wms_inventory_transfers_fromLocationId_fkey"
FOREIGN KEY ("fromLocationId") REFERENCES "wms_locations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_inventory_transfers"
ADD CONSTRAINT "wms_inventory_transfers_toLocationId_fkey"
FOREIGN KEY ("toLocationId") REFERENCES "wms_locations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_inventory_transfers"
ADD CONSTRAINT "wms_inventory_transfers_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_inventory_transfer_items"
ADD CONSTRAINT "wms_inventory_transfer_items_transferId_fkey"
FOREIGN KEY ("transferId") REFERENCES "wms_inventory_transfers"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_inventory_transfer_items"
ADD CONSTRAINT "wms_inventory_transfer_items_unitId_fkey"
FOREIGN KEY ("unitId") REFERENCES "wms_inventory_units"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
