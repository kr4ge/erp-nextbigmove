'use client';

import { ArrowDown, ArrowUp, BarChart3 } from 'lucide-react';
import type { PerfColumn } from '../_constants/performance-columns';
import type { PerformanceRow, PerformanceSortKey, ScopeInfo, SortDirection } from '../_types/advertising-performance';

/**
 * The decision table. It owns its scroll pane (a sticky header inside a
 * page-level scroll container detaches on some browsers), and the frozen
 * identity pane uses explicit widths so sticky offsets never drift.
 */
export function PerformanceTable({ columns, items, scope, isLoading, sortKey, sortDirection, onSort, onSelect }: {
  columns: PerfColumn[];
  items: PerformanceRow[] | undefined;
  scope: ScopeInfo | null;
  isLoading: boolean;
  sortKey: PerformanceSortKey;
  sortDirection: SortDirection;
  onSort: (key: PerformanceSortKey) => void;
  onSelect: (row: PerformanceRow) => void;
}) {
  const frozen = columns.filter((column) => column.frozen);
  const offsets = new Map<string, number>();
  let offset = 0;
  for (const column of frozen) {
    offsets.set(column.key, offset);
    offset += column.width;
  }
  const totalWidth = columns.reduce((sum, column) => sum + column.width, 0);
  const ctx = { scope };

  const stickyClass = (column: PerfColumn, layer: 'head' | 'body') =>
    column.frozen
      ? `sticky z-${layer === 'head' ? '30' : '10'} bg-surface`
      : '';

  return (
    <div className="max-h-[70vh] overflow-auto" role="region" aria-label="Advertising performance table">
      <table className="w-full border-separate border-spacing-0 text-left" style={{ minWidth: totalWidth }}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                style={{
                  width: column.width, minWidth: column.width,
                  ...(column.frozen ? { left: offsets.get(column.key) } : {}),
                }}
                className={`sticky top-0 z-20 whitespace-nowrap border-b border-border/60 bg-surface px-3 py-2.5 text-xs-tight font-semibold uppercase tracking-wide text-faint ${column.numeric ? 'text-right' : ''} ${column.frozen ? 'z-30' : ''} ${stickyClass(column, 'head')}`}
                aria-sort={column.sortKey === sortKey ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
                title={column.help}
              >
                {column.sortKey ? (
                  <button
                    type="button"
                    className={`inline-flex items-center gap-1 ${column.numeric ? 'w-full justify-end' : ''}`}
                    onClick={() => onSort(column.sortKey as PerformanceSortKey)}
                  >
                    {column.label}
                    {column.sortKey === sortKey
                      ? sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      : null}
                  </button>
                ) : column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading && !items ? (
            <tr><td colSpan={columns.length} className="px-4 py-16 text-center text-sm text-muted">Loading performance…</td></tr>
          ) : items?.length ? items.map((row) => (
            <tr
              key={row.key}
              onClick={() => onSelect(row)}
              className="group cursor-pointer"
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  style={{
                    width: column.width, minWidth: column.width,
                    ...(column.frozen ? { left: offsets.get(column.key) } : {}),
                  }}
                  className={`border-b border-border/40 bg-surface px-3 py-2 text-sm-custom text-foreground transition group-hover:bg-background dark:group-hover:bg-background-secondary ${column.numeric ? 'text-right tabular-nums' : ''} ${stickyClass(column, 'body')}`}
                >
                  {column.render(row, ctx)}
                </td>
              ))}
            </tr>
          )) : (
            <tr>
              <td colSpan={columns.length} className="px-4 py-16 text-center">
                <BarChart3 className="mx-auto h-7 w-7 text-muted" />
                <p className="mt-2 font-semibold text-foreground">No rows match this view</p>
                <p className="mt-1 text-sm text-muted">Widen the date range or loosen the filters to see more.</p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Compact card alternative for small screens, driven by the same rows. */
export function PerformanceCardList({ items, isLoading, onSelect }: {
  items: PerformanceRow[] | undefined;
  isLoading: boolean;
  onSelect: (row: PerformanceRow) => void;
}) {
  if (isLoading && !items) {
    return <div className="p-6 text-center text-sm text-muted">Loading performance…</div>;
  }
  if (!items?.length) {
    return (
      <div className="p-6 text-center">
        <p className="font-semibold text-foreground">No rows match this view</p>
        <p className="mt-1 text-sm text-muted">Widen the date range or loosen the filters.</p>
      </div>
    );
  }
  return (
    <div className="grid gap-2 p-3">
      {items.map((row) => (
        <button
          key={row.key}
          type="button"
          onClick={() => onSelect(row)}
          className="rounded-xl border border-border/50 bg-surface p-3 text-left shadow-card"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-sm-custom font-semibold text-foreground">
              {row.adName ?? row.campaignName ?? row.creative?.title ?? row.key}
            </p>
            <span className="shrink-0 text-xs-tight text-muted">{row.creative?.code ?? 'unlinked'}</span>
          </div>
          <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
            <div><dt className="text-faint">Orders</dt><dd className="font-semibold tabular-nums">{row.metrics.orders}</dd></div>
            <div><dt className="text-faint">Spend</dt><dd className="font-semibold tabular-nums">₱{Math.round(row.metrics.spend).toLocaleString('en-PH')}</dd></div>
            <div><dt className="text-faint">CPP</dt><dd className="font-semibold tabular-nums">{row.metrics.cpp == null ? '—' : `₱${Math.round(row.metrics.cpp).toLocaleString('en-PH')}`}</dd></div>
          </dl>
          <p className="mt-2 text-xs-tight text-muted">{row.verdict.reason}</p>
        </button>
      ))}
    </div>
  );
}
