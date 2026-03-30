-- CreateEnum
CREATE TYPE "MarketingKpiScopeType" AS ENUM ('TEAM', 'CATEGORY', 'USER');

-- CreateEnum
CREATE TYPE "MarketingKpiCategory" AS ENUM ('SCALING', 'TESTING');

-- CreateEnum
CREATE TYPE "MarketingKpiMetricKey" AS ENUM (
  'TEAM_AD_SPEND',
  'TEAM_AR_PCT',
  'USER_CREATIVES_CREATED',
  'USER_AR_PCT'
);

-- CreateTable
CREATE TABLE "marketing_kpi_targets" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "scopeType" "MarketingKpiScopeType" NOT NULL,
  "teamCode" TEXT NOT NULL,
  "userId" UUID,
  "category" "MarketingKpiCategory",
  "metricKey" "MarketingKpiMetricKey" NOT NULL,
  "targetValue" DECIMAL(12,2) NOT NULL,
  "startDate" DATE NOT NULL,
  "endDate" DATE,
  "createdByUserId" UUID NOT NULL,
  "updatedByUserId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "marketing_kpi_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_kpi_user_category_assignments" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "teamCode" TEXT NOT NULL,
  "userId" UUID NOT NULL,
  "category" "MarketingKpiCategory" NOT NULL,
  "startDate" DATE NOT NULL,
  "endDate" DATE,
  "createdByUserId" UUID NOT NULL,
  "updatedByUserId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "marketing_kpi_user_category_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "marketing_kpi_targets_tenantId_scopeType_teamCode_metricKey_idx"
ON "marketing_kpi_targets"("tenantId", "scopeType", "teamCode", "metricKey", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "marketing_kpi_targets_tenantId_userId_metricKey_startDate_e_idx"
ON "marketing_kpi_targets"("tenantId", "userId", "metricKey", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "marketing_kpi_targets_tenantId_teamCode_category_metricKey__idx"
ON "marketing_kpi_targets"("tenantId", "teamCode", "category", "metricKey", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "marketing_kpi_user_category_assignments_tenantId_teamCode_u_idx"
ON "marketing_kpi_user_category_assignments"("tenantId", "teamCode", "userId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "marketing_kpi_user_category_assignments_tenantId_category_t_idx"
ON "marketing_kpi_user_category_assignments"("tenantId", "category", "teamCode", "startDate", "endDate");

-- AddForeignKey
ALTER TABLE "marketing_kpi_targets"
ADD CONSTRAINT "marketing_kpi_targets_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_kpi_user_category_assignments"
ADD CONSTRAINT "marketing_kpi_user_category_assignments_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
