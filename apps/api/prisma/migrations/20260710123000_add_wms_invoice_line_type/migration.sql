CREATE TYPE "WmsInvoiceLineType" AS ENUM ('SOURCE', 'CUSTOM');

ALTER TABLE "wms_invoice_lines"
ADD COLUMN "lineType" "WmsInvoiceLineType" NOT NULL DEFAULT 'SOURCE';

CREATE INDEX "wms_invoice_lines_invoiceId_lineType_idx"
ON "wms_invoice_lines"("invoiceId", "lineType");
