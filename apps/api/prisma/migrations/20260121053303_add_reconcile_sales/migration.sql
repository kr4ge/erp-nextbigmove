-- CreateTable
CREATE TABLE "reconcile_sales" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "teamId" UUID,
    "date" DATE NOT NULL,
    "campaignId" TEXT,
    "campaignName" TEXT,
    "mapping" TEXT,
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
    "waitingPickupCount" INTEGER NOT NULL DEFAULT 0,
    "shippedCount" INTEGER NOT NULL DEFAULT 0,
    "deliveredCount" INTEGER NOT NULL DEFAULT 0,
    "canceledCount" INTEGER NOT NULL DEFAULT 0,
    "rtsCount" INTEGER NOT NULL DEFAULT 0,
    "restockingCount" INTEGER NOT NULL DEFAULT 0,
    "codPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deliveredCodPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "shippedCodPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "waitingPickupCodPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "rtsCodPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "canceledCodPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "restockingCodPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cogsPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cogsCanceledPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cogsRestockingPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sfPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "ffPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "ifPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sfSdrPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "ffSdrPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "ifSdrPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "codFeePos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "codFeeDeliveredPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reconcile_sales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reconcile_sales_tenantId_teamId_date_idx" ON "reconcile_sales"("tenantId", "teamId", "date");

-- CreateIndex
CREATE INDEX "reconcile_sales_tenantId_campaignId_date_idx" ON "reconcile_sales"("tenantId", "campaignId", "date");

-- CreateIndex
CREATE INDEX "reconcile_sales_tenantId_date_mapping_idx" ON "reconcile_sales"("tenantId", "date", "mapping");

-- CreateIndex
CREATE UNIQUE INDEX "reconcile_sales_tenantId_date_campaignId_key" ON "reconcile_sales"("tenantId", "date", "campaignId");

-- AddForeignKey
ALTER TABLE "reconcile_sales" ADD CONSTRAINT "reconcile_sales_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconcile_sales" ADD CONSTRAINT "reconcile_sales_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
