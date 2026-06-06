import { printHtmlDocument } from '@/lib/print-html';
import {
  compactBarcodeLabelPrintStyles,
  renderCompactBarcodeLabelHtml,
} from '@/lib/wms-compact-barcode-label';

type PrintReceivingBatchLabelsInput = {
  batchCode: string;
  units: Array<{
    barcode: string;
  }>;
};

export function printReceivingBatchLabels(input: PrintReceivingBatchLabelsInput) {
  const pages = input.units
    .map((unit, index) =>
      renderCompactBarcodeLabelHtml({
        barcodeValue: unit.barcode,
        countLabel: index + 1,
      }),
    )
    .join('');

  printHtmlDocument({
    title: `WMS Batch Labels ${input.batchCode}`,
    styles: compactBarcodeLabelPrintStyles,
    bodyHtml: pages,
  });
}
