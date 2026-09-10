-- Additive provider policy and immutable run settings. No existing rows are
-- deleted or rewritten; existing runs receive the previous Claude defaults.
CREATE TYPE "CreativeAiProvider" AS ENUM ('CLAUDE', 'CODEX');
CREATE TYPE "CreativeAiEffort" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'XHIGH', 'MAX');

ALTER TABLE "creative_ai_runs"
  ADD COLUMN "provider" "CreativeAiProvider" NOT NULL DEFAULT 'CLAUDE',
  ADD COLUMN "model" TEXT NOT NULL DEFAULT 'sonnet',
  ADD COLUMN "effort" "CreativeAiEffort" NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN "settingsSnapshot" JSONB;

CREATE TABLE "creative_ai_policies" (
  "tenantId" UUID NOT NULL,
  "defaultProvider" "CreativeAiProvider" NOT NULL DEFAULT 'CLAUDE',
  "claudeModel" TEXT NOT NULL DEFAULT 'sonnet',
  "codexModel" TEXT NOT NULL DEFAULT 'gpt-5.6-terra',
  "defaultEffort" "CreativeAiEffort" NOT NULL DEFAULT 'MEDIUM',
  "maxTurns" INTEGER NOT NULL DEFAULT 12,
  "maxBudgetUsd" DECIMAL(10,2) NOT NULL DEFAULT 1,
  "allowRunOverrides" BOOLEAN NOT NULL DEFAULT true,
  "updatedById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "creative_ai_policies_pkey" PRIMARY KEY ("tenantId")
);

ALTER TABLE "creative_ai_policies"
  ADD CONSTRAINT "creative_ai_policies_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "creative_ai_policies"
  ADD CONSTRAINT "creative_ai_policies_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
