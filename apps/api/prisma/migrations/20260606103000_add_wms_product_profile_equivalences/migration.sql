CREATE TABLE "wms_product_profile_equivalences" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "sourceStoreId" UUID NOT NULL,
  "targetStoreId" UUID NOT NULL,
  "sourceProfileId" UUID NOT NULL,
  "targetProfileId" UUID NOT NULL,
  "sourceVariationId" TEXT NOT NULL,
  "targetVariationId" TEXT NOT NULL,
  "matchSource" TEXT NOT NULL DEFAULT 'TRANSFER',
  "transferCount" INTEGER NOT NULL DEFAULT 0,
  "lastTransferAt" TIMESTAMP(3),
  "createdById" UUID,
  "updatedById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "wms_product_profile_equivalences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wms_product_profile_equivalences_tenantId_sourceProfileId_targetStoreId_key"
  ON "wms_product_profile_equivalences"("tenantId", "sourceProfileId", "targetStoreId");

CREATE INDEX "wms_product_profile_equivalences_tenantId_targetStoreId_idx"
  ON "wms_product_profile_equivalences"("tenantId", "targetStoreId");

CREATE INDEX "wms_product_profile_equivalences_sourceProfileId_targetProfileId_idx"
  ON "wms_product_profile_equivalences"("sourceProfileId", "targetProfileId");
