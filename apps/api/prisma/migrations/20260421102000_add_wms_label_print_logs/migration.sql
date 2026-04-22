ALTER TABLE "wms_receiving_batches"
ADD COLUMN "labelPrintCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "firstLabelPrintedAt" TIMESTAMP(3),
ADD COLUMN "lastLabelPrintedAt" TIMESTAMP(3);

ALTER TABLE "wms_inventory_units"
ADD COLUMN "labelPrintCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "firstLabelPrintedAt" TIMESTAMP(3),
ADD COLUMN "lastLabelPrintedAt" TIMESTAMP(3);

CREATE TABLE "wms_label_print_logs" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "actorId" UUID,
  "scope" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "receivingBatchId" UUID,
  "inventoryUnitId" UUID,
  "itemCount" INTEGER NOT NULL DEFAULT 1,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "wms_label_print_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "wms_label_print_logs_tenantId_createdAt_idx"
ON "wms_label_print_logs"("tenantId", "createdAt");

CREATE INDEX "wms_label_print_logs_scope_createdAt_idx"
ON "wms_label_print_logs"("scope", "createdAt");

CREATE INDEX "wms_label_print_logs_receivingBatchId_idx"
ON "wms_label_print_logs"("receivingBatchId");

CREATE INDEX "wms_label_print_logs_inventoryUnitId_idx"
ON "wms_label_print_logs"("inventoryUnitId");

CREATE INDEX "wms_label_print_logs_actorId_idx"
ON "wms_label_print_logs"("actorId");

ALTER TABLE "wms_label_print_logs"
ADD CONSTRAINT "wms_label_print_logs_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_label_print_logs"
ADD CONSTRAINT "wms_label_print_logs_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_label_print_logs"
ADD CONSTRAINT "wms_label_print_logs_receivingBatchId_fkey"
FOREIGN KEY ("receivingBatchId") REFERENCES "wms_receiving_batches"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_label_print_logs"
ADD CONSTRAINT "wms_label_print_logs_inventoryUnitId_fkey"
FOREIGN KEY ("inventoryUnitId") REFERENCES "wms_inventory_units"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
