'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Package,
  PackageCheck,
  PackageX,
  Plus,
  SlidersHorizontal,
  Undo2,
} from 'lucide-react';
import { WmsCompactPanel } from '../../_components/wms-compact-panel';
import { useWarehousesController } from '../_hooks/use-warehouses-controller';
import type { WmsLocationTreeNode } from '../_types/warehouse';
import { BinSerializationModal, type BinSerializationTarget } from './bin-serialization-modal';
import { WarehouseFormModal } from './warehouse-form-modal';
import { LocationFormModal } from './location-form-modal';
import { LocationStructurePanel } from './location-structure-panel';

export function WarehousesScreen() {
  const controller = useWarehousesController();
  const activeWarehouse = controller.activeWarehouse;
  const newlyCreatedBinId = controller.newlyCreatedBinId;
  const clearNewlyCreatedBinId = controller.clearNewlyCreatedBinId;
  const totalWarehouses = controller.overview?.summary.warehouses ?? 0;
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [binModalTarget, setBinModalTarget] = useState<BinSerializationTarget | null>(null);

  const selectedSection = useMemo(() => {
    if (!activeWarehouse || !selectedSectionId) {
      return null;
    }

    return activeWarehouse.structuralLocations.find((section) => section.id === selectedSectionId) ?? null;
  }, [activeWarehouse, selectedSectionId]);

  useEffect(() => {
    if (!activeWarehouse) {
      setSelectedSectionId(null);
      setBinModalTarget(null);
      return;
    }

    if (
      selectedSectionId
      && !activeWarehouse.structuralLocations.some((section) => section.id === selectedSectionId)
    ) {
      setSelectedSectionId(null);
    }

    if (
      binModalTarget
      && !findBinContextById(activeWarehouse.structuralLocations, binModalTarget.bin.id)
    ) {
      setBinModalTarget(null);
    }
  }, [activeWarehouse, selectedSectionId, binModalTarget]);

  useEffect(() => {
    if (!activeWarehouse || !newlyCreatedBinId) {
      return;
    }

    const binContext = findBinContextById(activeWarehouse.structuralLocations, newlyCreatedBinId);
    if (!binContext) {
      return;
    }

    setBinModalTarget({
      warehouseCode: activeWarehouse.code,
      warehouseName: activeWarehouse.name,
      section: binContext.section,
      rack: binContext.rack,
      bin: binContext.bin,
    });
    clearNewlyCreatedBinId();
  }, [activeWarehouse, newlyCreatedBinId, clearNewlyCreatedBinId]);

  const usageMetrics = useMemo(() => {
    if (!activeWarehouse) {
      return null;
    }

    if (selectedSection) {
      const sectionMetrics = computeSectionMetrics(selectedSection);
      return {
        title: `${selectedSection.code}-Section Usage`,
        utilization: sectionMetrics.utilization,
        totalCapacity: sectionMetrics.totalCapacity,
        emptySlots: sectionMetrics.emptySlots,
        usedSlots: sectionMetrics.usedSlots,
        scopeCount: sectionMetrics.rackCount,
        scopeLabel: 'Racks',
      };
    }

    const warehouseMetrics = computeWarehouseMetrics(activeWarehouse.structuralLocations);
    return {
      title: `${activeWarehouse.code} Usage`,
      utilization: warehouseMetrics.utilization,
      totalCapacity: warehouseMetrics.totalCapacity,
      emptySlots: warehouseMetrics.emptySlots,
      usedSlots: warehouseMetrics.usedSlots,
      scopeCount: activeWarehouse.stats.sections,
      scopeLabel: 'Sections',
    };
  }, [activeWarehouse, selectedSection]);

  const inventoryOverview = activeWarehouse?.inventorySummary ?? {
    serializedUnits: 0,
    putAwayUnits: 0,
    stagedUnits: 0,
    attentionUnits: 0,
  };

  const tabScrollRef = useRef<HTMLDivElement>(null);
  const scrollTabs = (direction: 'left' | 'right') => {
    tabScrollRef.current?.scrollBy({
      left: direction === 'left' ? -200 : 200,
      behavior: 'smooth',
    });
  };

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="wms-page-title font-medium tracking-tight text-[#12384b]">
          Warehouses ({totalWarehouses})
        </h1>

        <div className="flex items-center gap-2.5">
          <button type="button" className="wms-pill-control inline-flex items-center gap-2 rounded-full border border-[#d7e0e7] bg-white px-4 font-medium text-[#1d4b61]">
            <ArrowUpDown className="h-3.5 w-3.5" />
            Sort by
          </button>
          <button type="button" className="wms-pill-control inline-flex items-center gap-2 rounded-full border border-[#d7e0e7] bg-white px-4 font-medium text-[#1d4b61]">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filter by ({controller.overview?.warehouses.length ?? 0})
          </button>
        </div>
      </div>

      {/* Banners */}
      {controller.banner ? (
        <div
          className={`rounded-[24px] border px-4 py-3 text-sm ${
            controller.banner.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {controller.banner.message}
        </div>
      ) : null}

      {controller.errorMessage ? (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {controller.errorMessage}
        </div>
      ) : null}

      {/* Warehouse tab pills with chevron navigation */}
      {controller.overview?.warehouses.length ? (
        <div className="flex items-center gap-2">
          <div
            ref={tabScrollRef}
            className="flex flex-1 items-center gap-2 overflow-x-auto scrollbar-hide"
          >
            {controller.overview.warehouses.map((warehouse) => {
              const isActive = controller.selectedWarehouseId === warehouse.id;
              return (
                <button
                  key={warehouse.id}
                  type="button"
                  onClick={() => controller.setSelectedWarehouseId(warehouse.id)}
                  className={`shrink-0 min-w-[150px] rounded-full px-5 py-2.5 text-center text-[13px] font-semibold transition ${
                    isActive
                      ? 'bg-[#12384b] text-white shadow-[0_16px_36px_-24px_rgba(18,56,75,0.7)]'
                      : 'border border-[#dce4ea] bg-white text-[#12384b] hover:border-[#c6d4dd] hover:bg-[#f8fafb]'
                  }`}
                >
                  {warehouse.name}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => scrollTabs('left')}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[#dce4ea] bg-white text-[#4d6677] transition hover:border-[#c6d4dd] hover:text-[#12384b]"
              aria-label="Scroll left"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollTabs('right')}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[#dce4ea] bg-white text-[#4d6677] transition hover:border-[#c6d4dd] hover:text-[#12384b]"
              aria-label="Scroll right"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={controller.openCreateWarehouse}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#12384b] text-white shadow-[0_16px_36px_-24px_rgba(18,56,75,0.7)] transition hover:bg-[#0f3242]"
              aria-label="Add warehouse"
              title="Add warehouse"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-[24px] border border-dashed border-[#d7e0e7] bg-[#fbfcfc] px-5 py-10 text-center">
          <p className="text-sm font-medium text-[#12384b]">No warehouse records yet</p>
          <button
            type="button"
            onClick={controller.openCreateWarehouse}
            className="mt-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#12384b] text-white"
            aria-label="Create warehouse"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Main content: Section grid + right sidebar */}
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(300px,340px)]">
        <div className="space-y-4">
          <LocationStructurePanel
            warehouse={activeWarehouse}
            selectedSectionId={selectedSectionId}
            onSelectSection={setSelectedSectionId}
            onEditWarehouse={controller.openEditWarehouse}
            onCreateLocation={controller.openCreateLocation}
            onEditLocation={controller.openEditLocation}
            onOpenBin={({ section, rack, bin }) => {
              if (!activeWarehouse) {
                return;
              }
              setBinModalTarget({
                warehouseCode: activeWarehouse.code,
                warehouseName: activeWarehouse.name,
                section,
                rack,
                bin,
              });
            }}
          />
        </div>

        <div className="space-y-4">
          {/* B-Section Usage panel — reference: donut + 2×2 stat grid */}
          <WmsCompactPanel title={usageMetrics?.title ?? 'Section Usage'}>
            {usageMetrics ? (
              <div className="flex items-center gap-5">
                {/* Donut ring */}
                <div className="relative shrink-0">
                  <svg width="100" height="100" viewBox="0 0 100 100" className="block">
                    <circle
                      cx="50" cy="50" r="42"
                      fill="none"
                      stroke="#e7edf2"
                      strokeWidth="12"
                    />
                    <circle
                      cx="50" cy="50" r="42"
                      fill="none"
                      stroke="#e5b83a"
                      strokeWidth="12"
                      strokeLinecap="round"
                      strokeDasharray={`${usageMetrics.utilization * 2.639} ${263.9 - usageMetrics.utilization * 2.639}`}
                      strokeDashoffset="66"
                      className="transition-all duration-700"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[18px] font-bold text-[#12384b]">{usageMetrics.utilization}%</span>
                    <span className="text-[9px] text-[#7b8e9c]">Location Used</span>
                  </div>
                </div>

                {/* 2×2 stat grid */}
                <div className="grid grid-cols-2 gap-x-5 gap-y-3 text-[12.5px]">
                  <div>
                    <p className="text-[20px] font-bold tabular-nums text-[#12384b]">{usageMetrics.totalCapacity}</p>
                    <p className="text-[#7b8e9c]">Total Shelves</p>
                  </div>
                  <div>
                    <p className="text-[20px] font-bold tabular-nums text-[#12384b]">{usageMetrics.emptySlots}</p>
                    <p className="text-[#7b8e9c]">Empty Shelves</p>
                  </div>
                  <div>
                    <p className="text-[20px] font-bold tabular-nums text-[#12384b]">{usageMetrics.usedSlots}</p>
                    <p className="text-[#7b8e9c]">Full Shelves</p>
                  </div>
                  <div>
                    <p className="text-[20px] font-bold tabular-nums text-[#12384b]">{usageMetrics.scopeCount}</p>
                    <p className="text-[#7b8e9c]">{usageMetrics.scopeLabel}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-[#6a7f8d]">Select a warehouse to see usage metrics.</div>
            )}
          </WmsCompactPanel>

          {/* Inventory Overview */}
          <WmsCompactPanel title="Inventory Overview">
            <div className="grid grid-cols-2 gap-2.5">
              <InventoryStatCard
                icon={<Package className="h-5 w-5 text-[#5e8e7a]" />}
                value={inventoryOverview.serializedUnits}
                label="Serialized Units"
                bgClass="bg-[#eef7f2]"
              />
              <InventoryStatCard
                icon={<PackageCheck className="h-5 w-5 text-[#5e8196]" />}
                value={inventoryOverview.putAwayUnits}
                label="Put-away Units"
                bgClass="bg-[#eef3f7]"
              />
              <InventoryStatCard
                icon={<Undo2 className="h-5 w-5 text-[#b07a5e]" />}
                value={inventoryOverview.stagedUnits}
                label="In Staging"
                bgClass="bg-[#fdf5ef]"
              />
              <InventoryStatCard
                icon={<PackageX className="h-5 w-5 text-[#7a7abf]" />}
                value={inventoryOverview.attentionUnits}
                label="Attention Units"
                bgClass="bg-[#f2f0fa]"
              />
            </div>
          </WmsCompactPanel>
        </div>
      </section>

      <WarehouseFormModal
        open={controller.warehouseModal.open}
        warehouse={controller.warehouseModal.warehouse}
        isSubmitting={controller.isSavingWarehouse}
        onClose={controller.closeWarehouseModal}
        onSubmit={controller.submitWarehouse}
      />

      <LocationFormModal
        open={controller.locationModal.open}
        warehouse={activeWarehouse}
        location={controller.locationModal.location}
        draft={controller.locationModal.draft}
        isSubmitting={controller.isSavingLocation}
        onClose={controller.closeLocationModal}
        onSubmit={controller.submitLocation}
      />

      <BinSerializationModal
        open={!!binModalTarget}
        target={binModalTarget}
        onClose={() => setBinModalTarget(null)}
      />
    </div>
  );
}

const DEFAULT_RACK_BIN_CAPACITY = 6;

function getRackBinCapacity(rack: WmsLocationTreeNode) {
  return rack.capacity && rack.capacity > 0 ? rack.capacity : DEFAULT_RACK_BIN_CAPACITY;
}

function computeSectionMetrics(section: WmsLocationTreeNode) {
  const rackCount = section.children.length;
  const totalCapacity = section.children.reduce((total, rack) => total + getRackBinCapacity(rack), 0);
  const usedSlots = section.children.reduce((total, rack) => total + rack.children.length, 0);
  const emptySlots = Math.max(0, totalCapacity - usedSlots);
  const utilization = totalCapacity > 0
    ? Math.min(100, Math.round((usedSlots / totalCapacity) * 100))
    : 0;

  return {
    rackCount,
    totalCapacity,
    usedSlots,
    emptySlots,
    utilization,
  };
}

function computeWarehouseMetrics(sections: WmsLocationTreeNode[]) {
  const totals = sections.reduce(
    (accumulator, section) => {
      const sectionMetrics = computeSectionMetrics(section);
      return {
        totalCapacity: accumulator.totalCapacity + sectionMetrics.totalCapacity,
        usedSlots: accumulator.usedSlots + sectionMetrics.usedSlots,
      };
    },
    { totalCapacity: 0, usedSlots: 0 },
  );

  const emptySlots = Math.max(0, totals.totalCapacity - totals.usedSlots);
  const utilization = totals.totalCapacity > 0
    ? Math.min(100, Math.round((totals.usedSlots / totals.totalCapacity) * 100))
    : 0;

  return {
    totalCapacity: totals.totalCapacity,
    usedSlots: totals.usedSlots,
    emptySlots,
    utilization,
  };
}

function findBinContextById(
  sections: WmsLocationTreeNode[],
  binId: string,
): { section: WmsLocationTreeNode; rack: WmsLocationTreeNode; bin: WmsLocationTreeNode } | null {
  for (const section of sections) {
    for (const rack of section.children) {
      const bin = rack.children.find((child) => child.id === binId && child.kind === 'BIN');
      if (bin) {
        return { section, rack, bin };
      }
    }
  }

  return null;
}

/* ── Inventory stat card (matches reference 2×2 style) ── */
function InventoryStatCard({
  icon,
  value,
  label,
  bgClass,
}: {
  icon: ReactNode;
  value: number;
  label: string;
  bgClass: string;
}) {
  return (
    <div className="rounded-[16px] border border-[#dce4ea] bg-[#fbfcfc] px-3.5 py-3">
      <div className="flex items-center">
        <div className={`flex h-9 w-9 items-center justify-center rounded-[10px] ${bgClass}`}>
          {icon}
        </div>
      </div>
      <p className="mt-2 text-[22px] font-bold tabular-nums text-[#12384b]">
        {value.toLocaleString()}
      </p>
      <p className="text-[11.5px] text-[#7b8e9c]">{label}</p>
    </div>
  );
}
