'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownUp,
  Boxes,
  RotateCcw,
  ScrollText,
  Search,
  Warehouse,
} from 'lucide-react';
import { WmsPageHeader } from '../../_components/wms-page-header';
import { WmsSectionCard } from '../../_components/wms-section-card';
import { WmsStatCard } from '../../_components/wms-stat-card';
import { WmsTablePagination } from '../../_components/wms-table-pagination';
import { InventoryEmptyState } from '../_components/inventory-empty-state';
import { InventoryMovementBadge } from '../_components/inventory-movement-badge';
import { fetchInventoryLedger } from '../_services/inventory.service';
import { formatDateTime, formatMoney, formatQuantity } from '../_utils/inventory-format';

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

export default function InventoryLedgerPage() {
  const [search, setSearch] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('ALL');
  const [movementFilter, setMovementFilter] = useState('ALL');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const ledgerQuery = useQuery({
    queryKey: ['wms-inventory-ledger'],
    queryFn: fetchInventoryLedger,
  });
  const ledgerError =
    ledgerQuery.error instanceof Error ? ledgerQuery.error.message : null;

  const ledger = ledgerQuery.data || [];
  const inboundCount = ledger.filter((entry) => entry.quantityDelta > 0).length;
  const outboundCount = ledger.filter((entry) => entry.quantityDelta < 0).length;
  const latestCost = ledger.find((entry) => entry.totalCost != null)?.totalCost || null;

  const tableRows = useMemo(
    () =>
      ledger.map((entry) => ({
        ...entry,
        displaySku: getDisplayCode(entry.sku),
        variationLabel: getVariationLabel(entry.variationName),
        costLabel:
          entry.totalCost != null
            ? formatMoney(entry.totalCost, entry.currency || 'PHP')
            : formatMoney(entry.unitCost, entry.currency || 'PHP'),
      })),
    [ledger],
  );

  const warehouseOptions = useMemo(
    () =>
      Array.from(
        new Map(
          tableRows.map((entry) => [
            entry.warehouse.id,
            { id: entry.warehouse.id, label: entry.warehouse.name },
          ]),
        ).values(),
      ).sort((left, right) => left.label.localeCompare(right.label)),
    [tableRows],
  );

  const movementOptions = useMemo(
    () =>
      Array.from(new Set(tableRows.map((entry) => entry.movementType)))
        .sort((left, right) => left.localeCompare(right))
        .map((movementType) => ({
          value: movementType,
          label: movementType.replace(/_/g, ' '),
        })),
    [tableRows],
  );

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return tableRows.filter((entry) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        entry.productName.toLowerCase().includes(normalizedSearch) ||
        entry.sku.toLowerCase().includes(normalizedSearch) ||
        (entry.variationName || '').toLowerCase().includes(normalizedSearch) ||
        entry.movementType.toLowerCase().includes(normalizedSearch) ||
        entry.warehouse.name.toLowerCase().includes(normalizedSearch) ||
        entry.warehouse.code.toLowerCase().includes(normalizedSearch) ||
        entry.location.name.toLowerCase().includes(normalizedSearch) ||
        entry.location.code.toLowerCase().includes(normalizedSearch) ||
        (entry.referenceType || '').toLowerCase().includes(normalizedSearch) ||
        (entry.referenceId || '').toLowerCase().includes(normalizedSearch) ||
        (entry.actorUser?.name || '').toLowerCase().includes(normalizedSearch) ||
        (entry.actorUser?.email || '').toLowerCase().includes(normalizedSearch);

      const matchesWarehouse =
        warehouseFilter === 'ALL' || entry.warehouse.id === warehouseFilter;
      const matchesMovement =
        movementFilter === 'ALL' || entry.movementType === movementFilter;

      return matchesSearch && matchesWarehouse && matchesMovement;
    });
  }, [movementFilter, search, tableRows, warehouseFilter]);

  const paginatedRows = useMemo(() => {
    const start = pageIndex * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, pageIndex, pageSize]);

  useEffect(() => {
    setPageIndex(0);
  }, [search, warehouseFilter, movementFilter]);

  useEffect(() => {
    const pageCount = Math.max(Math.ceil(filteredRows.length / pageSize), 1);
    if (pageIndex > pageCount - 1) {
      setPageIndex(pageCount - 1);
    }
  }, [filteredRows.length, pageIndex, pageSize]);

  function resetFilters() {
    setSearch('');
    setWarehouseFilter('ALL');
    setMovementFilter('ALL');
  }

  return (
    <div className="space-y-6">
      <WmsPageHeader
        title="Ledger"
        description="Stock movement history."
        eyebrow="Inventory Core"
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <WmsStatCard label="Entries" value={ledger.length} icon={ScrollText} />
        <WmsStatCard
          label="Inbound"
          value={inboundCount}
          icon={ArrowDownUp}
          accent="emerald"
        />
        <WmsStatCard
          label="Outbound"
          value={outboundCount}
          icon={Boxes}
          accent="amber"
        />
        <WmsStatCard
          label="Latest Cost"
          value={formatMoney(latestCost)}
          icon={Warehouse}
          accent="orange"
        />
      </div>

      <WmsSectionCard
        title="Ledger Feed"
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
                placeholder="Search product, movement, warehouse, or reference"
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
              value={movementFilter}
              onChange={(event) => setMovementFilter(event.target.value)}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100 xl:w-[220px]"
            >
              <option value="ALL">All Movements</option>
              {movementOptions.map((movement) => (
                <option key={movement.value} value={movement.value}>
                  {movement.label}
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

        {ledgerQuery.isError ? (
          <div className="p-4">
            <InventoryEmptyState
              title="Ledger endpoint unavailable"
              description={
                ledgerError ||
                'Unable to load /wms/inventory/ledger. Check API runtime and migration state.'
              }
            />
          </div>
        ) : ledgerQuery.isLoading ? (
          <div className="p-4">
            <InventoryEmptyState
              title="Loading ledger"
              description="Pulling inventory movement history."
            />
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="p-4">
            <InventoryEmptyState
              title="No ledger entries found"
              description="Try widening the filters or post stock movements first."
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-[28%]" />
                  <col className="w-[14%]" />
                  <col className="w-[18%]" />
                  <col className="w-[10%]" />
                  <col className="w-[10%]" />
                  <col className="w-[10%]" />
                  <col className="w-[10%]" />
                </colgroup>
                <thead className="border-y border-slate-200 bg-slate-50/70">
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    <th className="px-4 py-3.5">Entry</th>
                    <th className="px-4 py-3.5">Movement</th>
                    <th className="px-4 py-3.5">Warehouse</th>
                    <th className="px-4 py-3.5 text-right">Delta</th>
                    <th className="px-4 py-3.5 text-right">After</th>
                    <th className="px-4 py-3.5 text-right">Cost</th>
                    <th className="px-4 py-3.5">Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-slate-100 align-top transition-colors hover:bg-slate-50/70 last:border-b-0"
                    >
                      <td className="px-4 py-4">
                        <div className="min-w-0">
                          <p className="truncate whitespace-nowrap font-medium text-slate-950">
                            {entry.productName}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {entry.displaySku ? (
                              <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-700">
                                {entry.displaySku}
                              </span>
                            ) : null}
                            {entry.variationLabel ? (
                              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                                {entry.variationLabel}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="min-w-0">
                          <InventoryMovementBadge movementType={entry.movementType} />
                          <p className="mt-2 truncate whitespace-nowrap text-sm text-slate-500">
                            {formatDateTime(entry.happenedAt)}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="min-w-0">
                          <p className="truncate whitespace-nowrap font-medium text-slate-950">
                            {entry.warehouse.name}
                          </p>
                          <p className="truncate whitespace-nowrap text-sm text-slate-500">
                            {entry.location.name} · {entry.location.code}
                          </p>
                        </div>
                      </td>
                      <td
                        className={`px-4 py-4 text-right font-semibold tabular-nums ${
                          entry.quantityDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {entry.quantityDelta >= 0 ? '+' : ''}
                        {formatQuantity(entry.quantityDelta)}
                      </td>
                      <td className="px-4 py-4 text-right font-semibold tabular-nums text-slate-950">
                        {formatQuantity(entry.quantityAfter)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="min-w-0">
                          <p className="whitespace-nowrap font-semibold tabular-nums text-slate-950">
                            {entry.costLabel}
                          </p>
                          {entry.unitCost != null && entry.totalCost != null ? (
                            <p className="truncate whitespace-nowrap text-sm text-slate-500">
                              Unit {formatMoney(entry.unitCost, entry.currency || 'PHP')}
                            </p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="min-w-0">
                          <p className="truncate whitespace-nowrap font-medium text-slate-950">
                            {entry.referenceType || 'Manual'}
                          </p>
                          <p className="truncate whitespace-nowrap text-sm text-slate-500">
                            {entry.referenceId || entry.notes || '—'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ))}
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
    </div>
  );
}
