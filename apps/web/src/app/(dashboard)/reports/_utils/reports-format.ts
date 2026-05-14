import type {
  PosOrdersReportItem,
  PosOrdersReportTotals,
} from '../_types/reports';

export const REPORT_QTY_COLUMNS = [
  { key: 'all_orders', label: 'All Orders', type: 'number' as const },
  { key: 'shipped', label: 'Shipped', type: 'number' as const },
  { key: 'delivered', label: 'Delivered', type: 'number' as const },
  { key: 'cancelled', label: 'Cancelled', type: 'number' as const },
  { key: 'returning', label: 'Returning', type: 'number' as const },
  { key: 'returned', label: 'Returned', type: 'number' as const },
  { key: 'restocking', label: 'Restocking', type: 'number' as const },
  { key: 'in_process', label: 'In Process', type: 'number' as const },
  { key: 'rts_rate', label: 'RTS Rate', type: 'rate' as const },
  { key: 'pending_rate', label: 'Pending Rate', type: 'rate' as const },
  { key: 'cancellation_rate', label: 'Cancellation Rate', type: 'rate' as const },
] as const;

export const REPORT_REVENUE_COLUMNS = [
  { key: 'all_orders', label: 'All Orders' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'returning', label: 'Returning' },
  { key: 'returned', label: 'Returned' },
  { key: 'restocking', label: 'Restocking' },
  { key: 'in_process', label: 'In Process' },
] as const;

export const formatReportCount = (value: number) =>
  new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);

export const formatReportRevenue = (value: number) =>
  `₱${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0)}`;

export const formatReportRate = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

export const buildReportFilename = (startDate: string, endDate: string, extension: 'csv' | 'xlsx') =>
  `pos-orders-report_${startDate}_to_${endDate}.${extension}`;

export const buildReportDateRangeLabel = (startDate: string, endDate: string) =>
  `${startDate} to ${endDate}`;

export const getQtyValue = (
  item: PosOrdersReportItem,
  key: (typeof REPORT_QTY_COLUMNS)[number]['key'],
) => item.qty[key];

export const getRevenueValue = (
  item: PosOrdersReportItem,
  key: (typeof REPORT_REVENUE_COLUMNS)[number]['key'],
) => item.revenue[key];

export const buildPosOrdersReportTotals = (
  items: PosOrdersReportItem[],
): PosOrdersReportTotals => {
  const totals = items.reduce<PosOrdersReportTotals>(
    (acc, item) => {
      acc.qty.all_orders += item.qty.all_orders;
      acc.qty.shipped += item.qty.shipped;
      acc.qty.delivered += item.qty.delivered;
      acc.qty.cancelled += item.qty.cancelled;
      acc.qty.returning += item.qty.returning;
      acc.qty.returned += item.qty.returned;
      acc.qty.restocking += item.qty.restocking;
      acc.qty.in_process += item.qty.in_process;

      acc.revenue.all_orders += item.revenue.all_orders;
      acc.revenue.shipped += item.revenue.shipped;
      acc.revenue.delivered += item.revenue.delivered;
      acc.revenue.cancelled += item.revenue.cancelled;
      acc.revenue.returning += item.revenue.returning;
      acc.revenue.returned += item.revenue.returned;
      acc.revenue.restocking += item.revenue.restocking;
      acc.revenue.in_process += item.revenue.in_process;

      return acc;
    },
    {
      qty: {
        all_orders: 0,
        shipped: 0,
        delivered: 0,
        cancelled: 0,
        returning: 0,
        returned: 0,
        restocking: 0,
        in_process: 0,
        rts_rate: 0,
        pending_rate: 0,
        cancellation_rate: 0,
      },
      revenue: {
        all_orders: 0,
        shipped: 0,
        delivered: 0,
        cancelled: 0,
        returning: 0,
        returned: 0,
        restocking: 0,
        in_process: 0,
      },
    },
  );

  const totalRts = totals.qty.returning + totals.qty.returned;
  const totalPending = totals.qty.restocking + totals.qty.in_process;
  totals.qty.rts_rate =
    totals.qty.delivered + totalRts > 0 ? totalRts / (totals.qty.delivered + totalRts) : 0;
  totals.qty.pending_rate =
    totals.qty.all_orders > 0 ? totalPending / totals.qty.all_orders : 0;
  totals.qty.cancellation_rate =
    totals.qty.all_orders > 0 ? totals.qty.cancelled / totals.qty.all_orders : 0;

  return totals;
};
