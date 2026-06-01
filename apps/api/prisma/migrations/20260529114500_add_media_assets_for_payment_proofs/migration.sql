-- CreateEnum
CREATE TYPE "MediaAssetKind" AS ENUM ('PAYMENT_PROOF_IMAGE');

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "kind" "MediaAssetKind" NOT NULL,
    "storageProvider" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "checksumSha256" VARCHAR(64),
    "originalFileName" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "wms_purchasing_batches"
ADD COLUMN "paymentProofAssetId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_bucket_objectKey_key" ON "media_assets"("bucket", "objectKey");

-- CreateIndex
CREATE INDEX "media_assets_tenantId_kind_idx" ON "media_assets"("tenantId", "kind");

-- CreateIndex
CREATE INDEX "media_assets_createdById_idx" ON "media_assets"("createdById");

-- CreateIndex
CREATE INDEX "wms_purchasing_batches_paymentProofAssetId_idx" ON "wms_purchasing_batches"("paymentProofAssetId");

-- AddForeignKey
ALTER TABLE "media_assets"
ADD CONSTRAINT "media_assets_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets"
ADD CONSTRAINT "media_assets_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_purchasing_batches"
ADD CONSTRAINT "wms_purchasing_batches_paymentProofAssetId_fkey"
FOREIGN KEY ("paymentProofAssetId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
