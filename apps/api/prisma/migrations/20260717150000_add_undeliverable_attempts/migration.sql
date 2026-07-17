CREATE TABLE "undeliverable_attempts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "storeId" UUID,
  "sourceEventKey" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "failedAt" TIMESTAMP(3) NOT NULL,
  "partnerStatusOld" TEXT,
  "partnerStatusNew" TEXT NOT NULL DEFAULT 'undeliverable',
  "returnedReason" JSONB,
  "subStatus" JSONB,
  "sourceTags" JSONB,
  "remark" TEXT,
  "remarkOptionId" UUID,
  "remarkedById" UUID,
  "remarkedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "undeliverable_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "undeliverable_attempts_orderId_sourceEventKey_key"
  ON "undeliverable_attempts"("orderId", "sourceEventKey");

CREATE INDEX "undeliverable_attempts_tenantId_storeId_failedAt_idx"
  ON "undeliverable_attempts"("tenantId", "storeId", "failedAt");

CREATE INDEX "undeliverable_attempts_tenantId_remarkedAt_failedAt_idx"
  ON "undeliverable_attempts"("tenantId", "remarkedAt", "failedAt");

CREATE INDEX "undeliverable_attempts_tenantId_orderId_failedAt_idx"
  ON "undeliverable_attempts"("tenantId", "orderId", "failedAt");

ALTER TABLE "undeliverable_attempts"
  ADD CONSTRAINT "undeliverable_attempts_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "undeliverable_attempts"
  ADD CONSTRAINT "undeliverable_attempts_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "pos_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "undeliverable_attempts"
  ADD CONSTRAINT "undeliverable_attempts_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "pos_stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
