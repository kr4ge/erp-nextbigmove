'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Barcode, Boxes, Printer, ScanLine, Warehouse } from 'lucide-react';
import {
  InventoryUnitLabelSheet,
  InventoryUnitLabelSheetModal,
} from '../_components/inventory-unit-label-sheet-modal';
import { WmsPageHeader } from '../../_components/wms-page-header';
import { WmsSectionCard } from '../../_components/wms-section-card';
import { WmsStatCard } from '../../_components/wms-stat-card';
import { InventoryEmptyState } from '../_components/inventory-empty-state';
import { InventoryUnitStatusBadge } from '../_components/inventory-unit-status-badge';
import { fetchInventoryUnits } from '../_services/inventory.service';
import { formatDateTime, formatMoney } from '../_utils/inventory-format';

export default function InventoryUnitsPage() {
  const [printSheet, setPrintSheet] = useState<InventoryUnitLabelSheet | null>(
    null,
  );

  const unitsQuery = useQuery({
    queryKey: ['wms-inventory-units'],
    queryFn: () => fetchInventoryUnits(),
  });

  const unitsError =
    unitsQuery.error instanceof Error ? unitsQuery.error.message : null;
  const units = unitsQuery.data || [];
  const availableCount = units.filter((unit) => unit.status === 'AVAILABLE').length;
  const assignedLots = new Set(units.map((unit) => unit.lot.id)).size;
  const serializedSkus = new Set(
    units.map((unit) => unit.skuProfile?.id || unit.sku).filter(Boolean),
  ).size;

  const tableRows = useMemo(
    () =>
      units.map((unit) => ({
        ...unit,
        sourceCode:
          unit.receiptSource?.receiptCode ||
          unit.adjustmentSource?.adjustmentCode ||
          unit.lastReferenceId ||
          '—',
      })),
    [units],
  );

  const batchGroups = useMemo(() => {
    const grouped = new Map<
      string,
      {
        lotId: string;
        lotCode: string;
        productName: string;
        variationName: string | null;
        sku: string;
        sourceCode: string;
        locationLabel: string;
        warehouseName: string;
        unitCost: number;
        units: typeof tableRows;
      }
    >();

    for (const unit of tableRows) {
      const existing = grouped.get(unit.lot.id);
      if (existing) {
        existing.units.push(unit);
        continue;
      }

      grouped.set(unit.lot.id, {
        lotId: unit.lot.id,
        lotCode: unit.lot.lotCode,
        productName: unit.productName,
        variationName: unit.variationName,
        sku: unit.skuProfile?.code || unit.sku,
        sourceCode: unit.sourceCode,
        locationLabel: `${unit.location.name} · ${unit.location.code}`,
        warehouseName: unit.warehouse.name,
        unitCost: unit.lot.unitCost,
        units: [unit],
      });
    }

    return Array.from(grouped.values())
      .map((group) => ({
        ...group,
        units: [...group.units].sort((left, right) => left.batchSequence - right.batchSequence),
      }))
      .sort((left, right) => {
        const leftReceivedAt = left.units[0]?.receivedAt || '';
        const rightReceivedAt = right.units[0]?.receivedAt || '';
        return rightReceivedAt.localeCompare(leftReceivedAt);
      });
  }, [tableRows]);

  const openBatchPrint = (lotId: string, unitId?: string) => {
    const batch = batchGroups.find((entry) => entry.lotId === lotId);
    if (!batch) {
      return;
    }

    const unitsToPrint = unitId
      ? batch.units.filter((unit) => unit.id === unitId)
      : batch.units;
    const serialStart = unitsToPrint[0]?.serialNo;
    const serialEnd = unitsToPrint.at(-1)?.serialNo;

    setPrintSheet({
      eyebrow: unitId ? 'Unit Label' : 'Batch Label Sheet',
      title: batch.sku,
      subtitle: `${batch.productName}${batch.variationName ? ` · ${batch.variationName}` : ''}`,
      metadata: unitId
        ? `Lot ${batch.lotCode}`
        : `${batch.lotCode} · ${batch.units.length} units · ${serialStart}–${serialEnd}`,
      labels: unitsToPrint.map((unit) => ({
        id: unit.id,
        serialNo: unit.serialNo,
        batchSequence: unit.batchSequence,
        unitBarcode: unit.unitBarcode,
        sku: unit.skuProfile?.code || unit.sku,
        productName: unit.productName,
        variationName: unit.variationName,
        lotCode: unit.lot.lotCode,
        locationLabel: `${unit.location.code} · ${unit.location.name}`,
        sourceLabel: unit.sourceCode,
      })),
    });
  };

  return (
    <div className="space-y-6">
      <WmsPageHeader
        title="Units"
        description="One row per physical stock unit generated during inbound posting."
        eyebrow="Serialized Stock"
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <WmsStatCard
          label="Units"
          value={units.length}
          description="Tracked physical pieces"
          icon={Boxes}
        />
        <WmsStatCard
          label="Available"
          value={availableCount}
          description="Ready for allocation"
          icon={ScanLine}
          accent="emerald"
        />
        <WmsStatCard
          label="Lots"
          value={assignedLots}
          description="Batches with serialized stock"
          icon={Warehouse}
          accent="amber"
        />
        <WmsStatCard
          label="Serialized SKUs"
          value={serializedSkus}
          description="Profiles producing unit labels"
          icon={Barcode}
          accent="orange"
        />
      </div>

      <WmsSectionCard
        title="Batch Label Sheets"
        metadata={`${batchGroups.length} active batches`}
      >
        {unitsQuery.isError ? (
          <InventoryEmptyState
            title="Unable to group serialized batches"
            description={
              unitsError || 'The units feed could not be grouped into printable batch sheets.'
            }
          />
        ) : unitsQuery.isLoading ? (
          <InventoryEmptyState
            title="Preparing label sheets"
            description="Grouping serialized units by lot and inbound source."
          />
        ) : batchGroups.length === 0 ? (
          <InventoryEmptyState
            title="No printable batches yet"
            description="Post a serialized stock receipt first, then print one cut sheet per lot."
          />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {batchGroups.map((batch) => {
              const serialStart = batch.units[0]?.serialNo;
              const serialEnd = batch.units.at(-1)?.serialNo;

              return (
                <div
                  key={batch.lotId}
                  className="rounded-[24px] border border-slate-200 bg-[linear-gradient(135deg,rgba(249,115,22,0.08),rgba(255,255,255,1)_55%)] p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
                        {batch.lotCode}
                      </div>
                      <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
                        {batch.productName}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {batch.variationName || 'Default variation'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openBatchPrint(batch.lotId)}
                      className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-4 py-2 text-sm font-semibold text-orange-700 transition hover:border-orange-300 hover:bg-orange-50"
                    >
                      <Printer className="h-4 w-4" />
                      Print Batch
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        SKU
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-950">
                        {batch.sku}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Units
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-950">
                        {batch.units.length}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Serial Range
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-950">
                        {serialStart}–{serialEnd}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        COGS
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-950">
                        {formatMoney(batch.unitCost)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                      {batch.sourceCode}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                      {batch.locationLabel}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                      {batch.warehouseName}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </WmsSectionCard>

      <WmsSectionCard title="Unit Directory" metadata={`${units.length} rows`}>
        {unitsQuery.isError ? (
          <InventoryEmptyState
            title="Units endpoint unavailable"
            description={
              unitsError || 'Unable to load /wms/inventory/units. Check API runtime and migration state.'
            }
          />
        ) : unitsQuery.isLoading ? (
          <InventoryEmptyState
            title="Loading units"
            description="Tracing serialized stock from inbound records."
          />
        ) : units.length === 0 ? (
          <InventoryEmptyState
            title="No serialized units yet"
            description="Post a stock receipt or positive adjustment for a serialized product profile."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <th className="pb-3 pr-4">Serial</th>
                  <th className="pb-3 pr-4">Unit Barcode</th>
                  <th className="pb-3 pr-4">Product</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3 pr-4">Lot</th>
                  <th className="pb-3 pr-4">Location</th>
                  <th className="pb-3 pr-4">Source</th>
                  <th className="pb-3 pr-4">Received</th>
                  <th className="pb-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((unit) => (
                  <tr
                    key={unit.id}
                    className="border-b border-slate-100 align-top last:border-b-0"
                  >
                    <td className="py-4 pr-4">
                      <div className="font-mono text-xs font-semibold tracking-[0.12em] text-slate-950">
                        {unit.serialNo}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Batch #{unit.batchSequence}
                      </div>
                    </td>
                    <td className="py-4 pr-4">
                      <div className="font-mono text-xs font-semibold tracking-[0.12em] text-slate-950">
                        {unit.unitBarcode}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {unit.skuProfile?.code || unit.sku}
                      </div>
                    </td>
                    <td className="py-4 pr-4">
                      <div className="font-medium text-slate-950">{unit.productName}</div>
                      <div className="text-xs text-slate-500">
                        {unit.variationName || unit.variationId || '—'}
                      </div>
                    </td>
                    <td className="py-4 pr-4">
                      <InventoryUnitStatusBadge status={unit.status} />
                    </td>
                    <td className="py-4 pr-4">
                      <div className="font-medium text-slate-950">{unit.lot.lotCode}</div>
                      <div className="text-xs text-slate-500">
                        Batch #{unit.batchSequence} · {formatMoney(unit.lot.unitCost)}
                        {unit.lot.supplierBatchNo ? ` · ${unit.lot.supplierBatchNo}` : ''}
                      </div>
                    </td>
                    <td className="py-4 pr-4">
                      <div className="font-medium text-slate-950">{unit.location.name}</div>
                      <div className="text-xs text-slate-500">
                        {unit.warehouse.code} · {unit.location.code}
                      </div>
                    </td>
                    <td className="py-4 pr-4">
                      <div className="font-medium text-slate-950">{unit.sourceCode}</div>
                      <div className="text-xs text-slate-500">
                        {unit.lastMovementType}
                      </div>
                    </td>
                    <td className="py-4 pr-4 text-slate-600">
                      {formatDateTime(unit.receivedAt)}
                    </td>
                    <td className="py-4 text-right">
                      <button
                        type="button"
                        onClick={() => openBatchPrint(unit.lot.id, unit.id)}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-orange-200 hover:text-orange-700"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        Print Unit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </WmsSectionCard>

      <InventoryUnitLabelSheetModal
        open={Boolean(printSheet)}
        sheet={printSheet}
        onClose={() => setPrintSheet(null)}
      />
    </div>
  );
}
