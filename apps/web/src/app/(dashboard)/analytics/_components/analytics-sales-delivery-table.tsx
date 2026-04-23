'use client';

import { type ReactNode } from 'react';
import {
  AnalyticsTableEmptyRow,
  AnalyticsTableLoadingRows,
  AnalyticsTableShell,
} from './analytics-table-shell';
import { formatMetricValue, toTitleCase } from '../_utils/metrics';

export type SalesDeliverySortKey =
  | 'index'
  | 'product'
  | 'total_orders'
  | 'new_orders'
  | 'restocking'
  | 'confirmed'
  | 'printed'
  | 'waiting_pickup'
  | 'shipped'
  | 'delivered'
  | 'rts'
  | 'canceled'
  | 'deleted';

export type SalesDeliveryRowItem = {
  row: {
    total_orders: number;
    new_orders: number;
    restocking: number;
    confirmed: number;
    printed: number;
    waiting_pickup: number;
    shipped: number;
    delivered: number;
    rts: number;
    canceled: number;
    deleted: number;
    mapping: string | null;
  };
  index: number;
  display: string;
};

type AnalyticsSalesDeliveryTableProps = {
  isLoading: boolean;
  deliveryStart: number;
  deliveryEnd: number;
  totalDelivery: number;
  onPrevious: () => void;
  onNext: () => void;
  canPrevious: boolean;
  canNext: boolean;
  pageSize: number;
  deliveryPage: number;
  rows: SalesDeliveryRowItem[];
  sourceCount: number;
  renderSortLabel: (label: ReactNode, key: SalesDeliverySortKey) => ReactNode;
};

export function AnalyticsSalesDeliveryTable({
  isLoading,
  deliveryStart,
  deliveryEnd,
  totalDelivery,
  onPrevious,
  onNext,
  canPrevious,
  canNext,
  pageSize,
  deliveryPage,
  rows,
  sourceCount,
  renderSortLabel,
}: AnalyticsSalesDeliveryTableProps) {
  return (
    <AnalyticsTableShell
      summaryLabel={`Showing ${deliveryStart}-${deliveryEnd} of ${totalDelivery}`}
      onPrevious={onPrevious}
      onNext={onNext}
      canPrevious={canPrevious}
      canNext={canNext}
      isLoading={isLoading}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full table-fixed divide-y divide-slate-100">
          <thead className="bg-slate-50">
            <tr>
              <th className="sticky left-0 z-10 w-16 bg-slate-50 px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                {renderSortLabel('#', 'index')}
              </th>
              <th className="sticky left-16 z-10 bg-slate-50 px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                {renderSortLabel('Product', 'product')}
              </th>
              <th className="px-3 sm:px-4 lg:px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                {renderSortLabel('Total Order', 'total_orders')}
              </th>
              <th className="px-3 sm:px-4 lg:px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                {renderSortLabel('New', 'new_orders')}
              </th>
              <th className="px-3 sm:px-4 lg:px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                {renderSortLabel('Restocking', 'restocking')}
              </th>
              <th className="px-3 sm:px-4 lg:px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                {renderSortLabel('Confirmed', 'confirmed')}
              </th>
              <th className="px-3 sm:px-4 lg:px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                {renderSortLabel('Printed', 'printed')}
              </th>
              <th className="px-3 sm:px-4 lg:px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                {renderSortLabel('Waiting for Pickup', 'waiting_pickup')}
              </th>
              <th className="px-3 sm:px-4 lg:px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                {renderSortLabel('Shipped', 'shipped')}
              </th>
              <th className="px-3 sm:px-4 lg:px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                {renderSortLabel('Delivered', 'delivered')}
              </th>
              <th className="px-3 sm:px-4 lg:px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                {renderSortLabel('RTS', 'rts')}
              </th>
              <th className="px-3 sm:px-4 lg:px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                {renderSortLabel('Cancelled', 'canceled')}
              </th>
              <th className="px-3 sm:px-4 lg:px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                {renderSortLabel('Deleted', 'deleted')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {isLoading ? (
              <AnalyticsTableLoadingRows colCount={13} />
            ) : (
              rows.map((item, idx) => (
                <tr key={`${item.row.mapping || 'null'}-${idx}`} className="hover:bg-slate-50">
                  <td className="sticky left-0 z-10 w-16 bg-white px-3 sm:px-4 lg:px-6 py-3 text-sm text-slate-700 whitespace-nowrap">
                    {(deliveryPage - 1) * pageSize + idx + 1}.
                  </td>
                  <td className="sticky left-16 z-10 bg-white px-3 sm:px-4 lg:px-6 py-3 text-sm text-slate-900 font-medium whitespace-nowrap">
                    {toTitleCase(item.display)}
                  </td>
                  <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-center text-slate-700 whitespace-nowrap">{formatMetricValue(item.row.total_orders ?? 0, 'number', 0)}</td>
                  <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-center text-slate-700 whitespace-nowrap">{formatMetricValue(item.row.new_orders ?? 0, 'number', 0)}</td>
                  <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-center text-slate-700 whitespace-nowrap">{formatMetricValue(item.row.restocking ?? 0, 'number', 0)}</td>
                  <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-center text-slate-700 whitespace-nowrap">{formatMetricValue(item.row.confirmed ?? 0, 'number', 0)}</td>
                  <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-center text-slate-700 whitespace-nowrap">{formatMetricValue(item.row.printed ?? 0, 'number', 0)}</td>
                  <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-center text-slate-700 whitespace-nowrap">{formatMetricValue(item.row.waiting_pickup ?? 0, 'number', 0)}</td>
                  <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-center text-slate-700 whitespace-nowrap">{formatMetricValue(item.row.shipped ?? 0, 'number', 0)}</td>
                  <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-center text-slate-700 whitespace-nowrap">{formatMetricValue(item.row.delivered ?? 0, 'number', 0)}</td>
                  <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-center text-slate-700 whitespace-nowrap">{formatMetricValue(item.row.rts ?? 0, 'number', 0)}</td>
                  <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-center text-slate-700 whitespace-nowrap">{formatMetricValue(item.row.canceled ?? 0, 'number', 0)}</td>
                  <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-center text-slate-700 whitespace-nowrap">{formatMetricValue(item.row.deleted ?? 0, 'number', 0)}</td>
                </tr>
              ))
            )}
            {!isLoading && sourceCount === 0 ? (
              <AnalyticsTableEmptyRow colSpan={13} message="No delivery status found for this range." />
            ) : null}
          </tbody>
        </table>
      </div>
    </AnalyticsTableShell>
  );
}
