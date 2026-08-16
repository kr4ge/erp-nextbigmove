CREATE TYPE "WmsPackingProofSource" AS ENUM ('CAMERA', 'FILE', 'CLIPBOARD');

ALTER TYPE "MediaAssetKind" ADD VALUE 'WMS_PACKING_PROOF_IMAGE';

CREATE TABLE "wms_packing_proofs" (
    "id" UUID NOT NULL,
    "fulfillmentOrderId" UUID NOT NULL,
    "mediaAssetId" UUID NOT NULL,
    "uploadedById" UUID NOT NULL,
    "source" "WmsPackingProofSource" NOT NULL DEFAULT 'FILE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "wms_packing_proofs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wms_packing_proofs_mediaAssetId_key" ON "wms_packing_proofs"("mediaAssetId");
CREATE INDEX "wms_packing_proofs_fulfillmentOrderId_createdAt_idx" ON "wms_packing_proofs"("fulfillmentOrderId", "createdAt");
CREATE INDEX "wms_packing_proofs_uploadedById_idx" ON "wms_packing_proofs"("uploadedById");

ALTER TABLE "wms_packing_proofs" ADD CONSTRAINT "wms_packing_proofs_fulfillmentOrderId_fkey" FOREIGN KEY ("fulfillmentOrderId") REFERENCES "wms_fulfillment_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wms_packing_proofs" ADD CONSTRAINT "wms_packing_proofs_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "wms_packing_proofs" ADD CONSTRAINT "wms_packing_proofs_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
