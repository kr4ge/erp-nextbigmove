-- Warehouse billing and bank details for procurement invoices
ALTER TABLE "wms_warehouses"
ADD COLUMN "billingCompanyName" TEXT,
ADD COLUMN "billingAddress" TEXT,
ADD COLUMN "bankName" TEXT,
ADD COLUMN "bankAccountName" TEXT,
ADD COLUMN "bankAccountNumber" TEXT,
ADD COLUMN "bankAccountType" TEXT,
ADD COLUMN "bankBranch" TEXT,
ADD COLUMN "paymentInstructions" TEXT;

-- Partner payment proof capture on purchasing batches
ALTER TABLE "wms_purchasing_batches"
ADD COLUMN "paymentProofImageUrl" TEXT,
ADD COLUMN "paymentProofSubmittedAt" TIMESTAMP(3),
ADD COLUMN "paymentProofSubmittedById" UUID;

ALTER TABLE "wms_purchasing_batches"
ADD CONSTRAINT "wms_purchasing_batches_paymentProofSubmittedById_fkey"
FOREIGN KEY ("paymentProofSubmittedById")
REFERENCES "users"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX "wms_purchasing_batches_paymentProofSubmittedById_idx"
ON "wms_purchasing_batches"("paymentProofSubmittedById");
