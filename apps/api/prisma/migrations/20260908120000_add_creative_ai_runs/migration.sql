-- CreateEnum
CREATE TYPE "CreativeAiRunStatus" AS ENUM (
  'QUEUED',
  'PREPROCESSING',
  'CONTEXT_BUILDING',
  'ANALYZING',
  'COMPLETED',
  'FAILED',
  'CANCELLED'
);

-- CreateEnum
CREATE TYPE "CreativeAiSourceType" AS ENUM ('LOCAL_UPLOAD', 'GOOGLE_DRIVE');

-- CreateTable
CREATE TABLE "creative_ai_runs" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "creativeId" UUID NOT NULL,
  "requestedById" UUID NOT NULL,
  "status" "CreativeAiRunStatus" NOT NULL DEFAULT 'QUEUED',
  "sourceType" "CreativeAiSourceType" NOT NULL DEFAULT 'LOCAL_UPLOAD',
  "sourceFileName" TEXT,
  "sourceContentType" TEXT,
  "sourceByteSize" INTEGER,
  "sourcePath" TEXT,
  "question" TEXT,
  "dateStart" DATE NOT NULL,
  "dateEnd" DATE NOT NULL,
  "progress" INTEGER NOT NULL DEFAULT 0,
  "stage" TEXT NOT NULL DEFAULT 'Queued',
  "queueJobId" TEXT,
  "mediaHash" VARCHAR(64),
  "mediaManifest" JSONB,
  "metricsSnapshot" JSONB,
  "analysisResult" JSONB,
  "responseText" TEXT,
  "claudeSessionId" TEXT,
  "warnings" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "creative_ai_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "creative_ai_runs_tenantId_requestedById_createdAt_idx"
ON "creative_ai_runs"("tenantId", "requestedById", "createdAt");

-- CreateIndex
CREATE INDEX "creative_ai_runs_tenantId_creativeId_createdAt_idx"
ON "creative_ai_runs"("tenantId", "creativeId", "createdAt");

-- CreateIndex
CREATE INDEX "creative_ai_runs_tenantId_status_createdAt_idx"
ON "creative_ai_runs"("tenantId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "creative_ai_runs"
ADD CONSTRAINT "creative_ai_runs_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_ai_runs"
ADD CONSTRAINT "creative_ai_runs_creativeId_fkey"
FOREIGN KEY ("creativeId") REFERENCES "creatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_ai_runs"
ADD CONSTRAINT "creative_ai_runs_requestedById_fkey"
FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
