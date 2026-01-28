-- CreateEnum
CREATE TYPE "WorkflowExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkflowTriggerType" AS ENUM ('MANUAL', 'SCHEDULED');

-- CreateTable
CREATE TABLE "workflows" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "schedule" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_executions" (
    "id" UUID NOT NULL,
    "workflowId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "status" "WorkflowExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "triggerType" "WorkflowTriggerType" NOT NULL,
    "dateRangeSince" TEXT,
    "dateRangeUntil" TEXT,
    "totalDays" INTEGER NOT NULL DEFAULT 0,
    "daysProcessed" INTEGER NOT NULL DEFAULT 0,
    "metaFetched" INTEGER NOT NULL DEFAULT 0,
    "posFetched" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB NOT NULL DEFAULT '[]',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_ad_insights" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "accountId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "campaignName" TEXT NOT NULL,
    "adsetId" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "adName" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "dateCreated" TEXT,
    "marketingAssociate" TEXT,
    "spend" DECIMAL(12,2) NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "linkClicks" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "leads" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_ad_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_orders" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "shopId" TEXT NOT NULL,
    "posOrderId" TEXT NOT NULL,
    "insertedAt" TIMESTAMP(3) NOT NULL,
    "dateLocal" TEXT NOT NULL,
    "status" INTEGER,
    "statusName" TEXT,
    "cod" DECIMAL(12,2),
    "total" DECIMAL(12,2),
    "currency" TEXT,
    "warehouseName" TEXT,
    "accountName" TEXT,
    "pUtmCampaign" TEXT,
    "pUtmContent" TEXT,
    "cogs" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalQuantity" INTEGER NOT NULL DEFAULT 0,
    "productName" TEXT,
    "productDisplayId" TEXT,
    "tracking" TEXT,
    "mapping" TEXT,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workflows_tenantId_enabled_idx" ON "workflows"("tenantId", "enabled");

-- CreateIndex
CREATE INDEX "workflow_executions_workflowId_status_idx" ON "workflow_executions"("workflowId", "status");

-- CreateIndex
CREATE INDEX "workflow_executions_tenantId_createdAt_idx" ON "workflow_executions"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "meta_ad_insights_tenantId_accountId_date_idx" ON "meta_ad_insights"("tenantId", "accountId", "date");

-- CreateIndex
CREATE INDEX "meta_ad_insights_date_idx" ON "meta_ad_insights"("date");

-- CreateIndex
CREATE UNIQUE INDEX "meta_ad_insights_accountId_adId_date_key" ON "meta_ad_insights"("accountId", "adId", "date");

-- CreateIndex
CREATE INDEX "pos_orders_tenantId_shopId_dateLocal_idx" ON "pos_orders"("tenantId", "shopId", "dateLocal");

-- CreateIndex
CREATE INDEX "pos_orders_dateLocal_idx" ON "pos_orders"("dateLocal");

-- CreateIndex
CREATE INDEX "pos_orders_mapping_idx" ON "pos_orders"("mapping");

-- CreateIndex
CREATE UNIQUE INDEX "pos_orders_shopId_posOrderId_key" ON "pos_orders"("shopId", "posOrderId");

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_ad_insights" ADD CONSTRAINT "meta_ad_insights_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_orders" ADD CONSTRAINT "pos_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
