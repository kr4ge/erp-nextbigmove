CREATE TYPE "WmsPurchasingRequestType" AS ENUM (
  'PROCUREMENT',
  'SELF_BUY'
);

CREATE TYPE "WmsPurchasingBatchStatus" AS ENUM (
  'SUBMITTED',
  'UNDER_REVIEW',
  'WAITING_PARTNER',
  'APPROVED',
  'READY_FOR_RECEIVING',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'REJECTED',
  'CANCELED'
);

CREATE TYPE "WmsPurchasingSourceType" AS ENUM (
  'ERP_REQUEST',
  'LEGACY_SIMULATION',
  'MANUAL',
  'IMPORT'
);

CREATE TABLE "wms_purchasing_batches" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "teamId" UUID,
  "storeId" UUID NOT NULL,
  "requestType" "WmsPurchasingRequestType" NOT NULL,
  "status" "WmsPurchasingBatchStatus" NOT NULL DEFAULT 'SUBMITTED',
  "sourceType" "WmsPurchasingSourceType" NOT NULL DEFAULT 'ERP_REQUEST',
  "sourceRequestId" TEXT,
  "sourceRequestType" INTEGER,
  "sourceStatus" TEXT,
  "sourceSnapshot" JSONB,
  "requestTitle" TEXT,
  "partnerNotes" TEXT,
  "wmsNotes" TEXT,
  "invoiceNumber" TEXT,
  "invoiceAmount" DECIMAL(14, 2),
  "paymentSubmittedAt" TIMESTAMP(3),
  "paymentVerifiedAt" TIMESTAMP(3),
  "readyForReceivingAt" TIMESTAMP(3),
  "submittedById" UUID,
  "reviewedById" UUID,
  "approvedById" UUID,
  "createdById" UUID,
  "updatedById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "wms_purchasing_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wms_purchasing_batch_lines" (
  "id" UUID NOT NULL,
  "batchId" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "lineNo" INTEGER NOT NULL,
  "sourceItemId" TEXT,
  "sourceSnapshot" JSONB,
  "productId" TEXT,
  "variationId" TEXT,
  "requestedProductName" TEXT,
  "uom" TEXT,
  "requestedQuantity" INTEGER NOT NULL,
  "approvedQuantity" INTEGER,
  "receivedQuantity" INTEGER NOT NULL DEFAULT 0,
  "partnerUnitCost" DECIMAL(14, 2),
  "supplierUnitCost" DECIMAL(14, 2),
  "needsProfiling" BOOLEAN NOT NULL DEFAULT false,
  "resolvedPosProductId" UUID,
  "resolvedProfileId" UUID,
  "notes" TEXT,
  "createdById" UUID,
  "updatedById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "wms_purchasing_batch_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wms_purchasing_events" (
  "id" UUID NOT NULL,
  "batchId" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "eventType" TEXT NOT NULL,
  "fromStatus" "WmsPurchasingBatchStatus",
  "toStatus" "WmsPurchasingBatchStatus",
  "message" TEXT,
  "payload" JSONB,
  "actorId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "wms_purchasing_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wms_purchasing_batches_tenantId_sourceType_sourceRequestId_key"
ON "wms_purchasing_batches"("tenantId", "sourceType", "sourceRequestId");

CREATE INDEX "wms_purchasing_batches_tenantId_storeId_status_idx"
ON "wms_purchasing_batches"("tenantId", "storeId", "status");

CREATE INDEX "wms_purchasing_batches_tenantId_requestType_status_idx"
ON "wms_purchasing_batches"("tenantId", "requestType", "status");

CREATE INDEX "wms_purchasing_batches_tenantId_sourceType_sourceRequestId_idx"
ON "wms_purchasing_batches"("tenantId", "sourceType", "sourceRequestId");

CREATE INDEX "wms_purchasing_batches_readyForReceivingAt_idx"
ON "wms_purchasing_batches"("readyForReceivingAt");

CREATE UNIQUE INDEX "wms_purchasing_batch_lines_batchId_lineNo_key"
ON "wms_purchasing_batch_lines"("batchId", "lineNo");

CREATE INDEX "wms_purchasing_batch_lines_tenantId_storeId_idx"
ON "wms_purchasing_batch_lines"("tenantId", "storeId");

CREATE INDEX "wms_purchasing_batch_lines_resolvedPosProductId_idx"
ON "wms_purchasing_batch_lines"("resolvedPosProductId");

CREATE INDEX "wms_purchasing_batch_lines_resolvedProfileId_idx"
ON "wms_purchasing_batch_lines"("resolvedProfileId");

CREATE INDEX "wms_purchasing_batch_lines_variationId_idx"
ON "wms_purchasing_batch_lines"("variationId");

CREATE INDEX "wms_purchasing_events_tenantId_batchId_createdAt_idx"
ON "wms_purchasing_events"("tenantId", "batchId", "createdAt");

ALTER TABLE "wms_purchasing_batches"
ADD CONSTRAINT "wms_purchasing_batches_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_purchasing_batches"
ADD CONSTRAINT "wms_purchasing_batches_teamId_fkey"
FOREIGN KEY ("teamId") REFERENCES "teams"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_purchasing_batches"
ADD CONSTRAINT "wms_purchasing_batches_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "pos_stores"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_purchasing_batches"
ADD CONSTRAINT "wms_purchasing_batches_submittedById_fkey"
FOREIGN KEY ("submittedById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_purchasing_batches"
ADD CONSTRAINT "wms_purchasing_batches_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_purchasing_batches"
ADD CONSTRAINT "wms_purchasing_batches_approvedById_fkey"
FOREIGN KEY ("approvedById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_purchasing_batches"
ADD CONSTRAINT "wms_purchasing_batches_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_purchasing_batches"
ADD CONSTRAINT "wms_purchasing_batches_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_purchasing_batch_lines"
ADD CONSTRAINT "wms_purchasing_batch_lines_batchId_fkey"
FOREIGN KEY ("batchId") REFERENCES "wms_purchasing_batches"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_purchasing_batch_lines"
ADD CONSTRAINT "wms_purchasing_batch_lines_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_purchasing_batch_lines"
ADD CONSTRAINT "wms_purchasing_batch_lines_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "pos_stores"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_purchasing_batch_lines"
ADD CONSTRAINT "wms_purchasing_batch_lines_resolvedPosProductId_fkey"
FOREIGN KEY ("resolvedPosProductId") REFERENCES "pos_products"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_purchasing_batch_lines"
ADD CONSTRAINT "wms_purchasing_batch_lines_resolvedProfileId_fkey"
FOREIGN KEY ("resolvedProfileId") REFERENCES "wms_product_profiles"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_purchasing_batch_lines"
ADD CONSTRAINT "wms_purchasing_batch_lines_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_purchasing_batch_lines"
ADD CONSTRAINT "wms_purchasing_batch_lines_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_purchasing_events"
ADD CONSTRAINT "wms_purchasing_events_batchId_fkey"
FOREIGN KEY ("batchId") REFERENCES "wms_purchasing_batches"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_purchasing_events"
ADD CONSTRAINT "wms_purchasing_events_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_purchasing_events"
ADD CONSTRAINT "wms_purchasing_events_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
