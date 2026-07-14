'use client';

import type { ReactNode } from 'react';
import {
  AnalyticsTableEmptyRow,
  AnalyticsTableLoadingRows,
  AnalyticsTableShell,
} from './analytics-table-shell';
import type {
  SalesPerformanceStoreConversionRow,
  SalesPerformanceStoreConversionSortKey,
} from '../_types/sales-performance';

const formatCurrency = (val?: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(val || 0);

const formatPct = (val?: number) => `${(val || 0).toFixed(2)}%`;

const formatCount = (val?: number) => new Intl.NumberFormat('en-US').format(val ?? 0);

type AnalyticsSalesPerformanceStoreTableProps = {
  isLoading: boolean;
  rows: SalesPerformanceStoreConversionRow[];
  storeStart: number;
  storeEnd: number;
  totalStoreRows: number;
  currentPage: number;
  totalPages: number;
  canPrevious: boolean;
  canNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  displayShop: (value: string) => string;
  renderSortLabel: (label: string, key: SalesPerformanceStoreConversionSortKey) => ReactNode;
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
        <table className="min-w-full divide-y divide-slate-100 dark:divide-border">
          <thead className="bg-slate-50 dark:bg-background-secondary">
            <tr>
              <th className="sticky left-0 z-10 whitespace-nowrap bg-slate-50 px-3 py-3 text-left dark:bg-background-secondary sm:px-4 lg:px-6">
                {renderSortLabel('Store', 'shop')}
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-right sm:px-4 lg:px-6">
                {renderSortLabel('Abandoned Revenue', 'abandoned_revenue')}
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-right sm:px-4 lg:px-6">
                {renderSortLabel('Abandoned Conv.', 'abandoned_conversion')}
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-right sm:px-4 lg:px-6">
                {renderSortLabel('Abandoned Delivery', 'abandoned_delivery')}
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-right sm:px-4 lg:px-6">
                {renderSortLabel('Abandoned RTS', 'abandoned_rts')}
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-right sm:px-4 lg:px-6">
                {renderSortLabel('Repurchase Revenue', 'repurchase_revenue')}
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-right sm:px-4 lg:px-6">
                {renderSortLabel('Repurchase Conv.', 'repurchase_conversion')}
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-right sm:px-4 lg:px-6">
                {renderSortLabel('Repurchase Delivery', 'repurchase_delivery')}
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-right sm:px-4 lg:px-6">
                {renderSortLabel('Repurchase RTS', 'repurchase_rts')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white dark:divide-border dark:bg-surface">
            {isLoading ? (
              <AnalyticsTableLoadingRows colCount={9} />
            ) : (
              rows.map((row) => (
                <tr key={row.shopId} className="bg-white hover:bg-slate-50 dark:bg-surface dark:hover:bg-background-secondary">
                  <td className="sticky left-0 z-10 bg-white px-3 py-4 text-sm text-slate-700 dark:bg-surface dark:text-slate-300 sm:px-4 lg:px-6">
                    <span className="text-foreground">{displayShop(row.shopId)}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-right text-sm text-slate-700 dark:text-slate-300 sm:px-4 lg:px-6">
                    <div className="font-semibold text-foreground">{formatCurrency(row.abandonedConvertedRevenue)}</div>
                    <div className="text-xs text-muted">{formatCount(row.abandonedConvertedOrders)} / {formatCount(row.abandonedOrders)} ord</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-right text-sm font-semibold text-foreground sm:px-4 lg:px-6">
                    {formatPct(row.abandonedConversionRatePct)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-right text-sm text-slate-700 dark:text-slate-300 sm:px-4 lg:px-6">
                    <div className="font-semibold text-foreground">{formatPct(row.abandonedDeliveryRatePct)}</div>
                    <div className="text-xs text-muted">{formatCount(row.abandonedDeliveredOrders)} delivered</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-right text-sm text-slate-700 dark:text-slate-300 sm:px-4 lg:px-6">
                    <div className="font-semibold text-foreground">{formatPct(row.abandonedRtsRatePct)}</div>
                    <div className="text-xs text-muted">{formatCount(row.abandonedRtsOrders)} RTS</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-right text-sm text-slate-700 dark:text-slate-300 sm:px-4 lg:px-6">
                    <div className="font-semibold text-foreground">{formatCurrency(row.repurchaseRevenue)}</div>
                    <div className="text-xs text-muted">{formatCount(row.repurchaseConvertedOrders)} / {formatCount(row.repurchaseOrders)} ord</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-right text-sm font-semibold text-foreground sm:px-4 lg:px-6">
                    {formatPct(row.repurchaseConversionRatePct)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-right text-sm text-slate-700 dark:text-slate-300 sm:px-4 lg:px-6">
                    <div className="font-semibold text-foreground">{formatPct(row.repurchaseDeliveryRatePct)}</div>
                    <div className="text-xs text-muted">{formatCount(row.repurchaseDeliveredOrders)} delivered</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-right text-sm text-slate-700 dark:text-slate-300 sm:px-4 lg:px-6">
                    <div className="font-semibold text-foreground">{formatPct(row.repurchaseRtsRatePct)}</div>
                    <div className="text-xs text-muted">{formatCount(row.repurchaseRtsOrders)} RTS</div>
                  </td>
                </tr>
              ))
            )}
            {!isLoading && rows.length === 0 ? (
              <AnalyticsTableEmptyRow colSpan={9} message="No abandoned or repurchase data for the selected range." />
            ) : null}
          </tbody>
        </table>
      </div>
    </AnalyticsTableShell>
  );
}
