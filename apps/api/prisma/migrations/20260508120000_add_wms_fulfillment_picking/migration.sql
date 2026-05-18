ALTER TYPE "WmsInventoryMovementType" ADD VALUE 'RESERVATION';
ALTER TYPE "WmsInventoryMovementType" ADD VALUE 'PICK';

CREATE TYPE "WmsFulfillmentOrderStatus" AS ENUM (
  'READY',
  'PARTIAL',
  'RESTOCKING',
  'ISSUE',
  'IN_PICKING',
  'PICKED',
  'CANCELED'
);

CREATE TYPE "WmsFulfillmentLineStatus" AS ENUM (
  'READY',
  'PARTIAL',
  'RESTOCKING',
  'ISSUE',
  'PICKED',
  'CANCELED'
);

CREATE TYPE "WmsPickReservationStatus" AS ENUM (
  'RESERVED',
  'PICKED',
  'RELEASED',
  'CANCELED'
);

CREATE TABLE "wms_fulfillment_orders" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "teamId" UUID,
  "storeId" UUID NOT NULL,
  "posOrderDbId" UUID NOT NULL,
  "shopId" TEXT NOT NULL,
  "posOrderId" TEXT NOT NULL,
  "posWarehouseRef" TEXT,
  "warehouseId" UUID,
  "customerName" TEXT,
  "customerPhone" TEXT,
  "status" "WmsFulfillmentOrderStatus" NOT NULL DEFAULT 'RESTOCKING',
  "issueReason" TEXT,
  "totalQuantity" INTEGER NOT NULL DEFAULT 0,
  "allocatedQuantity" INTEGER NOT NULL DEFAULT 0,
  "pickedQuantity" INTEGER NOT NULL DEFAULT 0,
  "claimedById" UUID,
  "claimedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "wms_fulfillment_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wms_fulfillment_lines" (
  "id" UUID NOT NULL,
  "fulfillmentOrderId" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "productId" TEXT,
  "variationId" TEXT NOT NULL,
  "productName" TEXT NOT NULL,
  "productDisplayId" TEXT,
  "quantityRequired" INTEGER NOT NULL,
  "quantityAllocated" INTEGER NOT NULL DEFAULT 0,
  "quantityPicked" INTEGER NOT NULL DEFAULT 0,
  "status" "WmsFulfillmentLineStatus" NOT NULL DEFAULT 'RESTOCKING',
  "issueReason" TEXT,
  "lineSnapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "wms_fulfillment_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wms_pick_reservations" (
  "id" UUID NOT NULL,
  "fulfillmentOrderId" UUID NOT NULL,
  "fulfillmentLineId" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "inventoryUnitId" UUID NOT NULL,
  "status" "WmsPickReservationStatus" NOT NULL DEFAULT 'RESERVED',
  "sequence" INTEGER NOT NULL DEFAULT 0,
  "reservedById" UUID,
  "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "pickedById" UUID,
  "pickedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "wms_pick_reservations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wms_fulfillment_orders_tenantId_shopId_posOrderId_key"
ON "wms_fulfillment_orders"("tenantId", "shopId", "posOrderId");

CREATE UNIQUE INDEX "wms_fulfillment_orders_posOrderDbId_key"
ON "wms_fulfillment_orders"("posOrderDbId");

CREATE INDEX "wms_fulfillment_orders_tenantId_status_createdAt_idx"
ON "wms_fulfillment_orders"("tenantId", "status", "createdAt");

CREATE INDEX "wms_fulfillment_orders_storeId_status_idx"
ON "wms_fulfillment_orders"("storeId", "status");

CREATE INDEX "wms_fulfillment_orders_claimedById_status_idx"
ON "wms_fulfillment_orders"("claimedById", "status");

CREATE INDEX "wms_fulfillment_orders_posWarehouseRef_idx"
ON "wms_fulfillment_orders"("posWarehouseRef");

CREATE UNIQUE INDEX "wms_fulfillment_lines_fulfillmentOrderId_variationId_key"
ON "wms_fulfillment_lines"("fulfillmentOrderId", "variationId");

CREATE INDEX "wms_fulfillment_lines_tenantId_variationId_status_idx"
ON "wms_fulfillment_lines"("tenantId", "variationId", "status");

CREATE INDEX "wms_fulfillment_lines_fulfillmentOrderId_status_idx"
ON "wms_fulfillment_lines"("fulfillmentOrderId", "status");

CREATE UNIQUE INDEX "wms_pick_reservations_fulfillmentLineId_inventoryUnitId_key"
ON "wms_pick_reservations"("fulfillmentLineId", "inventoryUnitId");

CREATE INDEX "wms_pick_reservations_tenantId_status_idx"
ON "wms_pick_reservations"("tenantId", "status");

CREATE INDEX "wms_pick_reservations_inventoryUnitId_status_idx"
ON "wms_pick_reservations"("inventoryUnitId", "status");

CREATE INDEX "wms_pick_reservations_fulfillmentOrderId_status_idx"
ON "wms_pick_reservations"("fulfillmentOrderId", "status");

CREATE INDEX "wms_pick_reservations_fulfillmentLineId_status_idx"
ON "wms_pick_reservations"("fulfillmentLineId", "status");

ALTER TABLE "wms_fulfillment_orders"
ADD CONSTRAINT "wms_fulfillment_orders_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_fulfillment_orders"
ADD CONSTRAINT "wms_fulfillment_orders_teamId_fkey"
FOREIGN KEY ("teamId") REFERENCES "teams"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_fulfillment_orders"
ADD CONSTRAINT "wms_fulfillment_orders_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "pos_stores"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_fulfillment_orders"
ADD CONSTRAINT "wms_fulfillment_orders_posOrderDbId_fkey"
FOREIGN KEY ("posOrderDbId") REFERENCES "pos_orders"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_fulfillment_orders"
ADD CONSTRAINT "wms_fulfillment_orders_warehouseId_fkey"
FOREIGN KEY ("warehouseId") REFERENCES "wms_warehouses"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_fulfillment_orders"
ADD CONSTRAINT "wms_fulfillment_orders_claimedById_fkey"
FOREIGN KEY ("claimedById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_fulfillment_lines"
ADD CONSTRAINT "wms_fulfillment_lines_fulfillmentOrderId_fkey"
FOREIGN KEY ("fulfillmentOrderId") REFERENCES "wms_fulfillment_orders"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_fulfillment_lines"
ADD CONSTRAINT "wms_fulfillment_lines_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_pick_reservations"
ADD CONSTRAINT "wms_pick_reservations_fulfillmentOrderId_fkey"
FOREIGN KEY ("fulfillmentOrderId") REFERENCES "wms_fulfillment_orders"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_pick_reservations"
ADD CONSTRAINT "wms_pick_reservations_fulfillmentLineId_fkey"
FOREIGN KEY ("fulfillmentLineId") REFERENCES "wms_fulfillment_lines"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_pick_reservations"
ADD CONSTRAINT "wms_pick_reservations_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_pick_reservations"
ADD CONSTRAINT "wms_pick_reservations_inventoryUnitId_fkey"
FOREIGN KEY ("inventoryUnitId") REFERENCES "wms_inventory_units"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_pick_reservations"
ADD CONSTRAINT "wms_pick_reservations_reservedById_fkey"
FOREIGN KEY ("reservedById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_pick_reservations"
ADD CONSTRAINT "wms_pick_reservations_pickedById_fkey"
FOREIGN KEY ("pickedById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
