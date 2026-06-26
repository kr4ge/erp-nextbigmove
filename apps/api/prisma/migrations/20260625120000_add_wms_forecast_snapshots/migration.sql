CREATE TABLE "wms_forecast_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID,
    "scopeKey" TEXT NOT NULL,
    "storeIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "selectedStores" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "cycleDate" TEXT NOT NULL,
    "cycleWeekday" TEXT NOT NULL,
    "forecastDates" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "salesWindowStartDate" TEXT NOT NULL,
    "salesWindowEndDate" TEXT NOT NULL,
    "daysForecasted" INTEGER NOT NULL,
    "safetyStockPct" DOUBLE PRECISION NOT NULL,
    "reorderTriggerDays" DOUBLE PRECISION NOT NULL,
    "version" INTEGER NOT NULL,
    "totalActualStock" INTEGER NOT NULL DEFAULT 0,
    "totalPendingOrders" INTEGER NOT NULL DEFAULT 0,
    "totalRemainingStocks" INTEGER NOT NULL DEFAULT 0,
    "totalPast3DaySales" INTEGER NOT NULL DEFAULT 0,
    "totalAvgDailySales" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalForecastDemand" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalSafetyStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalSuggestedOrder" INTEGER NOT NULL DEFAULT 0,
    "totalReturning" INTEGER NOT NULL DEFAULT 0,
    "generatedById" UUID,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wms_forecast_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wms_forecast_snapshot_rows" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "snapshotId" UUID NOT NULL,
    "tenantId" UUID,
    "storeId" UUID,
    "storeName" TEXT NOT NULL,
    "tenantName" TEXT,
    "shopId" TEXT,
    "rowId" TEXT NOT NULL,
    "variationId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "productDisplayId" TEXT,
    "actualStock" INTEGER NOT NULL DEFAULT 0,
    "pendingOrders" INTEGER NOT NULL DEFAULT 0,
    "remainingStocks" INTEGER NOT NULL DEFAULT 0,
    "past3DaySales" INTEGER NOT NULL DEFAULT 0,
    "avgDailySales" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "forecastedDemand" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "safetyStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "suggestedOrderQty" INTEGER NOT NULL DEFAULT 0,
    "daysOfStockLeft" DOUBLE PRECISION,
    "statusKey" TEXT NOT NULL,
    "statusLabel" TEXT NOT NULL,
    "returning" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wms_forecast_snapshot_rows_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wms_forecast_snapshots_scopeKey_cycleDate_version_key"
ON "wms_forecast_snapshots"("scopeKey", "cycleDate", "version");

CREATE INDEX "wms_forecast_snapshots_tenantId_cycleDate_generatedAt_idx"
ON "wms_forecast_snapshots"("tenantId", "cycleDate", "generatedAt");

CREATE INDEX "wms_forecast_snapshots_scopeKey_cycleDate_generatedAt_idx"
ON "wms_forecast_snapshots"("scopeKey", "cycleDate", "generatedAt");

CREATE INDEX "wms_forecast_snapshot_rows_snapshotId_idx"
ON "wms_forecast_snapshot_rows"("snapshotId");

CREATE INDEX "wms_forecast_snapshot_rows_tenantId_storeId_variationId_idx"
ON "wms_forecast_snapshot_rows"("tenantId", "storeId", "variationId");

ALTER TABLE "wms_forecast_snapshots"
ADD CONSTRAINT "wms_forecast_snapshots_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_forecast_snapshots"
ADD CONSTRAINT "wms_forecast_snapshots_generatedById_fkey"
FOREIGN KEY ("generatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_forecast_snapshot_rows"
ADD CONSTRAINT "wms_forecast_snapshot_rows_snapshotId_fkey"
FOREIGN KEY ("snapshotId") REFERENCES "wms_forecast_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_forecast_snapshot_rows"
ADD CONSTRAINT "wms_forecast_snapshot_rows_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_forecast_snapshot_rows"
ADD CONSTRAINT "wms_forecast_snapshot_rows_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "pos_stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
