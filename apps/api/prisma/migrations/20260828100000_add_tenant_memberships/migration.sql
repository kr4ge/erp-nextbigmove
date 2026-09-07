-- One identity, many tenants. Backfilled so every existing user keeps exactly
-- the access they have today: one membership in the tenant on their row.
CREATE TYPE "TenantMembershipStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

CREATE TABLE "tenant_memberships" (
  "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId"      UUID NOT NULL,
  "userId"        UUID NOT NULL,
  "status"        "TenantMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "defaultTeamId" UUID,
  "addedById"     UUID,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tenant_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_memberships_userId_tenantId_key" ON "tenant_memberships"("userId", "tenantId");
CREATE INDEX "tenant_memberships_tenantId_status_idx" ON "tenant_memberships"("tenantId", "status");

ALTER TABLE "tenant_memberships"
  ADD CONSTRAINT "tenant_memberships_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_memberships"
  ADD CONSTRAINT "tenant_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "tenant_memberships" ("tenantId", "userId", "defaultTeamId", "updatedAt")
SELECT "tenantId", "id", "defaultTeamId", CURRENT_TIMESTAMP
FROM "users"
WHERE "tenantId" IS NOT NULL
ON CONFLICT ("userId", "tenantId") DO NOTHING;
