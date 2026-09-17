-- CreateEnum
CREATE TYPE "CreativeKnowledgeLabel" AS ENUM ('WINNER', 'LOSER', 'INCONCLUSIVE');

-- CreateEnum
CREATE TYPE "CreativeKnowledgeLabelSource" AS ENUM ('AUTOMATIC', 'MANUAL');

-- CreateEnum
CREATE TYPE "CreativeKnowledgeAttribution" AS ENUM ('SOLE', 'SHARED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CreativeEnrollmentReviewStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "CreativeEnrollmentDecision" AS ENUM ('APPROVE', 'REVISE', 'REJECT');

-- CreateEnum
CREATE TYPE "CreativeEnrollmentReviewOutcome" AS ENUM ('PENDING', 'ACCEPTED', 'OVERRIDDEN');

-- CreateTable
CREATE TABLE "creative_knowledge_entries" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "storeConfigId" UUID NOT NULL,
    "creativeId" UUID NOT NULL,
    "runId" UUID,
    "label" "CreativeKnowledgeLabel" NOT NULL,
    "labelSource" "CreativeKnowledgeLabelSource" NOT NULL DEFAULT 'AUTOMATIC',
    "attribution" "CreativeKnowledgeAttribution" NOT NULL DEFAULT 'UNKNOWN',
    "labelRationale" TEXT,
    "nicheSnapshot" TEXT NOT NULL,
    "structure" JSONB NOT NULL,
    "metrics" JSONB,
    "digest" TEXT,
    "promotedById" UUID,
    "promotedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creative_knowledge_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creative_enrollment_reviews" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "storeConfigId" UUID NOT NULL,
    "creativeId" UUID NOT NULL,
    "runId" UUID,
    "status" "CreativeEnrollmentReviewStatus" NOT NULL DEFAULT 'QUEUED',
    "decision" "CreativeEnrollmentDecision",
    "confidence" INTEGER,
    "rationale" JSONB,
    "requiredChanges" JSONB,
    "shadow" BOOLEAN NOT NULL DEFAULT true,
    "entryIds" UUID[] DEFAULT ARRAY[]::UUID[],
    "corpusSize" INTEGER NOT NULL DEFAULT 0,
    "outcome" "CreativeEnrollmentReviewOutcome" NOT NULL DEFAULT 'PENDING',
    "decidedById" UUID,
    "decidedAt" TIMESTAMP(3),
    "decisionNotes" TEXT,
    "knowledgeEntryId" UUID,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creative_enrollment_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "creative_knowledge_entries_tenantId_storeConfigId_active_la_idx" ON "creative_knowledge_entries"("tenantId", "storeConfigId", "active", "label");

-- CreateIndex
CREATE INDEX "creative_knowledge_entries_tenantId_storeConfigId_promotedA_idx" ON "creative_knowledge_entries"("tenantId", "storeConfigId", "promotedAt");

-- CreateIndex
CREATE UNIQUE INDEX "creative_knowledge_entries_tenantId_creativeId_key" ON "creative_knowledge_entries"("tenantId", "creativeId");

-- CreateIndex
CREATE INDEX "creative_enrollment_reviews_tenantId_storeConfigId_createdA_idx" ON "creative_enrollment_reviews"("tenantId", "storeConfigId", "createdAt");

-- CreateIndex
CREATE INDEX "creative_enrollment_reviews_tenantId_creativeId_createdAt_idx" ON "creative_enrollment_reviews"("tenantId", "creativeId", "createdAt");

-- CreateIndex
CREATE INDEX "creative_enrollment_reviews_tenantId_status_createdAt_idx" ON "creative_enrollment_reviews"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "creative_enrollment_reviews_tenantId_outcome_createdAt_idx" ON "creative_enrollment_reviews"("tenantId", "outcome", "createdAt");

-- AddForeignKey
ALTER TABLE "creative_knowledge_entries" ADD CONSTRAINT "creative_knowledge_entries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_knowledge_entries" ADD CONSTRAINT "creative_knowledge_entries_storeConfigId_fkey" FOREIGN KEY ("storeConfigId") REFERENCES "creative_store_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_knowledge_entries" ADD CONSTRAINT "creative_knowledge_entries_creativeId_fkey" FOREIGN KEY ("creativeId") REFERENCES "creatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_knowledge_entries" ADD CONSTRAINT "creative_knowledge_entries_runId_fkey" FOREIGN KEY ("runId") REFERENCES "creative_ai_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_knowledge_entries" ADD CONSTRAINT "creative_knowledge_entries_promotedById_fkey" FOREIGN KEY ("promotedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_enrollment_reviews" ADD CONSTRAINT "creative_enrollment_reviews_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_enrollment_reviews" ADD CONSTRAINT "creative_enrollment_reviews_storeConfigId_fkey" FOREIGN KEY ("storeConfigId") REFERENCES "creative_store_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_enrollment_reviews" ADD CONSTRAINT "creative_enrollment_reviews_creativeId_fkey" FOREIGN KEY ("creativeId") REFERENCES "creatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_enrollment_reviews" ADD CONSTRAINT "creative_enrollment_reviews_runId_fkey" FOREIGN KEY ("runId") REFERENCES "creative_ai_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_enrollment_reviews" ADD CONSTRAINT "creative_enrollment_reviews_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_enrollment_reviews" ADD CONSTRAINT "creative_enrollment_reviews_knowledgeEntryId_fkey" FOREIGN KEY ("knowledgeEntryId") REFERENCES "creative_knowledge_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "wms_outbound_unit_records_fulfillmentOrderId_inventoryUnitId_ke" RENAME TO "wms_outbound_unit_records_fulfillmentOrderId_inventoryUnitI_key";

-- RenameIndex
ALTER INDEX "wms_outbound_unit_records_tenantId_currentStatus_latestEventAt_" RENAME TO "wms_outbound_unit_records_tenantId_currentStatus_latestEven_idx";

-- RenameIndex
ALTER INDEX "wms_outbound_unit_records_tenantId_productProfileId_currentStat" RENAME TO "wms_outbound_unit_records_tenantId_productProfileId_current_idx";

-- RenameIndex
ALTER INDEX "wms_outbound_unit_records_tenantId_storeId_currentStatus_latest" RENAME TO "wms_outbound_unit_records_tenantId_storeId_currentStatus_la_idx";

