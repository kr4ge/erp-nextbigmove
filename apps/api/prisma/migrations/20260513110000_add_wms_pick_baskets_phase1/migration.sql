CREATE TYPE "WmsBasketStatus" AS ENUM (
  'EMPTY',
  'ASSIGNED',
  'IN_PICKING',
  'FULL_HELD'
);

ALTER TABLE "users"
ADD COLUMN "wmsBasketCapacity" INTEGER NOT NULL DEFAULT 4;

CREATE TABLE "wms_baskets" (
  "id" UUID NOT NULL,
  "tenantId" UUID,
  "warehouseId" UUID,
  "barcode" TEXT NOT NULL,
  "status" "WmsBasketStatus" NOT NULL DEFAULT 'EMPTY',
  "assignedPickerId" UUID,
  "fulfillmentOrderId" UUID,
  "claimedAt" TIMESTAMP(3),
  "fullAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "wms_baskets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wms_baskets_barcode_key"
ON "wms_baskets"("barcode");

CREATE UNIQUE INDEX "wms_baskets_fulfillmentOrderId_key"
ON "wms_baskets"("fulfillmentOrderId");

CREATE INDEX "wms_baskets_tenantId_status_idx"
ON "wms_baskets"("tenantId", "status");

CREATE INDEX "wms_baskets_warehouseId_status_idx"
ON "wms_baskets"("warehouseId", "status");

CREATE INDEX "wms_baskets_assignedPickerId_status_idx"
ON "wms_baskets"("assignedPickerId", "status");

ALTER TABLE "wms_baskets"
ADD CONSTRAINT "wms_baskets_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_baskets"
ADD CONSTRAINT "wms_baskets_warehouseId_fkey"
FOREIGN KEY ("warehouseId") REFERENCES "wms_warehouses"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_baskets"
ADD CONSTRAINT "wms_baskets_assignedPickerId_fkey"
FOREIGN KEY ("assignedPickerId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_baskets"
ADD CONSTRAINT "wms_baskets_fulfillmentOrderId_fkey"
FOREIGN KEY ("fulfillmentOrderId") REFERENCES "wms_fulfillment_orders"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
