"use client";

import { X, Printer } from "lucide-react";
import { WmsEan13Barcode } from "./wms-ean13-barcode";
import { isEan13Barcode } from "../_utils/wms-barcodes";

type WmsPrintLabelField = {
  label: string;
  value: string;
};

export type WmsPrintLabelDescriptor = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  barcode: string | null;
  fields: WmsPrintLabelField[];
};

type WmsPrintLabelModalProps = {
  open: boolean;
  label: WmsPrintLabelDescriptor | null;
  onClose: () => void;
};

export function WmsPrintLabelModal({
  open,
  label,
  onClose,
}: WmsPrintLabelModalProps) {
  if (!open || !label) {
    return null;
  }

  const printable = isEan13Barcode(label.barcode);

  return (
    <>
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }

          #wms-print-sheet,
          #wms-print-sheet * {
            visibility: visible;
          }

          #wms-print-sheet {
            position: absolute;
            inset: 0;
            width: 100%;
            margin: 0;
            padding: 0;
          }
        }
      `}</style>

      <div className="fixed inset-0 z-[60]" aria-modal="true" role="dialog">
        <div
          className="absolute inset-0 bg-slate-950/45 backdrop-blur-[3px] print:hidden"
          onClick={onClose}
        />
        <div className="absolute inset-0 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
          <div className="mx-auto flex min-h-full max-w-3xl items-center justify-center">
            <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl print:max-w-none print:rounded-none print:border-0 print:shadow-none">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50/80 px-6 py-4 print:hidden">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
                    Print Label
                  </div>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
                    {label.eyebrow}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:border-orange-200 hover:text-orange-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="bg-[linear-gradient(180deg,rgba(248,250,252,0.95),rgba(255,255,255,1))] p-6 print:bg-white print:p-0">
                <div
                  id="wms-print-sheet"
                  className="mx-auto w-full max-w-[520px] rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-8 print:shadow-none"
                >
                  <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(135deg,rgba(249,115,22,0.12),rgba(255,247,237,0.85)_28%,rgba(255,255,255,1)_64%)] p-5">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-600">
                      {label.eyebrow}
                    </div>
                    <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                      {label.title}
                    </div>
                    {label.subtitle ? (
                      <div className="mt-1 text-sm text-slate-600">
                        {label.subtitle}
                      </div>
                    ) : null}

                    <div className="mt-5 rounded-[22px] border border-slate-200 bg-white px-4 py-5">
                      {printable && label.barcode ? (
                        <>
                          <WmsEan13Barcode
                            value={label.barcode}
                            className="h-auto w-full"
                          />
                          <div className="mt-3 text-center font-mono text-sm font-semibold tracking-[0.28em] text-slate-700">
                            {label.barcode}
                          </div>
                        </>
                      ) : (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                          Barcode preview is available only for 13-digit WMS
                          labels.
                        </div>
                      )}
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {label.fields.map((field) => (
                        <div
                          key={field.label}
                          className="rounded-2xl border border-white/80 bg-white/85 px-3 py-3"
                        >
                          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                            {field.label}
                          </div>
                          <div className="mt-1 text-sm font-medium text-slate-900">
                            {field.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-6 py-4 print:hidden">
                <div className="text-sm text-slate-500">
                  Print and place this label on the product or warehouse bin.
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
                    onClick={() => window.print()}
                    disabled={!printable}
                    className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Printer className="h-4 w-4" />
                    Print Label
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
