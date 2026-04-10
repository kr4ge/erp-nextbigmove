"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookCopy, Boxes, Layers3, RotateCcw, Search, Wallet } from "lucide-react";
import { WmsPageHeader } from "../../_components/wms-page-header";
import { WmsSectionCard } from "../../_components/wms-section-card";
import { WmsStatCard } from "../../_components/wms-stat-card";
import { WmsTablePagination } from "../../_components/wms-table-pagination";
import { InventoryEmptyState } from "../_components/inventory-empty-state";
import { InventoryLotStatusBadge } from "../_components/inventory-lot-status-badge";
import { fetchInventoryLots } from "../_services/inventory.service";
import { formatMoney, formatQuantity, formatShortDate } from "../_utils/inventory-format";

export default function InventoryLotsPage() {
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const lotsQuery = useQuery({
    queryKey: ["wms-inventory-lots"],
    queryFn: fetchInventoryLots,
  });

  const lotsError = lotsQuery.error instanceof Error ? lotsQuery.error.message : null;
  const lots = lotsQuery.data || [];

  const totalRemaining = lots.reduce((sum, lot) => sum + lot.remainingQuantity, 0);
  const totalLotValue = lots.reduce(
    (sum, lot) => sum + lot.remainingQuantity * lot.unitCost,
    0,
  );
  const activeLots = lots.filter((lot) => lot.status === "ACTIVE").length;

  const warehouseOptions = useMemo(
    () =>
      Array.from(
        new Map(
          lots.map((lot) => [lot.warehouse.id, { id: lot.warehouse.id, label: lot.warehouse.name }]),
        ).values(),
      ).sort((left, right) => left.label.localeCompare(right.label)),
    [lots],
  );

  const statusOptions = useMemo(
    () =>
      Array.from(new Set(lots.map((lot) => lot.status)))
        .sort((left, right) => left.localeCompare(right))
        .map((status) => ({
          value: status,
          label: status.replace(/_/g, " "),
        })),
    [lots],
  );

  const filteredLots = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return lots.filter((lot) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        lot.lotCode.toLowerCase().includes(normalizedSearch) ||
        lot.sku.toLowerCase().includes(normalizedSearch) ||
        lot.productName.toLowerCase().includes(normalizedSearch) ||
        (lot.variationName || "").toLowerCase().includes(normalizedSearch) ||
        (lot.supplierBatchNo || "").toLowerCase().includes(normalizedSearch) ||
        lot.warehouse.name.toLowerCase().includes(normalizedSearch) ||
        (lot.receivedLocation?.name || "").toLowerCase().includes(normalizedSearch);
      const matchesWarehouse =
        warehouseFilter === "ALL" || lot.warehouse.id === warehouseFilter;
      const matchesStatus = statusFilter === "ALL" || lot.status === statusFilter;

      return matchesSearch && matchesWarehouse && matchesStatus;
    });
  }, [lots, search, warehouseFilter, statusFilter]);

  const paginatedLots = useMemo(() => {
    const start = pageIndex * pageSize;
    return filteredLots.slice(start, start + pageSize);
  }, [filteredLots, pageIndex, pageSize]);

  useEffect(() => {
    setPageIndex(0);
  }, [search, warehouseFilter, statusFilter]);

  useEffect(() => {
    const pageCount = Math.max(Math.ceil(filteredLots.length / pageSize), 1);

    if (pageIndex > pageCount - 1) {
      setPageIndex(pageCount - 1);
    }
  }, [filteredLots.length, pageIndex, pageSize]);

  function resetFilters() {
    setSearch("");
    setWarehouseFilter("ALL");
    setStatusFilter("ALL");
  }

  return (
    <div className="space-y-6">
      <WmsPageHeader
        title="Lots & COGS"
        description="Inbound batches, remaining quantity, and active cost layers."
        eyebrow="Inventory Core"
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <WmsStatCard label="Lots" value={lots.length} icon={BookCopy} />
        <WmsStatCard
          label="Active"
          value={activeLots}
          icon={Layers3}
          accent="emerald"
        />
        <WmsStatCard
          label="Remaining"
          value={formatQuantity(totalRemaining)}
          icon={Boxes}
          accent="amber"
        />
        <WmsStatCard
          label="Lot Value"
          value={formatMoney(totalLotValue)}
          icon={Wallet}
          accent="orange"
        />
      </div>

      <WmsSectionCard
        title="Lot Feed"
        metadata={`${filteredLots.length} rows`}
        bodyClassName="p-0"
        className="mb-2"
      >
        <div className="border-b border-slate-100 px-3 py-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative min-w-0 xl:flex-[1.2]">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search lot, product, batch, or warehouse"
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
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100 xl:w-[180px]"
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

        {lotsQuery.isError ? (
          <div className="p-4">
            <InventoryEmptyState
              title="Lots endpoint unavailable"
              description={
                lotsError ||
                "Unable to load /wms/inventory/lots. Check API runtime and migration state."
              }
            />
          </div>
        ) : lotsQuery.isLoading ? (
          <div className="p-4">
            <InventoryEmptyState
              title="Loading lots"
              description="Pulling inbound batches and cost layers."
            />
          </div>
        ) : filteredLots.length === 0 ? (
          <div className="p-4">
            <InventoryEmptyState
              title="No lots found"
              description="Try widening the filters or post inbound stock into inventory first."
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-[34%]" />
                  <col className="w-[16%]" />
                  <col className="w-[12%]" />
                  <col className="w-[10%]" />
                  <col className="w-[10%]" />
                  <col className="w-[10%]" />
                  <col className="w-[8%]" />
                </colgroup>
                <thead className="border-y border-slate-200 bg-slate-50/70">
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    <th className="px-4 py-3.5">Lot</th>
                    <th className="px-4 py-3.5">Warehouse</th>
                    <th className="px-4 py-3.5 text-right">Initial</th>
                    <th className="px-4 py-3.5 text-right">Remain</th>
                    <th className="px-4 py-3.5 text-right">Unit COGS</th>
                    <th className="px-4 py-3.5 text-right">Received</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLots.map((lot) => (
                    <tr
                      key={lot.id}
                      className="border-b border-slate-100 align-top transition-colors hover:bg-slate-50/70 last:border-b-0"
                    >
                      <td className="px-4 py-4">
                        <div className="flex min-w-0 flex-col gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-[15px] font-semibold text-slate-950">
                              {lot.productName}
                            </p>
                            {lot.variationName ? (
                              <p className="truncate text-sm text-slate-500">
                                {lot.variationName}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-700">
                              {lot.sku}
                            </span>
                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                              {lot.lotCode}
                            </span>
                            {lot.supplierBatchNo ? (
                              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600">
                                {lot.supplierBatchNo}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-950">
                            {lot.warehouse.name}
                          </p>
                          <p className="truncate text-sm text-slate-500">
                            {lot.receivedLocation?.name || lot.warehouse.code}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right font-medium tabular-nums text-slate-600">
                        {formatQuantity(lot.initialQuantity)}
                      </td>
                      <td className="px-4 py-4 text-right font-semibold tabular-nums text-slate-950">
                        {formatQuantity(lot.remainingQuantity)}
                      </td>
                      <td className="px-4 py-4 text-right font-semibold tabular-nums text-slate-950">
                        {formatMoney(lot.unitCost, lot.currency)}
                      </td>
                      <td className="px-4 py-4 text-right text-slate-600">
                        {formatShortDate(lot.receivedAt)}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <InventoryLotStatusBadge status={lot.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <WmsTablePagination
              pageIndex={pageIndex}
              pageSize={pageSize}
              totalItems={filteredLots.length}
              onPageIndexChange={setPageIndex}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[10, 25, 50, 100]}
            />
          </>
        )}
      </WmsSectionCard>
    </div>
  );
}
