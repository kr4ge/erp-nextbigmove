'use client';

import { useEffect, useMemo, useState } from 'react';
import { Printer, RefreshCcw } from 'lucide-react';
import { WmsModal } from '../../_components/wms-modal';
import { WmsSearchableSelect } from '../../_components/wms-searchable-select';
import { InventoryUnitAdjustmentPanel } from './inventory-unit-adjustment-panel';
import type {
  CreateWmsInventoryAdjustmentInput,
  CreateWmsInventoryTransferInput,
  WmsInventoryMovementRecord,
  WmsInventoryTransferOptionsResponse,
  WmsInventoryUnitRecord,
} from '../_types/inventory';
import { formatInventoryStatusLabel } from '../_utils/inventory-status-presenters';
import { printUnitLabel } from '../_utils/print-unit-label';
import { normalizeBarcodeValue, renderCode128SvgMarkup } from '../../warehouses/_utils/code39-barcode';

type InventoryUnitModalProps = {
  open: boolean;
  unit: WmsInventoryUnitRecord | null;
  movements: WmsInventoryMovementRecord[];
  transferOptions: WmsInventoryTransferOptionsResponse | null;
  canPrintLabels: boolean;
  canTransferUnits: boolean;
  canAdjustUnits: boolean;
  isRecordingPrint: boolean;
  isLoadingMovements: boolean;
  isLoadingTransferOptions: boolean;
  isTransferringUnit: boolean;
  isAdjustingUnit: boolean;
  onRecordPrint: (unitId: string, action: 'PRINT' | 'REPRINT') => Promise<void>;
  onTransferUnit: (input: CreateWmsInventoryTransferInput) => Promise<void>;
  onAdjustUnit: (input: CreateWmsInventoryAdjustmentInput) => Promise<void>;
  onClose: () => void;
};

type UnitModalTab = 'overview' | 'movements' | 'transfer' | 'adjust';
type TransferMode = 'bin' | 'operational';

export function InventoryUnitModal({
  open,
  unit,
  movements,
  transferOptions,
  canPrintLabels,
  canTransferUnits,
  canAdjustUnits,
  isRecordingPrint,
  isLoadingMovements,
  isLoadingTransferOptions,
  isTransferringUnit,
  isAdjustingUnit,
  onRecordPrint,
  onTransferUnit,
  onAdjustUnit,
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
  }, [open, unit]);

  const barcodeValue = unit ? normalizeBarcodeValue(unit.barcode) : '';

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
        code: unit.code,
        barcodeValue,
        productName: unit.name,
        variationLabel: unit.variationDisplayId ? `Variation ${unit.variationDisplayId}` : `Variation ${unit.variationId}`,
        storeName: unit.store.name,
        warehouseCode: unit.warehouse.code,
        warehouseName: unit.warehouse.name,
        locationLabel: unit.currentLocation?.label ?? 'No location assigned',
        statusLabel: formatInventoryStatusLabel(unit.status),
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
      setActiveTab('movements');
    } catch (error) {
      setTransferError(error instanceof Error ? error.message : 'Unable to transfer unit');
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
              className="wms-pill-control inline-flex items-center gap-2 rounded-full border border-[#d7e0e7] bg-white px-4 font-medium text-[#1d4b61] transition hover:border-[#c6d4dd] hover:bg-[#f8fafb] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
            <button
              type="button"
              onClick={() => handlePrint('reprint')}
              disabled={!unit || isRecordingPrint}
              className="wms-pill-control inline-flex items-center gap-2 rounded-full bg-[#12384b] px-4 font-medium text-white transition hover:bg-[#0f3242] disabled:cursor-not-allowed disabled:opacity-60"
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
      description="Serialized unit identity, movement history, and location control."
      footer={footer}
    >
      {unit ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <TabButton
              active={activeTab === 'overview'}
              label="Overview"
              onClick={() => setActiveTab('overview')}
            />
            <TabButton
              active={activeTab === 'movements'}
              label="Movements"
              onClick={() => setActiveTab('movements')}
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

          {activeTab === 'overview' ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_240px]">
              <div className="rounded-[22px] border border-[#dce4ea] bg-[#fbfcfc] px-4 py-4">
                <div className="rounded-[16px] border border-[#d9e3ea] bg-white p-3">
                  <div
                    className="flex justify-center"
                    dangerouslySetInnerHTML={{ __html: barcodeMarkup }}
                  />
                </div>

                <div className="mt-3 rounded-[14px] border border-[#e1e8ee] bg-white px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7a8f9d]">Barcode Value</p>
                  <p className="mt-1 break-all text-[12px] font-medium text-[#12384b]">{barcodeValue}</p>
                </div>
              </div>

              <aside className="space-y-2.5">
                <MetaItem label="Product" value={unit.name} />
                <MetaItem label="Variation" value={unit.variationDisplayId ?? unit.variationId} />
                <MetaItem label="Product ID" value={unit.productCustomId ?? '—'} />
                <MetaItem label="Store" value={unit.store.name} />
                <MetaItem label="Warehouse" value={`${unit.warehouse.name} (${unit.warehouse.code})`} />
                <MetaItem label="Location" value={unit.currentLocation?.label ?? 'Not assigned'} />
                <MetaItem label="Status" value={formatInventoryStatusLabel(unit.status)} />
                <MetaItem
                  label="Label Prints"
                  value={`${unit.labelPrintCount}x${unit.lastLabelPrintedAt ? ` · Last ${formatDateTime(unit.lastLabelPrintedAt)}` : ''}`}
                />
                <MetaItem label="Source" value={unit.source?.label ?? unit.source?.type ?? '—'} />
              </aside>
            </div>
          ) : null}

          {activeTab === 'movements' ? (
            <div className="rounded-[18px] border border-[#dce4ea] bg-white">
              <div className="border-b border-[#e7edf2] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7b8e9c]">
                  Unit Movement History
                </p>
              </div>

              <div className="max-h-[420px] overflow-y-auto px-4 py-3">
                {isLoadingMovements ? (
                  <p className="py-8 text-center text-sm text-[#708492]">Loading movements…</p>
                ) : movements.length === 0 ? (
                  <p className="py-8 text-center text-sm text-[#708492]">No movement history yet.</p>
                ) : (
                  <div className="space-y-3">
                    {movements.map((movement) => (
                      <div key={movement.id} className="rounded-[14px] border border-[#e2e9ee] bg-[#fbfcfc] px-3.5 py-3">
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="text-[13px] font-semibold text-[#12384b]">
                              {formatMovementType(movement.movementType)}
                            </p>
                            <p className="mt-1 text-[12px] text-[#637786]">
                              {movement.fromLocation?.code ?? 'No source'} → {movement.toLocation?.code ?? 'No destination'}
                            </p>
                          </div>
                          <p className="text-[11px] text-[#7b8e9c]">{formatDateTime(movement.createdAt)}</p>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[#708492]">
                          {movement.fromStatusLabel || movement.toStatusLabel ? (
                            <span className="rounded-full border border-[#dce4ea] bg-white px-2.5 py-1">
                              {movement.fromStatusLabel ?? '—'} → {movement.toStatusLabel ?? '—'}
                            </span>
                          ) : null}
                          {movement.referenceCode ? (
                            <span className="rounded-full border border-[#dce4ea] bg-white px-2.5 py-1">
                              {movement.referenceCode}
                            </span>
                          ) : null}
                          {movement.actor?.name ? (
                            <span className="rounded-full border border-[#dce4ea] bg-white px-2.5 py-1">
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
          ) : null}

          {activeTab === 'transfer' ? (
            <div className="rounded-[18px] border border-[#dce4ea] bg-white">
              <div className="border-b border-[#e7edf2] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7b8e9c]">
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
                    <div className="flex flex-wrap items-center gap-2">
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
                      className="w-full rounded-[14px] border border-[#d7e0e7] bg-[#fbfcfc] px-3 py-2.5 text-[13px] text-[#12384b] outline-none transition placeholder:text-[#94a3b8] focus:border-[#96b4c3]"
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
                        className="inline-flex h-10 items-center rounded-[12px] bg-[#12384b] px-4 text-[13px] font-semibold text-white transition hover:bg-[#0f3242] disabled:cursor-not-allowed disabled:opacity-50"
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
            <div className="rounded-[18px] border border-[#dce4ea] bg-white">
              <div className="border-b border-[#e7edf2] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7b8e9c]">
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
                    setActiveTab('movements');
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
    <div className="rounded-[14px] border border-[#dce4ea] bg-[#fbfcfc] px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7a8f9d]">{label}</p>
      <p className="mt-1 text-[13px] font-medium text-[#12384b]">{value}</p>
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
      className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
        active
          ? 'border-[#12384b] bg-[#12384b] text-white'
          : 'border-[#d7e0e7] bg-white text-[#4f6776] hover:border-[#c6d4dd] hover:text-[#12384b]'
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
