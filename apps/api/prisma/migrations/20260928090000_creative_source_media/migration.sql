-- The creative's source file, held in object storage from its first analysis
-- until the draft worker hands it to Meta. Before this the analyzer deleted the
-- file as soon as frames were extracted, which left nothing to upload later.

ALTER TYPE "MediaAssetKind" ADD VALUE 'CREATIVE_SOURCE_MEDIA';

ALTER TABLE "creatives"
    ADD COLUMN "sourceAssetId" UUID,
    ADD COLUMN "mediaCapturedAt" TIMESTAMP(3),
    ADD COLUMN "mediaReleasedAt" TIMESTAMP(3),
    ADD COLUMN "mediaExpiresAt" TIMESTAMP(3);

CREATE INDEX "creatives_tenantId_mediaExpiresAt_idx" ON "creatives"("tenantId", "mediaExpiresAt");

ALTER TABLE "creatives" ADD CONSTRAINT "creatives_sourceAssetId_fkey" FOREIGN KEY ("sourceAssetId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
