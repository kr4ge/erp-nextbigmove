-- Target KPIs per store, read by the running-creative analysis as prompt
-- variables so the store's definition of a winner is written down once.

CREATE TABLE "creative_store_targets" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "storeConfigId" UUID NOT NULL,
    "hookRatePct" DECIMAL(6,2),
    "holdRatePct" DECIMAL(6,2),
    "ctrPct" DECIMAL(6,2),
    "cpp" DECIMAL(12,2),
    "arPct" DECIMAL(6,2),
    "maxCancellationPct" DECIMAL(6,2),
    "maxRtsPct" DECIMAL(6,2),
    "note" TEXT,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creative_store_targets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "creative_store_targets_storeConfigId_key" ON "creative_store_targets"("storeConfigId");
CREATE INDEX "creative_store_targets_tenantId_idx" ON "creative_store_targets"("tenantId");

ALTER TABLE "creative_store_targets" ADD CONSTRAINT "creative_store_targets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "creative_store_targets" ADD CONSTRAINT "creative_store_targets_storeConfigId_fkey" FOREIGN KEY ("storeConfigId") REFERENCES "creative_store_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "creative_store_targets" ADD CONSTRAINT "creative_store_targets_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
