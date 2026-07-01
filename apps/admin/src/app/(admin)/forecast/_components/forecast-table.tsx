'use client';

import { FileSpreadsheet } from 'lucide-react';
import type { ReactNode } from 'react';
import { WmsCompactPanel } from '../../_components/wms-compact-panel';
import type { WmsForecastingResponse, WmsForecastingRow } from '../_types/forecast';
import {
  formatForecastDecimal,
  formatForecastNumber,
  getForecastStatusClassName,
} from '../_utils/forecast-formatters';

type ForecastTableProps = {
  data: WmsForecastingResponse | null;
  isLoading: boolean;
};

export function ForecastTable({ data, isLoading }: ForecastTableProps) {
  const hasSelectedStores = (data?.context.selectedStoreIds.length ?? 0) > 0;
  const hasSnapshot = Boolean(data?.snapshot);
  const groupedTables = data ? buildStoreGroups(data.rows) : [];
  const pastSalesWindowDays = data?.context.pastSalesWindowDays ?? 3;
  const pastSalesLabel = `Past ${pastSalesWindowDays}-day sales`;

  return (
    <WmsCompactPanel
      title="Smart Order Forecasting"
      icon={<FileSpreadsheet className="panel-icon" />}
      meta={
        data
          ? hasSnapshot
            ? `${groupedTables.length.toLocaleString()} shops · ${data.rows.length.toLocaleString()} rows · Snapshot v${data.snapshot?.version} · Generated ${formatGeneratedAt(data.generatedAt)}`
            : `${groupedTables.length.toLocaleString()} shops · ${data.rows.length.toLocaleString()} rows · No saved snapshot`
          : undefined
      }
    >
      {isLoading && !data ? (
        <ForecastTableSkeleton />
      ) : data && data.rows.length > 0 ? (
        <div className="space-y-5">
          {groupedTables.map((group) => (
            <section
              key={group.storeId}
              className="overflow-hidden rounded-xl border border-border/10 bg-white"
            >
              <div className="flex items-center gap-3 border-b border-border/10 bg-primary px-5 py-3 text-white">
                <span className="truncate text-base font-semibold">
                  {group.title}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-max min-w-full table-fixed border-separate border-spacing-0">
                  <ForecastColumnGroup />
                  <thead>
                    <tr className="bg-slate-50 text-left">
                      <HeaderCell align="left" className="sticky left-0 z-30 bg-slate-50 shadow-[1px_0_0_0_rgba(15,23,42,0.06)]">Item</HeaderCell>
                      <HeaderCell align="center">Remaining stocks</HeaderCell>
                      <HeaderCell align="center">Pending orders</HeaderCell>
                      <HeaderCell align="center">{pastSalesLabel}</HeaderCell>
                      <HeaderCell align="center">Avg daily sales</HeaderCell>
                      <HeaderCell align="center">Forecasted demand</HeaderCell>
                      <HeaderCell align="center">Safety stock</HeaderCell>
                      <HeaderCell align="center">Suggested order qty</HeaderCell>
                      <HeaderCell align="center">Status</HeaderCell>
                      <HeaderCell align="center">Returning</HeaderCell>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {group.rows.map((row) => (
                      <ForecastRow key={row.rowId} row={row} />
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border/10 bg-secondary/20 text-foreground">
                      <td className="sticky left-0 z-20 whitespace-nowrap bg-secondary/20 px-5 py-3.5 text-left text-sm font-semibold uppercase tracking-wide shadow-[1px_0_0_0_rgba(15,23,42,0.06)]">
                        Totals
                      </td>
                      <TotalCell value={group.totals.remainingStocks} />
                      <TotalCell value={group.totals.pendingOrders} />
                      <TotalCell value={group.totals.past3DaySales} />
                      <TotalCell value={group.totals.avgDailySales} decimal />
                      <TotalCell value={group.totals.forecastedDemand} decimal />
                      <TotalCell value={group.totals.safetyStock} decimal />
                      <TotalCell value={group.totals.suggestedOrderQty} />
                      <td className="px-5 py-3.5 text-sm font-semibold" />
                      <TotalCell value={group.totals.returning} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-secondary/20 px-4 py-10 text-center">
          <p className="text-sm font-semibold text-foreground">
            {hasSelectedStores
              ? hasSnapshot
                ? 'No forecast rows'
                : 'No saved snapshot'
              : 'Select at least one store'}
          </p>
          <p className="mt-2 text-sm-custom text-muted">
            {hasSelectedStores
              ? hasSnapshot
                ? 'This generated snapshot does not have forecastable stock, orders, sales, or returns.'
                : `Generate after selecting stores to save the forecast snapshot using the selected ${pastSalesWindowDays}-day sales window.`
              : 'Pick one or more stores to generate per-shop forecast rows.'}
          </p>
        </div>
      )}
    </WmsCompactPanel>
  );
}

function ForecastRow({ row }: { row: WmsForecastingRow }) {
  return (
    <tr className="border-b border-border/10 text-sm-custom text-foreground transition hover:bg-secondary/20">
      <BodyCell align="left" className="sticky left-0 z-20 bg-white font-semibold text-foreground shadow-[1px_0_0_0_rgba(15,23,42,0.06)]">
        <span className="block truncate">
          {row.productDisplayId ? `${row.productName} · Code ${row.productDisplayId}` : row.productName}
        </span>
      </BodyCell>
      <MetricCell value={row.remainingStocks} />
      <MetricCell value={row.pendingOrders} />
      <MetricCell value={row.past3DaySales} />
      <MetricCell value={row.avgDailySales} decimal />
      <MetricCell value={row.forecastedDemand} decimal />
      <MetricCell value={row.safetyStock} decimal />
      <MetricCell value={row.suggestedOrderQty} highlight />
      <BodyCell>
        <span
          className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs-tight font-semibold ${getForecastStatusClassName(row.status.key)}`}
        >
          {row.status.label}
        </span>
      </BodyCell>
      <MetricCell value={row.returning} />
    </tr>
  );
}

function ForecastColumnGroup() {
  return (
    <colgroup>
      <col className="w-96" />
      <col className="w-36" />
      <col className="w-36" />
      <col className="w-36" />
      <col className="w-36" />
      <col className="w-40" />
      <col className="w-32" />
      <col className="w-40" />
      <col className="w-40" />
      <col className="w-28" />
    </colgroup>
  );
}

function HeaderCell({
  children,
  className = '',
  align = 'left',
}: {
  children: ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
}) {
  return (
    <th
      className={`whitespace-nowrap bg-slate-50 px-5 py-3 text-xs-tight font-semibold uppercase tracking-wide text-muted ${
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
      } ${className}`.trim()}
    >
      {children}
    </th>
  );
}

function BodyCell({
  children,
  align = 'left',
  className = '',
}: {
  children: ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
}) {
  return (
    <td
      className={`whitespace-nowrap px-5 py-3.5 align-middle ${
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
      } ${className}`.trim()}
    >
      {children}
    </td>
  );
}

function MetricCell({
  value,
  decimal = false,
  highlight = false,
}: {
  value: number;
  decimal?: boolean;
  highlight?: boolean;
}) {
  return (
    <BodyCell align="center">
      <span className={`font-semibold tabular-nums ${highlight ? 'text-primary' : 'text-foreground'}`}>
        {decimal ? formatForecastDecimal(value) : formatForecastNumber(value)}
      </span>
    </BodyCell>
  );
}

function TotalCell({
  value,
  decimal = false,
}: {
  value: number;
  decimal?: boolean;
}) {
  return (
    <td className="whitespace-nowrap px-5 py-3.5 text-center text-sm font-semibold tabular-nums">
      {decimal ? formatForecastDecimal(value) : formatForecastNumber(value)}
    </td>
  );
}

function ForecastTableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="h-12 animate-pulse rounded-xl bg-secondary/40" />
      ))}
    </div>
  );
}

function formatGeneratedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function buildStoreGroups(rows: WmsForecastingRow[]) {
  const groups = new Map<string, {
    storeId: string;
    title: string;
    rows: WmsForecastingRow[];
    totals: {
      remainingStocks: number;
      pendingOrders: number;
      past3DaySales: number;
      avgDailySales: number;
      forecastedDemand: number;
      safetyStock: number;
      suggestedOrderQty: number;
      returning: number;
    };
  }>();

  for (const row of rows) {
    const key = row.storeId ?? row.rowId;
    const title = row.tenantName ? `${row.storeName} — ${row.tenantName}` : row.storeName;
    const existing = groups.get(key) ?? {
      storeId: key,
      title,
      rows: [],
      totals: {
        remainingStocks: 0,
        pendingOrders: 0,
        past3DaySales: 0,
        avgDailySales: 0,
        forecastedDemand: 0,
        safetyStock: 0,
        suggestedOrderQty: 0,
        returning: 0,
      },
    };

    existing.rows.push(row);
    existing.totals.remainingStocks += row.remainingStocks;
    existing.totals.pendingOrders += row.pendingOrders;
    existing.totals.past3DaySales += row.past3DaySales;
    existing.totals.avgDailySales += row.avgDailySales;
    existing.totals.forecastedDemand += row.forecastedDemand;
    existing.totals.safetyStock += row.safetyStock;
    existing.totals.suggestedOrderQty += row.suggestedOrderQty;
    existing.totals.returning += row.returning;

    groups.set(key, existing);
  }

  return Array.from(groups.values()).map((group) => ({
    ...group,
    totals: {
      ...group.totals,
      avgDailySales: roundTo(group.totals.avgDailySales, 2),
      forecastedDemand: roundTo(group.totals.forecastedDemand, 2),
      safetyStock: roundTo(group.totals.safetyStock, 2),
    },
  }));
}

function roundTo(value: number, precision: number) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}
