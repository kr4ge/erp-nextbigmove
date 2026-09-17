-- Editable, versioned analysis prompts.
--
-- Replaces the structured analysis settings (market, currency, gate scores,
-- per-product thresholds, per-store fulfilment model) with two prompt
-- templates the advertiser edits directly. Every edit is a new version and
-- each run records the version that judged it.

-- CreateEnum
CREATE TYPE "CreativeAiPromptKind" AS ENUM ('RUNNING_ANALYST', 'NEW_REVIEWER');

-- CreateTable
CREATE TABLE "creative_ai_prompt_templates" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "kind" "CreativeAiPromptKind" NOT NULL,
    "version" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creative_ai_prompt_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "creative_ai_prompt_templates_tenantId_kind_isActive_idx" ON "creative_ai_prompt_templates"("tenantId", "kind", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "creative_ai_prompt_templates_tenantId_kind_version_key" ON "creative_ai_prompt_templates"("tenantId", "kind", "version");

-- AddForeignKey
ALTER TABLE "creative_ai_prompt_templates" ADD CONSTRAINT "creative_ai_prompt_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_ai_prompt_templates" ADD CONSTRAINT "creative_ai_prompt_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Each run records the prompt version that judged it.
ALTER TABLE "creative_ai_runs" ADD COLUMN "promptTemplateId" UUID;
ALTER TABLE "creative_ai_runs" ADD CONSTRAINT "creative_ai_runs_promptTemplateId_fkey" FOREIGN KEY ("promptTemplateId") REFERENCES "creative_ai_prompt_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Structured settings the prompt text now carries instead.
ALTER TABLE "creative_ai_policies"
  DROP COLUMN "analysisMarket",
  DROP COLUMN "analysisCurrency",
  DROP COLUMN "analysisLanguage",
  DROP COLUMN "gateApproveScore",
  DROP COLUMN "gateReviseScore",
  DROP COLUMN "gateMinRecords",
  DROP COLUMN "minCreativesForPattern";

ALTER TABLE "creative_store_configs" DROP COLUMN "fulfilmentModel";

DROP TABLE "creative_product_thresholds";

DROP TYPE "CreativeFulfilmentModel";
