'use client';

import { type ReactNode } from 'react';
import { formatMetricValue } from '../../analytics/_utils/metrics';
import {
  AnalyticsTableEmptyRow,
  AnalyticsTableShell,
} from '../../analytics/_components/analytics-table-shell';
import type { OrderStatusSummaryRow } from '../_types/summary';

type OrderStatusSummaryTableProps = {
  rows: OrderStatusSummaryRow[];
  start: number;
  end: number;
  total: number;
  page: number;
  totalPages: number;
  canPrevious: boolean;
  canNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  renderSortLabel?: (label: ReactNode, key: string) => ReactNode;
};

const STATUS_COLUMNS = [
  { key: 'new_orders', label: 'New' },
  { key: 'restocking', label: 'Restocking' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'printed', label: 'Printed' },
  { key: 'waiting_pickup', label: 'Waiting for Pickup' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'returning', label: 'Returning' },
  { key: 'returned', label: 'Returned' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'deleted', label: 'Deleted' },
  { key: 'total_orders', label: 'Total' },
] as const;

export function OrderStatusSummaryTable({
  rows,
  start,
  end,
  total,
  page,
  totalPages,
  canPrevious,
  canNext,
  onPrevious,
  onNext,
  renderSortLabel,
}: OrderStatusSummaryTableProps) {
  return (
    <AnalyticsTableShell
      summaryLabel={`Showing ${start}-${end} of ${total}`}
      onPrevious={onPrevious}
      onNext={onNext}
      canPrevious={canPrevious}
      canNext={canNext}
      pageIndicatorLabel={`Page ${page} of ${totalPages}`}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full table-fixed divide-y divide-slate-100 dark:divide-border">
          <thead className="bg-slate-50 dark:bg-background-secondary">
            <tr>
              <th className="w-16 min-w-[4rem] max-w-[4rem] bg-slate-50 px-3 py-3 text-left text-xs font-semibold uppercase whitespace-nowrap text-slate-500 dark:bg-background-secondary dark:text-slate-300 md:sticky md:left-0 md:z-10 sm:px-4 lg:px-6">
                #
              </th>
              <th className="min-w-[16rem] bg-slate-50 px-3 py-3 text-left text-xs font-semibold uppercase whitespace-nowrap text-slate-500 dark:bg-background-secondary dark:text-slate-300 md:sticky md:left-16 md:z-10 sm:px-4 lg:px-6">
                {renderSortLabel ? renderSortLabel('Store', 'shop') : 'Store'}
              </th>
              {STATUS_COLUMNS.map((column) => (
                <th
                  key={column.key}
                  className="px-3 py-3 text-center text-xs font-semibold uppercase whitespace-nowrap text-slate-500 dark:text-slate-300 sm:px-4 lg:px-6"
                >
                  {renderSortLabel ? renderSortLabel(column.label, column.key) : column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white dark:divide-border dark:bg-surface">
            {rows.map((row, index) => (
              <tr key={row.shop_id} className="hover:bg-slate-50 dark:hover:bg-background-secondary">
                <td className="w-16 min-w-[4rem] max-w-[4rem] bg-white px-3 py-3 text-sm whitespace-nowrap text-slate-700 dark:bg-surface dark:text-slate-300 md:sticky md:left-0 md:z-10 sm:px-4 lg:px-6">
                  {(page - 1) * 10 + index + 1}.
                </td>
                <td className="min-w-[16rem] bg-white px-3 py-3 text-sm font-medium whitespace-nowrap text-foreground dark:bg-surface md:sticky md:left-16 md:z-10 sm:px-4 lg:px-6">
                  {row.shop_name}
                </td>
                {STATUS_COLUMNS.map((column) => (
                  <td
                    key={`${row.shop_id}-${column.key}`}
                    className="px-3 py-3 text-center text-sm whitespace-nowrap text-slate-700 dark:text-slate-300 sm:px-4 lg:px-6"
                  >
                    {formatMetricValue(row[column.key], 'number', 0)}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 ? (
              <AnalyticsTableEmptyRow
                colSpan={STATUS_COLUMNS.length + 2}
                message="No stores available for the selected date."
              />
            ) : null}
          </tbody>
        </table>
      </div>
    </AnalyticsTableShell>
  );
}
