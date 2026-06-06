import { printHtmlDocument } from '@/lib/print-html';
import {
  compactBarcodeLabelPrintStyles,
  renderCompactBarcodeLabelHtml,
} from '@/lib/wms-compact-barcode-label';

type PrintUnitLabelInput = {
  barcodeValue: string;
  countLabel?: string | number;
};

export function printUnitLabel(input: PrintUnitLabelInput) {
  printHtmlDocument({
    title: 'WMS Unit Label',
    styles: compactBarcodeLabelPrintStyles,
    bodyHtml: renderCompactBarcodeLabelHtml({
      barcodeValue: input.barcodeValue,
      countLabel: input.countLabel ?? 1,
    }),
  });
}
