ALTER TABLE "wms_forecast_snapshots"
ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'CYCLE',
ADD COLUMN "forecastStartDate" TEXT NOT NULL DEFAULT '',
ADD COLUMN "forecastEndDate" TEXT NOT NULL DEFAULT '';

UPDATE "wms_forecast_snapshots"
SET
  "forecastStartDate" = COALESCE("forecastDates"[1], ''),
  "forecastEndDate" = COALESCE("forecastDates"[array_length("forecastDates", 1)], '');

ALTER TABLE "wms_forecast_snapshots"
DROP CONSTRAINT IF EXISTS "wms_forecast_snapshots_scopeKey_cycleDate_version_key";

ALTER TABLE "wms_forecast_snapshots"
ADD CONSTRAINT "wms_forecast_snapshots_scopeKey_mode_cycleDate_forecastStartD_key"
UNIQUE ("scopeKey", "mode", "cycleDate", "forecastStartDate", "forecastEndDate", "version");

DROP INDEX IF EXISTS "wms_forecast_snapshots_scopeKey_cycleDate_generatedAt_idx";

CREATE INDEX "wms_forecast_snapshots_scopeKey_mode_cycleDate_generatedAt_idx"
ON "wms_forecast_snapshots" ("scopeKey", "mode", "cycleDate", "generatedAt");
