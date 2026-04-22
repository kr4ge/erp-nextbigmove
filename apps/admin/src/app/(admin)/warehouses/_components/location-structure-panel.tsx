'use client';

import { useMemo, type MouseEvent } from 'react';
import { Edit3, Plus, ScanLine } from 'lucide-react';
import { WmsCompactPanel } from '../../_components/wms-compact-panel';
import type { CreateWmsLocationInput, WmsLocationTreeNode, WmsWarehouseDetail } from '../_types/warehouse';

const EMPTY_LOCATIONS: WmsLocationTreeNode[] = [];

/**
 * Pastel palette per section — cycles through 4 tones.
 * A = green, B = yellow/gold, C = lavender/purple, D = teal/mint
 */
const SECTION_PALETTES = [
  { filled: 'bg-[#d5eddb] text-[#2a5a3e] border-[#b9dcc6]', empty: 'border-[#d5eddb] text-[#8cb89e]' },
  { filled: 'bg-[#f5e7b8] text-[#5b4c1f] border-[#e8d899]', empty: 'border-[#f0e4c4] text-[#bba86e]' },
  { filled: 'bg-[#ddd4f0] text-[#4d3f72] border-[#cfc2e8]', empty: 'border-[#e0d8ee] text-[#a399be]' },
  { filled: 'bg-[#c8e6e9] text-[#2f5b61] border-[#aed7db]', empty: 'border-[#cfe6e8] text-[#85b5ba]' },
];

function formatBinIndexLabel(binIndex: number) {
  return `B${String(binIndex + 1).padStart(2, '0')}`;
}

function buildExpectedBinCode(rackCode: string, binIndex: number) {
  return `${rackCode}-${formatBinIndexLabel(binIndex)}`;
}

function extractBinDisplayLabel(binCode: string, rackCode: string) {
  const matcher = new RegExp(`^${rackCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-?(B\\d+)$`);
  const matched = binCode.match(matcher);
  return matched?.[1] ?? binCode;
}

type LocationStructurePanelProps = {
  warehouse: WmsWarehouseDetail | null;
  selectedSectionId: string | null;
  onSelectSection: (sectionId: string | null) => void;
  onEditWarehouse: (warehouse: WmsWarehouseDetail) => void;
  onCreateLocation: (draft?: Partial<CreateWmsLocationInput>) => void;
  onEditLocation: (location: WmsLocationTreeNode) => void;
  onOpenBin: (context: {
    section: WmsLocationTreeNode;
    rack: WmsLocationTreeNode;
    bin: WmsLocationTreeNode;
  }) => void;
};

export function LocationStructurePanel({
  warehouse,
  selectedSectionId,
  onSelectSection,
  onEditWarehouse,
  onCreateLocation,
  onEditLocation,
  onOpenBin,
}: LocationStructurePanelProps) {
  const structuralLocations = warehouse?.structuralLocations ?? EMPTY_LOCATIONS;

  const focusedSectionIdResolved = useMemo(() => {
    if (!structuralLocations.length) return null;
    if (selectedSectionId && structuralLocations.some((e) => e.id === selectedSectionId)) {
      return selectedSectionId;
    }
    return null;
  }, [selectedSectionId, structuralLocations]);

  if (!warehouse) {
    return (
      <WmsCompactPanel title="Structure" eyebrow="Phase 2">
        <div className="rounded-[24px] border border-dashed border-[#d7e0e7] bg-[#fbfcfc] px-5 py-10 text-center">
          <p className="text-sm font-medium text-[#12384b]">No WMS warehouse yet</p>
          <p className="mt-1 text-sm text-[#6b7f8c]">
            Create the first warehouse to start mapping sections, racks, bins, and operational zones.
          </p>
        </div>
      </WmsCompactPanel>
    );
  }

  const headerActions = (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onEditWarehouse(warehouse)}
        className="inline-flex items-center gap-1.5 rounded-full border border-[#d7e0e7] bg-white px-3.5 py-2 text-[12px] font-medium text-[#1d4b61] transition hover:border-[#c6d4dd] hover:bg-[#f8fafb]"
      >
        <Edit3 className="h-3.5 w-3.5" />
        Edit
      </button>
      <button
        type="button"
        onClick={() => onCreateLocation({ kind: 'SECTION' })}
        className="inline-flex items-center gap-1.5 rounded-full border border-[#d7e0e7] bg-white px-3.5 py-2 text-[12px] font-medium text-[#1d4b61] transition hover:border-[#c6d4dd] hover:bg-[#f8fafb]"
      >
        <Plus className="h-3.5 w-3.5" />
        Add section
      </button>
    </div>
  );

  return (
    <WmsCompactPanel
      title={`Section Overview (${warehouse.stats.sections})`}
      headerActions={headerActions}
    >
      <div className="flex flex-col gap-4">
        {/* Section cards grid */}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {structuralLocations.length > 0 ? (
            structuralLocations.map((section, sectionIndex) => {
              const palette = SECTION_PALETTES[sectionIndex % SECTION_PALETTES.length];
              const isFocused = focusedSectionIdResolved === section.id;
              const maxRacks = section.capacity ?? 12;
              const racks = section.children;

              return (
                <SectionCard
                  key={section.id}
                  section={section}
                  sectionCode={section.code}
                  palette={palette}
                  isFocused={isFocused}
                  maxRacks={maxRacks}
                  racks={racks}
                  onFocus={() => onSelectSection(isFocused ? null : section.id)}
                  onEditSection={(e) => {
                    e.stopPropagation();
                    onEditLocation(section);
                  }}
                  onAddRack={(e) => {
                    e.stopPropagation();
                    onCreateLocation({ kind: 'RACK', parentId: section.id });
                  }}
                  onAddBin={(rack, e) => {
                    e.stopPropagation();
                    onCreateLocation({ kind: 'BIN', parentId: rack.id });
                  }}
                  onOpenBin={(rack, bin, event) => {
                    event.stopPropagation();
                    onOpenBin({ section, rack, bin });
                  }}
                />
              );
            })
          ) : (
            <div className="rounded-[24px] border border-dashed border-[#d7e0e7] bg-[#fbfcfc] px-5 py-10 text-center xl:col-span-4">
              <p className="text-sm font-medium text-[#12384b]">No structural layout yet</p>
              <p className="mt-1 text-sm text-[#6b7f8c]">
                Add sections first, then place racks inside sections and bins inside racks.
              </p>
            </div>
          )}
        </div>

        {/* Operational zone pills */}
        {warehouse.operationalLocations.length > 0 ? (
          <div className="flex items-center gap-2 overflow-x-auto pt-1">
            <ScanLine className="h-3.5 w-3.5 shrink-0 text-[#78909f]" />
            {warehouse.operationalLocations.map((location) => (
              <button
                key={location.id}
                type="button"
                onClick={() => onEditLocation(location)}
                className="shrink-0 rounded-full border border-[#dce4ea] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#12384b] transition hover:border-[#c6d4dd]"
              >
                {location.code}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </WmsCompactPanel>
  );
}

/* ── Section Card ──
 *
 * Layout model:
 *
 *   Section: A – Electronics        2/4
 *   ┌────────────────────────────────────┐
 *   │    A1       │    A2       │  --  │  --   ← rack columns (maxRacks wide)
 *   │  ┌──────┐   │  ┌──────┐   │      │
 *   │  │ B01  │   │  │ B01  │   │      │  ← bin rows (maxBins deep)
 *   │  │ B02  │   │  │ B02  │   │      │
 *   │  │ B03  │   │  │ B03  │   │      │
 *   │  │ B04  │   │  │ B04  │   │      │
 *   │  │ B05  │   │  │ B05  │   │      │
 *   │  │ B06  │   │  │ B06  │   │      │
 *   │  └──────┘   │  └──────┘   │      │
 *   └────────────────────────────────────┘
 *   [ + Add Rack ]  (if focused & under capacity)
 *
 * - Racks are vertical columns side by side
 * - Bins fill top-to-bottom within each rack
 * - Rack identity uses rack code (A1, A2, ...)
 * - Bin identity uses rack-scoped bin code (A1-B01, A1-B02, ...)
 *   and renders as B01/B02 in the slot for readability.
 * - Empty rack columns show dashed placeholders
 * - Racks with no bins show the rack code but empty bin slots
 */

type SectionCardProps = {
  section: WmsLocationTreeNode;
  sectionCode: string;
  palette: (typeof SECTION_PALETTES)[number];
  isFocused: boolean;
  maxRacks: number;
  racks: WmsLocationTreeNode[];
  onFocus: () => void;
  onEditSection: (e: MouseEvent) => void;
  onAddRack: (e: MouseEvent) => void;
  onAddBin: (rack: WmsLocationTreeNode, e: MouseEvent) => void;
  onOpenBin: (rack: WmsLocationTreeNode, bin: WmsLocationTreeNode, e: MouseEvent) => void;
};

function SectionCard({
  section,
  sectionCode,
  palette,
  isFocused,
  maxRacks,
  racks,
  onFocus,
  onEditSection,
  onAddRack,
  onAddBin,
  onOpenBin,
}: SectionCardProps) {
  // Max bins per rack — use the rack's own capacity, or derive from the max across existing racks
  const maxBinsPerRack = Math.max(
    6,
    ...racks.map((r) => r.capacity ?? r.children.length),
  );

  // Build rack column slots (padded to maxRacks)
  const rackSlots = Array.from({ length: maxRacks }, (_, i) => racks[i] ?? null);

  return (
    <section
      className={`rounded-[20px] border bg-white p-4 transition cursor-pointer ${
        isFocused
          ? 'border-[#b8cad5] shadow-[0_12px_32px_-22px_rgba(18,56,75,0.35)]'
          : 'border-[#e3e9ee] hover:border-[#d0dae2]'
      }`}
      onClick={onFocus}
    >
      {/* Section header */}
      <div className="mb-3 flex items-baseline justify-between">
        <button type="button" onClick={onEditSection} className="text-left">
          <span className="text-[13px] font-medium text-[#12384b] hover:text-[#0d2f40]">
            {section.name && section.name !== section.code
              ? `${sectionCode} – ${section.name}`
              : sectionCode}
          </span>
        </button>
        <span className="text-[11px] tabular-nums text-[#8a9daa]">
          {racks.length}/{maxRacks}
        </span>
      </div>

      {/* Rack columns grid */}
      <div
        className="grid gap-[6px]"
        style={{ gridTemplateColumns: `repeat(${maxRacks}, minmax(0, 1fr))` }}
      >
        {rackSlots.map((rack, rackIndex) => {
          if (!rack) {
            // Empty rack column — show placeholder bin slots
            return (
              <div key={`${section.id}-erack-${rackIndex}`} className="flex flex-col gap-[5px]">
                <div className="mb-[3px] flex h-5 items-center justify-center rounded-full border border-dashed border-[#d5dfe6] bg-[#f8fafb] text-[10px] font-semibold text-[#9aabb6]">
                  --
                </div>
                {Array.from({ length: maxBinsPerRack }).map((_, binIdx) => (
                  <div
                    key={`${section.id}-erack-${rackIndex}-ebin-${binIdx}`}
                    className={`flex h-[34px] items-center justify-center rounded-[10px] border border-dashed text-[10px] font-medium ${palette.empty}`}
                  >
                    --
                  </div>
                ))}
              </div>
            );
          }

          // Rack exists — show its bin slots
          const rackMaxBins = rack.capacity ?? maxBinsPerRack;
          const bins = rack.children;

          return (
            <div key={rack.id} className="flex flex-col gap-[5px]">
              <div className="mb-[3px] flex h-5 items-center justify-center rounded-full border border-[#d5dfe6] bg-white text-[10px] font-semibold text-[#5a7180]">
                {rack.code}
              </div>
              {Array.from({ length: rackMaxBins }).map((_, binIdx) => {
                const bin = bins[binIdx] ?? null;
                const binLabel = formatBinIndexLabel(binIdx);

                if (bin) {
                  return (
                    <button
                      key={bin.id}
                      type="button"
                      onClick={(event) => onOpenBin(rack, bin, event)}
                      className={`flex h-[34px] w-full items-center justify-center rounded-[10px] border text-[11px] font-medium transition hover:brightness-[0.97] ${palette.filled}`}
                      title={bin.code}
                    >
                      {extractBinDisplayLabel(bin.code, rack.code)}
                    </button>
                  );
                }

                // Empty bin slot — clickable to add bin
                return (
                  <button
                    key={`${rack.id}-ebin-${binIdx}`}
                    type="button"
                    onClick={(e) => onAddBin(rack, e)}
                    className={`flex h-[34px] items-center justify-center rounded-[10px] border border-dashed text-[10px] font-medium transition hover:border-solid ${palette.empty}`}
                    title={`Create ${buildExpectedBinCode(rack.code, binIdx)}`}
                  >
                    {binLabel}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Add Rack button — only on focused section, and only if under capacity */}
      {isFocused && racks.length < maxRacks ? (
        <button
          type="button"
          onClick={onAddRack}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full border border-dashed border-[#c6d4dd] bg-[#f8fafb] py-2 text-[11px] font-medium text-[#5e7887] transition hover:border-[#12384b] hover:text-[#12384b]"
        >
          <Plus className="h-3 w-3" />
          Add Rack
        </button>
      ) : null}
    </section>
  );
}
