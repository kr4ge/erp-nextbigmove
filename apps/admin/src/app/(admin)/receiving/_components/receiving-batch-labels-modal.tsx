'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Printer } from 'lucide-react';
import { WmsModal } from '../../_components/wms-modal';
import type { WmsReceivingBatchDetail } from '../_types/receiving';
import { printReceivingBatchLabels } from '../_utils/print-receiving-batch-labels';
import { normalizeBarcodeValue, renderCode128SvgMarkup } from '../../warehouses/_utils/code39-barcode';

type ReceivingBatchLabelsModalProps = {
  open: boolean;
  isLoading: boolean;
  isRecordingPrint: boolean;
  batch: WmsReceivingBatchDetail | null;
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
  canPrintLabels = true,
  canOpenTransfer = true,
  onRecordPrint,
  onOpenTransfer,
  onClose,
}: ReceivingBatchLabelsModalProps) {
  const [printError, setPrintError] = useState<string | null>(null);
  const [didPrintInSession, setDidPrintInSession] = useState(false);

  const transferEnabled = Boolean(batch && batch.units.length > 0 && (batch.labelPrintCount > 0 || didPrintInSession));

  const unitsWithMarkup = useMemo(
    () =>
      (batch?.units ?? []).map((unit, index) => ({
        ...unit,
        barcodeValue: normalizeBarcodeValue(unit.barcode),
        sequence: index + 1,
        barcodeMarkup: renderCode128SvgMarkup(unit.barcode, {
          height: 30,
          moduleWidth: 1,
          quietZone: 10,
          textSize: 8,
        }),
      })),
    [batch?.units],
  );

  useEffect(() => {
    if (!open) {
      setDidPrintInSession(false);
    }
  }, [open]);

  useEffect(() => {
    setDidPrintInSession(false);
  }, [batch?.id]);

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
                className="inline-flex h-9 items-center gap-2 rounded-[12px] border border-[#d7e0e7] bg-white px-4 text-[12px] font-semibold text-[#12384b] transition hover:border-[#c6d4dd] hover:bg-[#f8fafb] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Open Transfer
              </button>
            ) : null}
            {canPrintLabels ? (
              <button
                type="button"
                onClick={handlePrintBatch}
                disabled={isLoading || isRecordingPrint || !batch || batch.units.length === 0}
                className="inline-flex h-9 items-center gap-2 rounded-[12px] bg-[#f97316] px-4 text-[12px] font-semibold text-white transition hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-50"
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
        <div className="flex h-56 items-center justify-center text-sm text-[#718797]">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading label sheet…
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-[16px] border border-[#dce4ea] bg-white px-3.5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8193a0]">Batch Context</p>
            <p className="mt-1 text-sm font-semibold text-[#12384b]">
              {batch.sourceRequestId || batch.requestTitle || 'Manual request'}
            </p>
            <p className="mt-1 text-[12px] text-[#5f7483]">
              {batch.warehouse.code} · {batch.warehouse.name}
              {batch.stagingLocation ? ` · ${batch.stagingLocation.code} · ${batch.stagingLocation.name}` : ''}
            </p>
          </div>

          <div className="max-h-[560px] space-y-3 overflow-y-auto rounded-[20px] border border-[#dce4ea] bg-[#fbfcfc] p-3">
            {unitsWithMarkup.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-[#7b8e9c]">
                No units in this batch yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {unitsWithMarkup.map((unit) => (
                  <article
                    key={unit.id}
                    className="rounded-[12px] border border-[#dbe4ea] bg-white p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-[#12384b]">{unit.productName}</p>
                        {unit.productCustomId ? (
                          <p className="mt-0.5 text-[11px] text-[#6a7f8e]">SKU {unit.productCustomId}</p>
                        ) : null}
                      </div>
                      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-[#f5b27f] px-1.5 text-[11px] font-semibold text-[#ea580c]">
                        {unit.sequence}
                      </span>
                    </div>

                    <div className="relative mt-2 rounded-[8px] border border-[#0f3040] bg-white p-1">
                      <div
                        className="flex items-center justify-center"
                        dangerouslySetInnerHTML={{ __html: unit.barcodeMarkup }}
                      />
                      <span className="absolute bottom-1 right-1 text-[11px] font-semibold leading-none text-[#0f3040]">
                        {unit.sequence}
                      </span>
                    </div>

                    <div className="mt-2 space-y-1 text-[11px] leading-4 text-[#3f5f72]">
                      <p className="font-semibold text-[#12384b]">{unit.code}</p>
                      <p className="break-all">{unit.barcodeValue}</p>
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
