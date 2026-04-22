CREATE TYPE "WmsWarehouseStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

CREATE TYPE "WmsLocationKind" AS ENUM (
  'SECTION',
  'RACK',
  'BIN',
  'RECEIVING_STAGING',
  'PACKING',
  'DISPATCH_STAGING',
  'RTS',
  'DAMAGE',
  'QUARANTINE'
);

CREATE TABLE "wms_warehouses" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "address" TEXT,
  "status" "WmsWarehouseStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "wms_warehouses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wms_locations" (
  "id" UUID NOT NULL,
  "warehouseId" UUID NOT NULL,
  "parentId" UUID,
  "kind" "WmsLocationKind" NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "barcode" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "capacity" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "wms_locations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wms_warehouses_code_key"
ON "wms_warehouses"("code");

CREATE INDEX "wms_warehouses_status_idx"
ON "wms_warehouses"("status");

CREATE UNIQUE INDEX "wms_locations_barcode_key"
ON "wms_locations"("barcode");

CREATE UNIQUE INDEX "wms_locations_warehouseId_code_key"
ON "wms_locations"("warehouseId", "code");

CREATE INDEX "wms_locations_warehouseId_kind_idx"
ON "wms_locations"("warehouseId", "kind");

CREATE INDEX "wms_locations_parentId_idx"
ON "wms_locations"("parentId");

ALTER TABLE "wms_locations"
ADD CONSTRAINT "wms_locations_warehouseId_fkey"
FOREIGN KEY ("warehouseId") REFERENCES "wms_warehouses"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_locations"
ADD CONSTRAINT "wms_locations_parentId_fkey"
FOREIGN KEY ("parentId") REFERENCES "wms_locations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
