-- CreateEnum
CREATE TYPE "AnalyticsShareScope" AS ENUM ('SALES', 'MARKETING', 'BOTH');

-- CreateTable
CREATE TABLE "analytics_shares" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "ownerTeamId" UUID NOT NULL,
    "targetTeamId" UUID NOT NULL,
    "scope" "AnalyticsShareScope" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "analytics_shares_tenantId_targetTeamId_idx" ON "analytics_shares"("tenantId", "targetTeamId");

-- CreateIndex
CREATE INDEX "analytics_shares_tenantId_ownerTeamId_idx" ON "analytics_shares"("tenantId", "ownerTeamId");

-- CreateIndex
CREATE INDEX "analytics_shares_tenantId_scope_idx" ON "analytics_shares"("tenantId", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_shares_tenantId_ownerTeamId_targetTeamId_scope_key" ON "analytics_shares"("tenantId", "ownerTeamId", "targetTeamId", "scope");

-- AddForeignKey
ALTER TABLE "analytics_shares" ADD CONSTRAINT "analytics_shares_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_shares" ADD CONSTRAINT "analytics_shares_ownerTeamId_fkey" FOREIGN KEY ("ownerTeamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_shares" ADD CONSTRAINT "analytics_shares_targetTeamId_fkey" FOREIGN KEY ("targetTeamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
