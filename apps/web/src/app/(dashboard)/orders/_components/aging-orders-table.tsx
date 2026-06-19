'use client';

import { type ReactNode } from 'react';
import {
  AnalyticsTableEmptyRow,
  AnalyticsTableLoadingRows,
  AnalyticsTableShell,
} from '../../analytics/_components/analytics-table-shell';
import { formatMetricValue } from '../../analytics/_utils/metrics';
import type {
  AgingOrdersSummaryRow,
} from '../_types/summary';
import type { AgingOrdersSummarySortKey } from '../_hooks/use-aging-orders-summary';

type AgingOrdersTableProps = {
  isLoading: boolean;
  start: number;
  end: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
  canPrevious: boolean;
  canNext: boolean;
  pageSize: number;
  page: number;
  totalPages: number;
  rows: AgingOrdersSummaryRow[];
  sourceCount: number;
  hasShopUnread: (shopId: string) => boolean;
  markingShopId: string | null;
  onShopRead: (shopId: string) => void;
  renderSortLabel: (label: ReactNode, key: AgingOrdersSummarySortKey) => ReactNode;
};

export function AgingOrdersTable({
  isLoading,
  start,
  end,
  total,
  onPrevious,
  onNext,
  canPrevious,
  canNext,
  pageSize,
  page,
  totalPages,
  rows,
  sourceCount,
  hasShopUnread,
  markingShopId,
  onShopRead,
  renderSortLabel,
}: AgingOrdersTableProps) {
  return (
    <AnalyticsTableShell
      summaryLabel={`Showing ${start}-${end} of ${total}`}
      onPrevious={onPrevious}
      onNext={onNext}
      canPrevious={canPrevious}
      canNext={canNext}
      isLoading={isLoading}
      pageIndicatorLabel={`Page ${page} of ${totalPages}`}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full table-fixed divide-y divide-slate-100 dark:divide-border">
          <thead className="bg-slate-50 dark:bg-background-secondary">
            <tr>
              <th className="w-16 min-w-[4rem] max-w-[4rem] bg-slate-50 px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap dark:bg-background-secondary dark:text-slate-300 md:sticky md:left-0 md:z-10 sm:px-4 lg:px-6">
                {renderSortLabel('#', 'index')}
              </th>
              <th className="bg-slate-50 px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap dark:bg-background-secondary dark:text-slate-300 md:sticky md:left-16 md:z-10 sm:px-4 lg:px-6">
                {renderSortLabel('Shop', 'shop')}
              </th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap dark:text-slate-300 sm:px-4 lg:px-6">
                {renderSortLabel('Total Order', 'total_orders')}
              </th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap dark:text-slate-300 sm:px-4 lg:px-6">
                {renderSortLabel('New', 'new_orders')}
              </th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap dark:text-slate-300 sm:px-4 lg:px-6">
                {renderSortLabel('Restocking', 'restocking')}
              </th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap dark:text-slate-300 sm:px-4 lg:px-6">
                {renderSortLabel('Confirmed', 'confirmed')}
              </th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap dark:text-slate-300 sm:px-4 lg:px-6">
                {renderSortLabel('Printed', 'printed')}
              </th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap dark:text-slate-300 sm:px-4 lg:px-6">
                {renderSortLabel('Waiting for Pickup', 'waiting_pickup')}
              </th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap dark:text-slate-300 sm:px-4 lg:px-6">
                {renderSortLabel('Shipped', 'shipped')}
              </th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap dark:text-slate-300 sm:px-4 lg:px-6">
                {renderSortLabel('Returning', 'rts')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white dark:divide-border dark:bg-surface">
            {isLoading ? (
              <AnalyticsTableLoadingRows colCount={10} />
            ) : (
              rows.map((row, index) => (
                <tr key={row.shop_id} className="hover:bg-slate-50 dark:hover:bg-background-secondary">
                  <td className="w-16 min-w-[4rem] max-w-[4rem] bg-white px-3 py-3 text-sm text-slate-700 whitespace-nowrap dark:bg-surface dark:text-slate-300 md:sticky md:left-0 md:z-10 sm:px-4 lg:px-6">
                    {(page - 1) * pageSize + index + 1}.
                  </td>
                  <td className="bg-white px-3 py-3 text-sm font-medium text-foreground whitespace-nowrap dark:bg-surface md:sticky md:left-16 md:z-10 sm:px-4 lg:px-6">
                    {hasShopUnread(row.shop_id) ? (
                      <button
                        type="button"
                        onClick={() => void onShopRead(row.shop_id)}
                        disabled={markingShopId === row.shop_id}
                        className="inline-flex items-center gap-2 rounded-full pr-1 text-left transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <span>{row.shop_name}</span>
                        <span className="h-2 w-2 rounded-full bg-destructive" />
                      </button>
                    ) : (
                      row.shop_name
                    )}
                  </td>
                  <td className="px-3 py-3 text-center text-sm text-slate-700 whitespace-nowrap dark:text-slate-300 sm:px-4 lg:px-6">{formatMetricValue(row.total_orders, 'number', 0)}</td>
                  <td className="px-3 py-3 text-center text-sm text-slate-700 whitespace-nowrap dark:text-slate-300 sm:px-4 lg:px-6">{formatMetricValue(row.new_orders, 'number', 0)}</td>
                  <td className="px-3 py-3 text-center text-sm text-slate-700 whitespace-nowrap dark:text-slate-300 sm:px-4 lg:px-6">{formatMetricValue(row.restocking, 'number', 0)}</td>
                  <td className="px-3 py-3 text-center text-sm text-slate-700 whitespace-nowrap dark:text-slate-300 sm:px-4 lg:px-6">{formatMetricValue(row.confirmed, 'number', 0)}</td>
                  <td className="px-3 py-3 text-center text-sm text-slate-700 whitespace-nowrap dark:text-slate-300 sm:px-4 lg:px-6">{formatMetricValue(row.printed, 'number', 0)}</td>
                  <td className="px-3 py-3 text-center text-sm text-slate-700 whitespace-nowrap dark:text-slate-300 sm:px-4 lg:px-6">{formatMetricValue(row.waiting_pickup, 'number', 0)}</td>
                  <td className="px-3 py-3 text-center text-sm text-slate-700 whitespace-nowrap dark:text-slate-300 sm:px-4 lg:px-6">{formatMetricValue(row.shipped, 'number', 0)}</td>
                  <td className="px-3 py-3 text-center text-sm text-slate-700 whitespace-nowrap dark:text-slate-300 sm:px-4 lg:px-6">{formatMetricValue(row.rts, 'number', 0)}</td>
                </tr>
              ))
            )}
            {!isLoading && sourceCount === 0 ? (
              <AnalyticsTableEmptyRow
                colSpan={10}
                message="No aging orders found for the selected shop filter."
              />
            ) : null}
          </tbody>
        </table>
      </div>
    </AnalyticsTableShell>
  );
}
