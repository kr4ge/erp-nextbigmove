CREATE TYPE "WmsInventoryUnitStatus" AS ENUM (
  'RECEIVED',
  'STAGED',
  'PUTAWAY',
  'RESERVED',
  'PICKED',
  'PACKED',
  'DISPATCHED',
  'RTS',
  'DAMAGED',
  'ARCHIVED'
);

CREATE TYPE "WmsInventoryUnitSourceType" AS ENUM (
  'RECEIVING',
  'MANUAL_INPUT',
  'RTS',
  'ADJUSTMENT',
  'MIGRATION'
);

CREATE TABLE "wms_inventory_units" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "teamId" UUID,
  "storeId" UUID NOT NULL,
  "posProductId" UUID NOT NULL,
  "productProfileId" UUID NOT NULL,
  "warehouseId" UUID NOT NULL,
  "currentLocationId" UUID,
  "productId" TEXT NOT NULL,
  "variationId" TEXT NOT NULL,
  "posWarehouseRef" TEXT,
  "code" TEXT NOT NULL,
  "barcode" TEXT NOT NULL,
  "status" "WmsInventoryUnitStatus" NOT NULL DEFAULT 'STAGED',
  "sourceType" "WmsInventoryUnitSourceType",
  "sourceRefId" TEXT,
  "sourceRefLabel" TEXT,
  "notes" TEXT,
  "createdById" UUID,
  "updatedById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "wms_inventory_units_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wms_inventory_units_code_key"
ON "wms_inventory_units"("code");

CREATE UNIQUE INDEX "wms_inventory_units_barcode_key"
ON "wms_inventory_units"("barcode");

CREATE INDEX "wms_inventory_units_tenantId_storeId_idx"
ON "wms_inventory_units"("tenantId", "storeId");

CREATE INDEX "wms_inventory_units_tenantId_status_idx"
ON "wms_inventory_units"("tenantId", "status");

CREATE INDEX "wms_inventory_units_storeId_variationId_idx"
ON "wms_inventory_units"("storeId", "variationId");

CREATE INDEX "wms_inventory_units_warehouseId_currentLocationId_idx"
ON "wms_inventory_units"("warehouseId", "currentLocationId");

CREATE INDEX "wms_inventory_units_productProfileId_idx"
ON "wms_inventory_units"("productProfileId");

CREATE INDEX "wms_inventory_units_sourceType_sourceRefId_idx"
ON "wms_inventory_units"("sourceType", "sourceRefId");

ALTER TABLE "wms_inventory_units"
ADD CONSTRAINT "wms_inventory_units_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_inventory_units"
ADD CONSTRAINT "wms_inventory_units_teamId_fkey"
FOREIGN KEY ("teamId") REFERENCES "teams"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_inventory_units"
ADD CONSTRAINT "wms_inventory_units_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "pos_stores"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_inventory_units"
ADD CONSTRAINT "wms_inventory_units_posProductId_fkey"
FOREIGN KEY ("posProductId") REFERENCES "pos_products"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "wms_inventory_units"
ADD CONSTRAINT "wms_inventory_units_productProfileId_fkey"
FOREIGN KEY ("productProfileId") REFERENCES "wms_product_profiles"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "wms_inventory_units"
ADD CONSTRAINT "wms_inventory_units_warehouseId_fkey"
FOREIGN KEY ("warehouseId") REFERENCES "wms_warehouses"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "wms_inventory_units"
ADD CONSTRAINT "wms_inventory_units_currentLocationId_fkey"
FOREIGN KEY ("currentLocationId") REFERENCES "wms_locations"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_inventory_units"
ADD CONSTRAINT "wms_inventory_units_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_inventory_units"
ADD CONSTRAINT "wms_inventory_units_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
