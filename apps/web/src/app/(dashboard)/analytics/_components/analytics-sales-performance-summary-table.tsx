'use client';

import type { ReactNode } from 'react';
import {
  AnalyticsTableEmptyRow,
  AnalyticsTableLoadingRows,
  AnalyticsTableShell,
} from './analytics-table-shell';
import type {
  SalesPerformanceSortKey,
  SalesPerformanceSummaryRow,
} from '../_types/sales-performance';

const formatCurrency = (val?: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(val || 0);

const formatPct = (val?: number) => `${(val || 0).toFixed(2)}%`;

type AnalyticsSalesPerformanceSummaryTableProps = {
  isLoading: boolean;
  rows: SalesPerformanceSummaryRow[];
  summaryStart: number;
  summaryEnd: number;
  totalSummaryRows: number;
  canPrevious: boolean;
  canNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  displayAssignee: (value: string | null) => string;
  renderSortLabel: (label: string, key: SalesPerformanceSortKey) => ReactNode;
};

export function AnalyticsSalesPerformanceSummaryTable({
  isLoading,
  rows,
  summaryStart,
  summaryEnd,
  totalSummaryRows,
  canPrevious,
  canNext,
  onPrevious,
  onNext,
  displayAssignee,
  renderSortLabel,
}: AnalyticsSalesPerformanceSummaryTableProps) {
  return (
    <AnalyticsTableShell
      summaryLabel={`Showing ${summaryStart}-${summaryEnd} of ${totalSummaryRows}`}
      onPrevious={onPrevious}
      onNext={onNext}
      canPrevious={canPrevious}
      canNext={canNext}
      isLoading={isLoading}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50">
            <tr>
              <th className="whitespace-nowrap px-3 py-3 text-left sm:px-4 lg:px-6">
                {renderSortLabel('Sales Assignee', 'assignee')}
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-left sm:px-4 lg:px-6">
                {renderSortLabel('MKTG Cod', 'mktg_cod')}
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-left sm:px-4 lg:px-6">
                {renderSortLabel('Sales Cod', 'sales_cod')}
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-left sm:px-4 lg:px-6">
                {renderSortLabel('SMP %', 'smp')}
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-left sm:px-4 lg:px-6">
                {renderSortLabel('RTS Rate %', 'rts')}
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-left sm:px-4 lg:px-6">
                {renderSortLabel('Confirmation Rate %', 'confirmation')}
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-left sm:px-4 lg:px-6">
                {renderSortLabel('Pending Rate %', 'pending')}
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-left sm:px-4 lg:px-6">
                {renderSortLabel('Cancellation Rate %', 'cancellation')}
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-left sm:px-4 lg:px-6">
                {renderSortLabel('Upsell Rate %', 'upsell_rate')}
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-left sm:px-4 lg:px-6">
                {renderSortLabel('Sales Upsell', 'upsell_delta')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <AnalyticsTableLoadingRows colCount={10} />
            ) : (
              rows.map((row) => (
                <tr key={row.salesAssignee ?? 'unassigned'} className="bg-white">
                  <td className="px-3 py-4 text-sm text-slate-700 sm:px-4 lg:px-6">
                    {displayAssignee(row.salesAssignee)}
                  </td>
                  <td className="px-3 py-4 text-sm text-slate-700 sm:px-4 lg:px-6">
                    {formatCurrency(row.mktgCod)}
                  </td>
                  <td className="px-3 py-4 text-sm text-slate-700 sm:px-4 lg:px-6">
                    {formatCurrency(row.salesCod)}
                  </td>
                  <td className="px-3 py-4 text-sm font-semibold text-slate-900 sm:px-4 lg:px-6">
                    {formatPct(row.salesVsMktgPct)}
                  </td>
                  <td className="px-3 py-4 text-sm font-semibold text-slate-900 sm:px-4 lg:px-6">
                    {formatPct(row.rtsRatePct)}
                  </td>
                  <td className="px-3 py-4 text-sm font-semibold text-slate-900 sm:px-4 lg:px-6">
                    {formatPct(row.confirmationRatePct)}
                  </td>
                  <td className="px-3 py-4 text-sm font-semibold text-slate-900 sm:px-4 lg:px-6">
                    {formatPct(row.pendingRatePct)}
                  </td>
                  <td className="px-3 py-4 text-sm font-semibold text-slate-900 sm:px-4 lg:px-6">
                    {formatPct(row.cancellationRatePct)}
                  </td>
                  <td className="px-3 py-4 text-sm font-semibold text-slate-900 sm:px-4 lg:px-6">
                    {formatPct(row.upsellRatePct)}
                  </td>
                  <td className="px-3 py-4 text-sm text-slate-700 sm:px-4 lg:px-6">
                    {formatCurrency(row.upsellDelta)}
                  </td>
                </tr>
              ))
            )}
            {!isLoading && rows.length === 0 ? (
              <AnalyticsTableEmptyRow colSpan={10} message="No data available for the selected filters." />
            ) : null}
          </tbody>
        </table>
      </div>
    </AnalyticsTableShell>
  );
}
