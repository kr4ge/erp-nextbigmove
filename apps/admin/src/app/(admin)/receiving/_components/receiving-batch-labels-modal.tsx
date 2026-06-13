'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Printer } from 'lucide-react';
import { WmsModal } from '../../_components/wms-modal';
import type { WmsReceivingBatchLabels } from '../_types/receiving';
import { printReceivingBatchLabels } from '../_utils/print-receiving-batch-labels';
import {
  isCode128CCompatible,
  normalizeBarcodeValue,
  renderCode128CSvgMarkup,
} from '../../warehouses/_utils/code39-barcode';

const LABEL_PREVIEW_PAGE_SIZE = 24;

type ReceivingBatchLabelsModalProps = {
  open: boolean;
  isLoading: boolean;
  isRecordingPrint: boolean;
  batch: WmsReceivingBatchLabels | null;
  errorMessage?: string | null;
  canPrintLabels?: boolean;
  canOpenTransfer?: boolean;
  onRecordPrint: (batchId: string, action: 'PRINT' | 'REPRINT') => Promise<void>;
  onOpenTransfer?: (batchId: string) => void;
  onClose: () => void;
};

export function ReceivingBatchLabelsModal({
  open,
  isLoading,
  isRecordingPrint,
  batch,
  errorMessage = null,
  canPrintLabels = true,
  canOpenTransfer = true,
  onRecordPrint,
  onOpenTransfer,
  onClose,
}: ReceivingBatchLabelsModalProps) {
  const [printError, setPrintError] = useState<string | null>(null);
  const [didPrintInSession, setDidPrintInSession] = useState(false);
  const [previewPage, setPreviewPage] = useState(1);

  const transferEnabled = Boolean(batch && batch.units.length > 0 && (batch.labelPrintCount > 0 || didPrintInSession));
  const totalPreviewPages = Math.max(1, Math.ceil((batch?.units.length ?? 0) / LABEL_PREVIEW_PAGE_SIZE));
  const previewStartIndex = (previewPage - 1) * LABEL_PREVIEW_PAGE_SIZE;
  const previewEndIndex = previewStartIndex + LABEL_PREVIEW_PAGE_SIZE;
  const previewUnits = useMemo(
    () => batch?.units.slice(previewStartIndex, previewEndIndex) ?? [],
    [batch?.units, previewEndIndex, previewStartIndex],
  );

  const unitsWithMarkup = useMemo(
    () =>
      previewUnits.map((unit, index) => ({
        ...unit,
        barcodeValue: normalizeBarcodeValue(unit.barcode),
        sequence: previewStartIndex + index + 1,
        sequenceLabel: String(previewStartIndex + index + 1).padStart(2, '0'),
        barcodeMarkup: isCode128CCompatible(unit.barcode)
          ? renderCode128CSvgMarkup(unit.barcode, {
              height: 30,
              moduleWidth: 1,
              quietZone: 10,
              textSize: 8,
            })
          : '',
      })),
    [previewStartIndex, previewUnits],
  );

  useEffect(() => {
    if (!open) {
      setDidPrintInSession(false);
    }
  }, [open]);

  useEffect(() => {
    setDidPrintInSession(false);
    setPreviewPage(1);
  }, [batch?.id]);

  useEffect(() => {
    if (previewPage <= totalPreviewPages) {
      return;
    }

    setPreviewPage(totalPreviewPages);
  }, [previewPage, totalPreviewPages]);

  const handlePrintBatch = async () => {
    if (!batch || !canPrintLabels) {
      return;
    }

    try {
      setPrintError(null);
      const action: 'PRINT' | 'REPRINT' = batch.labelPrintCount > 0 ? 'REPRINT' : 'PRINT';
      printReceivingBatchLabels({
        batchCode: batch.code,
        units: batch.units.map((unit) => ({
          barcode: normalizeBarcodeValue(unit.barcode),
        })),
      });
      await onRecordPrint(batch.id, action);
      setDidPrintInSession(true);
    } catch (error) {
      setPrintError(error instanceof Error ? error.message : 'Unable to open print dialog');
    }
  };

  if (!open) {
    return null;
  }

  return (
    <WmsModal
      open={open}
      title={batch ? batch.code : 'Batch labels'}
      description={
        batch
          ? `${batch.sourceRequestId || batch.requestTitle || 'Manual'} · ${batch.units.length} labels`
          : 'Loading receiving batch labels'
      }
      onClose={onClose}
      footer={(
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] text-[#5f7483]">
            {batch
              ? `${batch.units.length} labels · Printed ${batch.labelPrintCount}x${batch.lastLabelPrintedAt ? ` · Last ${formatDateTime(batch.lastLabelPrintedAt)}` : ''}`
              : 'Preparing labels'}
          </p>
          <div className="flex items-center gap-2">
            {batch && onOpenTransfer && canOpenTransfer ? (
              <button
                type="button"
                onClick={() => onOpenTransfer(batch.id)}
                disabled={isLoading || isRecordingPrint || !transferEnabled}
                className="btn btn-md btn-outline"
              >
                Open Transfer
              </button>
            ) : null}
            {canPrintLabels ? (
              <button
                type="button"
                onClick={handlePrintBatch}
                disabled={isLoading || isRecordingPrint || !batch || batch.units.length === 0}
                className="btn btn-md btn-primary btn-icon"
              >
                <Printer className="h-4 w-4" />
                {batch?.labelPrintCount ? 'Reprint Batch' : 'Print Batch'}
              </button>
            ) : (
              <span className="inline-flex h-9 items-center rounded-[12px] border border-[#d7e0e7] bg-white px-4 text-[12px] font-semibold text-[#7b8e9c]">
                Print permission required
              </span>
            )}
          </div>
        </div>
      )}
    >
      {isLoading || !batch ? (
        errorMessage && !isLoading ? (
          <div className="rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : (
          <div className="flex h-56 items-center justify-center text-sm text-[#718797]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading label sheet…
          </div>
        )
      ) : (
        <div className="space-y-3">
          <div className="card">
            <p className="card-label">Batch Context</p>
            <p className="mt-1 text-sm font-semibold text-primary">
              {batch.sourceRequestId || batch.requestTitle || 'Manual request'}
            </p>
            <p className="mt-1 text-[12px] text-[#5f7483]">
              {batch.warehouse.code} · {batch.warehouse.name}
              {batch.stagingLocation ? ` · ${batch.stagingLocation.code} · ${batch.stagingLocation.name}` : ''}
            </p>
          </div>

          {batch.units.length > LABEL_PREVIEW_PAGE_SIZE ? (
            <div className="flex items-center justify-between gap-3 rounded-[16px] border border-[#dce4ea] bg-white px-3 py-2">
              <p className="text-[12px] text-[#5f7483]">
                Showing {previewStartIndex + 1}-{Math.min(previewEndIndex, batch.units.length)} of {batch.units.length} labels
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewPage((current) => Math.max(1, current - 1))}
                  disabled={previewPage === 1}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#d7e0e7] bg-white text-[#4d6677] transition hover:border-[#c6d4dd] hover:text-primary disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="rounded-full border border-[#dce4ea] bg-[#fbfcfc] px-3 py-1 text-[11px] font-semibold text-primary">
                  {previewPage} / {totalPreviewPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewPage((current) => Math.min(totalPreviewPages, current + 1))}
                  disabled={previewPage === totalPreviewPages}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#d7e0e7] bg-white text-[#4d6677] transition hover:border-[#c6d4dd] hover:text-primary disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}

          <div className="max-h-[560px] space-y-3 overflow-y-auto rounded-2xl border border-[#dce4ea] bg-[#fbfcfc] p-3">
            {unitsWithMarkup.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-[#7b8e9c]">
                No units in this batch yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {unitsWithMarkup.map((unit) => (
                  <article
                    key={unit.id}
                    className="card"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-primary">{unit.productName}</p>
                        {unit.productCustomId ? (
                          <p className="mt-0.5 text-[11px] text-[#6a7f8e]">SKU {unit.productCustomId}</p>
                        ) : null}
                      </div>
                      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-primary/60 px-1.5 text-[11px] font-semibold text-primary">
                        {unit.sequence}
                      </span>
                    </div>

                    <div className="relative mt-2 rounded-[8px] border border-[#0f3040] bg-white p-1">
                      {unit.barcodeMarkup ? (
                        <div
                          className="flex items-center justify-center"
                          dangerouslySetInnerHTML={{ __html: unit.barcodeMarkup }}
                        />
                      ) : (
                        <p className="py-3 text-center text-[11px] font-semibold text-amber-700">
                          Run compact barcode migration for Code128C labels.
                        </p>
                      )}
                      <p className="mt-1 text-center text-[11px] font-semibold leading-none text-[#0f3040]">
                        {unit.barcodeValue}
                        <sub className="ml-1 text-[8px] leading-none">{unit.sequenceLabel}</sub>
                      </p>
                    </div>

                    <div className="mt-2 space-y-1 text-[11px] leading-4 text-[#3f5f72]">
                      <p className="font-semibold text-primary">{unit.code}</p>
                      <p>
                        {batch.warehouse.code} · {batch.warehouse.name}
                        {batch.stagingLocation ? ` · ${batch.stagingLocation.code} · ${batch.stagingLocation.name}` : ''}
                      </p>
                      <p>
                        Location:{' '}
                        {unit.currentLocation
                          ? `${unit.currentLocation.code} · ${unit.currentLocation.name}`
                          : batch.stagingLocation
                            ? `${batch.stagingLocation.code} · ${batch.stagingLocation.name}`
                            : 'Unassigned'}
                      </p>
                      <p>Status: {formatStatusLabel(unit.status)}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          {printError ? (
            <div className="rounded-[14px] border border-rose-200 bg-rose-50 px-3 py-2.5 text-[12px] text-rose-700">
              {printError}
            </div>
          ) : null}
        </div>
      )}
    </WmsModal>
  );
}

function formatStatusLabel(status: string) {
  return status
    .split('_')
    .map((token) => token.charAt(0) + token.slice(1).toLowerCase())
    .join(' ');
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
