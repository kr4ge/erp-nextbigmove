-- Meta draft automation: where a store publishes, and the paused campaigns the
-- ERP creates there. One campaign holds one ad set and one to three ads, per
-- management's launch SOP. Every Meta id is stored as soon as it exists so a
-- retried job resumes instead of duplicating.

CREATE TYPE "CreativeMetaDraftStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

CREATE TABLE "creative_store_publishing_profiles" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "storeConfigId" UUID NOT NULL,
    "metaAdAccountId" TEXT,
    "facebookPageId" TEXT,
    "facebookPageName" TEXT,
    "instagramAccountId" TEXT,
    "instagramUsername" TEXT,
    "defaultDailyBudget" DECIMAL(12,2),
    "countries" TEXT[] DEFAULT ARRAY['PH']::TEXT[],
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Manila',
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creative_store_publishing_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "creative_store_publishing_profiles_storeConfigId_key" ON "creative_store_publishing_profiles"("storeConfigId");
CREATE INDEX "creative_store_publishing_profiles_tenantId_idx" ON "creative_store_publishing_profiles"("tenantId");

ALTER TABLE "creative_store_publishing_profiles" ADD CONSTRAINT "creative_store_publishing_profiles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "creative_store_publishing_profiles" ADD CONSTRAINT "creative_store_publishing_profiles_storeConfigId_fkey" FOREIGN KEY ("storeConfigId") REFERENCES "creative_store_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "creative_store_publishing_profiles" ADD CONSTRAINT "creative_store_publishing_profiles_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "creative_store_product_destinations" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "posCustomId" TEXT NOT NULL,
    "posProductName" TEXT,
    "pixelId" TEXT NOT NULL,
    "landingPageUrl" TEXT NOT NULL,
    "displayLink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creative_store_product_destinations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "creative_store_product_destinations_profileId_posCustomId_key" ON "creative_store_product_destinations"("profileId", "posCustomId");
CREATE INDEX "creative_store_product_destinations_tenantId_idx" ON "creative_store_product_destinations"("tenantId");

ALTER TABLE "creative_store_product_destinations" ADD CONSTRAINT "creative_store_product_destinations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "creative_store_product_destinations" ADD CONSTRAINT "creative_store_product_destinations_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "creative_store_publishing_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "creative_meta_draft_batches" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "storeConfigId" UUID NOT NULL,
    "status" "CreativeMetaDraftStatus" NOT NULL DEFAULT 'QUEUED',
    "metaAdAccountId" TEXT NOT NULL,
    "currency" TEXT,
    "campaignName" TEXT NOT NULL,
    "adSetName" TEXT NOT NULL,
    "dailyBudget" DECIMAL(12,2) NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "pixelId" TEXT NOT NULL,
    "landingPageUrl" TEXT NOT NULL,
    "displayLink" TEXT,
    "facebookPageId" TEXT NOT NULL,
    "instagramAccountId" TEXT,
    "countries" TEXT[] DEFAULT ARRAY['PH']::TEXT[],
    "settingsSnapshot" JSONB,
    "metaCampaignId" TEXT,
    "metaAdSetId" TEXT,
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "queueJobId" TEXT,
    "requestedById" UUID,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creative_meta_draft_batches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "creative_meta_draft_batches_tenantId_storeConfigId_createdAt_idx" ON "creative_meta_draft_batches"("tenantId", "storeConfigId", "createdAt");
CREATE INDEX "creative_meta_draft_batches_tenantId_status_idx" ON "creative_meta_draft_batches"("tenantId", "status");

ALTER TABLE "creative_meta_draft_batches" ADD CONSTRAINT "creative_meta_draft_batches_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "creative_meta_draft_batches" ADD CONSTRAINT "creative_meta_draft_batches_storeConfigId_fkey" FOREIGN KEY ("storeConfigId") REFERENCES "creative_store_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "creative_meta_draft_batches" ADD CONSTRAINT "creative_meta_draft_batches_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "creative_meta_drafts" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "creativeId" UUID NOT NULL,
    "status" "CreativeMetaDraftStatus" NOT NULL DEFAULT 'QUEUED',
    "adName" TEXT NOT NULL,
    "primaryText" TEXT,
    "headline" TEXT,
    "metaVideoId" TEXT,
    "metaImageHash" TEXT,
    "metaThumbnailHash" TEXT,
    "metaCreativeId" TEXT,
    "metaAdId" TEXT,
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "mediaUploadedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creative_meta_drafts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "creative_meta_drafts_batchId_creativeId_key" ON "creative_meta_drafts"("batchId", "creativeId");
CREATE INDEX "creative_meta_drafts_tenantId_creativeId_createdAt_idx" ON "creative_meta_drafts"("tenantId", "creativeId", "createdAt");

ALTER TABLE "creative_meta_drafts" ADD CONSTRAINT "creative_meta_drafts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "creative_meta_drafts" ADD CONSTRAINT "creative_meta_drafts_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "creative_meta_draft_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "creative_meta_drafts" ADD CONSTRAINT "creative_meta_drafts_creativeId_fkey" FOREIGN KEY ("creativeId") REFERENCES "creatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;
