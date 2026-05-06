import { normalizeBarcodeValue, renderCode128SvgMarkup } from './code39-barcode';
import { printHtmlDocument } from '@/lib/print-html';

type PrintBinLabelInput = {
  warehouseCode: string;
  warehouseName: string;
  sectionCode: string;
  rackCode: string;
  binCode: string;
  barcodeValue: string;
};

export function printBinLabel(input: PrintBinLabelInput) {
  const barcodeValue = normalizeBarcodeValue(input.barcodeValue);
  const barcodeMarkup = renderCode128SvgMarkup(barcodeValue, {
    height: 112,
    moduleWidth: 2,
    quietZone: 24,
    textSize: 16,
  });

  const path = `${input.sectionCode} / ${input.rackCode} / ${input.binCode}`;

  printHtmlDocument({
    title: 'WMS Slot Label',
    styles: `
      @page { size: auto; margin: 12mm; }
      body {
        margin: 0;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
        color: #12384b;
      }
      .sheet {
        width: 100%;
        display: grid;
        place-items: center;
        padding: 16px 0;
      }
      .label {
        width: 620px;
        border: 1px solid #cfdbe3;
        border-radius: 18px;
        padding: 18px 20px;
      }
      .eyebrow {
        font-size: 11px;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: #6b7f8d;
      }
      .bin {
        font-size: 28px;
        margin: 8px 0 6px;
        font-weight: 700;
      }
      .meta {
        font-size: 13px;
        color: #3f5e70;
        margin-bottom: 12px;
      }
      .path {
        font-size: 12px;
        color: #5d7585;
        margin: 8px 0 12px;
      }
      .barcode-wrap {
        border: 1px solid #d7e0e7;
        border-radius: 12px;
        background: #fff;
        padding: 10px;
        display: grid;
        place-items: center;
      }
      .barcode-wrap svg {
        max-width: 100%;
        height: auto;
      }
      .value {
        margin-top: 10px;
        font-size: 14px;
        color: #5f7686;
        letter-spacing: 0.08em;
        font-weight: 700;
      }
    `,
    bodyHtml: `
      <div class="sheet">
        <div class="label">
          <div class="eyebrow">WMS SLOT LABEL</div>
          <div class="bin">${escapeHtml(input.binCode)}</div>
          <div class="meta">${escapeHtml(input.warehouseName)} (${escapeHtml(input.warehouseCode)})</div>
          <div class="path">${escapeHtml(path)}</div>
          <div class="barcode-wrap">${barcodeMarkup}</div>
          <div class="value">${escapeHtml(barcodeValue)}</div>
        </div>
      </div>
    `,
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
