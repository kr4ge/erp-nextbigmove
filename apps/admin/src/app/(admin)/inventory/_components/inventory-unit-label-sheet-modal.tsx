"use client";

import { Printer, X } from "lucide-react";
import { WmsCode128Barcode } from "../../_components/wms-code128-barcode";
import { getCode128BPattern, isCode128BValue } from "../../_utils/wms-barcodes";

const PRINTABLE_PAGE_HEIGHT_MM = 281;
const LABEL_WIDTH_MM = 58;
const LABEL_HEIGHT_MM = 24;
const LABEL_GAP_MM = 3;
const LABELS_PER_PAGE = 10;
const PRINT_BARCODE_HEIGHT = 75;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildBarcodeValueMarkup(
  barcode: string,
  batchSequence: number | null | undefined,
) {
  const safeBarcode = escapeHtml(barcode);
  if (!batchSequence) {
    return `<span class="value-main">${safeBarcode}</span>`;
  }

  return `<span class="value-main">${safeBarcode}</span><span class="value-sequence"><sup>${escapeHtml(String(batchSequence))}</sup></span>`;
}

function buildCode128SvgMarkup(value: string) {
  const patterns = getCode128BPattern(value);
  if (!patterns) {
    return "";
  }

  const moduleWidth = 1.15;
  const height = PRINT_BARCODE_HEIGHT;
  const quietZone = moduleWidth * 10;
  const width =
    quietZone * 2 +
    patterns.reduce(
      (sum, pattern) =>
        sum +
        pattern
          .split("")
          .reduce((patternSum, digit) => patternSum + Number(digit), 0),
      0,
    ) *
      moduleWidth;
  let cursor = quietZone;

  const rects = patterns.flatMap((pattern) =>
    pattern.split("").map((digit, tokenIndex) => {
      const segmentWidth = Number(digit) * moduleWidth;
      const x = cursor;
      cursor += segmentWidth;

      if (tokenIndex % 2 === 0) {
        return `<rect x="${x}" y="0" width="${segmentWidth}" height="${height}" fill="#0f172a" />`;
      }

      return "";
    }),
  );

  return `
    <svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" aria-label="Code128 barcode ${escapeHtml(value)}">
      <rect width="${width}" height="${height}" fill="white" />
      ${rects.join("")}
    </svg>
  `;
}

export type InventoryUnitLabelSheetUnit = {
  id: string;
  serialNo: string;
  batchSequence: number;
  unitBarcode: string;
  sku: string;
  productName: string;
  variationName?: string | null;
  lotCode: string;
  locationLabel: string;
  sourceLabel: string;
};

export type InventoryUnitLabelSheet = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  metadata?: string;
  labels: InventoryUnitLabelSheetUnit[];
};

type InventoryUnitLabelSheetModalProps = {
  open: boolean;
  sheet: InventoryUnitLabelSheet | null;
  onClose: () => void;
};

export function InventoryUnitLabelSheetModal({
  open,
  sheet,
  onClose,
}: InventoryUnitLabelSheetModalProps) {
  if (!open || !sheet) {
    return null;
  }

  const printable = sheet.labels.every((label) => isCode128BValue(label.unitBarcode));
  const pagedLabels = Array.from(
    { length: Math.ceil(sheet.labels.length / LABELS_PER_PAGE) },
    (_, index) =>
      sheet.labels.slice(
        index * LABELS_PER_PAGE,
        (index + 1) * LABELS_PER_PAGE,
      ),
  );

  const handlePrint = () => {
    const documentMarkup = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(sheet.title)} Labels</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 8mm;
            }

            html, body {
              margin: 0;
              padding: 0;
              background: white;
              font-family: Arial, sans-serif;
            }

            .page {
              box-sizing: border-box;
              width: 194mm;
              min-height: ${PRINTABLE_PAGE_HEIGHT_MM}mm;
              max-height: ${PRINTABLE_PAGE_HEIGHT_MM}mm;
              margin: 0 auto;
              display: flex;
              flex-direction: column;
              align-items: flex-start;
              overflow: hidden;
              page-break-after: always;
              break-after: page;
            }

            .page:last-child {
              page-break-after: auto;
              break-after: auto;
            }

            .column {
              width: ${LABEL_WIDTH_MM}mm;
              min-height: ${PRINTABLE_PAGE_HEIGHT_MM}mm;
              margin: 0 auto;
              display: flex;
              flex-direction: column;
              align-items: stretch;
              gap: ${LABEL_GAP_MM}mm;
            }

            .label {
              box-sizing: border-box;
              width: ${LABEL_WIDTH_MM}mm;
              min-height: ${LABEL_HEIGHT_MM}mm;
              max-height: ${LABEL_HEIGHT_MM}mm;
              padding: 1.2mm 1.8mm 1mm;
              border: 0.35mm solid #0f172a;
              background: white;
            }

            .barcode {
              width: 100%;
              height: auto;
              display: block;
            }

            .barcode svg {
              width: 100%;
              height: auto;
              display: block;
            }

            .value {
              margin-top: 0.4mm;
              position: relative;
              display: block;
              width: 100%;
              font-family: monospace;
              font-size: 9px;
              font-weight: 700;
              letter-spacing: 0.18em;
              color: #000;
            }

            .value-main {
              display: block;
              text-align: center;
            }

            .value-sequence {
              position: absolute;
              right: 0;
              top: -0.15em;
              line-height: 1;
            }

            .value-sequence sup {
              font-size: 6px;
              line-height: 1;
              vertical-align: super;
              letter-spacing: 0.04em;
            }
          </style>
        </head>
        <body>
          ${pagedLabels
            .map(
              (pageLabels) => `
                <section class="page">
                  <div class="column">
                    ${pageLabels
                      .map(
                        (label) => `
                          <div class="label">
                            <div class="barcode">${buildCode128SvgMarkup(label.unitBarcode)}</div>
                            <div class="value">${buildBarcodeValueMarkup(label.unitBarcode, label.batchSequence)}</div>
                          </div>
                        `,
                      )
                      .join("")}
                  </div>
                </section>
              `,
            )
            .join("")}
        </body>
      </html>
    `;

    const existingFrame = document.getElementById(
      "wms-unit-label-print-frame",
    ) as HTMLIFrameElement | null;
    existingFrame?.remove();

    const iframe = document.createElement("iframe");
    iframe.id = "wms-unit-label-print-frame";
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";
    document.body.appendChild(iframe);

    const frameWindow = iframe.contentWindow;
    const frameDocument = frameWindow?.document;
    if (!frameWindow || !frameDocument) {
      iframe.remove();
      return;
    }

    const cleanup = () => {
      window.setTimeout(() => {
        iframe.remove();
      }, 300);
    };

    frameWindow.onafterprint = cleanup;
    frameDocument.open();
    frameDocument.write(documentMarkup);
    frameDocument.close();
    frameWindow.focus();

    window.setTimeout(() => {
      frameWindow.print();
    }, 250);
  };

  const renderLabelCard = (
    label: InventoryUnitLabelSheetUnit,
    mode: "screen" | "print",
  ) => (
    <div
      key={`${mode}-${label.id}`}
      className={
        mode === "print"
          ? "wms-unit-label-print-card"
          : "rounded-[18px] border border-slate-200 bg-white p-3 shadow-sm"
      }
    >
      <div className={mode === "print" ? "hidden" : "flex items-start justify-between gap-3"}>
        <div className="min-w-0">
          <div className="truncate text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            {label.sku}
          </div>
          <div className="mt-1 line-clamp-2 text-[13px] font-semibold leading-4 text-slate-950">
            {label.productName}
          </div>
          <div className="mt-1 truncate text-[11px] text-slate-500">
            {label.variationName || "Default variation"}
          </div>
        </div>
        <div className="rounded-full border border-orange-200 bg-orange-50 px-2 py-1 text-[10px] font-semibold tracking-[0.12em] text-orange-700">
          #{label.batchSequence}
        </div>
      </div>

      <div
        className={
          mode === "print"
            ? "h-full rounded-none border-0 bg-white px-0 py-0"
            : "mt-3 rounded-[14px] border border-slate-200 bg-slate-50 px-2.5 py-2"
        }
      >
        {isCode128BValue(label.unitBarcode) ? (
          <WmsCode128Barcode
            value={label.unitBarcode}
            className="h-auto w-full"
            moduleWidth={1.15}
            height={PRINT_BARCODE_HEIGHT}
          />
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-2 py-2 text-[11px] text-amber-800">
            Barcode preview unavailable
          </div>
        )}
        <div
          className={
            mode === "print"
              ? "relative mt-[1mm] block w-full font-mono text-[9px] font-semibold tracking-[0.18em] text-black"
              : "relative mt-1.5 block w-full font-mono text-[10px] font-semibold tracking-[0.22em] text-slate-700"
          }
        >
          <span className="block text-center">{label.unitBarcode}</span>
          <span
            className={
              mode === "print"
                ? "absolute right-0 top-0 text-[6px] tracking-[0.04em]"
                : "absolute right-0 top-0 text-[7px] tracking-[0.04em]"
            }
          >
            <sup>{label.batchSequence}</sup>
          </span>
        </div>
      </div>

      <div className={mode === "print" ? "hidden" : "mt-3 grid grid-cols-2 gap-2 text-[10px] text-slate-600"}>
        <div>
          <div className="font-semibold uppercase tracking-[0.14em] text-slate-500">
            Serial
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-slate-900">
            {label.serialNo}
          </div>
        </div>
        <div>
          <div className="font-semibold uppercase tracking-[0.14em] text-slate-500">
            Batch
          </div>
          <div className="mt-0.5 truncate text-[11px] text-slate-900">
            {label.lotCode}
          </div>
        </div>
        <div>
          <div className="font-semibold uppercase tracking-[0.14em] text-slate-500">
            Location
          </div>
          <div className="mt-0.5 truncate text-[11px] text-slate-900">
            {label.locationLabel}
          </div>
        </div>
        <div>
          <div className="font-semibold uppercase tracking-[0.14em] text-slate-500">
            Source
          </div>
          <div className="mt-0.5 truncate text-[11px] text-slate-900">
            {label.sourceLabel}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 8mm;
        }

        @media print {
          html,
          body {
            margin: 0;
            padding: 0;
            background: white;
          }

          .wms-unit-label-screen-shell {
            display: none !important;
          }

          #wms-unit-label-print-root {
            display: block !important;
          }

          .wms-unit-label-print-page {
            box-sizing: border-box;
            width: 194mm;
            min-height: ${PRINTABLE_PAGE_HEIGHT_MM}mm;
            max-height: ${PRINTABLE_PAGE_HEIGHT_MM}mm;
            padding: 0;
            margin: 0 auto;
            display: flex;
            justify-content: flex-start;
            align-items: flex-start;
            flex-direction: column;
            page-break-after: always;
            break-after: page;
            overflow: hidden;
          }

          .wms-unit-label-print-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }

          .wms-unit-label-print-column {
            width: ${LABEL_WIDTH_MM}mm;
            min-height: ${PRINTABLE_PAGE_HEIGHT_MM}mm;
            display: flex;
            flex-direction: column;
            align-items: stretch;
            justify-content: flex-start;
            gap: ${LABEL_GAP_MM}mm;
            margin: 0 auto;
          }

          .wms-unit-label-print-card {
            width: ${LABEL_WIDTH_MM}mm;
            min-height: ${LABEL_HEIGHT_MM}mm;
            max-height: ${LABEL_HEIGHT_MM}mm;
            break-inside: avoid;
            page-break-inside: avoid;
            box-sizing: border-box;
            padding: 1.8mm 2mm 1.4mm;
            border: 0.35mm solid #0f172a;
            border-radius: 0;
            background: white;
          }
        }

        @media screen {
          #wms-unit-label-print-root {
            display: none;
          }
        }
      `}</style>

      <div
        className="wms-unit-label-screen-shell fixed inset-0 z-[70]"
        aria-modal="true"
        role="dialog"
      >
        <div
          className="absolute inset-0 bg-slate-950/45 backdrop-blur-[3px] print:hidden"
          onClick={onClose}
        />
        <div className="absolute inset-0 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
          <div className="mx-auto flex min-h-full max-w-6xl items-center justify-center">
            <div className="flex w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl print:max-w-none print:rounded-none print:border-0 print:shadow-none">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50/80 px-6 py-4 print:hidden">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
                    {sheet.eyebrow}
                  </div>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
                    {sheet.title}
                  </h2>
                  {sheet.subtitle ? (
                    <p className="mt-1 text-sm text-slate-600">{sheet.subtitle}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:border-orange-200 hover:text-orange-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="border-b border-slate-200 bg-[linear-gradient(135deg,rgba(249,115,22,0.08),rgba(255,255,255,1)_58%)] px-6 py-4 print:hidden">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                    <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 font-semibold text-orange-700">
                      {sheet.labels.length} labels
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                      {LABELS_PER_PAGE} per page
                    </span>
                    {sheet.metadata ? (
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                        {sheet.metadata}
                      </span>
                    ) : null}
                  </div>
                  {!printable ? (
                    <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm text-amber-800">
                      Some unit barcodes are not printable unit-label values.
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="bg-white p-6 print:p-0">
                <div
                  id="wms-unit-label-sheet"
                  className="mx-auto w-full max-w-[960px] print:max-w-none"
                >
                  <div className="space-y-8">
                    {pagedLabels.map((pageLabels, pageIndex) => (
                      <section
                        key={`page-${pageIndex}`}
                        className="min-h-[720px] rounded-[24px] border border-dashed border-slate-200 bg-slate-50/40 px-8 py-6"
                      >
                        <div className="mx-auto flex w-full max-w-[232px] flex-col items-stretch gap-3">
                          {pageLabels.map((label) => renderLabelCard(label, "screen"))}
                        </div>
                      </section>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-6 py-4 print:hidden">
                <div className="text-sm text-slate-500">
                  Print this sheet, cut each label, and patch it onto the received units.
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex items-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-950"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={handlePrint}
                    disabled={!printable}
                    className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Printer className="h-4 w-4" />
                    Print Batch
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="wms-unit-label-print-root">
        {pagedLabels.map((pageLabels, pageIndex) => (
          <section
            key={`print-page-${pageIndex}`}
            className="wms-unit-label-print-page"
          >
            <div className="wms-unit-label-print-column">
              {pageLabels.map((label) => renderLabelCard(label, "print"))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
