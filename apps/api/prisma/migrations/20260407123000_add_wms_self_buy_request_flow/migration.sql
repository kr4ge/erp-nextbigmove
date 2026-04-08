CREATE TYPE "WmsStockRequestType" AS ENUM ('WMS_PROCUREMENT', 'PARTNER_SELF_BUY');

ALTER TYPE "WmsStockRequestStatus" ADD VALUE 'UNDER_AUDIT';
ALTER TYPE "WmsStockRequestStatus" ADD VALUE 'FEEDBACK_REQUIRED';
ALTER TYPE "WmsStockRequestStatus" ADD VALUE 'AUDIT_ACCEPTED';

ALTER TABLE "wms_stock_requests"
ADD COLUMN "requestType" "WmsStockRequestType" NOT NULL DEFAULT 'WMS_PROCUREMENT',
ADD COLUMN "auditStartedAt" TIMESTAMP(3),
ADD COLUMN "auditCompletedAt" TIMESTAMP(3);

ALTER TABLE "wms_stock_request_lines"
ADD COLUMN "deliveredQuantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
ADD COLUMN "acceptedQuantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
ADD COLUMN "declaredUnitCost" DECIMAL(14,2),
ADD COLUMN "confirmedUnitCost" DECIMAL(14,2),
ADD COLUMN "auditRemarks" TEXT;

DROP INDEX "wms_stock_requests_tenantId_status_createdAt_idx";
DROP INDEX "wms_stock_requests_storeId_status_createdAt_idx";
DROP INDEX "wms_stock_requests_status_createdAt_idx";

CREATE INDEX "wms_stock_requests_tenantId_requestType_status_createdAt_idx"
ON "wms_stock_requests"("tenantId", "requestType", "status", "createdAt");

CREATE INDEX "wms_stock_requests_storeId_requestType_status_createdAt_idx"
ON "wms_stock_requests"("storeId", "requestType", "status", "createdAt");

CREATE INDEX "wms_stock_requests_requestType_status_createdAt_idx"
ON "wms_stock_requests"("requestType", "status", "createdAt");
