'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Printer, RefreshCcw } from 'lucide-react';
import { WmsModal } from '../../_components/wms-modal';
import { fetchWmsBinDetail } from '../_services/warehouses.service';
import type { WmsLocationTreeNode, WmsWarehouseBinDetailResponse } from '../_types/warehouse';
import { renderCode39SvgMarkup } from '../_utils/code39-barcode';
import { printBinLabel } from '../_utils/print-bin-label';

export type BinSerializationTarget = {
  warehouseCode: string;
  warehouseName: string;
  section: WmsLocationTreeNode;
  rack: WmsLocationTreeNode;
  bin: WmsLocationTreeNode;
};

type BinSerializationModalProps = {
  open: boolean;
  target: BinSerializationTarget | null;
  onClose: () => void;
};

type BinDetailTab = 'overview' | 'units' | 'label';

const TAB_OPTIONS: Array<{ value: BinDetailTab; label: string }> = [
  { value: 'overview', label: 'Overview' },
  { value: 'units', label: 'Units' },
  { value: 'label', label: 'Label' },
];

export function BinSerializationModal({ open, target, onClose }: BinSerializationModalProps) {
  const [activeTab, setActiveTab] = useState<BinDetailTab>('overview');
  const [printError, setPrintError] = useState<string | null>(null);
  const [lastPrintAction, setLastPrintAction] = useState<'print' | 'reprint' | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setActiveTab('overview');
    setPrintError(null);
    setLastPrintAction(null);
  }, [open, target?.bin.id]);

  const detailQuery = useQuery({
    queryKey: ['wms-bin-detail', target?.bin.id ?? 'none'],
    queryFn: () => fetchWmsBinDetail(target!.bin.id),
    enabled: open && Boolean(target?.bin.id),
  });

  const detail = detailQuery.data ?? null;
  const barcodeValue = detail?.bin.barcode ?? target?.bin.barcode ?? '';
  const barcodeMarkup = useMemo(() => {
    if (!barcodeValue) {
      return '';
    }

    return renderCode39SvgMarkup(barcodeValue, {
      height: 96,
      narrowWidth: 2,
      wideWidth: 5,
      quietZone: 16,
      textSize: 14,
    });
  }, [barcodeValue]);

  const capacity = detail?.bin.capacity ?? target?.bin.capacity ?? null;
  const occupiedUnits = detail?.bin.occupiedUnits ?? 0;
  const availableUnits =
    detail?.bin.availableUnits ?? (capacity === null ? null : Math.max(capacity - occupiedUnits, 0));

  const handlePrint = (action: 'print' | 'reprint') => {
    if (!target) {
      return;
    }

    try {
      setPrintError(null);
      printBinLabel({
        warehouseCode: target.warehouseCode,
        warehouseName: target.warehouseName,
        sectionCode: target.section.code,
        rackCode: target.rack.code,
        binCode: target.bin.code,
        barcodeValue: target.bin.barcode,
      });
      setLastPrintAction(action);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to open print dialog';
      setPrintError(message);
    }
  };

  const footer = (
    <div className="flex items-center justify-between gap-3">
      <div className="text-xs text-[#637786]">
        {lastPrintAction
          ? `${lastPrintAction === 'print' ? 'Printed' : 'Reprinted'} label for ${target?.bin.code}`
          : 'Print or reprint the bin label when needed.'}
      </div>

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => handlePrint('print')}
          disabled={!target}
          className="wms-pill-control inline-flex items-center gap-2 rounded-full border border-[#d7e0e7] bg-white px-4 font-medium text-[#1d4b61] transition hover:border-[#c6d4dd] hover:bg-[#f8fafb] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Printer className="h-4 w-4" />
          Print
        </button>
        <button
          type="button"
          onClick={() => handlePrint('reprint')}
          disabled={!target}
          className="wms-pill-control inline-flex items-center gap-2 rounded-full bg-[#12384b] px-4 font-medium text-white transition hover:bg-[#0f3242] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCcw className="h-4 w-4" />
          Reprint
        </button>
      </div>
    </div>
  );

  return (
    <WmsModal
      open={open && !!target}
      onClose={onClose}
      title={detail?.bin.code ? `Bin ${detail.bin.code}` : target ? `Bin ${target.bin.code}` : 'Bin'}
      footer={footer}
    >
      {target ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 border-b border-[#e6edf1] pb-3">
            {TAB_OPTIONS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={`inline-flex rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                  activeTab === tab.value
                    ? 'border-[#12384b] bg-[#12384b] text-white'
                    : 'border-[#d7e0e7] bg-white text-[#4d6677] hover:border-[#c6d4dd] hover:bg-[#f8fafb]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'label' ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
              <div className="rounded-[18px] border border-[#dce4ea] bg-[#fbfcfc] px-4 py-4">
                <div className="rounded-[14px] border border-[#d9e3ea] bg-white p-3">
                  <div
                    className="flex justify-center"
                    dangerouslySetInnerHTML={{ __html: barcodeMarkup }}
                  />
                </div>

                <div className="mt-3 rounded-[14px] border border-[#e1e8ee] bg-white px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7a8f9d]">
                    Barcode Value
                  </p>
                  <p className="mt-1 break-all text-[12px] font-medium text-[#12384b]">{barcodeValue}</p>
                </div>
              </div>

              <div className="space-y-2.5">
                <MetaItem label="Warehouse" value={`${target.warehouseName} (${target.warehouseCode})`} />
                <MetaItem label="Section" value={target.section.code} />
                <MetaItem label="Rack" value={target.rack.code} />
                <MetaItem label="Bin" value={target.bin.code} />
                <MetaItem label="Capacity" value={capacity === null ? 'Not set' : `${capacity} units`} />
              </div>
            </div>
          ) : detailQuery.isLoading ? (
            <div className="flex h-[260px] items-center justify-center text-sm text-[#718797]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading bin details…
            </div>
          ) : detailQuery.isError ? (
            <div className="rounded-[14px] border border-rose-200 bg-rose-50 px-3 py-2.5 text-[12px] text-rose-700">
              Unable to load this bin right now.
            </div>
          ) : detail ? (
            activeTab === 'overview' ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <SummaryTile label="Occupied" value={`${occupiedUnits}`} hint="Serialized units in this bin" />
                  <SummaryTile
                    label="Available"
                    value={availableUnits === null ? 'N/A' : `${availableUnits}`}
                    hint="Remaining capacity"
                  />
                  <SummaryTile
                    label="Capacity"
                    value={capacity === null ? 'Not set' : `${capacity}`}
                    hint="Maximum serialized units"
                  />
                  <SummaryTile
                    label="Status"
                    value={detail.bin.isFull ? 'Full' : 'Available'}
                    hint={detail.bin.isFull ? 'No more space left' : 'Can accept more units'}
                  />
                </div>

                <div className="grid gap-3 xl:grid-cols-2">
                  <MetaItem label="Warehouse" value={`${detail.bin.warehouse.code} · ${detail.bin.warehouse.name}`} />
                  <MetaItem label="Section" value={`${detail.bin.section.code} · ${detail.bin.section.name}`} />
                  <MetaItem label="Rack" value={`${detail.bin.rack.code} · ${detail.bin.rack.name}`} />
                  <MetaItem label="Bin" value={`${detail.bin.code} · ${detail.bin.name}`} />
                </div>
              </div>
            ) : (
              <BinUnitsTable units={detail.units} />
            )
          ) : null}

          {printError ? (
            <div className="rounded-[14px] border border-rose-200 bg-rose-50 px-3 py-2.5 text-[12px] text-rose-700">
              {printError}
            </div>
          ) : null}
        </div>
      ) : null}
    </WmsModal>
  );
}

function SummaryTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-[14px] border border-[#dce4ea] bg-[#fbfcfc] px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7a8f9d]">{label}</p>
      <p className="mt-1.5 text-[1.1rem] font-semibold text-[#12384b]">{value}</p>
      <p className="mt-1 text-[12px] text-[#637786]">{hint}</p>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-[#dce4ea] bg-white px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7a8f9d]">{label}</p>
      <p className="mt-1 text-[13px] font-medium text-[#12384b]">{value}</p>
    </div>
  );
}

function BinUnitsTable({
  units,
}: {
  units: WmsWarehouseBinDetailResponse['units'];
}) {
  if (!units.length) {
    return (
      <div className="rounded-[16px] border border-dashed border-[#d7e0e7] bg-[#fbfcfc] px-5 py-10 text-center text-sm text-[#637786]">
        No serialized units are currently stored in this bin.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[18px] border border-[#dce4ea] bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-[720px] w-full border-separate border-spacing-0">
          <thead className="bg-[#eff4f7]">
            <tr>
              <HeaderCell>Unit</HeaderCell>
              <HeaderCell>Product</HeaderCell>
              <HeaderCell>Source</HeaderCell>
              <HeaderCell>Status</HeaderCell>
              <HeaderCell>Updated</HeaderCell>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eef2f5] bg-white">
            {units.map((unit) => (
              <tr key={unit.id} className="text-[13px] text-[#12384b]">
                <BodyCell>
                  <div className="min-w-[160px]">
                    <p className="font-semibold text-[#12384b]">{unit.code}</p>
                    <p className="mt-1 text-[11px] text-[#7c8f9b]">{unit.barcode}</p>
                  </div>
                </BodyCell>
                <BodyCell>
                  <div className="min-w-[180px]">
                    <p className="font-semibold text-[#12384b]">{unit.productName}</p>
                    <p className="mt-1 text-[11px] text-[#7c8f9b]">{unit.productCustomId ?? 'No SKU'}</p>
                  </div>
                </BodyCell>
                <BodyCell>
                  <div className="min-w-[150px]">
                    <p className="font-medium text-[#12384b]">{unit.receivingBatch?.code ?? unit.sourceRefLabel ?? 'Manual'}</p>
                    <p className="mt-1 text-[11px] text-[#7c8f9b]">{unit.sourceRefLabel ?? 'No source label'}</p>
                  </div>
                </BodyCell>
                <BodyCell>
                  <span className="inline-flex rounded-full border border-[#dce4ea] bg-[#fbfcfc] px-2 py-0.5 text-[10.5px] font-semibold text-[#12384b]">
                    {formatStatusLabel(unit.status)}
                  </span>
                </BodyCell>
                <BodyCell>{formatDateTime(unit.updatedAt)}</BodyCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HeaderCell({ children }: { children: string }) {
  return (
    <th className="px-3.5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7b8e9c]">
      {children}
    </th>
  );
}

function BodyCell({ children }: { children: ReactNode }) {
  return <td className="px-3.5 py-3 align-middle text-left">{children}</td>;
}

function formatStatusLabel(value: string) {
  return value
    .split('_')
    .map((segment) => segment.charAt(0) + segment.slice(1).toLowerCase())
    .join(' ');
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}
