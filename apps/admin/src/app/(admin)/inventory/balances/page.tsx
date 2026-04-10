"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Boxes, PackageSearch, RotateCcw, Search, Warehouse } from "lucide-react";
import { WmsPageHeader } from "../../_components/wms-page-header";
import { WmsSectionCard } from "../../_components/wms-section-card";
import { WmsStatCard } from "../../_components/wms-stat-card";
import { WmsTablePagination } from "../../_components/wms-table-pagination";
import { InventoryEmptyState } from "../_components/inventory-empty-state";
import { fetchInventoryBalances } from "../_services/inventory.service";
import { formatMoney, formatQuantity } from "../_utils/inventory-format";

export default function InventoryBalancesPage() {
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("ALL");
  const [locationFilter, setLocationFilter] = useState("ALL");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const balancesQuery = useQuery({
    queryKey: ["wms-inventory-balances"],
    queryFn: fetchInventoryBalances,
  });

  const balancesError =
    balancesQuery.error instanceof Error ? balancesQuery.error.message : null;
  const balances = balancesQuery.data || [];

  const totalOnHand = balances.reduce(
    (sum, balance) => sum + balance.onHandQuantity,
    0,
  );
  const totalAvailable = balances.reduce(
    (sum, balance) => sum + balance.availableQuantity,
    0,
  );
  const totalValue = balances.reduce(
    (sum, balance) => sum + (balance.inventoryValue || 0),
    0,
  );

  const warehouseOptions = useMemo(
    () =>
      Array.from(
        new Map(
          balances.map((balance) => [
            balance.warehouse.id,
            { id: balance.warehouse.id, label: balance.warehouse.name },
          ]),
        ).values(),
      ).sort((left, right) => left.label.localeCompare(right.label)),
    [balances],
  );

  const locationOptions = useMemo(() => {
    const scoped = balances.filter(
      (balance) =>
        warehouseFilter === "ALL" || balance.warehouse.id === warehouseFilter,
    );

    return Array.from(
      new Map(
        scoped.map((balance) => [
          balance.location.id,
          { id: balance.location.id, label: balance.location.name },
        ]),
      ).values(),
    ).sort((left, right) => left.label.localeCompare(right.label));
  }, [balances, warehouseFilter]);

  const filteredBalances = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return balances.filter((balance) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        balance.sku.toLowerCase().includes(normalizedSearch) ||
        balance.productName.toLowerCase().includes(normalizedSearch) ||
        (balance.variationName || "").toLowerCase().includes(normalizedSearch) ||
        balance.warehouse.name.toLowerCase().includes(normalizedSearch) ||
        balance.location.name.toLowerCase().includes(normalizedSearch);
      const matchesWarehouse =
        warehouseFilter === "ALL" || balance.warehouse.id === warehouseFilter;
      const matchesLocation =
        locationFilter === "ALL" || balance.location.id === locationFilter;

      return matchesSearch && matchesWarehouse && matchesLocation;
    });
  }, [balances, locationFilter, search, warehouseFilter]);

  const paginatedBalances = useMemo(() => {
    const start = pageIndex * pageSize;
    return filteredBalances.slice(start, start + pageSize);
  }, [filteredBalances, pageIndex, pageSize]);

  useEffect(() => {
    setPageIndex(0);
  }, [search, warehouseFilter, locationFilter]);

  useEffect(() => {
    if (
      locationFilter !== "ALL" &&
      !locationOptions.some((location) => location.id === locationFilter)
    ) {
      setLocationFilter("ALL");
    }
  }, [locationFilter, locationOptions]);

  useEffect(() => {
    const pageCount = Math.max(
      Math.ceil(filteredBalances.length / pageSize),
      1,
    );

    if (pageIndex > pageCount - 1) {
      setPageIndex(pageCount - 1);
    }
  }, [filteredBalances.length, pageIndex, pageSize]);

  function resetFilters() {
    setSearch("");
    setWarehouseFilter("ALL");
    setLocationFilter("ALL");
  }

  return (
    <div className="space-y-6">
      <WmsPageHeader
        title="Balances"
        description="Current stock positions by warehouse and bin."
        eyebrow="Inventory Core"
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <WmsStatCard
          label="Rows"
          value={balances.length}
          description="Tracked balance rows"
          icon={PackageSearch}
        />
        <WmsStatCard
          label="On Hand"
          value={formatQuantity(totalOnHand)}
          description="Physical stock units"
          icon={Boxes}
          accent="emerald"
        />
        <WmsStatCard
          label="Available"
          value={formatQuantity(totalAvailable)}
          description="Ready to allocate"
          icon={Boxes}
          accent="amber"
        />
        <WmsStatCard
          label="Value"
          value={formatMoney(totalValue)}
          description="Inventory carrying value"
          icon={Warehouse}
          accent="orange"
        />
      </div>

      <WmsSectionCard
        title="Balance Feed"
        metadata={`${filteredBalances.length} rows`}
        bodyClassName="p-0"
      >
        <div className="border-b border-slate-100 px-3 py-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative min-w-0 xl:flex-[1.2]">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search SKU, product, warehouse, or location"
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
              value={locationFilter}
              onChange={(event) => setLocationFilter(event.target.value)}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100 xl:w-[220px]"
            >
              <option value="ALL">All Locations</option>
              {locationOptions.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.label}
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

        {balancesQuery.isError ? (
          <div className="p-4">
            <InventoryEmptyState
              title="Balances endpoint unavailable"
              description={
                balancesError ||
                "Unable to load /wms/inventory/balances. Check API runtime and migration state."
              }
            />
          </div>
        ) : balancesQuery.isLoading ? (
          <div className="p-4">
            <InventoryEmptyState
              title="Loading balances"
              description="Pulling current stock positions."
            />
          </div>
        ) : filteredBalances.length === 0 ? (
          <div className="p-4">
            <InventoryEmptyState
              title="No balances found"
              description="Try widening the filters or post stock into inventory first."
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-[34%]" />
                  <col className="w-[16%]" />
                  <col className="w-[14%]" />
                  <col className="w-[9%]" />
                  <col className="w-[9%]" />
                  <col className="w-[9%]" />
                  <col className="w-[9%]" />
                </colgroup>
                <thead className="border-y border-slate-200 bg-slate-50/70">
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    <th className="px-4 py-3.5">Product</th>
                    <th className="px-4 py-3.5">Warehouse</th>
                    <th className="px-4 py-3.5">Location</th>
                    <th className="px-4 py-3.5 text-right">On Hand</th>
                    <th className="px-4 py-3.5 text-right">Reserved</th>
                    <th className="px-4 py-3.5 text-right">Available</th>
                    <th className="px-4 py-3.5 text-right">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {paginatedBalances.map((balance) => (
                    <tr
                      key={balance.id}
                      className="align-top transition hover:bg-slate-50/80"
                    >
                      <td className="px-4 py-4">
                        <div className="font-semibold text-slate-950">
                          {balance.productName}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-700">
                            {balance.sku}
                          </span>
                        </div>
                        {balance.variationName ? (
                          <div className="mt-2 text-sm text-slate-500">
                            {balance.variationName}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-medium text-slate-950">
                          {balance.warehouse.name}
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                          {balance.warehouse.code}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-medium text-slate-950">
                          {balance.location.name}
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                          {balance.location.code}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right font-semibold tabular-nums text-slate-950">
                        {formatQuantity(balance.onHandQuantity)}
                      </td>
                      <td className="px-4 py-4 text-right tabular-nums text-slate-600">
                        {formatQuantity(balance.reservedQuantity)}
                      </td>
                      <td className="px-4 py-4 text-right font-semibold tabular-nums text-slate-950">
                        {formatQuantity(balance.availableQuantity)}
                      </td>
                      <td className="px-4 py-4 text-right font-semibold tabular-nums text-slate-950">
                        {formatMoney(balance.inventoryValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <WmsTablePagination
              pageIndex={pageIndex}
              pageSize={pageSize}
              pageSizeOptions={[10, 25, 50]}
              totalItems={filteredBalances.length}
              onPageIndexChange={setPageIndex}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize);
                setPageIndex(0);
              }}
            />
          </>
        )}
      </WmsSectionCard>
    </div>
  );
}
