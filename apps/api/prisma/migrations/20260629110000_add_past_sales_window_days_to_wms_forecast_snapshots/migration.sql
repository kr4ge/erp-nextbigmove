ALTER TABLE "wms_forecast_snapshots"
ADD COLUMN "pastSalesWindowDays" INTEGER NOT NULL DEFAULT 3;
