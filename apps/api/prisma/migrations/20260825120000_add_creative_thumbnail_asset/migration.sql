-- Cache Facebook post cover images as media assets so registry/asset tiles
-- have a stable thumbnail. Facebook's CDN URLs expire within days, so the
-- bytes are copied into object storage rather than hot-linked.
ALTER TYPE "MediaAssetKind" ADD VALUE IF NOT EXISTS 'CREATIVE_THUMBNAIL_IMAGE';

ALTER TABLE "creatives"
  ADD COLUMN IF NOT EXISTS "thumbnailAssetId" UUID,
  ADD COLUMN IF NOT EXISTS "thumbnailSourceUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "thumbnailCapturedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "thumbnailIsVideo" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "creatives"
  ADD CONSTRAINT "creatives_thumbnailAssetId_fkey"
  FOREIGN KEY ("thumbnailAssetId") REFERENCES "media_assets"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "creatives_thumbnailAssetId_idx" ON "creatives"("thumbnailAssetId");
