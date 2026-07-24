'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowRightLeft, ChevronLeft, ChevronRight, Info, Loader2, Tags, Truck } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { WmsInlineNotice } from '../../_components/wms-inline-notice';
import { WmsSearchableSelect } from '../../_components/wms-searchable-select';
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
import {
  formatInventoryExpirationDate,
  getInventoryStatusClassName,
} from '../_utils/inventory-status-presenters';
import { InventoryExpirationBadge } from './inventory-expiration-badge';

type PutawayDraft = {
  sectionId: string;
  rackId: string;
  binId: string;
  expirationDate: string;
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
const NOTICE_AUTO_DISMISS_MS = 5000;
const TRANSFER_UNITS_PAGE_SIZE = 100;

const INVENTORY_STATUSES: WmsInventoryUnitStatus[] = [
  'RECEIVED',
  'STAGED',
  'PUTAWAY',
  'EXPIRED',
  'DEADSTOCK',
  'RESERVED',
  'PICKED',
  'PACKED',
  'DISPATCHED',
  'RTS',
  'DAMAGED',
  'LOST',
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
  isResettingPutaway: boolean;
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
      expirationDate?: string | null;
    },
  ) => Promise<void>;
  onAssignPutawayUnits?: (
    batchId: string,
    assignments: Array<{
      unitId: string;
      sectionId: string;
      rackId: string;
      binId: string;
      expirationDate?: string | null;
    }>,
  ) => Promise<void>;
  onResetPutawayUnits: (batchId: string, unitIds: string[]) => Promise<void>;
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
  isResettingPutaway,
  canPutAway,
  onSelectBatch,
  onOpenLabels,
  onAssignPutawayUnit,
  onAssignPutawayUnits,
  onResetPutawayUnits,
}: InventoryTransfersTabProps) {
  const { addToast } = useToast();
  const [groupDrafts, setGroupDrafts] = useState<Record<string, PutawayDraft>>({});
  const [putawayError, setPutawayError] = useState<string | null>(null);
  const [unitFilter, setUnitFilter] = useState<'all' | 'pending' | 'done'>('pending');
  const [selectedItemKey, setSelectedItemKey] = useState('');
  const [activeGroupKey, setActiveGroupKey] = useState('');
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastSavedMessage, setLastSavedMessage] = useState<string | null>(null);
  const batchScrollRef = useRef<HTMLDivElement>(null);

  const sections = useMemo(
    () => putawayOptions?.sections ?? [],
    [putawayOptions?.sections],
  );
  const sectionMap = useMemo(
    () => new Map(sections.map((section) => [section.id, section])),
    [sections],
  );

  const stateFilteredUnits = useMemo(() => {
    const allUnits = putawayOptions?.units ?? [];

    if (unitFilter === 'pending') {
      return allUnits.filter(isPutawayPending);
    }

    if (unitFilter === 'done') {
      return allUnits.filter(isTransferCompleted);
    }

    return allUnits;
  }, [putawayOptions?.units, unitFilter]);

  const itemFilterOptions = useMemo(() => {
    const options = stateFilteredUnits.reduce((map, unit) => {
      const existing = map.get(unit.variationId);
      if (existing) {
        existing.hint += 1;
        return map;
      }

      map.set(unit.variationId, {
        value: unit.variationId,
        label: unit.productName,
        selectedLabel: unit.productCustomId
          ? `${unit.productName} · ${unit.productCustomId}`
          : unit.productName,
        hint: 1,
      });

      return map;
    }, new Map<string, { value: string; label: string; selectedLabel: string; hint: number }>());

    return Array.from(options.values()).sort((left, right) =>
      left.selectedLabel.localeCompare(right.selectedLabel),
    );
  }, [stateFilteredUnits]);

  const filteredUnits = useMemo(() => {
    if (!selectedItemKey) {
      return stateFilteredUnits;
    }

    return stateFilteredUnits.filter((unit) => unit.variationId === selectedItemKey);
  }, [selectedItemKey, stateFilteredUnits]);

  const scrollBatches = (direction: 'left' | 'right') => {
    batchScrollRef.current?.scrollBy({
      left: direction === 'left' ? -240 : 240,
      behavior: 'smooth',
    });
  };

  const groups = useMemo(() => buildTransferGroups(filteredUnits), [filteredUnits]);
  const completedUnits = useMemo(
    () => (putawayOptions?.units ?? []).filter((unit) => isTransferCompleted(unit)).length,
    [putawayOptions?.units],
  );
  const activeGroup = groups.find((group) => group.key === activeGroupKey) ?? groups[0] ?? null;
  const activeGroupUnits = activeGroup?.units ?? EMPTY_TRANSFER_UNITS;
  const isPendingTab = unitFilter === 'pending';
  const isTransferredTab = unitFilter === 'done';
  const totalPages = Math.max(1, Math.ceil(activeGroupUnits.length / TRANSFER_UNITS_PAGE_SIZE));
  const paginatedGroupUnits = useMemo(() => {
    const startIndex = (currentPage - 1) * TRANSFER_UNITS_PAGE_SIZE;
    return activeGroupUnits.slice(startIndex, startIndex + TRANSFER_UNITS_PAGE_SIZE);
  }, [activeGroupUnits, currentPage]);
  const actionableUnits = useMemo(
    () => {
      if (isPendingTab) {
      return activeGroupUnits.filter(isPutawayPending);
      }

      if (isTransferredTab) {
        return activeGroupUnits.filter(isReturnToStageEligible);
      }

      return EMPTY_TRANSFER_UNITS;
    },
    [activeGroupUnits, isPendingTab, isTransferredTab],
  );
  const actionableUnitIds = useMemo(
    () => actionableUnits.map((unit) => unit.id),
    [actionableUnits],
  );
  const pageActionableUnitIds = useMemo(
    () =>
      paginatedGroupUnits
        .filter((unit) =>
          isPendingTab
            ? isPutawayPending(unit)
            : isTransferredTab
              ? isReturnToStageEligible(unit)
              : false,
        )
        .map((unit) => unit.id),
    [isPendingTab, isTransferredTab, paginatedGroupUnits],
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
          expirationDate: previous?.expirationDate ?? '',
        };
      }

      return areGroupDraftsEqual(current, next) ? current : next;
    });
  }, [groups]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeGroupKey, selectedBatchId, selectedItemKey, unitFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

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
  }, [activeGroupKey, selectedBatchId, selectedItemKey, unitFilter]);

  useEffect(() => {
    if (!selectedItemKey) {
      return;
    }

    if (!itemFilterOptions.some((option) => option.value === selectedItemKey)) {
      setSelectedItemKey('');
    }
  }, [itemFilterOptions, selectedItemKey]);

  const activeDraft =
    (activeGroup ? groupDrafts[activeGroup.key] : null)
    ?? {
      sectionId: activeGroup?.sectionId ?? '',
      rackId: '',
      binId: '',
      expirationDate: '',
    };

  const selectedSection = activeDraft.sectionId
    ? sectionMap.get(activeDraft.sectionId) ?? null
    : null;
  const rackOptions = selectedSection?.racks ?? [];
  const selectedRack = rackOptions.find((rack) => rack.id === activeDraft.rackId) ?? null;
  const binOptions = selectedRack?.bins ?? [];
  const selectedBin = binOptions.find((bin) => bin.id === activeDraft.binId) ?? null;
  const selectedBinAvailableUnits = selectedBin?.availableUnits ?? null;
  const orderedSelectedUnits = useMemo(
    () => actionableUnits.filter((unit) => selectedUnitIds.includes(unit.id)),
    [actionableUnits, selectedUnitIds],
  );
  const selectedUnitsRequiringExpiration = useMemo(
    () => orderedSelectedUnits.filter((unit) => unit.requiresExpirationDate).length,
    [orderedSelectedUnits],
  );
  const selectedActionableCount = orderedSelectedUnits.length;
  const assignableSelectedCount = useMemo(() => {
    if (!selectedBin || selectedBin.isFull || selectedBin.capacity === null || selectedBinAvailableUnits === null) {
      return selectedActionableCount;
    }

    return Math.min(selectedActionableCount, Math.max(selectedBinAvailableUnits, 0));
  }, [selectedActionableCount, selectedBin, selectedBinAvailableUnits]);
  const remainingSelectedCount = Math.max(selectedActionableCount - assignableSelectedCount, 0);
  const allPageActionableSelected =
    pageActionableUnitIds.length > 0 && pageActionableUnitIds.every((unitId) => selectedUnitIds.includes(unitId));
  const assignmentGridClassName = 'grid items-stretch gap-2 sm:grid-cols-2 xl:grid-cols-4';
  const isMutatingTransfer = isAssigningPutaway || isResettingPutaway;

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
        expirationDate: current[activeGroup.key]?.expirationDate ?? '',
        ...update,
      },
    }));
  };

  const toggleSelectAll = () => {
    if (!pageActionableUnitIds.length) {
      return;
    }

    setPutawayError(null);
    setSelectedUnitIds((current) => {
      if (allPageActionableSelected) {
        return current.filter((unitId) => !pageActionableUnitIds.includes(unitId));
      }

      const next = new Set(current);
      pageActionableUnitIds.forEach((unitId) => next.add(unitId));
      return Array.from(next);
    });
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
    if (!isPendingTab || !selectedBatchId || !selectedActionableCount) {
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

    const assignableUnits = orderedSelectedUnits.slice(0, Math.max(selectedBinAvailableUnits, 0));

    if (!assignableUnits.length) {
      setPutawayError(`Bin ${selectedBin?.code} has no free slots right now. Choose another bin.`);
      return;
    }

    const missingRequiredExpiration = assignableUnits.find(
      (unit) => unit.requiresExpirationDate && !activeDraft.expirationDate && !unit.expirationDate,
    );
    if (missingRequiredExpiration) {
      setPutawayError(
        `${missingRequiredExpiration.productName} requires an expiration date before put-away.`,
      );
      return;
    }

    const assignments = assignableUnits.map((unit) => ({
      unitId: unit.id,
      sectionId: activeDraft.sectionId,
      rackId: activeDraft.rackId,
      binId: activeDraft.binId,
      expirationDate: activeDraft.expirationDate || unit.expirationDate || undefined,
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

      const remainingUnitIds = orderedSelectedUnits.slice(assignments.length).map((unit) => unit.id);
      setSelectedUnitIds(remainingUnitIds);
      setLastSavedMessage(remainingUnitIds.length > 0
        ? `Assigned ${assignments.length} unit${assignments.length === 1 ? '' : 's'} to ${selectedBin?.label ?? 'selected bin'}. ${remainingUnitIds.length} unit${remainingUnitIds.length === 1 ? '' : 's'} remain selected for the next bin.`
        : `Assigned ${assignments.length} unit${assignments.length === 1 ? '' : 's'} to ${selectedBin?.label ?? 'selected bin'}.`);
      addToast(
        'success',
        remainingUnitIds.length > 0
          ? `Transferred ${assignments.length} unit${assignments.length === 1 ? '' : 's'} to ${selectedBin?.label ?? 'selected bin'}.`
          : `Transfer complete: ${assignments.length} unit${assignments.length === 1 ? '' : 's'} assigned to ${selectedBin?.label ?? 'selected bin'}.`,
      );
    } catch (error) {
      setPutawayError(error instanceof Error ? error.message : 'Unable to save transfer');
    }
  };

  const handleReturnSelectedToStage = async () => {
    if (!isTransferredTab || !selectedBatchId || !selectedActionableCount) {
      return;
    }

    try {
      setPutawayError(null);
      await onResetPutawayUnits(selectedBatchId, orderedSelectedUnits.map((unit) => unit.id));
      setSelectedUnitIds([]);
      const stagingLabel = batchDetail?.stagingLocation
        ? `${batchDetail.stagingLocation.code} · ${batchDetail.stagingLocation.name}`
        : 'receiving staging';
      setLastSavedMessage(
        `Returned ${selectedActionableCount} unit${selectedActionableCount === 1 ? '' : 's'} to ${stagingLabel}.`,
      );
      addToast(
        'success',
        `Returned ${selectedActionableCount} unit${selectedActionableCount === 1 ? '' : 's'} to ${stagingLabel}.`,
      );
    } catch (error) {
      setPutawayError(error instanceof Error ? error.message : 'Unable to return units to stage');
    }
  };

  return (
    <div className="space-y-3">
      <section className="space-y-2">
        <div className="flex justify-between items-center w-full">
          <h2 className="text-[1.1rem] font-semibold tracking-tight text-primary">Batches</h2>
          <div className="flex shrink-0 items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => scrollBatches('left')}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[#dce4ea] bg-white text-[#4d6677] transition hover:border-[#c6d4dd] hover:text-primary"
                aria-label="Scroll batches left"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollBatches('right')}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[#dce4ea] bg-white text-[#4d6677] transition hover:border-[#c6d4dd] hover:text-primary"
                aria-label="Scroll batches right"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
        </div>
        {isLoadingBatches ? (
          <div className="px-4 py-10 text-center text-sm text-[#7b8e9c]">Loading transfer queue…</div>
        ) : batches.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-[#7b8e9c]">
            No printed receiving batches are waiting for put-away.
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div
              ref={batchScrollRef}
              className="scrollbar-hide flex min-w-0 flex-1 gap-2 overflow-x-auto"
            >
              {batches.map((batch) => {
                const active = batch.id === selectedBatchId;

                return (
                  <button
                    key={batch.id}
                    type="button"
                    onClick={() => onSelectBatch(batch)}
                    className={`card ${
                      active
                        ? 'border-primary bg-white'
                        : 'border-border bg-transparent hover:border-[#dce4ea] hover:bg-[#f8fbfc]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-primary">{batch.code}</p>
                      </div>
                      <span className={`pill ${getReceivingStatusClassName(batch.status)}`}>
                        {formatReceivingStatusLabel(batch.status)}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-[#6f8290]">
                      <span className="truncate">
                        {batch.sourceRequestId || batch.warehouse.code || 'Manual'}
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums text-primary">{batch.unitCount} units</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* <div className="flex shrink-0 items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => scrollBatches('left')}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[#dce4ea] bg-white text-[#4d6677] transition hover:border-[#c6d4dd] hover:text-primary"
                aria-label="Scroll batches left"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollBatches('right')}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[#dce4ea] bg-white text-[#4d6677] transition hover:border-[#c6d4dd] hover:text-primary"
                aria-label="Scroll batches right"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div> */}
          </div>
        )}
      </section>

      <WmsWorkspaceCard
        title={selectedBatch ? selectedBatch.code : 'Transfer'}
        icon={<Truck className="panel-icon" />}
        actions={
          selectedBatch ? (
            <button
              type="button"
              onClick={() => onOpenLabels(selectedBatch)}
              className="pill pill-ghost flex gap-1.5 rounded-lg"
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
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#dce4ea] bg-white text-primary">
                <ArrowRightLeft className="h-6 w-6" />
              </div>
              <p className="mt-4 text-sm font-semibold text-primary">Select a batch to start put-away</p>
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
              <div className="flex justify-between rounded-2xl border border-[#dce4ea] bg-[#fbfcfc] px-3 py-2.5 text-[11px] text-[#4d6677] lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] lg:items-center">
                <span className="truncate font-semibold text-primary">
                  {selectedBatch.sourceRequestId || selectedBatch.requestTitle || 'Manual request'}
                </span>
                <span className="truncate">
                  {selectedBatch.warehouse.code} · {selectedBatch.warehouse.name}
                  {batchDetail?.stagingLocation
                    ? ` · ${batchDetail.stagingLocation.code} · ${batchDetail.stagingLocation.name}`
                    : ''}
                </span>
                <span className="font-semibold text-primary lg:text-right">
                  {completedUnits}/{putawayOptions.batch.unitCount} assigned
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div className="overflow-x-auto">
                    <div className="flex min-w-max gap-6 border-b border-slate-200">
                      {[
                        ['pending', 'Needs Transfer'],
                        ['done', 'Transferred'],
                        ['all', 'All Units'],
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setUnitFilter(value as 'all' | 'pending' | 'done')}
                          className={`whitespace-nowrap border-b-2 pb-3 text-sm font-semibold transition-colors ${
                            unitFilter === value
                              ? 'border-primary text-primary'
                              : 'border-transparent text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <WmsSearchableSelect
                    label="Item"
                    hideInlineLabel
                    value={selectedItemKey}
                    onChange={setSelectedItemKey}
                    options={itemFilterOptions}
                    allLabel="All items"
                    placeholder="Search items..."
                    triggerClassName="h-10 min-w-[240px] lg:w-[280px]"
                    valueClassName="max-w-[200px]"
                  />
                </div>

                {groups.length > 0 ? (
                  <div className="scrollbar-hide overflow-x-auto">
                    <div className="flex min-w-max gap-6 border-b border-slate-200 pb-px">
                      {groups.map((group) => (
                        <button
                          key={group.key}
                          type="button"
                          onClick={() => setActiveGroupKey(group.key)}
                          className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 pb-3 text-sm font-semibold transition-colors ${
                            activeGroup?.key === group.key
                              ? 'border-primary text-primary'
                              : 'border-transparent text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <span>{group.label}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              activeGroup?.key === group.key
                                ? 'bg-primary/10 text-primary'
                                : 'bg-[#eef3f6] text-[#4d6677]'
                            }`}
                          >
                            {group.units.length}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {groups.length === 0 ? (
                <div className="rounded-[18px] border border-dashed border-[#d7e0e7] bg-[#fbfcfc] px-6 py-12 text-center text-sm text-[#7b8e9c]">
                  No units match this transfer filter.
                </div>
              ) : (
                <>

                  {activeGroup && isPendingTab ? (
                    <div className="rounded-[18px] border border-[#dce4ea] bg-[#fbfcfc] p-3">
                      <div className="flex flex-wrap items-start gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="form-label">{activeGroup.label}</p>
                            {activeGroup.isUnassigned ? (
                              <span
                                title="Assign a default section in Products > Section Assignment to remove these units from the Unassigned workflow."
                                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#d7e0e7] bg-white text-[#7b8e9c]"
                              >
                                <Info className="h-3 w-3" />
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1.5 text-[11px] font-medium text-primary">
                            {selectedActionableCount} selected / {actionableUnits.length} transferable
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 space-y-3">
                        <div className={assignmentGridClassName}>
                        {activeGroup.sectionId ? (
                          <TransferInfoCard
                            title="Section"
                            value={activeGroup.label}
                            hint="Locked by product section assignment"
                          />
                        ) : (
                          <label className="flex h-full min-w-0 flex-col space-y-2 rounded-[14px] border border-[#dce4ea] bg-white px-3 py-3">
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
                              className="input"
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

                        <label className="flex h-full min-w-0 flex-col space-y-2 rounded-[14px] border border-[#dce4ea] bg-white px-3 py-3">
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
                            className="input"
                          >
                            <option value="">Select rack</option>
                            {rackOptions.map((rack) => (
                              <option key={rack.id} value={rack.id}>
                                {rack.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="flex h-full min-w-0 flex-col space-y-2 rounded-[14px] border border-[#dce4ea] bg-white px-3 py-3">
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
                            className="input"
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
                                  : remainingSelectedCount > 0
                                    ? `${assignableSelectedCount} of ${selectedActionableCount} selected units fit here. ${remainingSelectedCount} will remain selected.`
                                    : `${selectedBin.availableUnits} free of ${selectedBin.capacity}`
                              : 'Only bins with available space can accept new units.'}
                          </p>
                        </label>

                        <label className="flex h-full min-w-0 flex-col space-y-2 rounded-[14px] border border-[#dce4ea] bg-white px-3 py-3">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8193a0]">
                            Expiration date
                          </span>
                          <input
                            type="date"
                            value={activeDraft.expirationDate}
                            min={getManilaDateInputValue()}
                            onChange={(event) =>
                              updateActiveGroupDraft({
                                expirationDate: event.target.value,
                              })
                            }
                            disabled={!canPutAway || isLoadingPutawayOptions}
                            className="input"
                          />
                          <p className="text-[11px] text-[#6f8290]">
                            {selectedUnitsRequiringExpiration > 0
                              ? `Required for ${selectedUnitsRequiringExpiration} selected unit${selectedUnitsRequiringExpiration === 1 ? '' : 's'}.`
                              : 'Optional. The date applies to selected units.'}
                          </p>
                        </label>

                        </div>

                        <div className="flex items-stretch">
                          <button
                            type="button"
                            onClick={() => void handleAssignSelected()}
                            disabled={
                              !canPutAway
                              || isMutatingTransfer
                              || !selectedUnitIds.length
                              || !activeDraft.sectionId
                              || !activeDraft.rackId
                              || !activeDraft.binId
                              || !!selectedBin?.isFull
                              || selectedBin?.capacity === null
                            }
                            className="btn btn-md btn-primary w-full"
                          >
                            {isAssigningPutaway
                              ? 'Saving…'
                              : selectedActionableCount > 0
                                ? remainingSelectedCount > 0
                                  ? `Assign ${assignableSelectedCount} ${assignableSelectedCount === 1 ? 'unit' : 'units'}`
                                  : `Assign ${selectedActionableCount} ${selectedActionableCount === 1 ? 'unit' : 'units'}`
                                : 'Assign selected'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {activeGroup && isTransferredTab ? (
                    <div className="rounded-[18px] border border-[#dce4ea] bg-[#fbfcfc] p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="form-label">{activeGroup.label}</p>
                          <p className="mt-1.5 text-[11px] font-medium text-primary">
                            {selectedActionableCount} selected / {actionableUnits.length} returnable
                          </p>
                        </div>
                        <div className="flex min-w-[220px] flex-1 justify-end">
                          <button
                            type="button"
                            onClick={() => void handleReturnSelectedToStage()}
                            disabled={!canPutAway || isMutatingTransfer || !selectedUnitIds.length}
                            className="btn btn-md btn-secondary w-full sm:w-auto"
                          >
                            {isResettingPutaway
                              ? 'Returning…'
                              : selectedActionableCount > 0
                                ? `Return ${selectedActionableCount} ${selectedActionableCount === 1 ? 'unit' : 'units'} to stage`
                                : 'Return selected to stage'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="overflow-hidden rounded-[18px] border border-[#dce4ea] bg-white">
                    <div className="overflow-x-auto">
                      <table className="min-w-[900px] w-full border-separate border-spacing-0">
                        <thead className="bg-slate-50">
                          <tr>
                            <HeaderCell className="w-[52px]">
                              <input
                                type="checkbox"
                                checked={allPageActionableSelected && pageActionableUnitIds.length > 0}
                                onChange={toggleSelectAll}
                                disabled={!pageActionableUnitIds.length || !canPutAway}
                                className="h-4 w-4 rounded border-[#c5d1d9] text-primary focus:ring-primary"
                              />
                            </HeaderCell>
                            <HeaderCell>Unit</HeaderCell>
                            <HeaderCell>Product</HeaderCell>
                            <HeaderCell>Current</HeaderCell>
                            <HeaderCell>Section Rule</HeaderCell>
                            <HeaderCell>Expiration</HeaderCell>
                            <HeaderCell>Status</HeaderCell>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#eef2f5] bg-white">
                          {paginatedGroupUnits.map((unit) => {
                            const isCompleted = isTransferCompleted(unit);
                            const isSelected = selectedUnitIds.includes(unit.id);
                            const isSelectable = isPendingTab
                              ? isPutawayPending(unit)
                              : isTransferredTab
                                ? isReturnToStageEligible(unit)
                                : false;

                            return (
                              <tr
                                key={unit.id}
                                className={`text-[13px] text-primary transition ${
                                  isSelected ? 'bg-[#fff7ed]' : ''
                                }`}
                              >
                                <BodyCell>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleUnitSelection(unit.id)}
                                    disabled={!canPutAway || !isSelectable}
                                    className="h-4 w-4 rounded border-[#c5d1d9] text-primary focus:ring-primary disabled:cursor-not-allowed disabled:opacity-45"
                                  />
                                </BodyCell>

                                <BodyCell>
                                  <div className="min-w-[136px]">
                                    <p className="font-semibold text-primary">{unit.code}</p>
                                  </div>
                                </BodyCell>

                                <BodyCell>
                                  <div className="min-w-[164px]">
                                    <p className="font-semibold text-primary">{unit.productName}</p>
                                    <p className="mt-1 text-[11px] text-[#7c8f9b]">{unit.productCustomId ?? 'No SKU'}</p>
                                  </div>
                                </BodyCell>

                                <BodyCell>
                                  <div className="min-w-[140px]">
                                    <p className="font-medium text-primary">
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
                                  <div className="min-w-[126px] space-y-1">
                                    <p className="font-medium text-primary">
                                      {formatInventoryExpirationDate(unit.expirationDate)}
                                    </p>
                                    <InventoryExpirationBadge
                                      expirationDate={unit.expirationDate}
                                      status={unit.status}
                                    />
                                    {unit.expirationDate ? null : (
                                      <p className="text-[11px] text-[#7c8f9b]">
                                        {unit.requiresExpirationDate ? 'Required' : 'Optional'}
                                      </p>
                                    )}
                                  </div>
                                </BodyCell>

                                <BodyCell>
                                  <div className="min-w-[112px] space-y-1">
                                    <span className={`pill ${getTransferUnitStatusClassName(unit.status)}`}>
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
                    {activeGroupUnits.length > TRANSFER_UNITS_PAGE_SIZE ? (
                      <div className="flex items-center justify-between gap-3 border-t border-[#eef2f5] px-3.5 py-3">
                        <p className="text-[12px] text-[#6f8290]">
                          Showing {(currentPage - 1) * TRANSFER_UNITS_PAGE_SIZE + 1}
                          -
                          {Math.min(currentPage * TRANSFER_UNITS_PAGE_SIZE, activeGroupUnits.length)}
                          {' '}of {activeGroupUnits.length} units
                        </p>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                            disabled={currentPage === 1}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#d7e0e7] bg-white text-[#4d6677] transition hover:border-[#c6d4dd] hover:text-primary disabled:cursor-not-allowed disabled:opacity-45"
                            aria-label="Previous units page"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>

                          <span className="rounded-full border border-[#dce4ea] bg-[#fbfcfc] px-3.5 py-1.5 text-[12px] font-semibold text-primary">
                            {currentPage} / {totalPages}
                          </span>

                          <button
                            type="button"
                            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                            disabled={currentPage === totalPages}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#d7e0e7] bg-white text-[#4d6677] transition hover:border-[#c6d4dd] hover:text-primary disabled:cursor-not-allowed disabled:opacity-45"
                            aria-label="Next units page"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </>
              )}

              {lastSavedMessage ? (
                <WmsInlineNotice
                  tone="success"
                  className="px-3 py-2.5 text-[12px]"
                  dismissible
                  autoDismissMs={NOTICE_AUTO_DISMISS_MS}
                  onDismiss={() => setLastSavedMessage(null)}
                >
                  {lastSavedMessage}
                </WmsInlineNotice>
              ) : null}

              {putawayError ? (
                <WmsInlineNotice
                  tone="error"
                  className="rounded-[14px] px-3 py-2.5 text-[12px]"
                  dismissible
                  autoDismissMs={NOTICE_AUTO_DISMISS_MS}
                  onDismiss={() => setPutawayError(null)}
                >
                  {putawayError}
                </WmsInlineNotice>
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
    <div className="flex h-full min-w-0 flex-col rounded-[14px] border border-[#dce4ea] bg-white px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8193a0]">{title}</p>
      <p className="mt-1.5 text-sm font-semibold text-primary">{value}</p>
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
  return (
    unit.currentLocation?.kind === 'BIN'
    && (unit.status === 'PUTAWAY' || unit.status === 'EXPIRED')
  );
}

function isPutawayPending(unit: TransferUnit) {
  return unit.status === 'STAGED';
}

function isReturnToStageEligible(unit: TransferUnit) {
  return (
    unit.currentLocation?.kind === 'BIN'
    && unit.status === 'PUTAWAY'
  );
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
      && leftDraft?.binId === rightDraft.binId
      && leftDraft?.expirationDate === rightDraft.expirationDate
    );
  });
}

function getManilaDateInputValue(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
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
