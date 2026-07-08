import type {
  PosOrdersReportItem,
  PosOrdersReportTotals,
} from '../_types/reports';

export const REPORT_QTY_COLUMNS = [
  { key: 'all_orders', label: 'All Orders', type: 'number' as const },
  { key: 'new_orders', label: 'New', type: 'number' as const },
  { key: 'confirmed', label: 'Confirmed', type: 'number' as const },
  { key: 'waiting_pickup', label: 'Waiting Pickup', type: 'number' as const },
  { key: 'wait_print', label: 'Awaiting Print', type: 'number' as const },
  { key: 'printed', label: 'Printed', type: 'number' as const },
  { key: 'shipped', label: 'Shipped', type: 'number' as const },
  { key: 'delivered', label: 'Delivered', type: 'number' as const },
  { key: 'cancelled', label: 'Cancelled', type: 'number' as const },
  { key: 'returning', label: 'Returning', type: 'number' as const },
  { key: 'returned', label: 'Returned', type: 'number' as const },
  { key: 'restocking', label: 'Restocking', type: 'number' as const },
  { key: 'rts_rate', label: 'RTS Rate', type: 'rate' as const },
  { key: 'pending_rate', label: 'Pending Rate', type: 'rate' as const },
  { key: 'cancellation_rate', label: 'Cancellation Rate', type: 'rate' as const },
] as const;

export const REPORT_REVENUE_COLUMNS = [
  { key: 'all_orders', label: 'All Orders' },
  { key: 'new_orders', label: 'New' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'waiting_pickup', label: 'Waiting Pickup' },
  { key: 'wait_print', label: 'Awaiting Print' },
  { key: 'printed', label: 'Printed' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'returning', label: 'Returning' },
  { key: 'returned', label: 'Returned' },
  { key: 'restocking', label: 'Restocking' },
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
      acc.qty.new_orders += item.qty.new_orders;
      acc.qty.confirmed += item.qty.confirmed;
      acc.qty.waiting_pickup += item.qty.waiting_pickup;
      acc.qty.wait_print += item.qty.wait_print;
      acc.qty.printed += item.qty.printed;
      acc.qty.shipped += item.qty.shipped;
      acc.qty.delivered += item.qty.delivered;
      acc.qty.cancelled += item.qty.cancelled;
      acc.qty.returning += item.qty.returning;
      acc.qty.returned += item.qty.returned;
      acc.qty.restocking += item.qty.restocking;
      acc.qty.in_process += item.qty.in_process;

      acc.revenue.all_orders += item.revenue.all_orders;
      acc.revenue.new_orders += item.revenue.new_orders;
      acc.revenue.confirmed += item.revenue.confirmed;
      acc.revenue.waiting_pickup += item.revenue.waiting_pickup;
      acc.revenue.wait_print += item.revenue.wait_print;
      acc.revenue.printed += item.revenue.printed;
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
        new_orders: 0,
        confirmed: 0,
        waiting_pickup: 0,
        wait_print: 0,
        printed: 0,
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
        new_orders: 0,
        confirmed: 0,
        waiting_pickup: 0,
        wait_print: 0,
        printed: 0,
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
