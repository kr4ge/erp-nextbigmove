"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ClipboardCheck, RotateCcw, Search, TrendingUp } from "lucide-react";
import { WmsPageHeader } from "../../_components/wms-page-header";
import { WmsSectionCard } from "../../_components/wms-section-card";
import { WmsStatCard } from "../../_components/wms-stat-card";
import { WmsTablePagination } from "../../_components/wms-table-pagination";
import { ProductImage } from "../../inventory/_components/product-image";
import { fetchInventoryPosProductFilters } from "../../inventory/_services/inventory.service";
import { fetchPartners } from "../../partners/_services/partners.service";
import type { Partner } from "../../partners/_types/partners";
import { fetchWmsForecasts } from "../../requests/_services/requests.service";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatDateInput(date: Date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate(),
  )}`;
}

function getDefaultForecastRunDate() {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  const date = new Date(Date.UTC(year, month - 1, day));

  while (![1, 3, 5].includes(date.getUTCDay())) {
    date.setUTCDate(date.getUTCDate() - 1);
  }

  return formatDateInput(date);
}

function isAllowedForecastRunDate(value: string) {
  if (!value) {
    return false;
  }

  const parts = value.split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
    return false;
  }

  const weekday = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])).getUTCDay();
  return [1, 3, 5].includes(weekday);
}

function formatDateLabel(value: string) {
  return new Date(`${value}T00:00:00+08:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Manila",
  });
}

export function ForecastScreen() {
  const [tenantId, setTenantId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [runDate, setRunDate] = useState(getDefaultForecastRunDate);
  const [search, setSearch] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const partnersQuery = useQuery({
    queryKey: ["wms-partners"],
    queryFn: fetchPartners,
  });

  const filtersQuery = useQuery({
    queryKey: ["wms-forecast-shop-filters", tenantId],
    queryFn: () => fetchInventoryPosProductFilters(tenantId || undefined),
  });

  const isRunDateAllowed = isAllowedForecastRunDate(runDate);

  const forecastsQuery = useQuery({
    queryKey: ["wms-forecast-module", tenantId, storeId, runDate, search],
    queryFn: () =>
      fetchWmsForecasts({
        tenantId,
        storeId,
        runDate,
        search: search || undefined,
        requestableOnly: false,
        profileOnly: true,
        limit: 1000,
      }),
    enabled: Boolean(tenantId && storeId && isRunDateAllowed),
  });

  const partners = partnersQuery.data || [];
  const shops = (filtersQuery.data?.shops || []).filter((shop) =>
    tenantId ? shop.tenantId === tenantId : true,
  );
  const rows = forecastsQuery.data || [];
  const pageCount = Math.max(Math.ceil(rows.length / pageSize), 1);
  const paginatedRows = useMemo(() => {
    const start = pageIndex * pageSize;
    return rows.slice(start, start + pageSize);
  }, [pageIndex, pageSize, rows]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        const qtyForOrdering = row.forecast.recommendedQuantity;
        if (qtyForOrdering > 0) {
          acc.positiveLines += 1;
          acc.positiveUnits += qtyForOrdering;
        }
        acc.returningUnits += row.forecast.returning;
        return acc;
      },
      {
        positiveLines: 0,
        positiveUnits: 0,
        returningUnits: 0,
      },
    );
  }, [rows]);

  function resetFilters() {
    setTenantId("");
    setStoreId("");
    setRunDate(getDefaultForecastRunDate());
    setSearch("");
  }

  useEffect(() => {
    setPageIndex(0);
  }, [tenantId, storeId, runDate, search]);

  useEffect(() => {
    if (pageIndex > pageCount - 1) {
      setPageIndex(Math.max(pageCount - 1, 0));
    }
  }, [pageCount, pageIndex]);

  const toolbarFieldClassName =
    "h-10 rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100";

  return (
    <div className="space-y-6">
      <WmsPageHeader
        title="Forecast"
        description="Mon / Wed / Fri planning grid."
        eyebrow="Planning"
      />

      {!isRunDateAllowed ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
          Forecast run date must fall on Monday, Wednesday, or Friday.
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-4">
        <WmsStatCard
          label="Forecast Rows"
          value={rows.length}
          description="Visible store variations"
          icon={ClipboardCheck}
        />
        <WmsStatCard
          label="Positive Lines"
          value={totals.positiveLines}
          description="Variations with order need"
          icon={TrendingUp}
          accent="amber"
        />
        <WmsStatCard
          label="Qty To Order"
          value={totals.positiveUnits}
          description="Positive recommendation only"
          icon={CalendarDays}
          accent="orange"
        />
        <WmsStatCard
          label="Returning"
          value={totals.returningUnits}
          description="Units in return status"
          icon={RotateCcw}
          accent="emerald"
        />
      </div>

      <WmsSectionCard
        title="Forecast Grid"
        metadata={
          <Link
            href="/requests"
            className="inline-flex items-center justify-center rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 transition hover:bg-orange-100"
          >
            Open Requests
          </Link>
        }
        bodyClassName="p-0"
      >
        <div className="border-b border-slate-200 bg-slate-50/80 px-3 py-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              aria-label="Partner"
              value={tenantId}
              onChange={(event) => {
                setTenantId(event.target.value);
                setStoreId("");
              }}
              className={`${toolbarFieldClassName} min-w-[176px] xl:w-[190px]`}
            >
              <option value="">Partner</option>
              {partners.map((partner: Partner) => (
                <option key={partner.id} value={partner.id}>
                  {partner.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Store"
              value={storeId}
              onChange={(event) => setStoreId(event.target.value)}
              disabled={!tenantId}
              className={`${toolbarFieldClassName} min-w-[220px] xl:w-[260px]`}
            >
              <option value="">Store</option>
              {shops.map((shop) => (
                <option key={shop.id} value={shop.id}>
                  {shop.name} ({shop.shopId})
                </option>
              ))}
            </select>

            <input
              aria-label="Run date"
              type="date"
              value={runDate}
              onChange={(event) => setRunDate(event.target.value)}
              className={`${toolbarFieldClassName} min-w-[164px] xl:w-[170px]`}
            />

            <div className="relative min-w-[280px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                aria-label="Search forecast"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search product or variation"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
              />
            </div>

            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 transition hover:border-orange-200 hover:text-orange-700"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
          </div>
        </div>

        {!tenantId || !storeId ? (
          <div className="px-5 py-12 text-center text-sm text-slate-500">
            Choose a partner and store to load the forecast grid.
          </div>
        ) : !isRunDateAllowed ? (
          <div className="px-5 py-12 text-center text-sm text-slate-500">
            Forecast only runs on Monday, Wednesday, and Friday.
          </div>
        ) : forecastsQuery.isLoading ? (
          <div className="px-5 py-12 text-center text-sm text-slate-500">
            Loading forecast...
          </div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-slate-500">
            No forecast rows found for this store.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed divide-y divide-slate-200 text-sm">
                <colgroup>
                  <col className="w-[35%]" />
                  <col className="w-[13%]" />
                  <col className="w-[13%]" />
                  <col className="w-[13%]" />
                  <col className="w-[13%]" />
                  <col className="w-[13%]" />
                </colgroup>
                <thead className="bg-slate-50/90 text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <tr>
                    <th className="px-5 py-2.5">Product</th>
                    <th className="px-4 py-2.5 text-right">Remain</th>
                    <th className="px-4 py-2.5 text-right">Pending</th>
                    <th className="px-4 py-2.5 text-right">Past 2D</th>
                    <th className="px-4 py-2.5 text-right">Order</th>
                    <th className="px-4 py-2.5 text-right">Return</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {paginatedRows.map((row) => (
                    <tr key={row.id} className="align-top transition-colors hover:bg-slate-50/60">
                      <td className="px-5 py-3.5">
                        <div className="flex items-start gap-3">
                          <ProductImage
                            imageUrl={row.imageUrl}
                            name={row.name}
                            className="h-10 w-10 rounded-lg"
                          />
                          <div className="min-w-0 space-y-1">
                            <div className="font-semibold leading-snug text-slate-950">
                              {row.name}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-orange-700">
                                {row.variationCustomId || "No variation ref"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold tabular-nums text-slate-900">
                        {row.forecast.remainingStock}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-slate-600">
                        {row.forecast.pending}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-slate-600">
                        {row.forecast.pastTwoDays}
                      </td>
                      <td
                        className={`px-4 py-3.5 text-right font-semibold tabular-nums ${
                          row.forecast.recommendedQuantity > 0
                            ? "text-orange-700"
                            : "text-slate-500"
                        }`}
                      >
                        {row.forecast.recommendedQuantity}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-slate-600">
                        {row.forecast.returning}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <WmsTablePagination
              pageIndex={pageIndex}
              pageSize={pageSize}
              pageSizeOptions={[25, 50, 100]}
              totalItems={rows.length}
              onPageIndexChange={setPageIndex}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </WmsSectionCard>
    </div>
  );
}
