'use client';

import type { ReactNode } from 'react';
import {
  AnalyticsTableEmptyRow,
  AnalyticsTableLoadingRows,
  AnalyticsTableShell,
} from './analytics-table-shell';
import type { SalesPerformanceRow, SalesPerformanceSortKey } from '../_types/sales-performance';

const formatCurrency = (val?: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(val || 0);

const formatPct = (val?: number) => `${(val || 0).toFixed(2)}%`;

type AnalyticsSalesPerformanceStoreTableProps = {
  isLoading: boolean;
  rows: SalesPerformanceRow[];
  storeStart: number;
  storeEnd: number;
  totalStoreRows: number;
  currentPage: number;
  totalPages: number;
  canPrevious: boolean;
  canNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  displayAssignee: (value: string | null) => string;
  displayShop: (value: string) => string;
  renderSortLabel: (label: string, key: SalesPerformanceSortKey) => ReactNode;
};

export function AnalyticsSalesPerformanceStoreTable({
  isLoading,
  rows,
  storeStart,
  storeEnd,
  totalStoreRows,
  currentPage,
  totalPages,
  canPrevious,
  canNext,
  onPrevious,
  onNext,
  displayAssignee,
  displayShop,
  renderSortLabel,
}: AnalyticsSalesPerformanceStoreTableProps) {
  return (
    <AnalyticsTableShell
      summaryLabel={`Showing ${storeStart}-${storeEnd} of ${totalStoreRows}`}
      onPrevious={onPrevious}
      onNext={onNext}
      canPrevious={canPrevious}
      canNext={canNext}
      isLoading={isLoading}
      pageIndicatorLabel={`Page ${currentPage} of ${totalPages}`}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50">
            <tr>
              <th className="whitespace-nowrap px-3 py-3 text-left sm:px-4 lg:px-6">
                {renderSortLabel('Sales Assignee', 'assignee')}
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-left sm:px-4 lg:px-6">
                {renderSortLabel('Shop POS', 'shop')}
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
              <AnalyticsTableLoadingRows colCount={11} />
            ) : (
              rows.map((row) => (
                <tr key={`${row.salesAssignee ?? 'unassigned'}-${row.shopId}`} className="bg-white">
                  <td className="px-3 py-4 text-sm text-slate-700 sm:px-4 lg:px-6">
                    {displayAssignee(row.salesAssignee)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-700 sm:px-4 lg:px-6">
                    <span className="text-slate-900">{displayShop(row.shopId)}</span>
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
              <AnalyticsTableEmptyRow colSpan={11} message="No data available for the selected filters." />
            ) : null}
          </tbody>
        </table>
      </div>
    </AnalyticsTableShell>
  );
}
