CREATE TYPE "WmsFulfillmentAdjustmentType" AS ENUM ('BYPASS', 'SUBSTITUTION');
CREATE TYPE "WmsFulfillmentAdjustmentStatus" AS ENUM ('ACTIVE', 'SUPERSEDED', 'REVOKED');

ALTER TABLE "wms_fulfillment_orders"
ADD COLUMN "sourceTotalQuantity" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "wms_fulfillment_lines"
ADD COLUMN "sourceQuantityRequired" INTEGER NOT NULL DEFAULT 0;

UPDATE "wms_fulfillment_orders"
SET "sourceTotalQuantity" = "totalQuantity";

UPDATE "wms_fulfillment_lines"
SET "sourceQuantityRequired" = "quantityRequired";

CREATE TABLE "wms_fulfillment_adjustments" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "fulfillmentOrderId" UUID NOT NULL,
    "sourceLineId" UUID NOT NULL,
    "sourceVariationId" TEXT NOT NULL,
    "sourceProductId" TEXT,
    "sourceProductName" TEXT NOT NULL,
    "sourceProductDisplayId" TEXT,
    "substituteVariationId" TEXT,
    "substituteProductId" TEXT,
    "substituteProductName" TEXT,
    "substituteProductDisplayId" TEXT,
    "type" "WmsFulfillmentAdjustmentType" NOT NULL,
    "status" "WmsFulfillmentAdjustmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "quantity" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "sourceRevision" INTEGER NOT NULL,
    "createdById" UUID NOT NULL,
    "supersededAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wms_fulfillment_adjustments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "wms_fulfillment_adjustments_tenantId_status_createdAt_idx"
ON "wms_fulfillment_adjustments"("tenantId", "status", "createdAt");

CREATE INDEX "wms_fulfillment_adjustments_fulfillmentOrderId_status_idx"
ON "wms_fulfillment_adjustments"("fulfillmentOrderId", "status");

CREATE INDEX "wms_fulfillment_adjustments_sourceLineId_status_idx"
ON "wms_fulfillment_adjustments"("sourceLineId", "status");

CREATE INDEX "wms_fulfillment_adjustments_createdById_idx"
ON "wms_fulfillment_adjustments"("createdById");

ALTER TABLE "wms_fulfillment_adjustments"
ADD CONSTRAINT "wms_fulfillment_adjustments_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_fulfillment_adjustments"
ADD CONSTRAINT "wms_fulfillment_adjustments_fulfillmentOrderId_fkey"
FOREIGN KEY ("fulfillmentOrderId") REFERENCES "wms_fulfillment_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_fulfillment_adjustments"
ADD CONSTRAINT "wms_fulfillment_adjustments_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
