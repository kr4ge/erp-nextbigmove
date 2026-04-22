'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowRightLeft, Info, Loader2, Tags } from 'lucide-react';
import { WmsWorkspaceCard } from '../../_components/wms-workspace-card';
import type {
  WmsReceivingBatchDetail,
  WmsReceivingBatchRow,
  WmsReceivingPutawayOptionsResponse,
} from '../../receiving/_types/receiving';
import {
  formatReceivingStatusLabel,
  getReceivingStatusClassName,
} from '../../receiving/_utils/receiving-presenters';
import type { WmsInventoryUnitStatus } from '../_types/inventory';
import { getInventoryStatusClassName } from '../_utils/inventory-status-presenters';

type PutawayDraft = {
  sectionId: string;
  rackId: string;
  binId: string;
};

type TransferUnit = WmsReceivingPutawayOptionsResponse['units'][number];

type TransferGroup = {
  key: string;
  label: string;
  sectionId: string | null;
  isUnassigned: boolean;
  units: TransferUnit[];
};

const EMPTY_TRANSFER_UNITS: TransferUnit[] = [];

const INVENTORY_STATUSES: WmsInventoryUnitStatus[] = [
  'RECEIVED',
  'STAGED',
  'PUTAWAY',
  'RESERVED',
  'PICKED',
  'PACKED',
  'DISPATCHED',
  'RTS',
  'DAMAGED',
  'ARCHIVED',
];

type InventoryTransfersTabProps = {
  batches: WmsReceivingBatchRow[];
  selectedBatchId: string | null;
  selectedBatch: WmsReceivingBatchRow | null;
  batchDetail: WmsReceivingBatchDetail | null;
  putawayOptions: WmsReceivingPutawayOptionsResponse | null;
  isLoadingBatches: boolean;
  isLoadingPutawayOptions: boolean;
  isAssigningPutaway: boolean;
  canPutAway: boolean;
  onSelectBatch: (batch: WmsReceivingBatchRow) => void;
  onOpenLabels: (batch: WmsReceivingBatchRow) => void;
  onAssignPutawayUnit: (
    batchId: string,
    assignment: {
      unitId: string;
      sectionId: string;
      rackId: string;
      binId: string;
    },
  ) => Promise<void>;
  onAssignPutawayUnits?: (
    batchId: string,
    assignments: Array<{
      unitId: string;
      sectionId: string;
      rackId: string;
      binId: string;
    }>,
  ) => Promise<void>;
};

export function InventoryTransfersTab({
  batches,
  selectedBatchId,
  selectedBatch,
  batchDetail,
  putawayOptions,
  isLoadingBatches,
  isLoadingPutawayOptions,
  isAssigningPutaway,
  canPutAway,
  onSelectBatch,
  onOpenLabels,
  onAssignPutawayUnit,
  onAssignPutawayUnits,
}: InventoryTransfersTabProps) {
  const [groupDrafts, setGroupDrafts] = useState<Record<string, PutawayDraft>>({});
  const [putawayError, setPutawayError] = useState<string | null>(null);
  const [unitFilter, setUnitFilter] = useState<'all' | 'pending' | 'done'>('pending');
  const [activeGroupKey, setActiveGroupKey] = useState('');
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [lastSavedMessage, setLastSavedMessage] = useState<string | null>(null);

  const sections = putawayOptions?.sections ?? [];
  const sectionMap = useMemo(
    () => new Map(sections.map((section) => [section.id, section])),
    [sections],
  );

  const filteredUnits = useMemo(() => {
    const allUnits = putawayOptions?.units ?? [];

    if (unitFilter === 'pending') {
      return allUnits.filter((unit) => !isTransferCompleted(unit));
    }

    if (unitFilter === 'done') {
      return allUnits.filter((unit) => isTransferCompleted(unit));
    }

    return allUnits;
  }, [putawayOptions?.units, unitFilter]);

  const groups = useMemo(() => buildTransferGroups(filteredUnits), [filteredUnits]);
  const completedUnits = useMemo(
    () => (putawayOptions?.units ?? []).filter((unit) => isTransferCompleted(unit)).length,
    [putawayOptions?.units],
  );
  const activeGroup = groups.find((group) => group.key === activeGroupKey) ?? groups[0] ?? null;
  const activeGroupUnits = activeGroup?.units ?? EMPTY_TRANSFER_UNITS;
  const actionableUnits = useMemo(
    () => activeGroupUnits.filter((unit) => !isTransferCompleted(unit)),
    [activeGroupUnits],
  );
  const actionableUnitIds = useMemo(
    () => actionableUnits.map((unit) => unit.id),
    [actionableUnits],
  );

  useEffect(() => {
    if (!groups.length) {
      setActiveGroupKey('');
      return;
    }

    if (!groups.some((group) => group.key === activeGroupKey)) {
      setActiveGroupKey(groups[0].key);
    }
  }, [activeGroupKey, groups]);

  useEffect(() => {
    if (!groups.length) {
      setGroupDrafts({});
      return;
    }

    setGroupDrafts((current) => {
      const next: Record<string, PutawayDraft> = {};

      for (const group of groups) {
        const previous = current[group.key];
        const forcedSectionId = group.sectionId ?? previous?.sectionId ?? '';
        const sectionChanged = forcedSectionId !== (previous?.sectionId ?? '');

        next[group.key] = {
          sectionId: forcedSectionId,
          rackId: sectionChanged ? '' : previous?.rackId ?? '',
          binId: sectionChanged ? '' : previous?.binId ?? '',
        };
      }

      return areGroupDraftsEqual(current, next) ? current : next;
    });
  }, [groups]);

  useEffect(() => {
    setSelectedUnitIds((current) => {
      const next = current.filter((unitId) => actionableUnitIds.includes(unitId));
      return areStringArraysEqual(current, next) ? current : next;
    });
  }, [actionableUnitIds]);

  useEffect(() => {
    setSelectedUnitIds([]);
    setLastSavedMessage(null);
    setPutawayError(null);
  }, [activeGroupKey, selectedBatchId, unitFilter]);

  const activeDraft =
    (activeGroup ? groupDrafts[activeGroup.key] : null)
    ?? {
      sectionId: activeGroup?.sectionId ?? '',
      rackId: '',
      binId: '',
    };

  const selectedSection = activeDraft.sectionId
    ? sectionMap.get(activeDraft.sectionId) ?? null
    : null;
  const rackOptions = selectedSection?.racks ?? [];
  const selectedRack = rackOptions.find((rack) => rack.id === activeDraft.rackId) ?? null;
  const binOptions = selectedRack?.bins ?? [];
  const selectedBin = binOptions.find((bin) => bin.id === activeDraft.binId) ?? null;
  const selectedBinAvailableUnits = selectedBin?.availableUnits ?? null;
  const selectedBinHasCapacityConflict =
    selectedBinAvailableUnits !== null
    && selectedUnitIds.length > 0
    && selectedUnitIds.length > selectedBinAvailableUnits;
  const allActionableSelected =
    actionableUnitIds.length > 0 && actionableUnitIds.every((unitId) => selectedUnitIds.includes(unitId));
  const selectedActionableCount = selectedUnitIds.length;
  const assignmentGridClassName =
    'grid items-start gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_180px]';

  const updateActiveGroupDraft = (update: Partial<PutawayDraft>) => {
    if (!activeGroup) {
      return;
    }

    setPutawayError(null);
    setGroupDrafts((current) => ({
      ...current,
      [activeGroup.key]: {
        sectionId: current[activeGroup.key]?.sectionId ?? activeGroup.sectionId ?? '',
        rackId: current[activeGroup.key]?.rackId ?? '',
        binId: current[activeGroup.key]?.binId ?? '',
        ...update,
      },
    }));
  };

  const toggleSelectAll = () => {
    if (!actionableUnitIds.length) {
      return;
    }

    setPutawayError(null);
    setSelectedUnitIds(allActionableSelected ? [] : actionableUnitIds);
  };

  const toggleUnitSelection = (unitId: string) => {
    setPutawayError(null);
    setSelectedUnitIds((current) =>
      current.includes(unitId)
        ? current.filter((value) => value !== unitId)
        : [...current, unitId],
    );
  };

  const handleAssignSelected = async () => {
    if (!selectedBatchId || !selectedUnitIds.length) {
      return;
    }

    if (!activeDraft.sectionId || !activeDraft.rackId || !activeDraft.binId) {
      return;
    }

    if (selectedBin?.isFull) {
      setPutawayError(`Bin ${selectedBin.code} is already full. Choose another bin.`);
      return;
    }

    if (selectedBin?.capacity === null || selectedBinAvailableUnits === null) {
      setPutawayError(`Bin ${selectedBin?.code} is missing a usable capacity setting.`);
      return;
    }

    if (selectedBinHasCapacityConflict) {
      setPutawayError(
        `Bin ${selectedBin?.code} has space for ${selectedBinAvailableUnits} more unit${selectedBinAvailableUnits === 1 ? '' : 's'}. Reduce the selection or choose another bin.`,
      );
      return;
    }

    const assignments = selectedUnitIds.map((unitId) => ({
      unitId,
      sectionId: activeDraft.sectionId,
      rackId: activeDraft.rackId,
      binId: activeDraft.binId,
    }));

    try {
      setPutawayError(null);

      if (onAssignPutawayUnits) {
        await onAssignPutawayUnits(selectedBatchId, assignments);
      } else {
        await Promise.all(
          assignments.map((assignment) => onAssignPutawayUnit(selectedBatchId, assignment)),
        );
      }

      setSelectedUnitIds([]);
      setLastSavedMessage(
        `Assigned ${assignments.length} unit${assignments.length > 1 ? 's' : ''} to ${selectedBin?.label ?? 'selected bin'}.`,
      );
    } catch (error) {
      setPutawayError(error instanceof Error ? error.message : 'Unable to save transfer');
    }
  };

  return (
    <div className="space-y-3">
      <section className="space-y-2">
        <h2 className="text-[1.1rem] font-semibold tracking-tight text-[#12384b]">Batches</h2>
        {isLoadingBatches ? (
          <div className="px-4 py-10 text-center text-sm text-[#7b8e9c]">Loading transfer queue…</div>
        ) : batches.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-[#7b8e9c]">
            No printed receiving batches are waiting for put-away.
          </div>
        ) : (
          <div className="scrollbar-hide flex gap-2 overflow-x-auto">
            {batches.map((batch) => {
              const active = batch.id === selectedBatchId;

              return (
                <button
                  key={batch.id}
                  type="button"
                  onClick={() => onSelectBatch(batch)}
                  className={`w-[216px] shrink-0 rounded-[12px] border px-3 py-2.5 text-left transition sm:w-[228px] ${
                    active
                      ? 'border-[#f4c57c] bg-[#fff7ed]'
                      : 'border-transparent bg-transparent hover:border-[#dce4ea] hover:bg-[#f8fbfc]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#12384b]">{batch.code}</p>
                    </div>
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${getReceivingStatusClassName(batch.status)}`}>
                      {formatReceivingStatusLabel(batch.status)}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-[#6f8290]">
                    <span className="truncate">
                      {batch.sourceRequestId || batch.warehouse.code || 'Manual'}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-[#12384b]">{batch.unitCount} units</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <WmsWorkspaceCard
        title={selectedBatch ? selectedBatch.code : 'Transfer'}
        actions={
          selectedBatch ? (
            <button
              type="button"
              onClick={() => onOpenLabels(selectedBatch)}
              className="inline-flex items-center gap-2 rounded-full border border-[#d7e0e7] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#12384b] transition hover:border-[#c6d4dd] hover:bg-[#f8fafb]"
            >
              <Tags className="h-3.5 w-3.5" />
              Labels
            </button>
          ) : null
        }
        contentClassName="px-3 py-3 sm:px-4 sm:py-4"
      >
          {!selectedBatch ? (
            <div className="rounded-[20px] border border-dashed border-[#d7e0e7] bg-[#fbfcfc] px-6 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#dce4ea] bg-white text-[#12384b]">
                <ArrowRightLeft className="h-6 w-6" />
              </div>
              <p className="mt-4 text-sm font-semibold text-[#12384b]">Select a batch to start put-away</p>
            </div>
          ) : isLoadingPutawayOptions ? (
            <div className="flex h-[420px] items-center justify-center text-sm text-[#718797]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading transfer destinations…
            </div>
          ) : !putawayOptions ? (
            <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              Put-away options are not available for the selected batch.
            </div>
          ) : (
            <div className="space-y-3.5">
              <div className="grid gap-2 rounded-[16px] border border-[#dce4ea] bg-[#fbfcfc] px-3 py-2.5 text-[11px] text-[#4d6677] lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] lg:items-center">
                <span className="truncate font-semibold text-[#12384b]">
                  {selectedBatch.sourceRequestId || selectedBatch.requestTitle || 'Manual request'}
                </span>
                <span className="truncate">
                  {selectedBatch.warehouse.code} · {selectedBatch.warehouse.name}
                  {batchDetail?.stagingLocation
                    ? ` · ${batchDetail.stagingLocation.code} · ${batchDetail.stagingLocation.name}`
                    : ''}
                </span>
                <span className="font-semibold text-[#12384b] lg:text-right">
                  {completedUnits}/{putawayOptions.batch.unitCount} assigned
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    ['pending', 'Needs Transfer'],
                    ['done', 'Transferred'],
                    ['all', 'All Units'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setUnitFilter(value as 'all' | 'pending' | 'done')}
                      className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[10.5px] font-semibold transition ${
                        unitFilter === value
                          ? 'border-[#f97316] bg-[#fff7ed] text-[#c2410c]'
                          : 'border-[#d7e0e7] bg-white text-[#4d6677] hover:border-[#c6d4dd]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {groups.length > 0 ? (
                  <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
                    {groups.map((group) => (
                      <button
                        key={group.key}
                        type="button"
                        onClick={() => setActiveGroupKey(group.key)}
                        className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                          activeGroup?.key === group.key
                            ? 'border-[#12384b] bg-[#12384b] text-white'
                            : 'border-[#d7e0e7] bg-white text-[#12384b] hover:border-[#c6d4dd] hover:bg-[#f8fafb]'
                        }`}
                      >
                        <span>{group.label}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            activeGroup?.key === group.key
                              ? 'bg-white/15 text-white'
                              : 'bg-[#eef3f6] text-[#4d6677]'
                          }`}
                        >
                          {group.units.length}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {groups.length === 0 ? (
                <div className="rounded-[18px] border border-dashed border-[#d7e0e7] bg-[#fbfcfc] px-6 py-12 text-center text-sm text-[#7b8e9c]">
                  No units match this transfer filter.
                </div>
              ) : (
                <>

                  {activeGroup ? (
                    <div className="rounded-[18px] border border-[#dce4ea] bg-[#fbfcfc] p-3">
                      <div className="flex flex-wrap items-start gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-[#12384b]">{activeGroup.label}</p>
                            {activeGroup.isUnassigned ? (
                              <span
                                title="Assign a default section in Products > Section Assignment to remove these units from the Unassigned workflow."
                                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#d7e0e7] bg-white text-[#7b8e9c]"
                              >
                                <Info className="h-3 w-3" />
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1.5 text-[11px] font-medium text-[#12384b]">
                            {selectedActionableCount} selected / {actionableUnits.length} transferable
                          </p>
                        </div>
                      </div>

                      <div className={`mt-3 ${assignmentGridClassName}`}>
                        {activeGroup.sectionId ? (
                          <TransferInfoCard
                            title="Section"
                            value={activeGroup.label}
                            hint="Locked by product section assignment"
                          />
                        ) : (
                          <label className="min-w-0 self-start space-y-2 rounded-[14px] border border-[#dce4ea] bg-white px-3 py-3">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8193a0]">
                              Section
                            </span>
                            <select
                              value={activeDraft.sectionId}
                              onChange={(event) =>
                                updateActiveGroupDraft({
                                  sectionId: event.target.value,
                                  rackId: '',
                                  binId: '',
                                })
                              }
                              disabled={!canPutAway || isLoadingPutawayOptions}
                              className="h-10 w-full rounded-[11px] border border-[#d7e0e7] bg-white px-3 text-[12px] text-[#12384b] outline-none transition focus:border-[#a9c1ce] disabled:cursor-not-allowed disabled:bg-[#f8fafb] disabled:text-[#7c8f9b]"
                            >
                              <option value="">Select section</option>
                              {sections.map((section) => (
                                <option key={section.id} value={section.id}>
                                  {section.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}

                        <label className="min-w-0 self-start space-y-2 rounded-[14px] border border-[#dce4ea] bg-white px-3 py-3">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8193a0]">
                            Rack
                          </span>
                          <select
                            value={activeDraft.rackId}
                            onChange={(event) =>
                              updateActiveGroupDraft({
                                rackId: event.target.value,
                                binId: '',
                              })
                            }
                            disabled={!canPutAway || isLoadingPutawayOptions || !activeDraft.sectionId}
                            className="h-10 w-full rounded-[11px] border border-[#d7e0e7] bg-white px-3 text-[12px] text-[#12384b] outline-none transition focus:border-[#a9c1ce] disabled:cursor-not-allowed disabled:bg-[#f8fafb] disabled:text-[#7c8f9b]"
                          >
                            <option value="">Select rack</option>
                            {rackOptions.map((rack) => (
                              <option key={rack.id} value={rack.id}>
                                {rack.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="min-w-0 self-start space-y-2 rounded-[14px] border border-[#dce4ea] bg-white px-3 py-3">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8193a0]">
                            Bin
                          </span>
                          <select
                            value={activeDraft.binId}
                            onChange={(event) =>
                              updateActiveGroupDraft({
                                binId: event.target.value,
                              })
                            }
                            disabled={!canPutAway || isLoadingPutawayOptions || !activeDraft.rackId}
                            className="h-10 w-full rounded-[11px] border border-[#d7e0e7] bg-white px-3 text-[12px] text-[#12384b] outline-none transition focus:border-[#a9c1ce] disabled:cursor-not-allowed disabled:bg-[#f8fafb] disabled:text-[#7c8f9b]"
                          >
                            <option value="">Select bin</option>
                            {binOptions.map((bin) => (
                              <option
                                key={bin.id}
                                value={bin.id}
                                disabled={bin.isFull || bin.capacity === null || bin.availableUnits === null}
                              >
                                {formatBinOptionLabel(bin)}
                              </option>
                            ))}
                          </select>
                          <p className="text-[11px] text-[#6f8290]">
                            {selectedBin
                              ? selectedBin.isFull
                                ? `Full · ${selectedBin.occupiedUnits}/${selectedBin.capacity ?? 0} stored`
                                : selectedBin.capacity === null
                                  ? 'Capacity is not configured for this bin.'
                                  : `${selectedBin.availableUnits} free of ${selectedBin.capacity}`
                              : 'Only bins with available space can accept new units.'}
                          </p>
                        </label>

                        <div className="flex items-stretch self-start sm:col-span-2 xl:col-span-1">
                          <button
                            type="button"
                            onClick={() => void handleAssignSelected()}
                            disabled={
                              !canPutAway
                              || isAssigningPutaway
                              || !selectedUnitIds.length
                              || !activeDraft.sectionId
                              || !activeDraft.rackId
                              || !activeDraft.binId
                              || selectedBinHasCapacityConflict
                              || !!selectedBin?.isFull
                              || selectedBin?.capacity === null
                            }
                            className="inline-flex h-11 w-full items-center justify-center rounded-[14px] bg-[#12384b] px-4 text-[12px] font-semibold text-white transition hover:bg-[#0f3242] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isAssigningPutaway
                              ? 'Saving…'
                              : selectedUnitIds.length > 0
                                ? `Assign ${selectedUnitIds.length} ${selectedUnitIds.length === 1 ? 'unit' : 'units'}`
                                : 'Assign selected'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="overflow-hidden rounded-[18px] border border-[#dce4ea] bg-white">
                    <div className="overflow-x-auto">
                      <table className="min-w-[760px] w-full border-separate border-spacing-0">
                        <thead className="bg-[#eff4f7]">
                          <tr>
                            <HeaderCell className="w-[52px]">
                              <input
                                type="checkbox"
                                checked={allActionableSelected && actionableUnitIds.length > 0}
                                onChange={toggleSelectAll}
                                disabled={!actionableUnitIds.length || !canPutAway}
                                className="h-4 w-4 rounded border-[#c5d1d9] text-[#12384b] focus:ring-[#12384b]"
                              />
                            </HeaderCell>
                            <HeaderCell>Unit</HeaderCell>
                            <HeaderCell>Product</HeaderCell>
                            <HeaderCell>Current</HeaderCell>
                            <HeaderCell>Section Rule</HeaderCell>
                            <HeaderCell>Status</HeaderCell>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#eef2f5] bg-white">
                          {activeGroupUnits.map((unit) => {
                            const isCompleted = isTransferCompleted(unit);
                            const isSelected = selectedUnitIds.includes(unit.id);

                            return (
                              <tr
                                key={unit.id}
                                className={`text-[13px] text-[#12384b] transition ${
                                  isSelected ? 'bg-[#fff7ed]' : ''
                                }`}
                              >
                                <BodyCell>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleUnitSelection(unit.id)}
                                    disabled={!canPutAway || isCompleted}
                                    className="h-4 w-4 rounded border-[#c5d1d9] text-[#12384b] focus:ring-[#12384b] disabled:cursor-not-allowed disabled:opacity-45"
                                  />
                                </BodyCell>

                                <BodyCell>
                                  <div className="min-w-[136px]">
                                    <p className="font-semibold text-[#12384b]">{unit.code}</p>
                                    <p className="mt-1 text-[11px] text-[#7c8f9b]">{unit.barcode}</p>
                                  </div>
                                </BodyCell>

                                <BodyCell>
                                  <div className="min-w-[164px]">
                                    <p className="font-semibold text-[#12384b]">{unit.productName}</p>
                                    <p className="mt-1 text-[11px] text-[#7c8f9b]">{unit.productCustomId ?? 'No SKU'}</p>
                                  </div>
                                </BodyCell>

                                <BodyCell>
                                  <div className="min-w-[140px]">
                                    <p className="font-medium text-[#12384b]">
                                      {unit.currentLocation?.code ?? batchDetail?.stagingLocation?.code ?? 'Staging'}
                                    </p>
                                    <p className="mt-1 text-[11px] text-[#7c8f9b]">
                                      {unit.currentLocation?.name ?? batchDetail?.stagingLocation?.name ?? 'Receiving staging'}
                                    </p>
                                  </div>
                                </BodyCell>

                                <BodyCell>
                                  <div className="min-w-[150px] space-y-1">
                                    {unit.defaultSectionLabel ? (
                                      <span className="inline-flex rounded-full border border-[#fed7aa] bg-[#fff7ed] px-2 py-1 text-[10.5px] font-semibold text-[#c2410c]">
                                        {unit.defaultSectionLabel}
                                      </span>
                                    ) : (
                                      <span
                                        title="Assign a default section in Products > Section Assignment to make transfer routing automatic."
                                        className="inline-flex items-center gap-1 rounded-full border border-[#dce4ea] bg-[#fbfcfc] px-2 py-1 text-[10.5px] font-semibold text-[#4d6677]"
                                      >
                                        Unassigned
                                        <Info className="h-3 w-3" />
                                      </span>
                                    )}
                                    <p className="text-[11px] text-[#7c8f9b]">
                                      {unit.defaultSectionLabel
                                        ? 'Section locked by product assignment'
                                        : 'Choose section during transfer'}
                                    </p>
                                  </div>
                                </BodyCell>

                                <BodyCell>
                                  <div className="min-w-[112px] space-y-1">
                                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${getTransferUnitStatusClassName(unit.status)}`}>
                                      {formatTransferUnitStatus(unit.status)}
                                    </span>
                                    <p className="text-[11px] text-[#7c8f9b]">
                                      {isCompleted ? 'Transferred into bin' : 'Waiting for put-away'}
                                    </p>
                                  </div>
                                </BodyCell>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {lastSavedMessage ? (
                <div className="rounded-[14px] border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[12px] text-emerald-700">
                  {lastSavedMessage}
                </div>
              ) : null}

              {putawayError ? (
                <div className="rounded-[14px] border border-rose-200 bg-rose-50 px-3 py-2.5 text-[12px] text-rose-700">
                  {putawayError}
                </div>
              ) : null}
            </div>
        )}
      </WmsWorkspaceCard>
    </div>
  );
}

function TransferInfoCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="self-start rounded-[14px] border border-[#dce4ea] bg-white px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8193a0]">{title}</p>
      <p className="mt-1.5 text-sm font-semibold text-[#12384b]">{value}</p>
      <p className="mt-1 text-[12px] text-[#6f8290]">{hint}</p>
    </div>
  );
}

function HeaderCell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <th className={`px-3.5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7b8e9c] ${className}`}>
      {children}
    </th>
  );
}

function BodyCell({
  children,
  align = 'left',
}: {
  children: ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <td className={`px-3.5 py-3 align-middle ${align === 'right' ? 'text-right' : 'text-left'}`}>
      {children}
    </td>
  );
}

function buildTransferGroups(units: TransferUnit[]): TransferGroup[] {
  const groups = new Map<string, TransferGroup>();

  for (const unit of units) {
    const key = unit.defaultSectionId ?? 'unassigned';
    const existing = groups.get(key);

    if (existing) {
      existing.units.push(unit);
      continue;
    }

    groups.set(key, {
      key,
      label: unit.defaultSectionLabel ?? 'Unassigned Section',
      sectionId: unit.defaultSectionId ?? null,
      isUnassigned: !unit.defaultSectionId,
      units: [unit],
    });
  }

  return Array.from(groups.values()).sort((left, right) => {
    if (left.isUnassigned !== right.isUnassigned) {
      return left.isUnassigned ? 1 : -1;
    }

    return left.label.localeCompare(right.label);
  });
}

function isTransferCompleted(unit: TransferUnit) {
  return unit.status === 'PUTAWAY' && unit.currentLocation?.kind === 'BIN';
}

function formatBinOptionLabel(bin: WmsReceivingPutawayOptionsResponse['sections'][number]['racks'][number]['bins'][number]) {
  if (bin.isFull) {
    return `${bin.label} · Full`;
  }

  if (bin.capacity === null || bin.availableUnits === null) {
    return `${bin.label} · Capacity unavailable`;
  }

  return `${bin.label} · ${bin.availableUnits} free`;
}

function areGroupDraftsEqual(
  left: Record<string, PutawayDraft>,
  right: Record<string, PutawayDraft>,
) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => {
    const leftDraft = left[key];
    const rightDraft = right[key];

    return Boolean(
      rightDraft
      && leftDraft?.sectionId === rightDraft.sectionId
      && leftDraft?.rackId === rightDraft.rackId
      && leftDraft?.binId === rightDraft.binId,
    );
  });
}

function areStringArraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function getTransferUnitStatusClassName(status: string) {
  if (INVENTORY_STATUSES.includes(status as WmsInventoryUnitStatus)) {
    return getInventoryStatusClassName(status as WmsInventoryUnitStatus);
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function formatTransferUnitStatus(status: string) {
  return status
    .toLowerCase()
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}
