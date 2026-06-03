-- CreateTable
CREATE TABLE "reconcile_sales_attribution" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "campaignId" TEXT,
    "campaignName" TEXT,
    "campaignKey" TEXT NOT NULL,
    "mapping" TEXT,
    "mappingKey" TEXT NOT NULL,
    "teamCode" TEXT,
    "teamCodeKey" TEXT NOT NULL,
    "isUnmatched" BOOLEAN NOT NULL DEFAULT false,
    "spend" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "linkClicks" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "leads" INTEGER NOT NULL DEFAULT 0,
    "purchasesPos" INTEGER NOT NULL DEFAULT 0,
    "processedPurchasesPos" INTEGER NOT NULL DEFAULT 0,
    "confirmedCount" INTEGER NOT NULL DEFAULT 0,
    "unconfirmedCount" INTEGER NOT NULL DEFAULT 0,
    "printedCount" INTEGER NOT NULL DEFAULT 0,
    "waitingPickupCount" INTEGER NOT NULL DEFAULT 0,
    "shippedCount" INTEGER NOT NULL DEFAULT 0,
    "deliveredCount" INTEGER NOT NULL DEFAULT 0,
    "canceledCount" INTEGER NOT NULL DEFAULT 0,
    "deletedCount" INTEGER NOT NULL DEFAULT 0,
    "rtsCount" INTEGER NOT NULL DEFAULT 0,
    "restockingCount" INTEGER NOT NULL DEFAULT 0,
    "abandonedCount" INTEGER NOT NULL DEFAULT 0,
    "codPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deliveredCodPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "shippedCodPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "waitingPickupCodPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "rtsCodPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "canceledCodPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "restockingCodPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "confirmedCodPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "unconfirmedCodPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "abandonedCodPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cogsPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cogsCanceledPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cogsRestockingPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cogsRtsPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cogsDeliveredPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sfPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "ffPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "ifPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sfSdrPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "ffSdrPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "ifSdrPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "codFeePos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "codFeeDeliveredPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reconcile_sales_attribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reconcile_sales_attribution_tenantId_date_campaignKey_mapp_key" ON "reconcile_sales_attribution"("tenantId", "date", "campaignKey", "mappingKey", "teamCodeKey");

-- CreateIndex
CREATE INDEX "reconcile_sales_attribution_tenantId_date_teamCodeKey_idx" ON "reconcile_sales_attribution"("tenantId", "date", "teamCodeKey");

-- CreateIndex
CREATE INDEX "reconcile_sales_attribution_tenantId_date_mappingKey_idx" ON "reconcile_sales_attribution"("tenantId", "date", "mappingKey");

-- CreateIndex
CREATE INDEX "reconcile_sales_attribution_tenantId_date_campaignKey_idx" ON "reconcile_sales_attribution"("tenantId", "date", "campaignKey");

-- CreateIndex
CREATE INDEX "reconcile_sales_attribution_tenantId_date_teamCodeKey_mapping_idx" ON "reconcile_sales_attribution"("tenantId", "date", "teamCodeKey", "mappingKey");

-- AddForeignKey
ALTER TABLE "reconcile_sales_attribution" ADD CONSTRAINT "reconcile_sales_attribution_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
