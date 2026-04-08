-- CreateTable
CREATE TABLE "wms_sku_profiles" (
  "id" UUID NOT NULL,
  "posProductId" UUID NOT NULL,
  "code" TEXT,
  "category" TEXT,
  "unit" TEXT,
  "packSize" TEXT,
  "barcode" TEXT,
  "description" TEXT,
  "status" "WmsSkuStatus" NOT NULL DEFAULT 'ACTIVE',
  "isLotTracked" BOOLEAN NOT NULL DEFAULT false,
  "isExpiryTracked" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "wms_sku_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wms_sku_profiles_posProductId_key" ON "wms_sku_profiles"("posProductId");

-- CreateIndex
CREATE UNIQUE INDEX "wms_sku_profiles_code_key" ON "wms_sku_profiles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "wms_sku_profiles_barcode_key" ON "wms_sku_profiles"("barcode");

-- CreateIndex
CREATE INDEX "wms_sku_profiles_status_idx" ON "wms_sku_profiles"("status");

-- CreateIndex
CREATE INDEX "wms_sku_profiles_category_idx" ON "wms_sku_profiles"("category");

-- AddForeignKey
ALTER TABLE "wms_sku_profiles"
ADD CONSTRAINT "wms_sku_profiles_posProductId_fkey"
FOREIGN KEY ("posProductId") REFERENCES "pos_products"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- DropTable
DROP TABLE "wms_sku_pos_product_mappings";

-- DropTable
DROP TABLE "wms_skus";
