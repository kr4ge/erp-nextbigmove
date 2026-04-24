'use client';

import { useEffect, useMemo, useState } from 'react';
import { WmsSearchableSelect } from '../../_components/wms-searchable-select';
import type {
  CreateWmsInventoryAdjustmentInput,
  WmsInventoryTransferOptionsResponse,
  WmsInventoryUnitRecord,
} from '../_types/inventory';
import { formatInventoryStatusLabel } from '../_utils/inventory-status-presenters';

type InventoryUnitAdjustmentPanelProps = {
  unit: WmsInventoryUnitRecord;
  transferOptions: WmsInventoryTransferOptionsResponse | null;
  canAdjustUnits: boolean;
  isLoadingTransferOptions: boolean;
  isAdjustingUnit: boolean;
  onAdjustUnit: (input: CreateWmsInventoryAdjustmentInput) => Promise<void>;
  onSuccess: () => void;
};

type AdjustableStatus = CreateWmsInventoryAdjustmentInput['targetStatus'];

const ADJUSTABLE_STATUS_OPTIONS: Array<{
  value: AdjustableStatus;
  label: string;
  hint: string;
}> = [
  { value: 'STAGED', label: 'Staged', hint: 'Move back into receiving staging.' },
  { value: 'PUTAWAY', label: 'Put Away', hint: 'Place the unit into a bin.' },
  { value: 'RTS', label: 'RTS', hint: 'Move the unit into the RTS zone.' },
  { value: 'DAMAGED', label: 'Damaged', hint: 'Move the unit into damage or quarantine.' },
  { value: 'ARCHIVED', label: 'Archived', hint: 'Remove the unit from active stock.' },
];

export function InventoryUnitAdjustmentPanel({
  unit,
  transferOptions,
  canAdjustUnits,
  isLoadingTransferOptions,
  isAdjustingUnit,
  onAdjustUnit,
  onSuccess,
}: InventoryUnitAdjustmentPanelProps) {
  const [targetStatus, setTargetStatus] = useState<AdjustableStatus>('STAGED');
  const [sectionId, setSectionId] = useState('');
  const [rackId, setRackId] = useState('');
  const [binId, setBinId] = useState('');
  const [operationalLocationId, setOperationalLocationId] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setTargetStatus('STAGED');
    setSectionId('');
    setRackId('');
    setBinId('');
    setOperationalLocationId('');
    setNotes('');
    setErrorMessage(null);
  }, [unit.id]);

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
      case 'RTS':
        return transferOptions.operationalLocations.filter((location) => location.kind === 'RTS');
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
        return binId || null;
      case 'ARCHIVED':
        return null;
      default:
        return operationalLocationId || null;
    }
  }, [binId, operationalLocationId, targetStatus]);

  const selectedBinHasCapacityConflict =
    targetStatus === 'PUTAWAY'
    && selectedBin
    && selectedBin.availableUnits !== null
    && selectedBin.availableUnits < 1;

  const canSubmit =
    canAdjustUnits
    && !isAdjustingUnit
    && (
      targetStatus === 'ARCHIVED'
      || Boolean(targetLocationId)
    )
    && !selectedBinHasCapacityConflict;

  const handleSubmit = async () => {
    if (!canSubmit) {
      return;
    }

    try {
      setErrorMessage(null);
      await onAdjustUnit({
        unitIds: [unit.id],
        targetStatus,
        ...(targetLocationId ? { targetLocationId } : {}),
        notes: notes.trim() || undefined,
      });
      onSuccess();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to adjust unit');
    }
  };

  return (
    <div className="space-y-4">
      {!canAdjustUnits ? (
        <InlineMutedBox message="Adjustment permission required." />
      ) : isLoadingTransferOptions ? (
        <InlineMutedBox message="Loading adjustment destinations…" />
      ) : !transferOptions ? (
        <InlineMutedBox message="Adjustment destinations are not available for this unit." />
      ) : (
        <>
          <div className="rounded-[14px] border border-[#dce4ea] bg-[#fbfcfc] px-3.5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8193a0]">Current State</p>
            <p className="mt-1 text-[13px] font-semibold text-[#12384b]">
              {formatInventoryStatusLabel(unit.status)}
              {' · '}
              {unit.currentLocation?.label ?? 'No location assigned'}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <WmsSearchableSelect
              label="Target Status"
              value={targetStatus}
              onChange={(value) => setTargetStatus((value as AdjustableStatus) || 'STAGED')}
              options={ADJUSTABLE_STATUS_OPTIONS.map((status) => ({
                value: status.value,
                label: status.label,
                hint: status.hint,
              }))}
              placeholder="Search statuses…"
              allLabel="Select status"
              clearable={false}
            />

            <div className="rounded-[14px] border border-[#dce4ea] bg-white px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8193a0]">Rule</p>
              <p className="mt-1 text-[13px] font-semibold text-[#12384b]">{targetStatusMeta?.label}</p>
              <p className="mt-1 text-[12px] text-[#637786]">{targetStatusMeta?.hint}</p>
            </div>
          </div>

          {targetStatus === 'PUTAWAY' ? (
            <div className="grid gap-3 md:grid-cols-3">
              <WmsSearchableSelect
                label="Section"
                value={sectionId}
                onChange={(value) => setSectionId(value)}
                options={(transferOptions.sections ?? []).map((section) => ({
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
                options={(selectedRack?.bins ?? []).map((bin) => ({
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
          ) : targetStatus === 'ARCHIVED' ? (
            <InlineMutedBox message="Archiving removes the unit from its current location and active stock." />
          ) : (
            <WmsSearchableSelect
              label="Destination"
              value={operationalLocationId}
              onChange={(value) => setOperationalLocationId(value)}
              options={operationalLocations.map((location) => ({
                value: location.id,
                label: location.label,
              }))}
              placeholder="Search locations…"
              allLabel="Select destination"
              clearable={false}
            />
          )}

          {targetStatus === 'PUTAWAY' && selectedBin ? (
            <p className="text-[12px] text-[#637786]">
              {selectedBin.availableUnits === null
                ? 'Bin has no explicit capacity limit.'
                : `${selectedBin.availableUnits} unit${selectedBin.availableUnits === 1 ? '' : 's'} available in ${selectedBin.code}.`}
            </p>
          ) : null}

          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            placeholder="Why is this unit being adjusted?"
            className="w-full rounded-[14px] border border-[#d7e0e7] bg-[#fbfcfc] px-3 py-2.5 text-[13px] text-[#12384b] outline-none transition placeholder:text-[#94a3b8] focus:border-[#96b4c3]"
          />

          {errorMessage ? (
            <div className="rounded-[14px] border border-rose-200 bg-rose-50 px-3 py-2.5 text-[12px] text-rose-700">
              {errorMessage}
            </div>
          ) : null}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!canSubmit}
              className="inline-flex h-10 items-center rounded-[12px] bg-[#12384b] px-4 text-[13px] font-semibold text-white transition hover:bg-[#0f3242] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isAdjustingUnit ? 'Saving adjustment…' : 'Apply adjustment'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function InlineMutedBox({ message }: { message: string }) {
  return (
    <div className="rounded-[14px] border border-[#dce4ea] bg-[#fbfcfc] px-3 py-3 text-[12px] text-[#637786]">
      {message}
    </div>
  );
}
