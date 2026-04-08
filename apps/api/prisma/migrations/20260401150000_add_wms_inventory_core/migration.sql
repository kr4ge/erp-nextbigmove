-- CreateEnum
CREATE TYPE "WmsInventoryLotStatus" AS ENUM ('ACTIVE', 'HOLD', 'DEPLETED', 'CLOSED');

-- CreateEnum
CREATE TYPE "WmsInventoryMovementType" AS ENUM (
  'RECEIPT',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'RESERVE',
  'RELEASE',
  'PICK',
  'DISPATCH',
  'RTS_RECEIPT',
  'DAMAGE',
  'RESTOCK'
);

-- CreateTable
CREATE TABLE "wms_inventory_lots" (
  "id" UUID NOT NULL,
  "lotCode" TEXT NOT NULL,
  "warehouseId" UUID NOT NULL,
  "receivedLocationId" UUID,
  "sku" TEXT NOT NULL,
  "productName" TEXT NOT NULL,
  "variationId" TEXT,
  "variationName" TEXT,
  "barcode" TEXT,
  "supplierBatchNo" TEXT,
  "status" "WmsInventoryLotStatus" NOT NULL DEFAULT 'ACTIVE',
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "initialQuantity" DECIMAL(14,4) NOT NULL,
  "remainingQuantity" DECIMAL(14,4) NOT NULL,
  "unitCost" DECIMAL(14,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'PHP',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "wms_inventory_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wms_inventory_cost_layers" (
  "id" UUID NOT NULL,
  "warehouseId" UUID NOT NULL,
  "lotId" UUID NOT NULL,
  "sku" TEXT NOT NULL,
  "originalQuantity" DECIMAL(14,4) NOT NULL,
  "remainingQuantity" DECIMAL(14,4) NOT NULL,
  "unitCost" DECIMAL(14,2) NOT NULL,
  "totalCost" DECIMAL(14,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'PHP',
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "wms_inventory_cost_layers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wms_inventory_balances" (
  "id" UUID NOT NULL,
  "warehouseId" UUID NOT NULL,
  "locationId" UUID NOT NULL,
  "sku" TEXT NOT NULL,
  "productName" TEXT NOT NULL,
  "variationId" TEXT,
  "variationName" TEXT,
  "barcode" TEXT,
  "onHandQuantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "reservedQuantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "availableQuantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "latestUnitCost" DECIMAL(14,2),
  "inventoryValue" DECIMAL(14,2),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "wms_inventory_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wms_inventory_ledger" (
  "id" UUID NOT NULL,
  "warehouseId" UUID NOT NULL,
  "locationId" UUID NOT NULL,
  "lotId" UUID,
  "costLayerId" UUID,
  "actorUserId" UUID,
  "movementType" "WmsInventoryMovementType" NOT NULL,
  "sku" TEXT NOT NULL,
  "productName" TEXT NOT NULL,
  "variationId" TEXT,
  "variationName" TEXT,
  "barcode" TEXT,
  "quantityDelta" DECIMAL(14,4) NOT NULL,
  "quantityBefore" DECIMAL(14,4) NOT NULL,
  "quantityAfter" DECIMAL(14,4) NOT NULL,
  "reservedDelta" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "unitCost" DECIMAL(14,2),
  "totalCost" DECIMAL(14,2),
  "currency" VARCHAR(8),
  "referenceType" VARCHAR(64),
  "referenceId" VARCHAR(64),
  "notes" TEXT,
  "happenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "wms_inventory_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wms_inventory_lots_lotCode_key" ON "wms_inventory_lots"("lotCode");

-- CreateIndex
CREATE INDEX "wms_inventory_lots_warehouseId_status_receivedAt_idx" ON "wms_inventory_lots"("warehouseId", "status", "receivedAt");

-- CreateIndex
CREATE INDEX "wms_inventory_lots_warehouseId_sku_idx" ON "wms_inventory_lots"("warehouseId", "sku");

-- CreateIndex
CREATE INDEX "wms_inventory_lots_barcode_idx" ON "wms_inventory_lots"("barcode");

-- CreateIndex
CREATE INDEX "wms_inventory_lots_variationId_idx" ON "wms_inventory_lots"("variationId");

-- CreateIndex
CREATE INDEX "wms_inventory_cost_layers_warehouseId_sku_receivedAt_idx" ON "wms_inventory_cost_layers"("warehouseId", "sku", "receivedAt");

-- CreateIndex
CREATE INDEX "wms_inventory_cost_layers_lotId_idx" ON "wms_inventory_cost_layers"("lotId");

-- CreateIndex
CREATE UNIQUE INDEX "wms_inventory_balances_warehouseId_locationId_sku_key" ON "wms_inventory_balances"("warehouseId", "locationId", "sku");

-- CreateIndex
CREATE INDEX "wms_inventory_balances_warehouseId_sku_idx" ON "wms_inventory_balances"("warehouseId", "sku");

-- CreateIndex
CREATE INDEX "wms_inventory_balances_locationId_sku_idx" ON "wms_inventory_balances"("locationId", "sku");

-- CreateIndex
CREATE INDEX "wms_inventory_balances_variationId_idx" ON "wms_inventory_balances"("variationId");

-- CreateIndex
CREATE INDEX "wms_inventory_balances_barcode_idx" ON "wms_inventory_balances"("barcode");

-- CreateIndex
CREATE INDEX "wms_inventory_ledger_warehouseId_happenedAt_idx" ON "wms_inventory_ledger"("warehouseId", "happenedAt");

-- CreateIndex
CREATE INDEX "wms_inventory_ledger_locationId_happenedAt_idx" ON "wms_inventory_ledger"("locationId", "happenedAt");

-- CreateIndex
CREATE INDEX "wms_inventory_ledger_sku_happenedAt_idx" ON "wms_inventory_ledger"("sku", "happenedAt");

-- CreateIndex
CREATE INDEX "wms_inventory_ledger_movementType_happenedAt_idx" ON "wms_inventory_ledger"("movementType", "happenedAt");

-- CreateIndex
CREATE INDEX "wms_inventory_ledger_referenceType_referenceId_idx" ON "wms_inventory_ledger"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "wms_inventory_ledger_actorUserId_happenedAt_idx" ON "wms_inventory_ledger"("actorUserId", "happenedAt");

-- AddForeignKey
ALTER TABLE "wms_inventory_lots"
ADD CONSTRAINT "wms_inventory_lots_warehouseId_fkey"
FOREIGN KEY ("warehouseId") REFERENCES "wms_warehouses"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_inventory_lots"
ADD CONSTRAINT "wms_inventory_lots_receivedLocationId_fkey"
FOREIGN KEY ("receivedLocationId") REFERENCES "wms_locations"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_inventory_cost_layers"
ADD CONSTRAINT "wms_inventory_cost_layers_warehouseId_fkey"
FOREIGN KEY ("warehouseId") REFERENCES "wms_warehouses"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_inventory_cost_layers"
ADD CONSTRAINT "wms_inventory_cost_layers_lotId_fkey"
FOREIGN KEY ("lotId") REFERENCES "wms_inventory_lots"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_inventory_balances"
ADD CONSTRAINT "wms_inventory_balances_warehouseId_fkey"
FOREIGN KEY ("warehouseId") REFERENCES "wms_warehouses"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_inventory_balances"
ADD CONSTRAINT "wms_inventory_balances_locationId_fkey"
FOREIGN KEY ("locationId") REFERENCES "wms_locations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_inventory_ledger"
ADD CONSTRAINT "wms_inventory_ledger_warehouseId_fkey"
FOREIGN KEY ("warehouseId") REFERENCES "wms_warehouses"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_inventory_ledger"
ADD CONSTRAINT "wms_inventory_ledger_locationId_fkey"
FOREIGN KEY ("locationId") REFERENCES "wms_locations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_inventory_ledger"
ADD CONSTRAINT "wms_inventory_ledger_lotId_fkey"
FOREIGN KEY ("lotId") REFERENCES "wms_inventory_lots"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_inventory_ledger"
ADD CONSTRAINT "wms_inventory_ledger_costLayerId_fkey"
FOREIGN KEY ("costLayerId") REFERENCES "wms_inventory_cost_layers"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_inventory_ledger"
ADD CONSTRAINT "wms_inventory_ledger_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
