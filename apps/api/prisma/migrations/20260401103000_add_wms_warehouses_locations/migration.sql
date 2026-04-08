-- CreateEnum
CREATE TYPE "WmsWarehouseStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WmsLocationType" AS ENUM (
  'RECEIVING',
  'STORAGE',
  'PICKING',
  'PACKING',
  'STAGING',
  'RETURNS',
  'DAMAGE',
  'QUARANTINE',
  'DISPATCH'
);

-- CreateEnum
CREATE TYPE "WmsLocationStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "wms_warehouses" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "WmsWarehouseStatus" NOT NULL DEFAULT 'ACTIVE',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "contactName" TEXT,
  "contactPhone" TEXT,
  "addressLine1" TEXT,
  "addressLine2" TEXT,
  "city" TEXT,
  "province" TEXT,
  "postalCode" TEXT,
  "country" TEXT NOT NULL DEFAULT 'Philippines',
  "notes" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "wms_warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wms_locations" (
  "id" UUID NOT NULL,
  "warehouseId" UUID NOT NULL,
  "parentId" UUID,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "type" "WmsLocationType" NOT NULL DEFAULT 'STORAGE',
  "status" "WmsLocationStatus" NOT NULL DEFAULT 'ACTIVE',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "barcode" TEXT,
  "capacityUnits" INTEGER,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "wms_locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wms_warehouses_code_key" ON "wms_warehouses"("code");

-- CreateIndex
CREATE INDEX "wms_warehouses_status_idx" ON "wms_warehouses"("status");

-- CreateIndex
CREATE INDEX "wms_warehouses_isDefault_idx" ON "wms_warehouses"("isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "wms_locations_barcode_key" ON "wms_locations"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "wms_locations_warehouseId_code_key" ON "wms_locations"("warehouseId", "code");

-- CreateIndex
CREATE INDEX "wms_locations_warehouseId_status_idx" ON "wms_locations"("warehouseId", "status");

-- CreateIndex
CREATE INDEX "wms_locations_warehouseId_parentId_sortOrder_idx" ON "wms_locations"("warehouseId", "parentId", "sortOrder");

-- CreateIndex
CREATE INDEX "wms_locations_isDefault_idx" ON "wms_locations"("isDefault");

-- AddForeignKey
ALTER TABLE "wms_locations"
ADD CONSTRAINT "wms_locations_warehouseId_fkey"
FOREIGN KEY ("warehouseId") REFERENCES "wms_warehouses"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_locations"
ADD CONSTRAINT "wms_locations_parentId_fkey"
FOREIGN KEY ("parentId") REFERENCES "wms_locations"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
