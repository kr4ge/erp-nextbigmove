"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Barcode,
  Boxes,
  Printer,
  RotateCcw,
  ScanLine,
  Search,
  Warehouse,
} from "lucide-react";
import {
  InventoryUnitLabelSheet,
  InventoryUnitLabelSheetModal,
} from "../_components/inventory-unit-label-sheet-modal";
import { InventoryEmptyState } from "../_components/inventory-empty-state";
import { InventoryUnitStatusBadge } from "../_components/inventory-unit-status-badge";
import { fetchInventoryUnits } from "../_services/inventory.service";
import { formatMoney } from "../_utils/inventory-format";
import { WmsPageHeader } from "../../_components/wms-page-header";
import { WmsSectionCard } from "../../_components/wms-section-card";
import { WmsStatCard } from "../../_components/wms-stat-card";
import { WmsTablePagination } from "../../_components/wms-table-pagination";

const UUID_LIKE_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getDisplayCode(value: string | null | undefined) {
  if (!value || UUID_LIKE_PATTERN.test(value)) {
    return null;
  }

  return value;
}

function getVariationLabel(value: string | null | undefined) {
  if (!value || value.trim().length === 0) {
    return null;
  }

  return value;
}

function formatReceivedLabel(value: string) {
  const date = new Date(value);

  return `${date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })} · ${date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

export default function InventoryUnitsPage() {
  const [printSheet, setPrintSheet] = useState<InventoryUnitLabelSheet | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const unitsQuery = useQuery({
    queryKey: ["wms-inventory-units"],
    queryFn: () => fetchInventoryUnits(),
  });

  const unitsError =
    unitsQuery.error instanceof Error ? unitsQuery.error.message : null;
  const units = unitsQuery.data || [];
  const availableCount = units.filter((unit) => unit.status === "AVAILABLE").length;
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
          "—",
      })),
    [units],
  );

  const warehouseOptions = useMemo(
    () =>
      Array.from(
        new Map(
          tableRows.map((unit) => [
            unit.warehouse.id,
            { id: unit.warehouse.id, label: unit.warehouse.name },
          ]),
        ).values(),
      ).sort((left, right) => left.label.localeCompare(right.label)),
    [tableRows],
  );

  const statusOptions = useMemo(
    () =>
      Array.from(new Set(tableRows.map((unit) => unit.status)))
        .sort((left, right) => left.localeCompare(right))
        .map((status) => ({
          value: status,
          label: status.replace(/_/g, " "),
        })),
    [tableRows],
  );

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return tableRows.filter((unit) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        unit.serialNo.toLowerCase().includes(normalizedSearch) ||
        unit.unitBarcode.toLowerCase().includes(normalizedSearch) ||
        unit.sku.toLowerCase().includes(normalizedSearch) ||
        unit.productName.toLowerCase().includes(normalizedSearch) ||
        (unit.variationName || "").toLowerCase().includes(normalizedSearch) ||
        unit.lot.lotCode.toLowerCase().includes(normalizedSearch) ||
        unit.location.name.toLowerCase().includes(normalizedSearch) ||
        unit.warehouse.name.toLowerCase().includes(normalizedSearch) ||
        unit.sourceCode.toLowerCase().includes(normalizedSearch);
      const matchesWarehouse =
        warehouseFilter === "ALL" || unit.warehouse.id === warehouseFilter;
      const matchesStatus = statusFilter === "ALL" || unit.status === statusFilter;

      return matchesSearch && matchesWarehouse && matchesStatus;
    });
  }, [search, statusFilter, tableRows, warehouseFilter]);

  const paginatedRows = useMemo(() => {
    const start = pageIndex * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, pageIndex, pageSize]);

  useEffect(() => {
    setPageIndex(0);
  }, [search, warehouseFilter, statusFilter]);

  useEffect(() => {
    const pageCount = Math.max(Math.ceil(filteredRows.length / pageSize), 1);
    if (pageIndex > pageCount - 1) {
      setPageIndex(pageCount - 1);
    }
  }, [filteredRows.length, pageIndex, pageSize]);

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
        units: [...group.units].sort(
          (left, right) => left.batchSequence - right.batchSequence,
        ),
      }))
      .sort((left, right) => {
        const leftReceivedAt = left.units[0]?.receivedAt || "";
        const rightReceivedAt = right.units[0]?.receivedAt || "";
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
      eyebrow: unitId ? "Unit Label" : "Batch Label Sheet",
      title: batch.sku,
      subtitle: `${batch.productName}${
        batch.variationName ? ` · ${batch.variationName}` : ""
      }`,
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

  function resetFilters() {
    setSearch("");
    setWarehouseFilter("ALL");
    setStatusFilter("ALL");
  }

  return (
    <div className="space-y-6">
      <WmsPageHeader
        title="Units"
        description="Serialized stock and printable batch labels."
        eyebrow="Serialized Stock"
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <WmsStatCard label="Units" value={units.length} icon={Boxes} />
        <WmsStatCard
          label="Available"
          value={availableCount}
          icon={ScanLine}
          accent="emerald"
        />
        <WmsStatCard
          label="Lots"
          value={assignedLots}
          icon={Warehouse}
          accent="amber"
        />
        <WmsStatCard
          label="Serialized SKUs"
          value={serializedSkus}
          icon={Barcode}
          accent="orange"
        />
      </div>

      <WmsSectionCard
        title="Print Batches"
        metadata={`${batchGroups.length} batches`}
        bodyClassName="p-0"
        className="mb-2"
      >
        {unitsQuery.isError ? (
          <div className="p-4">
            <InventoryEmptyState
              title="Unable to group printable batches"
              description={
                unitsError ||
                "The units feed could not be grouped into printable batch sheets."
              }
            />
          </div>
        ) : unitsQuery.isLoading ? (
          <div className="p-4">
            <InventoryEmptyState
              title="Preparing print batches"
              description="Grouping serialized units by lot."
            />
          </div>
        ) : batchGroups.length === 0 ? (
          <div className="p-4">
            <InventoryEmptyState
              title="No printable batches yet"
              description="Post a serialized receipt first."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed text-sm">
              <colgroup>
                <col className="w-[30%]" />
                <col className="w-[14%]" />
                <col className="w-[16%]" />
                <col className="w-[12%]" />
                <col className="w-[18%]" />
                <col className="w-[10%]" />
              </colgroup>
              <thead className="border-y border-slate-200 bg-slate-50/70">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <th className="px-4 py-3.5">Batch</th>
                  <th className="px-4 py-3.5 text-right">Units</th>
                  <th className="px-4 py-3.5 text-right">Range</th>
                  <th className="px-4 py-3.5 text-right">COGS</th>
                  <th className="px-4 py-3.5">Location</th>
                  <th className="px-4 py-3.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {batchGroups.map((batch) => {
                  const serialStart = batch.units[0]?.serialNo;
                  const serialEnd = batch.units.at(-1)?.serialNo;
                  const variationLabel = getVariationLabel(batch.variationName);

                  return (
                    <tr
                      key={batch.lotId}
                      className="border-b border-slate-100 align-top transition-colors hover:bg-slate-50/70 last:border-b-0"
                    >
                      <td className="px-4 py-4">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-950">
                            {batch.productName}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-700">
                              {batch.lotCode}
                            </span>
                            {variationLabel ? (
                              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                                {variationLabel}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right font-semibold tabular-nums text-slate-950">
                        {batch.units.length}
                      </td>
                      <td className="px-4 py-4 text-right font-medium tabular-nums text-slate-700">
                        {serialStart}–{serialEnd}
                      </td>
                      <td className="px-4 py-4 text-right font-semibold tabular-nums text-slate-950">
                        {formatMoney(batch.unitCost)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-950">
                            {batch.locationLabel}
                          </p>
                          <p className="truncate text-sm text-slate-500">
                            {batch.warehouseName}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => openBatchPrint(batch.lotId)}
                          className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-3 py-2 text-xs font-semibold text-orange-700 transition hover:border-orange-300 hover:bg-orange-50"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          Print
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </WmsSectionCard>

      <WmsSectionCard
        title="Unit Directory"
        metadata={`${filteredRows.length} rows`}
        bodyClassName="p-0"
        className="mb-2"
      >
        <div className="border-b border-slate-100 px-3 py-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative min-w-0 xl:flex-[1.15]">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search unit, lot, product, or receipt"
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
              />
            </div>

            <select
              value={warehouseFilter}
              onChange={(event) => setWarehouseFilter(event.target.value)}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100 xl:w-[220px]"
            >
              <option value="ALL">All Warehouses</option>
              {warehouseOptions.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.label}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100 xl:w-[190px]"
            >
              <option value="ALL">All Statuses</option>
              {statusOptions.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-orange-200 hover:text-orange-700"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
          </div>
        </div>

        {unitsQuery.isError ? (
          <div className="p-4">
            <InventoryEmptyState
              title="Units endpoint unavailable"
              description={
                unitsError ||
                "Unable to load /wms/inventory/units. Check API runtime and migration state."
              }
            />
          </div>
        ) : unitsQuery.isLoading ? (
          <div className="p-4">
            <InventoryEmptyState
              title="Loading units"
              description="Tracing serialized stock from inbound records."
            />
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="p-4">
            <InventoryEmptyState
              title="No units found"
              description="Try widening the filters or post serialized inbound stock first."
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-[24%]" />
                  <col className="w-[23%]" />
                  <col className="w-[10%]" />
                  <col className="w-[15%]" />
                  <col className="w-[14%]" />
                  <col className="w-[8%]" />
                  <col className="w-[6%]" />
                </colgroup>
                <thead className="border-y border-slate-200 bg-slate-50/70">
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    <th className="px-4 py-3.5">Unit</th>
                    <th className="px-4 py-3.5">Product</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                    <th className="px-4 py-3.5">Lot</th>
                    <th className="px-4 py-3.5">Location</th>
                    <th className="px-4 py-3.5 text-right">Received</th>
                    <th className="px-4 py-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((unit) => {
                    const received = formatReceivedLabel(unit.receivedAt);
                    const unitCode = getDisplayCode(unit.skuProfile?.code || unit.sku);
                    const variationLabel = getVariationLabel(unit.variationName);

                    return (
                      <tr
                        key={unit.id}
                        className="border-b border-slate-100 align-top transition-colors hover:bg-slate-50/70 last:border-b-0"
                      >
                        <td className="px-4 py-4">
                          <div className="space-y-2">
                            <div className="truncate font-mono text-xs font-semibold tracking-[0.12em] text-slate-950">
                              {unit.unitBarcode}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                                {unit.serialNo}
                              </span>
                              {unitCode ? (
                                <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-700">
                                  {unitCode}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="min-w-0">
                            <p className="truncate whitespace-nowrap font-medium text-slate-950">
                              {unit.productName}
                            </p>
                            {variationLabel ? (
                              <p className="truncate whitespace-nowrap text-sm text-slate-500">
                                {variationLabel}
                              </p>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <InventoryUnitStatusBadge status={unit.status} />
                        </td>
                        <td className="px-4 py-4">
                          <div className="min-w-0">
                            <p className="truncate whitespace-nowrap font-medium text-slate-950">
                              {unit.lot.lotCode}
                            </p>
                            <p className="truncate whitespace-nowrap text-sm text-slate-500">
                              {formatMoney(unit.lot.unitCost)}
                              {unit.sourceCode !== "—" ? ` · ${unit.sourceCode}` : ""}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="min-w-0">
                            <p className="truncate whitespace-nowrap font-medium text-slate-950">
                              {unit.location.name}
                            </p>
                            <p className="truncate whitespace-nowrap text-sm text-slate-500">
                              {unit.warehouse.code} · {unit.location.code}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className="whitespace-nowrap font-medium text-slate-700">
                            {received}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => openBatchPrint(unit.lot.id, unit.id)}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-orange-200 hover:text-orange-700"
                          >
                            <Printer className="h-3.5 w-3.5" />
                            Print
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <WmsTablePagination
              pageIndex={pageIndex}
              pageSize={pageSize}
              totalItems={filteredRows.length}
              onPageIndexChange={setPageIndex}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[10, 25, 50, 100]}
            />
          </>
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
