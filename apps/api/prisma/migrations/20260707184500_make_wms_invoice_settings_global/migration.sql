ALTER TABLE "media_assets"
  ALTER COLUMN "tenantId" DROP NOT NULL;

ALTER TABLE "wms_invoice_settings"
  ADD COLUMN "scopeKey" TEXT NOT NULL DEFAULT 'GLOBAL',
  ADD COLUMN "partnerBillingCompanyName" TEXT,
  ADD COLUMN "partnerBillingAddress" TEXT;

ALTER TABLE "wms_invoice_settings"
  ALTER COLUMN "tenantId" DROP NOT NULL;

CREATE UNIQUE INDEX "wms_invoice_settings_scopeKey_key"
  ON "wms_invoice_settings"("scopeKey");

CREATE INDEX "wms_invoice_settings_scopeKey_idx"
  ON "wms_invoice_settings"("scopeKey");
