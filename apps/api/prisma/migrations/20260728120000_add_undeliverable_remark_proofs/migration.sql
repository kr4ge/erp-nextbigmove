ALTER TYPE "MediaAssetKind"
ADD VALUE IF NOT EXISTS 'UNDELIVERABLE_REMARK_PROOF_IMAGE';

CREATE TABLE "undeliverable_attempt_proofs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "attemptId" UUID NOT NULL,
  "mediaAssetId" UUID NOT NULL,
  "uploadedById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "undeliverable_attempt_proofs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "undeliverable_attempt_proofs_mediaAssetId_key"
  ON "undeliverable_attempt_proofs"("mediaAssetId");

CREATE INDEX "undeliverable_attempt_proofs_tenantId_attemptId_createdAt_idx"
  ON "undeliverable_attempt_proofs"("tenantId", "attemptId", "createdAt");

CREATE INDEX "undeliverable_attempt_proofs_uploadedById_idx"
  ON "undeliverable_attempt_proofs"("uploadedById");

ALTER TABLE "undeliverable_attempt_proofs"
  ADD CONSTRAINT "undeliverable_attempt_proofs_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "undeliverable_attempt_proofs"
  ADD CONSTRAINT "undeliverable_attempt_proofs_attemptId_fkey"
  FOREIGN KEY ("attemptId") REFERENCES "undeliverable_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "undeliverable_attempt_proofs"
  ADD CONSTRAINT "undeliverable_attempt_proofs_mediaAssetId_fkey"
  FOREIGN KEY ("mediaAssetId") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "undeliverable_attempt_proofs"
  ADD CONSTRAINT "undeliverable_attempt_proofs_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
