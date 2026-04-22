CREATE TYPE "WmsProductProfileStatus" AS ENUM ('DEFAULT', 'READY', 'ARCHIVED');

CREATE TABLE "wms_product_profiles" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "posProductId" UUID NOT NULL,
  "productId" TEXT NOT NULL,
  "variationId" TEXT NOT NULL,
  "posWarehouseRef" TEXT,
  "status" "WmsProductProfileStatus" NOT NULL DEFAULT 'DEFAULT',
  "isSerialized" BOOLEAN NOT NULL DEFAULT true,
  "preferredLocationId" UUID,
  "pickLocationId" UUID,
  "isFragile" BOOLEAN NOT NULL DEFAULT false,
  "isStackable" BOOLEAN NOT NULL DEFAULT true,
  "keepDry" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "wms_product_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wms_product_profiles_posProductId_key"
ON "wms_product_profiles"("posProductId");

CREATE UNIQUE INDEX "wms_product_profiles_storeId_variationId_key"
ON "wms_product_profiles"("storeId", "variationId");

CREATE INDEX "wms_product_profiles_tenantId_storeId_idx"
ON "wms_product_profiles"("tenantId", "storeId");

CREATE INDEX "wms_product_profiles_tenantId_status_idx"
ON "wms_product_profiles"("tenantId", "status");

CREATE INDEX "wms_product_profiles_storeId_posWarehouseRef_idx"
ON "wms_product_profiles"("storeId", "posWarehouseRef");

ALTER TABLE "wms_product_profiles"
ADD CONSTRAINT "wms_product_profiles_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_product_profiles"
ADD CONSTRAINT "wms_product_profiles_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "pos_stores"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_product_profiles"
ADD CONSTRAINT "wms_product_profiles_posProductId_fkey"
FOREIGN KEY ("posProductId") REFERENCES "pos_products"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
