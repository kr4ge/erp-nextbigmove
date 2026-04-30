'use client';

import {
  AnalyticsTableEmptyRow,
  AnalyticsTableLoadingRows,
  AnalyticsTableShell,
} from './analytics-table-shell';

export type SalesPerformanceRepurchaseRow = {
  shop: string;
  deliveredOrders: number;
  deliveredAmount: number;
  rtsOrders: number;
  rtsAmount: number;
  shippedOrders: number;
  shippedAmount: number;
  totalOrders: number;
  totalAmount: number;
};

type AnalyticsSalesPerformanceRepurchaseTableProps = {
  isLoading: boolean;
  rows: SalesPerformanceRepurchaseRow[];
  repurchaseStart: number;
  repurchaseEnd: number;
  totalRepurchaseRows: number;
  canPrevious: boolean;
  canNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
};

const formatCount = (value: number) => new Intl.NumberFormat('en-US').format(value || 0);
const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value || 0);

export function AnalyticsSalesPerformanceRepurchaseTable({
  isLoading,
  rows,
  repurchaseStart,
  repurchaseEnd,
  totalRepurchaseRows,
  canPrevious,
  canNext,
  onPrevious,
  onNext,
}: AnalyticsSalesPerformanceRepurchaseTableProps) {
  return (
    <AnalyticsTableShell
      summaryLabel={`Showing ${repurchaseStart}-${repurchaseEnd} of ${totalRepurchaseRows}`}
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
              <th className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase text-slate-500 sm:px-4 lg:px-6">
                Shop
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-right text-xs font-semibold uppercase text-slate-500 sm:px-4 lg:px-6">
                Delivered Orders
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-right text-xs font-semibold uppercase text-slate-500 sm:px-4 lg:px-6">
                Delivered Amount
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-right text-xs font-semibold uppercase text-slate-500 sm:px-4 lg:px-6">
                RTS Orders
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-right text-xs font-semibold uppercase text-slate-500 sm:px-4 lg:px-6">
                RTS Amount
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-right text-xs font-semibold uppercase text-slate-500 sm:px-4 lg:px-6">
                Shipped Orders
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-right text-xs font-semibold uppercase text-slate-500 sm:px-4 lg:px-6">
                Shipped Amount
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-right text-xs font-semibold uppercase text-slate-500 sm:px-4 lg:px-6">
                Total Orders
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-right text-xs font-semibold uppercase text-slate-500 sm:px-4 lg:px-6">
                Total Amount
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <AnalyticsTableLoadingRows colCount={9} />
            ) : (
              rows.map((row) => (
                <tr key={row.shop} className="bg-white">
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-700 sm:px-4 lg:px-6">
                    {row.shop}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-right text-sm font-semibold text-slate-900 sm:px-4 lg:px-6">
                    {formatCount(row.deliveredOrders)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-right text-sm text-slate-700 sm:px-4 lg:px-6">
                    {formatCurrency(row.deliveredAmount)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-right text-sm font-semibold text-slate-900 sm:px-4 lg:px-6">
                    {formatCount(row.rtsOrders)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-right text-sm text-slate-700 sm:px-4 lg:px-6">
                    {formatCurrency(row.rtsAmount)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-right text-sm font-semibold text-slate-900 sm:px-4 lg:px-6">
                    {formatCount(row.shippedOrders)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-right text-sm text-slate-700 sm:px-4 lg:px-6">
                    {formatCurrency(row.shippedAmount)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-right text-sm font-semibold text-slate-900 sm:px-4 lg:px-6">
                    {formatCount(row.totalOrders)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-right text-sm text-slate-700 sm:px-4 lg:px-6">
                    {formatCurrency(row.totalAmount)}
                  </td>
                </tr>
              ))
            )}
            {!isLoading && rows.length === 0 ? (
              <AnalyticsTableEmptyRow
                colSpan={9}
                message="No repurchase data available for the selected scope."
              />
            ) : null}
          </tbody>
        </table>
      </div>
    </AnalyticsTableShell>
  );
}

