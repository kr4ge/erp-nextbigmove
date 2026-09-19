-- Scene thumbnails from creative AI analyses, stored as media assets so the
-- storyboard and the knowledge base outlive the run workspace.

ALTER TYPE "MediaAssetKind" ADD VALUE 'CREATIVE_AI_FRAME_IMAGE';

CREATE TABLE "creative_ai_run_frames" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "sceneIndex" INTEGER NOT NULL,
    "timestampSeconds" DECIMAL(10,3),
    "endSeconds" DECIMAL(10,3),
    "assetId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creative_ai_run_frames_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "creative_ai_run_frames_runId_sceneIndex_key" ON "creative_ai_run_frames"("runId", "sceneIndex");
CREATE INDEX "creative_ai_run_frames_tenantId_runId_idx" ON "creative_ai_run_frames"("tenantId", "runId");

ALTER TABLE "creative_ai_run_frames" ADD CONSTRAINT "creative_ai_run_frames_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "creative_ai_run_frames" ADD CONSTRAINT "creative_ai_run_frames_runId_fkey" FOREIGN KEY ("runId") REFERENCES "creative_ai_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "creative_ai_run_frames" ADD CONSTRAINT "creative_ai_run_frames_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
