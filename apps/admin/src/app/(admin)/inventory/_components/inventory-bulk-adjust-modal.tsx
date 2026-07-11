'use client';

import { Loader2, Settings2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { WmsModal } from '../../_components/wms-modal';
import { WmsSearchableSelect } from '../../_components/wms-searchable-select';
import type {
  CreateWmsInventoryAdjustmentInput,
  WmsInventoryTransferOptionsResponse,
  WmsInventoryUnitRecord,
} from '../_types/inventory';
import { formatInventoryStatusLabel } from '../_utils/inventory-status-presenters';

type InventoryBulkAdjustModalProps = {
  open: boolean;
  units: WmsInventoryUnitRecord[];
  transferOptions: WmsInventoryTransferOptionsResponse | null;
  canAdjustUnits: boolean;
  isLoadingTransferOptions: boolean;
  isSubmitting: boolean;
  onSubmit: (input: CreateWmsInventoryAdjustmentInput) => Promise<void>;
  onClose: () => void;
};

type AdjustableStatus = CreateWmsInventoryAdjustmentInput['targetStatus'];

const ADJUSTABLE_STATUS_OPTIONS: Array<{
  value: AdjustableStatus;
  label: string;
  hint: string;
}> = [
  { value: 'STAGED', label: 'Staged', hint: 'Move selected units into receiving staging.' },
  { value: 'PUTAWAY', label: 'Put Away', hint: 'Place selected units into a bin.' },
  {
    value: 'DEADSTOCK',
    label: 'Deadstock',
    hint: 'Keep selected units in a bin but classify them as deadstock.',
  },
  { value: 'RTS', label: 'RTS', hint: 'Mark selected units as verified returns pending final disposition.' },
  { value: 'DAMAGED', label: 'Damaged', hint: 'Move selected units into damage or quarantine.' },
  { value: 'LOST', label: 'Lost', hint: 'Mark selected units missing and remove them from active stock.' },
  { value: 'ARCHIVED', label: 'Archived', hint: 'Remove selected units from active stock.' },
];

export function InventoryBulkAdjustModal({
  open,
  units,
  transferOptions,
  canAdjustUnits,
  isLoadingTransferOptions,
  isSubmitting,
  onSubmit,
  onClose,
}: InventoryBulkAdjustModalProps) {
  const [targetStatus, setTargetStatus] = useState<AdjustableStatus>('STAGED');
  const [sectionId, setSectionId] = useState('');
  const [rackId, setRackId] = useState('');
  const [binId, setBinId] = useState('');
  const [operationalLocationId, setOperationalLocationId] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const warehouseIds = useMemo(
    () => Array.from(new Set(units.map((unit) => unit.warehouse.id))),
    [units],
  );
  const warehouseLabels = useMemo(
    () => Array.from(new Set(units.map((unit) => `${unit.warehouse.code} · ${unit.warehouse.name}`))),
    [units],
  );
  const sameWarehouse = warehouseIds.length <= 1;
  const requiresSameWarehouse = targetStatus !== 'ARCHIVED';
  const mixedWarehouseBlocked = requiresSameWarehouse && !sameWarehouse;

  const targetStatusMeta = ADJUSTABLE_STATUS_OPTIONS.find((option) => option.value === targetStatus);
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
    if (!open) {
      return;
    }

    setTargetStatus('STAGED');
    setSectionId('');
    setRackId('');
    setBinId('');
    setOperationalLocationId('');
    setNotes('');
    setErrorMessage(null);
  }, [open, units]);

  useEffect(() => {
    setSectionId('');
    setRackId('');
    setBinId('');
    setOperationalLocationId('');
    setErrorMessage(null);
  }, [targetStatus]);

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

  const operationalLocations = useMemo(() => {
    if (!transferOptions) {
      return [];
    }

    switch (targetStatus) {
      case 'STAGED':
        return transferOptions.operationalLocations.filter(
          (location) => location.kind === 'RECEIVING_STAGING',
        );
      case 'DAMAGED':
        return transferOptions.operationalLocations.filter(
          (location) => location.kind === 'DAMAGE' || location.kind === 'QUARANTINE',
        );
      default:
        return [];
    }
  }, [targetStatus, transferOptions]);

  const targetLocationId = useMemo(() => {
    switch (targetStatus) {
      case 'PUTAWAY':
      case 'DEADSTOCK':
        return binId || null;
      case 'RTS':
      case 'LOST':
      case 'ARCHIVED':
        return null;
      default:
        return operationalLocationId || null;
    }
  }, [binId, operationalLocationId, targetStatus]);

  const selectedBinHasCapacityConflict =
    (targetStatus === 'PUTAWAY' || targetStatus === 'DEADSTOCK')
    && selectedBin
    && selectedBin.availableUnits !== null
    && selectedBin.availableUnits < units.length;

  const requiresDestination = targetStatus === 'STAGED' || targetStatus === 'PUTAWAY' || targetStatus === 'DEADSTOCK' || targetStatus === 'DAMAGED';
  const canSubmit =
    canAdjustUnits
    && units.length > 0
    && !isSubmitting
    && !mixedWarehouseBlocked
    && !selectedBinHasCapacityConflict
    && (!requiresDestination || Boolean(targetLocationId));

  const handleSubmit = async () => {
    if (!canSubmit) {
      return;
    }

    try {
      setErrorMessage(null);
      await onSubmit({
        unitIds: units.map((unit) => unit.id),
        targetStatus,
        ...(targetLocationId ? { targetLocationId } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to adjust selected units');
    }
  };

  if (!open) {
    return null;
  }

  return (
    <WmsModal
      open={open}
      onClose={onClose}
      title="Adjust selected stock"
      description="Apply one inventory status and destination to the current multi-selection."
      panelClassName="w-[min(94vw,980px)]"
      footer={(
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] text-[#667b8a]">
            {units.length} unit{units.length === 1 ? '' : 's'} selected
            {warehouseLabels[0] ? ` · ${warehouseLabels[0]}` : ''}
            {warehouseLabels.length > 1 ? ` + ${warehouseLabels.length - 1} more warehouse${warehouseLabels.length === 2 ? '' : 's'}` : ''}
          </p>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-md btn-outline"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!canSubmit}
              className="btn btn-md btn-primary btn-icon"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings2 className="h-4 w-4" />}
              Apply adjustment
            </button>
          </div>
        </div>
      )}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="space-y-4">
          {!canAdjustUnits ? (
            <InlineMutedBox message="Adjustment permission required." />
          ) : isLoadingTransferOptions && requiresDestination ? (
            <InlineMutedBox message="Loading adjustment destinations..." />
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <div className="card">
              <p className="card-label">Selection</p>
              <p className="mt-1 text-[13px] font-semibold text-primary">
                {units.length} unit{units.length === 1 ? '' : 's'}
              </p>
              <p className="mt-1 text-[12px] text-[#637786]">
                {sameWarehouse ? warehouseLabels[0] ?? 'No warehouse' : `${warehouseLabels.length} warehouses selected`}
              </p>
            </div>

            <div className="card">
              <p className="card-label">Rule</p>
              <p className="mt-1 text-[13px] font-semibold text-primary">{targetStatusMeta?.label}</p>
              <p className="mt-1 text-[12px] text-[#637786]">{targetStatusMeta?.hint}</p>
            </div>
          </div>

          {mixedWarehouseBlocked ? (
            <div className="rounded-2xl border border-[#f2c7c7] bg-[#fff7f7] px-4 py-3 text-[13px] font-medium text-[#a43f3f]">
              Selected units span multiple warehouses. Bulk adjustment to {targetStatusMeta?.label.toLowerCase()} must use one warehouse only.
            </div>
          ) : null}

          {selectedBinHasCapacityConflict && selectedBin ? (
            <div className="rounded-2xl border border-[#f0d4a2] bg-[#fffaf0] px-4 py-3 text-[13px] font-medium text-[#9a681e]">
              Bin {selectedBin.label} has space for {selectedBin.availableUnits ?? 0} unit{selectedBin.availableUnits === 1 ? '' : 's'}, but {units.length} were selected.
            </div>
          ) : null}

          {errorMessage ? (
            <div className="rounded-2xl border border-[#f2c7c7] bg-[#fff7f7] px-4 py-3 text-[13px] font-medium text-[#a43f3f]">
              {errorMessage}
            </div>
          ) : null}

          <WmsSearchableSelect
            label="Target Status"
            value={targetStatus}
            onChange={(value) => setTargetStatus((value as AdjustableStatus) || 'STAGED')}
            options={ADJUSTABLE_STATUS_OPTIONS.map((status) => ({
              value: status.value,
              label: status.label,
            }))}
            placeholder="Search statuses..."
            allLabel="Select status"
            clearable={false}
          />

          {targetStatus === 'PUTAWAY' || targetStatus === 'DEADSTOCK' ? (
            <div className="grid gap-3 md:grid-cols-3">
              <WmsSearchableSelect
                label="Section"
                value={sectionId}
                onChange={(value) => setSectionId(value)}
                options={(transferOptions?.sections ?? []).map((section) => ({
                  value: section.id,
                  label: section.label,
                  hint: section.racks.length,
                }))}
                placeholder="Search sections..."
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
                placeholder="Search racks..."
                allLabel="Select rack"
                clearable={false}
              />

              <WmsSearchableSelect
                label="Bin"
                value={binId}
                onChange={(value) => setBinId(value)}
                options={(selectedRack?.bins ?? []).map((bin) => ({
                  value: bin.id,
                  label: bin.label,
                  hint: bin.availableUnits ?? '∞',
                  disabled: bin.isFull,
                }))}
                placeholder="Search bins..."
                allLabel="Select bin"
                clearable={false}
              />
            </div>
          ) : targetStatus === 'STAGED' || targetStatus === 'DAMAGED' ? (
            <WmsSearchableSelect
              label="Destination"
              value={operationalLocationId}
              onChange={(value) => setOperationalLocationId(value)}
              options={operationalLocations.map((location) => ({
                value: location.id,
                label: location.label,
              }))}
              placeholder="Search locations..."
              allLabel="Select location"
              clearable={false}
            />
          ) : (
            <div className="rounded-2xl border border-[#dce4ea] bg-[#fbfcfc] px-4 py-3 text-[12px] text-[#667b8a]">
              No destination location is required for {targetStatusMeta?.label.toLowerCase()}.
            </div>
          )}

          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8193a0]">Notes</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder="Optional reason or audit note"
              className="mt-2 w-full rounded-2xl border border-[#d7e0e7] bg-white px-3.5 py-3 text-[13px] text-primary outline-none transition placeholder:text-[#9aacb8] focus:border-[#96b4c3] focus:shadow-[0_0_0_4px_rgba(18,56,75,0.08)]"
            />
          </label>
        </section>

        <aside className="rounded-2xl border border-[#dce4ea] bg-white p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8193a0]">Selected units</p>
          <div className="mt-3 max-h-[360px] space-y-2 overflow-y-auto pr-1">
            {units.map((unit) => (
              <div key={unit.id} className="rounded-xl border border-[#edf2f6] bg-[#fbfcfc] px-3 py-2">
                <p className="truncate text-[12px] font-semibold text-primary">{unit.code}</p>
                <p className="mt-0.5 truncate text-[11px] text-[#758997]">
                  {formatInventoryStatusLabel(unit.status)} · {unit.currentLocation?.code ?? 'No location'}
                </p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </WmsModal>
  );
}

function InlineMutedBox({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-[#dce4ea] bg-[#fbfcfc] px-4 py-3 text-[12px] text-[#667b8a]">
      {message}
    </div>
  );
}
