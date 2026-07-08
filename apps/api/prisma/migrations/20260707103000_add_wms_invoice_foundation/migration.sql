ALTER TYPE "MediaAssetKind" ADD VALUE IF NOT EXISTS 'INVOICE_LOGO_IMAGE';

CREATE TYPE "WmsInvoiceSourceType" AS ENUM ('MANUAL', 'MANUAL_RECEIVING', 'PROCUREMENT');
CREATE TYPE "WmsInvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID_PENDING_VERIFY', 'PAID_VERIFIED', 'CANCELED');

ALTER TABLE "tenants"
ADD COLUMN "billingCompanyName" TEXT,
ADD COLUMN "billingAddress" TEXT;

CREATE TABLE "wms_invoice_settings" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "companyName" TEXT,
    "companyAddress" TEXT,
    "logoAssetId" UUID,
    "invoicePrefix" TEXT NOT NULL DEFAULT 'INV',
    "bankName" TEXT,
    "bankAccountName" TEXT,
    "bankAccountNumber" TEXT,
    "bankAccountType" TEXT,
    "bankBranch" TEXT,
    "paymentInstructions" TEXT,
    "footerNotes" TEXT,
    "createdById" UUID,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wms_invoice_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wms_invoices" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "sourceType" "WmsInvoiceSourceType" NOT NULL,
    "sourceRefId" UUID,
    "sourceRefCode" TEXT,
    "status" "WmsInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "invoiceNumber" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'PHP',
    "issuerSnapshot" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "billToSnapshot" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "totalsSnapshot" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "notes" TEXT,
    "createdById" UUID,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wms_invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wms_invoice_lines" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "storeId" UUID,
    "lineNo" INTEGER NOT NULL,
    "productId" TEXT,
    "variationId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitRate" DECIMAL(14,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "rateSource" TEXT,
    "lineSnapshot" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wms_invoice_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wms_invoice_settings_tenantId_key" ON "wms_invoice_settings"("tenantId");
CREATE UNIQUE INDEX "wms_invoice_settings_logoAssetId_key" ON "wms_invoice_settings"("logoAssetId");
CREATE INDEX "wms_invoice_settings_tenantId_idx" ON "wms_invoice_settings"("tenantId");
CREATE INDEX "wms_invoice_settings_createdById_idx" ON "wms_invoice_settings"("createdById");
CREATE INDEX "wms_invoice_settings_updatedById_idx" ON "wms_invoice_settings"("updatedById");

CREATE UNIQUE INDEX "wms_invoices_tenantId_invoiceNumber_key" ON "wms_invoices"("tenantId", "invoiceNumber");
CREATE INDEX "wms_invoices_tenantId_sourceType_status_idx" ON "wms_invoices"("tenantId", "sourceType", "status");
CREATE INDEX "wms_invoices_tenantId_sourceType_sourceRefId_idx" ON "wms_invoices"("tenantId", "sourceType", "sourceRefId");
CREATE INDEX "wms_invoices_createdById_idx" ON "wms_invoices"("createdById");
CREATE INDEX "wms_invoices_updatedById_idx" ON "wms_invoices"("updatedById");

CREATE UNIQUE INDEX "wms_invoice_lines_invoiceId_lineNo_key" ON "wms_invoice_lines"("invoiceId", "lineNo");
CREATE INDEX "wms_invoice_lines_tenantId_storeId_idx" ON "wms_invoice_lines"("tenantId", "storeId");
CREATE INDEX "wms_invoice_lines_invoiceId_idx" ON "wms_invoice_lines"("invoiceId");
CREATE INDEX "wms_invoice_lines_variationId_idx" ON "wms_invoice_lines"("variationId");

ALTER TABLE "wms_invoice_settings"
ADD CONSTRAINT "wms_invoice_settings_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_invoice_settings"
ADD CONSTRAINT "wms_invoice_settings_logoAssetId_fkey"
FOREIGN KEY ("logoAssetId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_invoice_settings"
ADD CONSTRAINT "wms_invoice_settings_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_invoice_settings"
ADD CONSTRAINT "wms_invoice_settings_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_invoices"
ADD CONSTRAINT "wms_invoices_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_invoices"
ADD CONSTRAINT "wms_invoices_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_invoices"
ADD CONSTRAINT "wms_invoices_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_invoice_lines"
ADD CONSTRAINT "wms_invoice_lines_invoiceId_fkey"
FOREIGN KEY ("invoiceId") REFERENCES "wms_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_invoice_lines"
ADD CONSTRAINT "wms_invoice_lines_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_invoice_lines"
ADD CONSTRAINT "wms_invoice_lines_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "pos_stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
