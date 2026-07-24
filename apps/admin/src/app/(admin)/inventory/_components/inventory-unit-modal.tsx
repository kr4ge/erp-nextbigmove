'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Archive, History, MoveHorizontal, Printer, RefreshCcw, Settings2 } from 'lucide-react';
import { WmsModal } from '../../_components/wms-modal';
import { WmsSearchableSelect } from '../../_components/wms-searchable-select';
import { InventoryUnitAdjustmentPanel } from './inventory-unit-adjustment-panel';
import type {
  CreateWmsInventoryAdjustmentInput,
  CreateWmsInventoryTransferInput,
  VoidWmsInventoryUnitInput,
  WmsInventoryMovementRecord,
  WmsInventoryTransferOptionsResponse,
  WmsInventoryUnitRecord,
} from '../_types/inventory';
import {
  formatInventoryExpirationDate,
  formatInventoryStatusLabel,
} from '../_utils/inventory-status-presenters';
import { InventoryExpirationBadge } from './inventory-expiration-badge';
import { printUnitLabel } from '../_utils/print-unit-label';
import {
  isCode128CCompatible,
  normalizeBarcodeValue,
  renderCode128CSvgMarkup,
} from '../../warehouses/_utils/code39-barcode';

type InventoryUnitModalProps = {
  open: boolean;
  unit: WmsInventoryUnitRecord | null;
  movements: WmsInventoryMovementRecord[];
  transferOptions: WmsInventoryTransferOptionsResponse | null;
  canPrintLabels: boolean;
  canTransferUnits: boolean;
  canAdjustUnits: boolean;
  canVoidUnits: boolean;
  isRecordingPrint: boolean;
  isLoadingMovements: boolean;
  isLoadingTransferOptions: boolean;
  isTransferringUnit: boolean;
  isAdjustingUnit: boolean;
  isVoidingUnit: boolean;
  onRecordPrint: (unitId: string, action: 'PRINT' | 'REPRINT') => Promise<void>;
  onTransferUnit: (input: CreateWmsInventoryTransferInput) => Promise<void>;
  onAdjustUnit: (input: CreateWmsInventoryAdjustmentInput) => Promise<void>;
  onVoidUnit: (input: VoidWmsInventoryUnitInput) => Promise<void>;
  onClose: () => void;
};

type UnitModalTab = 'overview' | 'transfer' | 'adjust';
type TransferMode = 'bin' | 'operational';

export function InventoryUnitModal({
  open,
  unit,
  movements,
  transferOptions,
  canPrintLabels,
  canTransferUnits,
  canAdjustUnits,
  canVoidUnits,
  isRecordingPrint,
  isLoadingMovements,
  isLoadingTransferOptions,
  isTransferringUnit,
  isAdjustingUnit,
  isVoidingUnit,
  onRecordPrint,
  onTransferUnit,
  onAdjustUnit,
  onVoidUnit,
  onClose,
}: InventoryUnitModalProps) {
  const [activeTab, setActiveTab] = useState<UnitModalTab>('overview');
  const [printError, setPrintError] = useState<string | null>(null);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [lastPrintAction, setLastPrintAction] = useState<'print' | 'reprint' | null>(null);
  const [transferMode, setTransferMode] = useState<TransferMode>('bin');
  const [sectionId, setSectionId] = useState('');
  const [rackId, setRackId] = useState('');
  const [binId, setBinId] = useState('');
  const [operationalLocationId, setOperationalLocationId] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [voidReason, setVoidReason] = useState('');
  const [voidNotes, setVoidNotes] = useState('');
  const [voidError, setVoidError] = useState<string | null>(null);
  const overviewStaticRef = useRef<HTMLDivElement | null>(null);
  const overviewAsideRef = useRef<HTMLElement | null>(null);
  const movementCardRef = useRef<HTMLDivElement | null>(null);
  const movementBodyRef = useRef<HTMLDivElement | null>(null);
  const [movementViewportHeight, setMovementViewportHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !unit) {
      return;
    }

    setActiveTab('overview');
    setPrintError(null);
    setTransferError(null);
    setTransferMode('bin');
    setSectionId('');
    setRackId('');
    setBinId('');
    setOperationalLocationId('');
    setTransferNotes('');
    setVoidReason('');
    setVoidNotes('');
    setVoidError(null);
  }, [open, unit]);

  const barcodeValue = unit ? normalizeBarcodeValue(unit.barcode) : '';

  const barcodeMarkup = useMemo(() => {
    if (!barcodeValue) {
      return '';
    }

    if (!isCode128CCompatible(barcodeValue)) {
      return '';
    }

    return renderCode128CSvgMarkup(barcodeValue, {
      height: 112,
      moduleWidth: 1.6,
      quietZone: 16,
      showText: true,
    });
  }, [barcodeValue]);

  const selectedSection = useMemo(
    () => transferOptions?.sections.find((section) => section.id === sectionId) ?? null,
    [sectionId, transferOptions?.sections],
  );
  const selectedRack = useMemo(
    () => selectedSection?.racks.find((rack) => rack.id === rackId) ?? null,
    [rackId, selectedSection],
  );
  const selectedBin = useMemo(
    () => selectedRack?.bins.find((bin) => bin.id === binId) ?? null,
    [binId, selectedRack],
  );

  useEffect(() => {
    if (!selectedSection?.racks.some((rack) => rack.id === rackId)) {
      setRackId('');
      setBinId('');
    }
  }, [rackId, selectedSection]);

  useEffect(() => {
    if (!selectedRack?.bins.some((bin) => bin.id === binId)) {
      setBinId('');
    }
  }, [binId, selectedRack]);

  useEffect(() => {
    if (!open || activeTab !== 'overview') {
      setMovementViewportHeight(null);
      return;
    }

    const syncMovementViewportHeight = () => {
      if (typeof window === 'undefined' || window.innerWidth < 1280) {
        setMovementViewportHeight(null);
        return;
      }

      const asideHeight = overviewAsideRef.current?.offsetHeight ?? 0;
      const staticHeight = overviewStaticRef.current?.offsetHeight ?? 0;
      const movementCardHeight = movementCardRef.current?.offsetHeight ?? 0;
      const movementBodyHeight = movementBodyRef.current?.offsetHeight ?? 0;
      const gapHeight = 12;
      const movementChromeHeight = movementCardHeight - movementBodyHeight;
      const availableHeight = asideHeight - staticHeight - gapHeight - movementChromeHeight;

      setMovementViewportHeight(availableHeight > 0 ? availableHeight : null);
    };

    syncMovementViewportHeight();

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => {
          syncMovementViewportHeight();
        });

    if (resizeObserver) {
      if (overviewStaticRef.current) {
        resizeObserver.observe(overviewStaticRef.current);
      }
      if (overviewAsideRef.current) {
        resizeObserver.observe(overviewAsideRef.current);
      }
      if (movementCardRef.current) {
        resizeObserver.observe(movementCardRef.current);
      }
    }

    window.addEventListener('resize', syncMovementViewportHeight);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', syncMovementViewportHeight);
    };
  }, [activeTab, movements.length, open]);

  const targetLocationId =
    transferMode === 'bin'
      ? binId || null
      : operationalLocationId || null;

  const handlePrint = async (action: 'print' | 'reprint') => {
    if (!unit || !canPrintLabels) {
      return;
    }

    try {
      setPrintError(null);
      printUnitLabel({
        barcodeValue,
        countLabel: 1,
      });
      await onRecordPrint(unit.id, action === 'print' ? 'PRINT' : 'REPRINT');
      setLastPrintAction(action);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to open print dialog';
      setPrintError(message);
    }
  };

  const handleTransfer = async () => {
    if (!unit || !targetLocationId) {
      return;
    }

    try {
      setTransferError(null);
      await onTransferUnit({
        unitIds: [unit.id],
        targetLocationId,
        notes: transferNotes.trim() || undefined,
      });
      setTransferNotes('');
      setOperationalLocationId('');
      setSectionId('');
      setRackId('');
      setBinId('');
      setActiveTab('overview');
    } catch (error) {
      setTransferError(error instanceof Error ? error.message : 'Unable to transfer unit');
    }
  };

  const handleVoid = async () => {
    if (!unit || !canVoidUnits || !voidReason.trim()) {
      return;
    }

    try {
      setVoidError(null);
      await onVoidUnit({
        unitId: unit.id,
        reason: voidReason.trim(),
        notes: voidNotes.trim() || undefined,
      });
      setVoidReason('');
      setVoidNotes('');
      setActiveTab('overview');
    } catch (error) {
      setVoidError(error instanceof Error ? error.message : 'Unable to void unit');
    }
  };

  const footer = (
    <div className="flex items-center justify-between gap-3">
      <div className="text-xs text-[#637786]">
        {lastPrintAction
          ? `${lastPrintAction === 'print' ? 'Printed' : 'Reprinted'} label for ${unit?.code}`
          : 'Ready to print unit label'}
      </div>

      <div className="flex items-center gap-2.5">
        {canPrintLabels ? (
          <>
            <button
              type="button"
              onClick={() => handlePrint('print')}
              disabled={!unit || isRecordingPrint}
              className="btn btn-md btn-outline btn-icon"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
            <button
              type="button"
              onClick={() => handlePrint('reprint')}
              disabled={!unit || isRecordingPrint}
              className="btn btn-md btn-primary btn-icon"
            >
              <RefreshCcw className="h-4 w-4" />
              Reprint
            </button>
          </>
        ) : (
          <span className="rounded-full border border-[#d7e0e7] bg-white px-4 py-2 text-[12px] font-medium text-[#7b8e9c]">
            Print permission required
          </span>
        )}
      </div>
    </div>
  );

  return (
    <WmsModal
      open={open && !!unit}
      onClose={onClose}
      title={unit ? unit.code : 'Unit details'}
      footer={footer}
    >
      {unit ? (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <div className="flex min-w-max gap-6 border-b border-slate-200">
              <TabButton
                active={activeTab === 'overview'}
                label="Overview"
                onClick={() => setActiveTab('overview')}
              />
              <TabButton
                active={activeTab === 'transfer'}
                label="Transfer"
                onClick={() => setActiveTab('transfer')}
              />
              <TabButton
                active={activeTab === 'adjust'}
                label="Adjust"
                onClick={() => setActiveTab('adjust')}
              />
            </div>
          </div>

          {activeTab === 'overview' ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_240px]">
              <div className="space-y-3">
                <div ref={overviewStaticRef} className="space-y-3">
                  <div className="card">
                  {barcodeMarkup ? (
                    <div
                      className="flex justify-center"
                      dangerouslySetInnerHTML={{ __html: barcodeMarkup }}
                    />
                  ) : (
                    <p className="py-8 text-center text-[12px] font-semibold text-amber-700">
                      Code128C needs a numeric even-length barcode. Run the compact barcode migration for legacy units.
                    </p>
                  )}
                </div>

                  <div className="card">
                  <p className="card-label">Barcode Value</p>
                  <p className="card-value text-base">
                    {barcodeValue}
                    <sub className="ml-1 text-[10px] leading-none">01</sub>
                  </p>
                  </div>
                </div>

                <div ref={movementCardRef} className="card">
                  <div className="flex items-center gap-2.5">
                    <History className="h-4 w-4 text-[#708492]" />
                    <p className="card-label">Unit Movement History</p>
                  </div>

                  <div
                    ref={movementBodyRef}
                    className="mt-3 overflow-y-auto"
                    style={movementViewportHeight ? { maxHeight: `${movementViewportHeight}px` } : { maxHeight: '420px' }}
                  >
                    {isLoadingMovements ? (
                      <p className="py-8 text-center text-sm text-[#708492]">Loading movements...</p>
                    ) : movements.length === 0 ? (
                      <p className="py-8 text-center text-sm text-[#708492]">No movement history yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {movements.map((movement) => (
                          <div key={movement.id} className="rounded-2xl border border-[#e2e9ee] bg-[#fbfcfc] px-3.5 py-3">
                            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                              <div>
                                <p className="text-[13px] font-semibold text-primary">
                                  {formatMovementType(movement.movementType)}
                                </p>
                                <p className="mt-1 text-[12px] text-[#637786]">
                                  {movement.fromLocation?.code ?? 'No source'} &rarr; {movement.toLocation?.code ?? 'No destination'}
                                </p>
                              </div>
                              <p className="text-[11px] text-[#7b8e9c]">{formatDateTime(movement.createdAt)}</p>
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[#708492]">
                              {movement.fromStatusLabel || movement.toStatusLabel ? (
                                <span className="pill pill-ghost">
                                  {movement.fromStatusLabel ?? '-'} &rarr; {movement.toStatusLabel ?? '-'}
                                </span>
                              ) : null}
                              {movement.referenceCode ? (
                                <span className="pill pill-ghost">
                                  {movement.referenceCode}
                                </span>
                              ) : null}
                              {movement.actor?.name ? (
                                <span className="pill pill-ghost">
                                  {movement.actor.name}
                                </span>
                              ) : null}
                            </div>

                            {movement.notes ? (
                              <p className="mt-2 text-[12px] text-[#637786]">{movement.notes}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <aside ref={overviewAsideRef} className="space-y-2.5">
                <MetaItem label="Product" value={unit.name} />
                <MetaItem label="Variation" value={unit.variationDisplayId ?? unit.variationId} />
                <MetaItem label="Product ID" value={unit.productCustomId ?? '—'} />
                <MetaItem label="Store" value={unit.store.name} />
                <MetaItem label="Warehouse" value={`${unit.warehouse.name} (${unit.warehouse.code})`} />
                <MetaItem label="Location" value={unit.currentLocation?.label ?? 'Not assigned'} />
                <div className="card">
                  <p className="card-label">Expiration</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <p className="text-[13px] font-medium text-primary">
                      {formatInventoryExpirationDate(unit.expirationDate)}
                    </p>
                    <InventoryExpirationBadge
                      expirationDate={unit.expirationDate}
                      status={unit.status}
                    />
                  </div>
                </div>
                {unit.expiredAt ? (
                  <MetaItem label="Expired at" value={formatDateTime(unit.expiredAt)} />
                ) : null}
                <MetaItem label="Status" value={formatInventoryStatusLabel(unit.status)} />
                <MetaItem
                  label="Label Prints"
                  value={`${unit.labelPrintCount}x${unit.lastLabelPrintedAt ? ` · Last ${formatDateTime(unit.lastLabelPrintedAt)}` : ''}`}
                />
                <MetaItem label="Source" value={unit.source?.label ?? unit.source?.type ?? '—'} />
                {unit.status === 'ARCHIVED' ? (
                  <div className="rounded-[18px] border border-[#d7e0e7] bg-[#fbfcfc] px-4 py-3">
                    <p className="card-label">Void</p>
                    <p className="mt-1 text-[12px] font-medium text-[#637786]">
                      This unit is already archived.
                    </p>
                  </div>
                ) : (
                  <div className="card border-rose-200 bg-rose-50/70 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Archive className="h-4 w-4 text-rose-700" />
                      <p className="text-[12px] font-bold uppercase tracking-[0.24em] text-rose-700">
                        Void Unit
                      </p>
                    </div>

                    <input
                      value={voidReason}
                      onChange={(event) => setVoidReason(event.target.value)}
                      placeholder="Reason required"
                      className="mt-3 w-full rounded-[12px] border border-rose-200 bg-white px-3 py-2 text-[12px] text-primary outline-none transition placeholder:text-rose-300 focus:border-rose-400"
                    />
                    <textarea
                      value={voidNotes}
                      onChange={(event) => setVoidNotes(event.target.value)}
                      rows={2}
                      placeholder="Optional notes"
                      className="mt-2 w-full rounded-[12px] border border-rose-200 bg-white px-3 py-2 text-[12px] text-primary outline-none transition placeholder:text-rose-300 focus:border-rose-400"
                    />

                    {voidError ? (
                      <div className="mt-2 rounded-[12px] border border-rose-200 bg-white px-3 py-2 text-[12px] text-rose-700">
                        {voidError}
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => void handleVoid()}
                      disabled={!canVoidUnits || !voidReason.trim() || isVoidingUnit}
                      className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-[12px] border border-rose-300 bg-white px-3 text-[12px] font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {canVoidUnits ? (isVoidingUnit ? 'Voiding…' : 'Void unit') : 'Void permission required'}
                    </button>
                  </div>
                )}
              </aside>
            </div>
          ) : null}

          {activeTab === 'transfer' ? (
            <div className="panel panel-content">
              <div className="panel-header">
                <MoveHorizontal className='panel-icon' />
                <p className="panel-title">
                  Internal Transfer
                </p>
              </div>

              <div className="space-y-4 px-4 py-4">
                {!canTransferUnits ? (
                  <InlineMutedBox message="Transfer permission required." />
                ) : !unit.currentLocation ? (
                  <InlineMutedBox message="This unit needs a current location before it can be transferred." />
                ) : isLoadingTransferOptions ? (
                  <InlineMutedBox message="Loading destination options…" />
                ) : transferOptions ? (
                  <>
                    <div className="overflow-x-auto">
                      <div className="flex min-w-max gap-6 border-b border-slate-200">
                        <TabButton
                          active={transferMode === 'bin'}
                          label="Bin"
                          onClick={() => setTransferMode('bin')}
                        />
                        <TabButton
                          active={transferMode === 'operational'}
                          label="Operational"
                          onClick={() => setTransferMode('operational')}
                        />
                      </div>
                    </div>

                    {transferMode === 'bin' ? (
                      <div className="grid gap-3 md:grid-cols-3">
                        <WmsSearchableSelect
                          label="Section"
                          value={sectionId}
                          onChange={(value) => setSectionId(value)}
                          options={transferOptions.sections.map((section) => ({
                            value: section.id,
                            label: section.label,
                            hint: section.racks.length,
                          }))}
                          placeholder="Search sections…"
                          allLabel="Select section"
                          clearable={false}
                        />

                        <WmsSearchableSelect
                          label="Rack"
                          value={rackId}
                          onChange={(value) => setRackId(value)}
                          options={(selectedSection?.racks ?? []).map((rack) => ({
                            value: rack.id,
                            label: rack.label,
                            hint: rack.bins.length,
                          }))}
                          placeholder="Search racks…"
                          allLabel="Select rack"
                          clearable={false}
                        />

                        <WmsSearchableSelect
                          label="Bin"
                          value={binId}
                          onChange={(value) => setBinId(value)}
                          options={(selectedRack?.bins ?? [])
                            .filter((bin) => bin.id !== unit.currentLocation?.id)
                            .map((bin) => ({
                              value: bin.id,
                              label: bin.label,
                              hint: bin.availableUnits ?? '∞',
                              disabled: bin.isFull,
                            }))}
                          placeholder="Search bins…"
                          allLabel="Select bin"
                          clearable={false}
                        />
                      </div>
                    ) : (
                      <WmsSearchableSelect
                        label="Destination"
                        value={operationalLocationId}
                        onChange={(value) => setOperationalLocationId(value)}
                        options={transferOptions.operationalLocations
                          .filter((location) => location.id !== unit.currentLocation?.id)
                          .map((location) => ({
                            value: location.id,
                            label: location.label,
                          }))}
                        placeholder="Search locations…"
                        allLabel="Select destination"
                        clearable={false}
                      />
                    )}

                    {transferMode === 'bin' && selectedBin ? (
                      <p className="text-[12px] text-[#637786]">
                        {selectedBin.availableUnits === null
                          ? 'Bin has no explicit capacity limit.'
                          : `${selectedBin.availableUnits} unit${selectedBin.availableUnits === 1 ? '' : 's'} available in ${selectedBin.code}.`}
                      </p>
                    ) : null}

                    <textarea
                      value={transferNotes}
                      onChange={(event) => setTransferNotes(event.target.value)}
                      rows={3}
                      placeholder="Optional transfer notes"
                      className="w-full rounded-[14px] border border-[#d7e0e7] bg-[#fbfcfc] px-3 py-2.5 text-[13px] text-primary outline-none transition placeholder:text-[#94a3b8] focus:border-[#96b4c3]"
                    />

                    {transferError ? (
                      <div className="rounded-[14px] border border-rose-200 bg-rose-50 px-3 py-2.5 text-[12px] text-rose-700">
                        {transferError}
                      </div>
                    ) : null}

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => void handleTransfer()}
                        disabled={!targetLocationId || isTransferringUnit}
                        className="inline-flex h-10 items-center rounded-[12px] bg-primary px-4 text-[13px] font-semibold text-white transition hover:bg-[#0f3242] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Transfer unit
                      </button>
                    </div>
                  </>
                ) : (
                  <InlineMutedBox message="Destination options are not available for this unit." />
                )}
              </div>
            </div>
          ) : null}

          {activeTab === 'adjust' ? (
            <div className="panel panel-content">
              <div className="panel-header">
                <Settings2 className='panel-icon' />
                <p className="panel-title">
                  Inventory Adjustment
                </p>
              </div>

              <div className="space-y-4 px-4 py-4">
                <InventoryUnitAdjustmentPanel
                  unit={unit}
                  transferOptions={transferOptions}
                  canAdjustUnits={canAdjustUnits}
                  isLoadingTransferOptions={isLoadingTransferOptions}
                  isAdjustingUnit={isAdjustingUnit}
                  onAdjustUnit={onAdjustUnit}
                  onSuccess={() => {
                    setActiveTab('overview');
                  }}
                />
              </div>
            </div>
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

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <p className="card-label">{label}</p>
      <p className="mt-1 text-[13px] font-medium text-primary">{value}</p>
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

function InlineMutedBox({ message }: { message: string }) {
  return (
    <div className="rounded-[14px] border border-[#dce4ea] bg-[#fbfcfc] px-3 py-3 text-[12px] text-[#637786]">
      {message}
    </div>
  );
}

function formatMovementType(value: WmsInventoryMovementRecord['movementType']) {
  return value
    .toLowerCase()
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
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
