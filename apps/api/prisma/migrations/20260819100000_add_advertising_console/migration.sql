-- CreateEnum
CREATE TYPE "AdStrategyTag" AS ENUM ('OFFER', 'AD_COPY', 'TARGETING', 'FB_STRATEGY', 'CREATIVE', 'PRICING', 'OPS', 'OTHER');

-- CreateEnum
CREATE TYPE "AdLibraryFormat" AS ENUM ('VIDEO', 'IMAGE', 'CAROUSEL', 'OTHER');

-- CreateTable
CREATE TABLE "ad_benchmarks" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "teamId" UUID,
    "accountId" TEXT,
    "label" TEXT NOT NULL DEFAULT 'Industry benchmark',
    "cpp" DECIMAL(12,2) NOT NULL DEFAULT 300.00,
    "cpm" DECIMAL(12,2) NOT NULL DEFAULT 150.00,
    "ctrPct" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "deliveryRate" DOUBLE PRECISION NOT NULL DEFAULT 0.55,
    "cancelRate" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "rtsRate" DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    "targetMer" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_benchmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_strategy_entries" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "teamId" UUID,
    "date" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "tag" "AdStrategyTag" NOT NULL DEFAULT 'OTHER',
    "result" TEXT,
    "resultUpdatedAt" TIMESTAMP(3),
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_strategy_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_library_entries" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "teamId" UUID,
    "pageName" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "format" "AdLibraryFormat" NOT NULL DEFAULT 'OTHER',
    "headline" TEXT,
    "bodyCopy" TEXT,
    "ctaText" TEXT,
    "notes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_library_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_creatives" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "metaCreativeId" TEXT NOT NULL,
    "name" TEXT,
    "thumbnailUrl" TEXT,
    "imageUrl" TEXT,
    "videoId" TEXT,
    "title" TEXT,
    "body" TEXT,
    "adIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_creatives_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ad_benchmarks_tenantId_idx" ON "ad_benchmarks"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ad_benchmarks_tenantId_accountId_key" ON "ad_benchmarks"("tenantId", "accountId");

-- CreateIndex
CREATE INDEX "ad_strategy_entries_tenantId_date_idx" ON "ad_strategy_entries"("tenantId", "date");

-- CreateIndex
CREATE INDEX "ad_strategy_entries_tenantId_teamId_date_idx" ON "ad_strategy_entries"("tenantId", "teamId", "date");

-- CreateIndex
CREATE INDEX "ad_library_entries_tenantId_createdAt_idx" ON "ad_library_entries"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "ad_library_entries_tenantId_teamId_idx" ON "ad_library_entries"("tenantId", "teamId");

-- CreateIndex
CREATE INDEX "ad_creatives_tenantId_idx" ON "ad_creatives"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ad_creatives_tenantId_metaCreativeId_key" ON "ad_creatives"("tenantId", "metaCreativeId");

-- AddForeignKey
ALTER TABLE "ad_benchmarks" ADD CONSTRAINT "ad_benchmarks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_benchmarks" ADD CONSTRAINT "ad_benchmarks_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_strategy_entries" ADD CONSTRAINT "ad_strategy_entries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_strategy_entries" ADD CONSTRAINT "ad_strategy_entries_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_strategy_entries" ADD CONSTRAINT "ad_strategy_entries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_library_entries" ADD CONSTRAINT "ad_library_entries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_library_entries" ADD CONSTRAINT "ad_library_entries_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_library_entries" ADD CONSTRAINT "ad_library_entries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_creatives" ADD CONSTRAINT "ad_creatives_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

