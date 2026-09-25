-- The tenant's fallback creative targets, inherited by any store that has not
-- set its own. One row per tenant; a store's own row always wins.

CREATE TABLE "creative_ai_target_defaults" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "breakevenCpp" DECIMAL(12,2),
    "cpp" DECIMAL(12,2),
    "scaleCpp" DECIMAL(12,2),
    "killCpp" DECIMAL(12,2),
    "arPct" DECIMAL(6,2),
    "scaleArPct" DECIMAL(6,2),
    "killArPct" DECIMAL(6,2),
    "maxCancellationPct" DECIMAL(6,2),
    "maxRtsPct" DECIMAL(6,2),
    "hookRatePct" DECIMAL(6,2),
    "holdRatePct" DECIMAL(6,2),
    "ctrPct" DECIMAL(6,2),
    "note" TEXT,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creative_ai_target_defaults_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "creative_ai_target_defaults_tenantId_key" ON "creative_ai_target_defaults"("tenantId");

ALTER TABLE "creative_ai_target_defaults" ADD CONSTRAINT "creative_ai_target_defaults_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "creative_ai_target_defaults" ADD CONSTRAINT "creative_ai_target_defaults_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed every existing tenant with the numbers management agreed on 2026-09-25.
-- Scale and kill lines stay null: the ERP derives them at 75% and 130% of the
-- target and says so, which keeps one source of truth for the ratios.
INSERT INTO "creative_ai_target_defaults" ("id", "tenantId", "breakevenCpp", "cpp", "arPct", "maxCancellationPct", "maxRtsPct", "hookRatePct", "note", "createdAt", "updatedAt")
SELECT gen_random_uuid(), t."id", 400, 300, 33, 10, 20, 40,
       'Seeded from the launch SOP defaults, 2026-09-25. A store that sets its own targets overrides these.',
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "tenants" t
ON CONFLICT ("tenantId") DO NOTHING;
