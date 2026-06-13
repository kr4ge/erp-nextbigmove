CREATE TYPE "WmsFulfillmentAssignmentMode" AS ENUM ('SERIAL_RESERVED', 'BASKET_DEMAND');
CREATE TYPE "WmsBasketUnitStatus" AS ENUM ('PICKED', 'PACKED', 'REMOVED');

ALTER TABLE "wms_fulfillment_orders"
ADD COLUMN "assignmentMode" "WmsFulfillmentAssignmentMode" NOT NULL DEFAULT 'SERIAL_RESERVED';

CREATE TABLE "wms_basket_pick_demands" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "basketId" UUID NOT NULL,
  "fulfillmentOrderId" UUID NOT NULL,
  "fulfillmentLineId" UUID NOT NULL,
  "productId" TEXT,
  "variationId" TEXT NOT NULL,
  "productName" TEXT NOT NULL,
  "productDisplayId" TEXT,
  "quantityRequired" INTEGER NOT NULL,
  "quantityPicked" INTEGER NOT NULL DEFAULT 0,
  "quantityPacked" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "wms_basket_pick_demands_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wms_basket_pick_demand_bins" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "basketId" UUID NOT NULL,
  "demandId" UUID NOT NULL,
  "warehouseId" UUID NOT NULL,
  "locationId" UUID NOT NULL,
  "variationId" TEXT NOT NULL,
  "quantityTarget" INTEGER NOT NULL,
  "quantityPicked" INTEGER NOT NULL DEFAULT 0,
  "routeSequence" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "wms_basket_pick_demand_bins_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wms_basket_units" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "basketId" UUID NOT NULL,
  "inventoryUnitId" UUID NOT NULL,
  "warehouseId" UUID NOT NULL,
  "sourceLocationId" UUID,
  "productId" TEXT NOT NULL,
  "variationId" TEXT NOT NULL,
  "status" "WmsBasketUnitStatus" NOT NULL DEFAULT 'PICKED',
  "fulfillmentOrderId" UUID,
  "fulfillmentLineId" UUID,
  "pickedById" UUID,
  "packedById" UUID,
  "removedById" UUID,
  "pickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "packedAt" TIMESTAMP(3),
  "removedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "wms_basket_units_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wms_basket_pick_demands_basketId_fulfillmentLineId_key"
ON "wms_basket_pick_demands"("basketId", "fulfillmentLineId");

CREATE INDEX "wms_basket_pick_demands_tenantId_variationId_idx"
ON "wms_basket_pick_demands"("tenantId", "variationId");

CREATE INDEX "wms_basket_pick_demands_storeId_variationId_idx"
ON "wms_basket_pick_demands"("storeId", "variationId");

CREATE INDEX "wms_basket_pick_demands_fulfillmentOrderId_idx"
ON "wms_basket_pick_demands"("fulfillmentOrderId");

CREATE INDEX "wms_basket_pick_demands_fulfillmentLineId_idx"
ON "wms_basket_pick_demands"("fulfillmentLineId");

CREATE UNIQUE INDEX "wms_basket_pick_demand_bins_demandId_locationId_key"
ON "wms_basket_pick_demand_bins"("demandId", "locationId");

CREATE INDEX "wms_basket_pick_demand_bins_basketId_routeSequence_idx"
ON "wms_basket_pick_demand_bins"("basketId", "routeSequence");

CREATE INDEX "wms_basket_pick_demand_bins_locationId_idx"
ON "wms_basket_pick_demand_bins"("locationId");

CREATE INDEX "wms_basket_pick_demand_bins_warehouseId_idx"
ON "wms_basket_pick_demand_bins"("warehouseId");

CREATE INDEX "wms_basket_pick_demand_bins_tenantId_variationId_idx"
ON "wms_basket_pick_demand_bins"("tenantId", "variationId");

CREATE INDEX "wms_basket_units_basketId_status_idx"
ON "wms_basket_units"("basketId", "status");

CREATE INDEX "wms_basket_units_inventoryUnitId_status_idx"
ON "wms_basket_units"("inventoryUnitId", "status");

CREATE INDEX "wms_basket_units_tenantId_variationId_status_idx"
ON "wms_basket_units"("tenantId", "variationId", "status");

CREATE INDEX "wms_basket_units_fulfillmentOrderId_status_idx"
ON "wms_basket_units"("fulfillmentOrderId", "status");

CREATE INDEX "wms_basket_units_fulfillmentLineId_status_idx"
ON "wms_basket_units"("fulfillmentLineId", "status");

CREATE INDEX "wms_basket_units_sourceLocationId_idx"
ON "wms_basket_units"("sourceLocationId");

CREATE UNIQUE INDEX "wms_basket_units_active_inventoryUnitId_key"
ON "wms_basket_units"("inventoryUnitId")
WHERE "status" IN ('PICKED', 'PACKED');

CREATE INDEX "wms_fulfillment_orders_tenantId_assignmentMode_status_idx"
ON "wms_fulfillment_orders"("tenantId", "assignmentMode", "status");

ALTER TABLE "wms_basket_pick_demands"
ADD CONSTRAINT "wms_basket_pick_demands_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_basket_pick_demands"
ADD CONSTRAINT "wms_basket_pick_demands_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "pos_stores"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_basket_pick_demands"
ADD CONSTRAINT "wms_basket_pick_demands_basketId_fkey"
FOREIGN KEY ("basketId") REFERENCES "wms_baskets"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_basket_pick_demands"
ADD CONSTRAINT "wms_basket_pick_demands_fulfillmentOrderId_fkey"
FOREIGN KEY ("fulfillmentOrderId") REFERENCES "wms_fulfillment_orders"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_basket_pick_demands"
ADD CONSTRAINT "wms_basket_pick_demands_fulfillmentLineId_fkey"
FOREIGN KEY ("fulfillmentLineId") REFERENCES "wms_fulfillment_lines"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_basket_pick_demand_bins"
ADD CONSTRAINT "wms_basket_pick_demand_bins_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_basket_pick_demand_bins"
ADD CONSTRAINT "wms_basket_pick_demand_bins_basketId_fkey"
FOREIGN KEY ("basketId") REFERENCES "wms_baskets"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_basket_pick_demand_bins"
ADD CONSTRAINT "wms_basket_pick_demand_bins_demandId_fkey"
FOREIGN KEY ("demandId") REFERENCES "wms_basket_pick_demands"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_basket_pick_demand_bins"
ADD CONSTRAINT "wms_basket_pick_demand_bins_warehouseId_fkey"
FOREIGN KEY ("warehouseId") REFERENCES "wms_warehouses"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "wms_basket_pick_demand_bins"
ADD CONSTRAINT "wms_basket_pick_demand_bins_locationId_fkey"
FOREIGN KEY ("locationId") REFERENCES "wms_locations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "wms_basket_units"
ADD CONSTRAINT "wms_basket_units_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_basket_units"
ADD CONSTRAINT "wms_basket_units_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "pos_stores"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_basket_units"
ADD CONSTRAINT "wms_basket_units_basketId_fkey"
FOREIGN KEY ("basketId") REFERENCES "wms_baskets"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_basket_units"
ADD CONSTRAINT "wms_basket_units_inventoryUnitId_fkey"
FOREIGN KEY ("inventoryUnitId") REFERENCES "wms_inventory_units"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "wms_basket_units"
ADD CONSTRAINT "wms_basket_units_warehouseId_fkey"
FOREIGN KEY ("warehouseId") REFERENCES "wms_warehouses"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "wms_basket_units"
ADD CONSTRAINT "wms_basket_units_sourceLocationId_fkey"
FOREIGN KEY ("sourceLocationId") REFERENCES "wms_locations"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_basket_units"
ADD CONSTRAINT "wms_basket_units_fulfillmentOrderId_fkey"
FOREIGN KEY ("fulfillmentOrderId") REFERENCES "wms_fulfillment_orders"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_basket_units"
ADD CONSTRAINT "wms_basket_units_fulfillmentLineId_fkey"
FOREIGN KEY ("fulfillmentLineId") REFERENCES "wms_fulfillment_lines"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_basket_units"
ADD CONSTRAINT "wms_basket_units_pickedById_fkey"
FOREIGN KEY ("pickedById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_basket_units"
ADD CONSTRAINT "wms_basket_units_packedById_fkey"
FOREIGN KEY ("packedById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_basket_units"
ADD CONSTRAINT "wms_basket_units_removedById_fkey"
FOREIGN KEY ("removedById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
