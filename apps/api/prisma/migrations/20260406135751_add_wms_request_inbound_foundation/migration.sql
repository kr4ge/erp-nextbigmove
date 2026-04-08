-- CreateEnum
CREATE TYPE "WmsStockRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'WMS_REVIEWED', 'PARTNER_CONFIRMED', 'PARTNER_REJECTED', 'INVOICED', 'PAYMENT_SUBMITTED', 'PAYMENT_VERIFIED', 'IN_PROCUREMENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELED');

-- CreateEnum
CREATE TYPE "WmsStockRequestInvoiceStatus" AS ENUM ('UNPAID', 'PAYMENT_SUBMITTED', 'PAID', 'CANCELED');

-- CreateEnum
CREATE TYPE "WmsStockRequestPaymentStatus" AS ENUM ('SUBMITTED', 'VERIFIED', 'REJECTED');

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "billingAddress" JSONB,
ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "partnerTypeId" UUID;

-- AlterTable
ALTER TABLE "wms_sku_profiles" ADD COLUMN     "isRequestable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "supplierCost" DECIMAL(14,2),
ADD COLUMN     "wmsUnitPrice" DECIMAL(14,2);

-- AlterTable
ALTER TABLE "wms_stock_receipt_items" ADD COLUMN     "requestLineId" UUID;

-- AlterTable
ALTER TABLE "wms_stock_receipts" ADD COLUMN     "requestId" UUID;

-- CreateTable
CREATE TABLE "partner_types" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wms_company_billing_settings" (
    "id" UUID NOT NULL,
    "companyName" TEXT NOT NULL,
    "billingAddress" JSONB NOT NULL,
    "bankName" TEXT,
    "bankAccountName" TEXT,
    "bankAccountNumber" TEXT,
    "bankAccountType" TEXT,
    "notes" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wms_company_billing_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wms_stock_requests" (
    "id" UUID NOT NULL,
    "requestCode" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "storeId" UUID,
    "status" "WmsStockRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "forecastRunDate" DATE,
    "orderingWindow" TEXT,
    "reviewRemarks" TEXT,
    "internalNotes" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "partnerRespondedAt" TIMESTAMP(3),
    "invoicedAt" TIMESTAMP(3),
    "paymentSubmittedAt" TIMESTAMP(3),
    "paymentVerifiedAt" TIMESTAMP(3),
    "procurementStartedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "totalQuantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "adjustmentAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'PHP',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wms_stock_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wms_stock_request_lines" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "posProductId" UUID NOT NULL,
    "skuProfileId" UUID,
    "sku" TEXT,
    "productName" TEXT NOT NULL,
    "variationId" TEXT,
    "variationName" TEXT,
    "barcode" TEXT,
    "requestedQuantity" DECIMAL(14,4) NOT NULL,
    "recommendedQuantity" DECIMAL(14,4),
    "remainingQuantity" DECIMAL(14,4),
    "pendingQuantity" DECIMAL(14,4),
    "pastTwoDaysQuantity" DECIMAL(14,4),
    "returningQuantity" DECIMAL(14,4),
    "receivedQuantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "supplierCost" DECIMAL(14,2),
    "wmsUnitPrice" DECIMAL(14,2) NOT NULL,
    "lineAmount" DECIMAL(14,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "partnerNotes" TEXT,
    "reviewRemarks" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wms_stock_request_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wms_stock_request_invoices" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "invoiceCode" TEXT NOT NULL,
    "status" "WmsStockRequestInvoiceStatus" NOT NULL DEFAULT 'UNPAID',
    "companyName" TEXT NOT NULL,
    "companyBillingAddress" JSONB NOT NULL,
    "partnerCompanyName" TEXT NOT NULL,
    "partnerBillingAddress" JSONB NOT NULL,
    "bankName" TEXT,
    "bankAccountName" TEXT,
    "bankAccountNumber" TEXT,
    "bankAccountType" TEXT,
    "invoiceDate" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "note" TEXT,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "adjustmentAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "amountDue" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PHP',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wms_stock_request_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wms_stock_request_invoice_lines" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "requestLineId" UUID,
    "lineNo" INTEGER NOT NULL,
    "posProductId" UUID,
    "sku" TEXT,
    "productName" TEXT NOT NULL,
    "variationId" TEXT,
    "variationName" TEXT,
    "quantity" DECIMAL(14,4) NOT NULL,
    "supplierCost" DECIMAL(14,2),
    "wmsUnitPrice" DECIMAL(14,2) NOT NULL,
    "lineAmount" DECIMAL(14,2) NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wms_stock_request_invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wms_stock_request_payments" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "status" "WmsStockRequestPaymentStatus" NOT NULL DEFAULT 'SUBMITTED',
    "proofUrl" TEXT,
    "proofNote" TEXT,
    "remarks" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),
    "verifiedByUserId" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wms_stock_request_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "partner_types_key_key" ON "partner_types"("key");

-- CreateIndex
CREATE UNIQUE INDEX "partner_types_name_key" ON "partner_types"("name");

-- CreateIndex
CREATE INDEX "partner_types_isActive_name_idx" ON "partner_types"("isActive", "name");

-- CreateIndex
CREATE UNIQUE INDEX "wms_stock_requests_requestCode_key" ON "wms_stock_requests"("requestCode");

-- CreateIndex
CREATE INDEX "wms_stock_requests_tenantId_status_createdAt_idx" ON "wms_stock_requests"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "wms_stock_requests_storeId_status_createdAt_idx" ON "wms_stock_requests"("storeId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "wms_stock_requests_status_createdAt_idx" ON "wms_stock_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "wms_stock_request_lines_posProductId_idx" ON "wms_stock_request_lines"("posProductId");

-- CreateIndex
CREATE INDEX "wms_stock_request_lines_skuProfileId_idx" ON "wms_stock_request_lines"("skuProfileId");

-- CreateIndex
CREATE INDEX "wms_stock_request_lines_variationId_idx" ON "wms_stock_request_lines"("variationId");

-- CreateIndex
CREATE UNIQUE INDEX "wms_stock_request_lines_requestId_lineNo_key" ON "wms_stock_request_lines"("requestId", "lineNo");

-- CreateIndex
CREATE UNIQUE INDEX "wms_stock_request_invoices_requestId_key" ON "wms_stock_request_invoices"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "wms_stock_request_invoices_invoiceCode_key" ON "wms_stock_request_invoices"("invoiceCode");

-- CreateIndex
CREATE INDEX "wms_stock_request_invoices_tenantId_status_invoiceDate_idx" ON "wms_stock_request_invoices"("tenantId", "status", "invoiceDate");

-- CreateIndex
CREATE INDEX "wms_stock_request_invoices_status_invoiceDate_idx" ON "wms_stock_request_invoices"("status", "invoiceDate");

-- CreateIndex
CREATE INDEX "wms_stock_request_invoice_lines_requestLineId_idx" ON "wms_stock_request_invoice_lines"("requestLineId");

-- CreateIndex
CREATE INDEX "wms_stock_request_invoice_lines_posProductId_idx" ON "wms_stock_request_invoice_lines"("posProductId");

-- CreateIndex
CREATE UNIQUE INDEX "wms_stock_request_invoice_lines_invoiceId_lineNo_key" ON "wms_stock_request_invoice_lines"("invoiceId", "lineNo");

-- CreateIndex
CREATE INDEX "wms_stock_request_payments_requestId_status_submittedAt_idx" ON "wms_stock_request_payments"("requestId", "status", "submittedAt");

-- CreateIndex
CREATE INDEX "wms_stock_request_payments_invoiceId_status_submittedAt_idx" ON "wms_stock_request_payments"("invoiceId", "status", "submittedAt");

-- CreateIndex
CREATE INDEX "tenants_partnerTypeId_idx" ON "tenants"("partnerTypeId");

-- CreateIndex
CREATE INDEX "wms_sku_profiles_isRequestable_status_idx" ON "wms_sku_profiles"("isRequestable", "status");

-- CreateIndex
CREATE INDEX "wms_stock_receipt_items_requestLineId_idx" ON "wms_stock_receipt_items"("requestLineId");

-- CreateIndex
CREATE INDEX "wms_stock_receipts_requestId_receivedAt_idx" ON "wms_stock_receipts"("requestId", "receivedAt");

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_partnerTypeId_fkey" FOREIGN KEY ("partnerTypeId") REFERENCES "partner_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_stock_receipts" ADD CONSTRAINT "wms_stock_receipts_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "wms_stock_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_stock_receipt_items" ADD CONSTRAINT "wms_stock_receipt_items_requestLineId_fkey" FOREIGN KEY ("requestLineId") REFERENCES "wms_stock_request_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_stock_requests" ADD CONSTRAINT "wms_stock_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_stock_requests" ADD CONSTRAINT "wms_stock_requests_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "pos_stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_stock_request_lines" ADD CONSTRAINT "wms_stock_request_lines_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "wms_stock_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_stock_request_lines" ADD CONSTRAINT "wms_stock_request_lines_posProductId_fkey" FOREIGN KEY ("posProductId") REFERENCES "pos_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_stock_request_lines" ADD CONSTRAINT "wms_stock_request_lines_skuProfileId_fkey" FOREIGN KEY ("skuProfileId") REFERENCES "wms_sku_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_stock_request_invoices" ADD CONSTRAINT "wms_stock_request_invoices_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "wms_stock_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_stock_request_invoices" ADD CONSTRAINT "wms_stock_request_invoices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_stock_request_invoice_lines" ADD CONSTRAINT "wms_stock_request_invoice_lines_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "wms_stock_request_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_stock_request_invoice_lines" ADD CONSTRAINT "wms_stock_request_invoice_lines_requestLineId_fkey" FOREIGN KEY ("requestLineId") REFERENCES "wms_stock_request_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_stock_request_invoice_lines" ADD CONSTRAINT "wms_stock_request_invoice_lines_posProductId_fkey" FOREIGN KEY ("posProductId") REFERENCES "pos_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_stock_request_payments" ADD CONSTRAINT "wms_stock_request_payments_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "wms_stock_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_stock_request_payments" ADD CONSTRAINT "wms_stock_request_payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "wms_stock_request_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
