'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DashboardLoadingBar } from '../../../_components/dashboard-loading-state';
import { PanelHeader } from '../../../overview/_components/overview-ui';
import {
  formatCount,
  formatCurrency,
  formatPercent,
  inverseRateTone,
  RATE_TONE_TEXT,
  rateTone,
  type RateTone,
} from '../../../overview/_utils/creative-overview-format';
import type {
  AdvertisingDashboardResponse,
  CreativeDashboardKpis,
  CreatorKpiBreakdownRow,
  DashboardMetric,
} from '../_types/advertising-dashboard';

const PAGE_SIZE = 10;

type VisibleKpiKey = Exclude<keyof CreativeDashboardKpis, 'cvr'>;
type ColumnFormat = 'count' | 'currency' | 'percent';

const KPI_COLUMNS: Array<{
  key: VisibleKpiKey;
  label: string;
  description: string;
  format: ColumnFormat;
}> = [
  { key: 'hookRate', label: 'Hook', description: '3-second plays ÷ video impressions.', format: 'percent' },
  { key: 'holdRate', label: 'Hold', description: 'ThruPlays ÷ 3-second plays.', format: 'percent' },
  { key: 'completionRate', label: 'Completion', description: 'ThruPlays ÷ video impressions.', format: 'percent' },
  { key: 'ctr', label: 'CTR', description: 'Link clicks ÷ impressions.', format: 'percent' },
  { key: 'orders', label: 'Orders', description: 'Attributed POS orders.', format: 'count' },
  { key: 'adSpend', label: 'Ad Spend', description: 'Spend on linked and historically attributed ads.', format: 'currency' },
  { key: 'mar', label: 'MAR% (AR%)', description: 'Ad spend ÷ attributed gross revenue.', format: 'percent' },
  { key: 'output', label: 'Video Output', description: 'Creatives enrolled in the selected period.', format: 'count' },
  { key: 'delivered', label: 'Delivered', description: 'Attributed orders delivered.', format: 'count' },
  { key: 'cancellationRate', label: 'Cancellation Rate', description: 'Cancelled ÷ all attributed orders.', format: 'percent' },
  { key: 'rtsRate', label: 'RTS Rate', description: 'RTS ÷ (delivered + RTS).', format: 'percent' },
  { key: 'deliveryRate', label: 'Delivery Rate', description: 'Delivered ÷ all attributed orders.', format: 'percent' },
];

function formatMetric(metric: DashboardMetric, format: ColumnFormat) {
  if (format === 'currency') return formatCurrency(metric.value);
  if (format === 'count') return formatCount(metric.value);
  return formatPercent(metric.value);
}

function metricTone(
  key: VisibleKpiKey,
  metric: DashboardMetric,
  floors: AdvertisingDashboardResponse['floors'] | undefined,
): RateTone {
  if (key === 'hookRate' || key === 'holdRate' || key === 'completionRate' || key === 'ctr') {
    return rateTone(metric.value, floors?.values[key]);
  }
  if (key === 'cancellationRate') {
    return inverseRateTone(metric.value, floors?.values.cancellationRate);
  }
  return 'neutral';
}

function CreatorKpiTableSkeleton() {
  return (
    <div className="divide-y divide-border/40 animate-pulse" role="status" aria-label="Loading creator KPI breakdown">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="flex min-w-max items-center gap-8 px-4 py-3" aria-hidden="true">
          <DashboardLoadingBar className="h-3 w-5" />
          <DashboardLoadingBar className="h-3.5 w-36" />
          {KPI_COLUMNS.map((column) => (
            <DashboardLoadingBar key={column.key} className="h-3 w-16" />
          ))}
        </div>
      ))}
      <span className="sr-only">Loading creator KPI breakdown…</span>
    </div>
  );
}

function CreatorMetricCell({
  metric,
  column,
  floors,
}: {
  metric: DashboardMetric;
  column: (typeof KPI_COLUMNS)[number];
  floors: AdvertisingDashboardResponse['floors'] | undefined;
}) {
  const tone = metricTone(column.key, metric, floors);
  return (
    <td className="whitespace-nowrap px-4 py-3 text-right text-sm-custom tabular-nums">
      <span className={metric.value == null ? 'text-muted' : RATE_TONE_TEXT[tone]}>
        {formatMetric(metric, column.format)}
      </span>
    </td>
  );
}

export function CreatorKpiBreakdown({
  rows,
  floors,
  isLoading,
  scopeKey,
}: {
  rows: CreatorKpiBreakdownRow[];
  floors: AdvertisingDashboardResponse['floors'] | undefined;
  isLoading: boolean;
  scopeKey: string;
}) {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [scopeKey]);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const visibleRows = rows.slice(startIndex, startIndex + PAGE_SIZE);
  const firstRow = rows.length === 0 ? 0 : startIndex + 1;
  const lastRow = Math.min(startIndex + PAGE_SIZE, rows.length);

  return (
    <section className="panel panel-content shadow-card">
      <PanelHeader
        title="Creator KPI breakdown"
        description="One row per creator, using the same formulas and active dashboard filters as Creative metrics."
        right={<span className="text-xs-tight font-semibold text-muted">{isLoading ? 'Loading…' : `${rows.length} creators`}</span>}
      />

      <div className="overflow-x-auto" tabIndex={0} aria-label="Creator KPI breakdown table">
        <table className="min-w-max border-separate border-spacing-0 text-left">
          <thead>
            <tr className="bg-background-secondary/70">
              <th className="sticky left-0 z-20 w-14 bg-background-secondary px-4 py-3 text-xs-tight font-semibold uppercase tracking-wide text-muted">#</th>
              <th className="sticky left-14 z-20 min-w-48 bg-background-secondary px-4 py-3 text-xs-tight font-semibold uppercase tracking-wide text-muted">Creator</th>
              {KPI_COLUMNS.map((column) => (
                <th
                  key={column.key}
                  title={column.description}
                  className="whitespace-nowrap px-4 py-3 text-right text-xs-tight font-semibold uppercase tracking-wide text-muted"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          {!isLoading ? (
            <tbody className="bg-surface">
              {visibleRows.map((row, index) => (
                <tr key={row.creatorId} className="group transition hover:bg-background-secondary/50 [&>td]:border-t [&>td]:border-border/40">
                  <td className="sticky left-0 z-10 w-14 bg-surface px-4 py-3 text-sm-custom text-muted group-hover:bg-background-secondary">
                    {startIndex + index + 1}.
                  </td>
                  <td className="sticky left-14 z-10 min-w-48 bg-surface px-4 py-3 text-sm-custom font-semibold text-foreground group-hover:bg-background-secondary">
                    {row.creatorName}
                  </td>
                  {KPI_COLUMNS.map((column) => (
                    <CreatorMetricCell
                      key={column.key}
                      metric={row.kpis[column.key]}
                      column={column}
                      floors={floors}
                    />
                  ))}
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={KPI_COLUMNS.length + 2} className="border-t border-border/40 px-4 py-10 text-center">
                    <p className="font-semibold text-foreground">No creators match this scope</p>
                    <p className="mt-1 text-sm-custom text-muted">Change the creator, store, account, or date filters to see creator metrics.</p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          ) : null}
        </table>
        {isLoading ? <CreatorKpiTableSkeleton /> : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/40 px-4 py-3">
        <p className="text-xs-tight text-muted">
          {isLoading ? 'Loading creator metrics…' : `Showing ${firstRow}–${lastRow} of ${rows.length}`}
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            iconLeft={<ChevronLeft className="h-4 w-4" />}
            disabled={isLoading || currentPage <= 1}
            onClick={() => setPage(Math.max(1, currentPage - 1))}
          >
            Previous
          </Button>
          <span className="min-w-20 text-center text-xs-tight font-semibold text-muted">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            iconRight={<ChevronRight className="h-4 w-4" />}
            disabled={isLoading || currentPage >= totalPages}
            onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
          >
            Next
          </Button>
        </div>
      </div>
    </section>
  );
}
