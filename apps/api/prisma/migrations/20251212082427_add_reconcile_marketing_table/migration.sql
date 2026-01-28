-- CreateTable
CREATE TABLE "reconcile_marketing" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "adId" TEXT NOT NULL,
    "normalizedAdId" TEXT,
    "accountId" TEXT,
    "campaignId" TEXT,
    "campaignName" TEXT,
    "adsetId" TEXT,
    "adName" TEXT,
    "marketingAssociate" TEXT,
    "spend" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "linkClicks" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "leads" INTEGER NOT NULL DEFAULT 0,
    "purchasesPos" INTEGER NOT NULL DEFAULT 0,
    "codPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "matchedOrders" JSONB NOT NULL DEFAULT '[]',
    "shops" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reconcile_marketing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reconcile_marketing_tenantId_date_idx" ON "reconcile_marketing"("tenantId", "date");

-- CreateIndex
CREATE INDEX "reconcile_marketing_tenantId_adId_date_idx" ON "reconcile_marketing"("tenantId", "adId", "date");

-- CreateIndex
CREATE INDEX "reconcile_marketing_tenantId_campaignId_date_idx" ON "reconcile_marketing"("tenantId", "campaignId", "date");

-- AddForeignKey
ALTER TABLE "reconcile_marketing" ADD CONSTRAINT "reconcile_marketing_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
