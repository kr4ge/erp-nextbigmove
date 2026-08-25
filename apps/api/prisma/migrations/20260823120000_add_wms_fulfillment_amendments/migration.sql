CREATE TYPE "WmsFulfillmentChangeState" AS ENUM (
  'NONE',
  'PICK_REWORK_REQUIRED',
  'PACK_REWORK_REQUIRED',
  'PACKED_REWORK_REQUIRED',
  'EXCEPTION'
);

CREATE TYPE "WmsFulfillmentAmendmentStatus" AS ENUM (
  'OPEN',
  'RESOLVED',
  'SUPERSEDED'
);

CREATE TYPE "WmsFulfillmentAmendmentStage" AS ENUM (
  'PRE_PICK',
  'PICKING',
  'PACKING',
  'PACKED'
);

ALTER TABLE "wms_fulfillment_orders"
  ADD COLUMN "sourceItemsHash" TEXT,
  ADD COLUMN "sourceRevision" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "changeState" "WmsFulfillmentChangeState" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "changeDetectedAt" TIMESTAMP(3),
  ADD COLUMN "changeSummary" JSONB;

CREATE TABLE "wms_fulfillment_amendments" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "fulfillmentOrderId" UUID NOT NULL,
  "sourceHash" TEXT NOT NULL,
  "previousHash" TEXT,
  "sourceRevision" INTEGER NOT NULL,
  "detectedStage" "WmsFulfillmentAmendmentStage" NOT NULL,
  "status" "WmsFulfillmentAmendmentStatus" NOT NULL DEFAULT 'OPEN',
  "diff" JSONB NOT NULL,
  "requiredActions" JSONB NOT NULL,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "wms_fulfillment_amendments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wms_fulfillment_amendments_fulfillmentOrderId_sourceHash_key"
  ON "wms_fulfillment_amendments"("fulfillmentOrderId", "sourceHash");
CREATE INDEX "wms_fulfillment_amendments_tenantId_status_detectedAt_idx"
  ON "wms_fulfillment_amendments"("tenantId", "status", "detectedAt");
CREATE INDEX "wms_fulfillment_amendments_fulfillmentOrderId_status_idx"
  ON "wms_fulfillment_amendments"("fulfillmentOrderId", "status");
CREATE INDEX "wms_fulfillment_orders_tenantId_changeState_updatedAt_idx"
  ON "wms_fulfillment_orders"("tenantId", "changeState", "updatedAt");

ALTER TABLE "wms_fulfillment_amendments"
  ADD CONSTRAINT "wms_fulfillment_amendments_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_fulfillment_amendments"
  ADD CONSTRAINT "wms_fulfillment_amendments_fulfillmentOrderId_fkey"
  FOREIGN KEY ("fulfillmentOrderId") REFERENCES "wms_fulfillment_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
