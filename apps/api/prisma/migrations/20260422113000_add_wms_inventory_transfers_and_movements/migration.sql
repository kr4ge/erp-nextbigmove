CREATE TYPE "WmsInventoryMovementType" AS ENUM (
  'RECEIPT',
  'MANUAL_RECEIPT',
  'PUTAWAY',
  'TRANSFER',
  'ADJUSTMENT'
);

CREATE TYPE "WmsTransferStatus" AS ENUM (
  'COMPLETED',
  'CANCELED'
);

CREATE TABLE "wms_transfers" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "tenantId" UUID NOT NULL,
  "teamId" UUID,
  "warehouseId" UUID NOT NULL,
  "fromLocationId" UUID,
  "toLocationId" UUID NOT NULL,
  "status" "WmsTransferStatus" NOT NULL DEFAULT 'COMPLETED',
  "notes" TEXT,
  "createdById" UUID,
  "updatedById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "wms_transfers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wms_transfer_items" (
  "id" UUID NOT NULL,
  "transferId" UUID NOT NULL,
  "inventoryUnitId" UUID NOT NULL,
  "lineNo" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "wms_transfer_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wms_inventory_movements" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "teamId" UUID,
  "inventoryUnitId" UUID NOT NULL,
  "warehouseId" UUID NOT NULL,
  "fromLocationId" UUID,
  "toLocationId" UUID,
  "fromStatus" "WmsInventoryUnitStatus",
  "toStatus" "WmsInventoryUnitStatus",
  "movementType" "WmsInventoryMovementType" NOT NULL,
  "referenceType" TEXT,
  "referenceId" TEXT,
  "referenceCode" TEXT,
  "notes" TEXT,
  "actorId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "wms_inventory_movements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wms_transfers_code_key"
ON "wms_transfers"("code");

CREATE INDEX "wms_transfers_tenantId_warehouseId_createdAt_idx"
ON "wms_transfers"("tenantId", "warehouseId", "createdAt");

CREATE INDEX "wms_transfers_fromLocationId_idx"
ON "wms_transfers"("fromLocationId");

CREATE INDEX "wms_transfers_toLocationId_idx"
ON "wms_transfers"("toLocationId");

CREATE INDEX "wms_transfer_items_inventoryUnitId_idx"
ON "wms_transfer_items"("inventoryUnitId");

CREATE UNIQUE INDEX "wms_transfer_items_transferId_lineNo_key"
ON "wms_transfer_items"("transferId", "lineNo");

CREATE UNIQUE INDEX "wms_transfer_items_transferId_inventoryUnitId_key"
ON "wms_transfer_items"("transferId", "inventoryUnitId");

CREATE INDEX "wms_inventory_movements_tenantId_warehouseId_createdAt_idx"
ON "wms_inventory_movements"("tenantId", "warehouseId", "createdAt");

CREATE INDEX "wms_inventory_movements_inventoryUnitId_createdAt_idx"
ON "wms_inventory_movements"("inventoryUnitId", "createdAt");

CREATE INDEX "wms_inventory_movements_fromLocationId_idx"
ON "wms_inventory_movements"("fromLocationId");

CREATE INDEX "wms_inventory_movements_toLocationId_idx"
ON "wms_inventory_movements"("toLocationId");

CREATE INDEX "wms_inventory_movements_referenceType_referenceId_idx"
ON "wms_inventory_movements"("referenceType", "referenceId");

CREATE INDEX "wms_inventory_movements_actorId_idx"
ON "wms_inventory_movements"("actorId");

ALTER TABLE "wms_transfers"
ADD CONSTRAINT "wms_transfers_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_transfers"
ADD CONSTRAINT "wms_transfers_teamId_fkey"
FOREIGN KEY ("teamId") REFERENCES "teams"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_transfers"
ADD CONSTRAINT "wms_transfers_warehouseId_fkey"
FOREIGN KEY ("warehouseId") REFERENCES "wms_warehouses"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "wms_transfers"
ADD CONSTRAINT "wms_transfers_fromLocationId_fkey"
FOREIGN KEY ("fromLocationId") REFERENCES "wms_locations"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_transfers"
ADD CONSTRAINT "wms_transfers_toLocationId_fkey"
FOREIGN KEY ("toLocationId") REFERENCES "wms_locations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "wms_transfers"
ADD CONSTRAINT "wms_transfers_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_transfers"
ADD CONSTRAINT "wms_transfers_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_transfer_items"
ADD CONSTRAINT "wms_transfer_items_transferId_fkey"
FOREIGN KEY ("transferId") REFERENCES "wms_transfers"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_transfer_items"
ADD CONSTRAINT "wms_transfer_items_inventoryUnitId_fkey"
FOREIGN KEY ("inventoryUnitId") REFERENCES "wms_inventory_units"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_inventory_movements"
ADD CONSTRAINT "wms_inventory_movements_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_inventory_movements"
ADD CONSTRAINT "wms_inventory_movements_teamId_fkey"
FOREIGN KEY ("teamId") REFERENCES "teams"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_inventory_movements"
ADD CONSTRAINT "wms_inventory_movements_inventoryUnitId_fkey"
FOREIGN KEY ("inventoryUnitId") REFERENCES "wms_inventory_units"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_inventory_movements"
ADD CONSTRAINT "wms_inventory_movements_warehouseId_fkey"
FOREIGN KEY ("warehouseId") REFERENCES "wms_warehouses"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "wms_inventory_movements"
ADD CONSTRAINT "wms_inventory_movements_fromLocationId_fkey"
FOREIGN KEY ("fromLocationId") REFERENCES "wms_locations"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_inventory_movements"
ADD CONSTRAINT "wms_inventory_movements_toLocationId_fkey"
FOREIGN KEY ("toLocationId") REFERENCES "wms_locations"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_inventory_movements"
ADD CONSTRAINT "wms_inventory_movements_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
