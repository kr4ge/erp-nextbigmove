import { normalizeBarcodeValue, renderCode128CSvgMarkup } from '@/app/(admin)/warehouses/_utils/code39-barcode';

type CompactBarcodeLabelInput = {
  barcodeValue: string;
  countLabel?: string | number;
};

export const compactBarcodeLabelPrintStyles = `
  @page { size: 30mm 20mm; margin: 0; }
  html,
  body {
    width: 30mm;
    min-height: 20mm;
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #000000;
    font-family: Helvetica, Arial, sans-serif;
  }
  .label-page {
    width: 30mm;
    height: 20mm;
    box-sizing: border-box;
    break-after: page;
    page-break-after: always;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    padding: 1.15mm 0.65mm 0.85mm;
  }
  .label-page:last-child {
    break-after: auto;
    page-break-after: auto;
  }
  .barcode-wrap {
    width: 28.7mm;
    height: 13.5mm;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .barcode-wrap svg {
    width: 100%;
    height: 100%;
    display: block;
  }
  .barcode-value-line {
    width: 28.7mm;
    margin-top: 0.65mm;
    text-align: center;
    white-space: nowrap;
    line-height: 1;
    color: #000000;
  }
  .barcode-value {
    font-size: 6.4pt;
    font-weight: 600;
    letter-spacing: 0.02em;
  }
  .barcode-count {
    margin-left: 0.4mm;
    font-size: 4pt;
    font-weight: 600;
    line-height: 1;
    vertical-align: baseline;
  }
`;

export function renderCompactBarcodeLabelHtml(input: CompactBarcodeLabelInput) {
  const barcodeValue = normalizeBarcodeValue(input.barcodeValue);
  const barcodeMarkup = renderCode128CSvgMarkup(barcodeValue, {
    height: 104,
    moduleWidth: 1,
    quietZone: 6,
    showText: false,
    barColor: '#000000',
    preserveAspectRatio: 'none',
  });
  const countLabel = formatCountLabel(input.countLabel);

  return `
    <section class="label-page">
      <div class="barcode-wrap">${barcodeMarkup}</div>
      <div class="barcode-value-line">
        <span class="barcode-value">${escapeHtml(barcodeValue)}</span>${countLabel ? `<sub class="barcode-count">${escapeHtml(countLabel)}</sub>` : ''}
      </div>
    </section>
  `;
}

export function formatCountLabel(value: string | number | undefined) {
  if (value === undefined || value === null || value === '') {
    return '';
  }

  const normalized = String(value).trim();

  if (!normalized) {
    return '';
  }

  if (/^\d+$/.test(normalized)) {
    return normalized.padStart(2, '0');
  }

  return normalized;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
