-- Reference documents the creative analysis consults: brand rules, claim
-- sheets, playbooks. Text extracted at upload, scoped to tenant, store or
-- product, cited by title in the analysis.

CREATE TYPE "CreativeAiDocumentScope" AS ENUM ('TENANT', 'STORE', 'PRODUCT');
CREATE TYPE "CreativeAiDocumentStatus" AS ENUM ('READY', 'FAILED', 'UNSUPPORTED');

CREATE TABLE "creative_ai_reference_documents" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "scope" "CreativeAiDocumentScope" NOT NULL DEFAULT 'TENANT',
    "storeConfigId" UUID,
    "productName" TEXT,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "objectKey" TEXT,
    "text" TEXT NOT NULL,
    "characterCount" INTEGER NOT NULL,
    "tokenEstimate" INTEGER NOT NULL,
    "status" "CreativeAiDocumentStatus" NOT NULL DEFAULT 'READY',
    "statusNote" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "uploadedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creative_ai_reference_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "creative_ai_reference_documents_tenantId_active_scope_idx" ON "creative_ai_reference_documents"("tenantId", "active", "scope");
CREATE INDEX "creative_ai_reference_documents_tenantId_storeConfigId_idx" ON "creative_ai_reference_documents"("tenantId", "storeConfigId");

ALTER TABLE "creative_ai_reference_documents" ADD CONSTRAINT "creative_ai_reference_documents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "creative_ai_reference_documents" ADD CONSTRAINT "creative_ai_reference_documents_storeConfigId_fkey" FOREIGN KEY ("storeConfigId") REFERENCES "creative_store_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "creative_ai_reference_documents" ADD CONSTRAINT "creative_ai_reference_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
