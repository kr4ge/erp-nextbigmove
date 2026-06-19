'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Printer, RefreshCcw } from 'lucide-react';
import { WmsModal } from '../../_components/wms-modal';
import { fetchWmsBinDetail } from '../_services/warehouses.service';
import type {
  UpdateWmsLocationInput,
  WmsLocationTreeNode,
  WmsWarehouseBinDetailResponse,
} from '../_types/warehouse';
import { normalizeBarcodeValue, renderCode128SvgMarkup } from '../_utils/code39-barcode';
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
  isSavingCapacity: boolean;
  onClose: () => void;
  onUpdateCapacity: (id: string, input: UpdateWmsLocationInput) => Promise<void>;
};

type BinDetailTab = 'overview' | 'units' | 'label';

const TAB_OPTIONS: Array<{ value: BinDetailTab; label: string }> = [
  { value: 'overview', label: 'Overview' },
  { value: 'units', label: 'Units' },
  { value: 'label', label: 'Label' },
];

export function BinSerializationModal({
  open,
  target,
  isSavingCapacity,
  onClose,
  onUpdateCapacity,
}: BinSerializationModalProps) {
  const [activeTab, setActiveTab] = useState<BinDetailTab>('overview');
  const [printError, setPrintError] = useState<string | null>(null);
  const [lastPrintAction, setLastPrintAction] = useState<'print' | 'reprint' | null>(null);
  const [capacityDraft, setCapacityDraft] = useState('');
  const [capacityError, setCapacityError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setActiveTab('overview');
    setPrintError(null);
    setLastPrintAction(null);
    setCapacityError(null);
  }, [open, target?.bin.id]);

  const detailQuery = useQuery({
    queryKey: ['wms-bin-detail', target?.bin.id ?? 'none'],
    queryFn: () => fetchWmsBinDetail(target!.bin.id),
    enabled: open && Boolean(target?.bin.id),
  });

  const detail = detailQuery.data ?? null;
  const barcodeValue = normalizeBarcodeValue(detail?.bin.barcode ?? target?.bin.barcode ?? '');
  const barcodeMarkup = useMemo(() => {
    if (!barcodeValue) {
      return '';
    }

    return renderCode128SvgMarkup(barcodeValue, {
      height: 112,
      moduleWidth: 2,
      quietZone: 24,
      textSize: 16,
    });
  }, [barcodeValue]);

  const capacity = detail?.bin.capacity ?? target?.bin.capacity ?? null;
  const occupiedUnits = detail?.bin.occupiedUnits ?? 0;
  const availableUnits =
    detail?.bin.availableUnits ?? (capacity === null ? null : Math.max(capacity - occupiedUnits, 0));

  useEffect(() => {
    if (!open) {
      return;
    }

    setCapacityDraft(capacity === null ? '' : String(capacity));
  }, [capacity, open, target?.bin.id]);

  const canSaveCapacity =
    capacityDraft.trim().length > 0
    && Number.isFinite(Number(capacityDraft))
    && Number(capacityDraft) >= occupiedUnits
    && Number(capacityDraft) !== capacity
    && !isSavingCapacity;

  const handleSaveCapacity = async () => {
    if (!target) {
      return;
    }

    const nextCapacity = Number(capacityDraft);
    if (!Number.isFinite(nextCapacity) || nextCapacity < 1) {
      setCapacityError('Slot capacity must be at least 1 unit.');
      return;
    }

    if (nextCapacity < occupiedUnits) {
      setCapacityError(`Slot capacity cannot be lower than ${occupiedUnits} occupied unit${occupiedUnits === 1 ? '' : 's'}.`);
      return;
    }

    try {
      setCapacityError(null);
      await onUpdateCapacity(target.bin.id, { capacity: nextCapacity });
      await detailQuery.refetch();
    } catch {
      // The shared warehouse controller already raises the banner with the API error.
    }
  };

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
        barcodeValue,
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
          : 'Print or reprint the slot label when needed.'}
      </div>

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => handlePrint('print')}
          disabled={!target}
          className="btn btn-md btn-outline btn-icon"
        >
          <Printer className="h-4 w-4" />
          Print
        </button>
        <button
          type="button"
          onClick={() => handlePrint('reprint')}
          disabled={!target}
          className="btn btn-md btn-primary btn-icon"
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
      title={detail?.bin.code ? `Slot ${detail.bin.code}` : target ? `Slot ${target.bin.code}` : 'Slot'}
      footer={footer}
    >
      {target ? (
        <div className="space-y-3">
          <div className="overflow-x-auto">
            <nav className="flex min-w-max gap-6 border-b border-slate-200">
              {TAB_OPTIONS.map((tab) => (
                <TabButton
                  key={tab.value}
                  active={activeTab === tab.value}
                  label={tab.label}
                  onClick={() => setActiveTab(tab.value)}
                />
              ))}
            </nav>
          </div>

          {activeTab === 'label' ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
              <div className="card">
                <div className="rounded-[14px] border border-[#d9e3ea] bg-white p-3">
                  <div
                    className="flex justify-center"
                    dangerouslySetInnerHTML={{ __html: barcodeMarkup }}
                  />
                </div>

                <div className="card mt-3">
                  <p className="card-label">
                    Barcode Value
                  </p>
                  <p className="card-value text-base">{barcodeValue}</p>
                </div>
              </div>

              <div className="space-y-2.5">
                <MetaItem label="Warehouse" value={`${target.warehouseName} (${target.warehouseCode})`} />
                <MetaItem label="Section" value={target.section.code} />
                <MetaItem label="Rack" value={target.rack.code} />
                <MetaItem label="Slot" value={target.bin.code} />
                <MetaItem label="Capacity" value={capacity === null ? 'Not set' : `${capacity} units`} />
              </div>
            </div>
          ) : detailQuery.isLoading ? (
            <div className="flex h-[260px] items-center justify-center text-sm text-[#718797]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading slot details…
            </div>
          ) : detailQuery.isError ? (
            <div className="rounded-[14px] border border-rose-200 bg-rose-50 px-3 py-2.5 text-[12px] text-rose-700">
              Unable to load this slot right now.
            </div>
          ) : detail ? (
            activeTab === 'overview' ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <SummaryTile label="Occupied" value={`${occupiedUnits}`} hint="Serialized units in this slot" />
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
                  <MetaItem label="Slot" value={`${detail.bin.code} · ${detail.bin.name}`} />
                </div>

                <div className="rounded-[18px] border border-[#dce4ea] bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#6c8190]">Slot Capacity</p>
                      <p className="mt-1 text-sm text-[#637786]">Update how many serialized units this slot can hold.</p>
                      <input
                        type="number"
                        min={Math.max(1, occupiedUnits)}
                        max={1000000}
                        value={capacityDraft}
                        onChange={(event) => {
                          setCapacityDraft(event.target.value);
                          setCapacityError(null);
                        }}
                        className="input mt-3 w-full sm:max-w-[220px]"
                        placeholder="Capacity"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={!canSaveCapacity}
                      onClick={() => {
                        void handleSaveCapacity();
                      }}
                      className="btn btn-md btn-primary sm:min-w-[150px] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSavingCapacity ? 'Saving...' : 'Update capacity'}
                    </button>
                  </div>

                  {capacityError ? (
                    <p className="mt-2 text-sm text-rose-700">{capacityError}</p>
                  ) : (
                    <p className="mt-2 text-xs text-[#637786]">
                      Minimum allowed right now: {Math.max(1, occupiedUnits)} unit{Math.max(1, occupiedUnits) === 1 ? '' : 's'}.
                    </p>
                  )}
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
    <div className="card">
      <p className="card-label">{label}</p>
      <p className="card-value text-base">{value}</p>
      <p className="mt-1 text-[12px] text-[#637786]">{hint}</p>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <p className="card-label">{label}</p>
      <p className="card-value text-base">{value}</p>
    </div>
  );
}

function TabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap border-b-2 pb-3 text-sm font-semibold transition-colors ${
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-slate-600 hover:text-slate-900'
      }`}
    >
      {label}
    </button>
  );
}

function BinUnitsTable({
  units,
}: {
  units: WmsWarehouseBinDetailResponse['units'];
}) {
  if (!units.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[#d7e0e7] bg-[#fbfcfc] px-5 py-10 text-center text-sm text-[#637786]">
        No serialized units are currently stored in this slot.
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
              <tr key={unit.id} className="text-[13px] text-primary">
                <BodyCell>
                  <div className="min-w-[160px]">
                    <p className="font-semibold text-primary">{unit.code}</p>
                    <p className="mt-1 text-[11px] text-[#7c8f9b]">{unit.barcode}</p>
                  </div>
                </BodyCell>
                <BodyCell>
                  <div className="min-w-[180px]">
                    <p className="font-semibold text-primary">{unit.productName}</p>
                    <p className="mt-1 text-[11px] text-[#7c8f9b]">{unit.productCustomId ?? 'No SKU'}</p>
                  </div>
                </BodyCell>
                <BodyCell>
                  <div className="min-w-[150px]">
                    <p className="font-medium text-primary">{unit.receivingBatch?.code ?? unit.sourceRefLabel ?? 'Manual'}</p>
                    <p className="mt-1 text-[11px] text-[#7c8f9b]">{unit.sourceRefLabel ?? 'No source label'}</p>
                  </div>
                </BodyCell>
                <BodyCell>
                  <span className="inline-flex rounded-full border border-[#dce4ea] bg-[#fbfcfc] px-2 py-0.5 text-[10.5px] font-semibold text-primary">
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
