import { printHtmlDocument } from '@/lib/print-html';
import { renderCode39SvgMarkup } from '../../warehouses/_utils/code39-barcode';

type PrintReceivingBatchLabelsInput = {
  batchCode: string;
  units: Array<{
    barcode: string;
  }>;
};

export function printReceivingBatchLabels(input: PrintReceivingBatchLabelsInput) {
  const labelsPerPage = 10;
  const pages = chunkUnits(input.units, labelsPerPage)
    .map((pageUnits, pageIndex) => {
      const labels = pageUnits
        .map((unit, itemIndex) => {
          const sequence = (pageIndex * labelsPerPage) + itemIndex + 1;
          const barcodeMarkup = renderCode39SvgMarkup(unit.barcode, {
            height: 44,
            narrowWidth: 1.5,
            wideWidth: 3.1,
            quietZone: 10,
            showText: false,
          });
          const labelCode = escapeHtml(unit.barcode);

          return `
            <article class="label-card">
              <div class="barcode-wrap">${barcodeMarkup}</div>
              <div class="barcode-value">${labelCode}</div>
              <span class="barcode-count">${sequence}</span>
            </article>
          `;
        })
        .join('');

      return `
        <section class="page">
          <div class="stack">${labels}</div>
        </section>
      `;
    })
    .join('');

  printHtmlDocument({
    title: `WMS Batch Labels ${input.batchCode}`,
    styles: `
      @page { size: A4 portrait; margin: 8mm; }
      body {
        margin: 0;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
        color: #12384b;
        background: #fff;
      }
      .page {
        min-height: calc(297mm - 16mm);
        display: flex;
        justify-content: flex-start;
        align-items: center;
      }
      .page + .page {
        break-before: page;
      }
      .stack {
        width: 112mm;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 1mm;
      }
      .label-card {
        position: relative;
        width: 100%;
        height: 27.2mm;
        box-sizing: border-box;
        border: 1.2px solid #0f3040;
        border-radius: 0;
        padding: 0.7mm 1.2mm 0.4mm;
        break-inside: avoid;
        display: grid;
        grid-template-rows: 17.8mm auto;
        row-gap: 0.2mm;
      }
      .barcode-wrap {
        width: 96%;
        height: 100%;
        margin: 0 auto;
        box-sizing: border-box;
      }
      .barcode-wrap svg {
        width: 100%;
        height: 100%;
        display: block;
      }
      .barcode-value {
        text-align: center;
        font-size: 10.6pt;
        font-weight: 700;
        line-height: 1;
        letter-spacing: 0.2em;
        color: #0f3040;
        font-family: "OCR A Std", "OCR A Extended", "Courier New", ui-monospace, Menlo, Monaco, Consolas, monospace;
      }
      .barcode-count {
        position: absolute;
        right: 1.6mm;
        bottom: 1.1mm;
        font-size: 11px;
        font-weight: 700;
        line-height: 1;
        color: #0f3040;
      }
    `,
    bodyHtml: pages,
  });
}

function chunkUnits<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
