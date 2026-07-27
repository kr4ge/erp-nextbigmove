CREATE TABLE "wms_invoice_payment_profiles" (
    "id" UUID NOT NULL,
    "invoiceSettingsId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "bankName" TEXT,
    "bankAccountName" TEXT,
    "bankAccountNumber" TEXT,
    "bankAccountType" TEXT,
    "bankBranch" TEXT,
    "paymentInstructions" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wms_invoice_payment_profiles_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "wms_invoices"
ADD COLUMN "paymentProfileSnapshot" JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX "wms_invoice_payment_profiles_invoiceSettingsId_name_key"
ON "wms_invoice_payment_profiles"("invoiceSettingsId", "name");

CREATE INDEX "wms_invoice_payment_profiles_invoiceSettingsId_isDefault_sortOrder_idx"
ON "wms_invoice_payment_profiles"("invoiceSettingsId", "isDefault", "sortOrder");

ALTER TABLE "wms_invoice_payment_profiles"
ADD CONSTRAINT "wms_invoice_payment_profiles_invoiceSettingsId_fkey"
FOREIGN KEY ("invoiceSettingsId") REFERENCES "wms_invoice_settings"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
