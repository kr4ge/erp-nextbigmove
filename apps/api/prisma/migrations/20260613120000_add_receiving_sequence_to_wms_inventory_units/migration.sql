ALTER TABLE "wms_inventory_units"
ADD COLUMN "receivingSequence" INTEGER;

CREATE INDEX "wms_inventory_units_receivingBatchId_receivingSequence_idx"
ON "wms_inventory_units"("receivingBatchId", "receivingSequence");
