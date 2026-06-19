import type {
  PosOrdersReportItem,
  PosOrdersReportTotals,
} from '../_types/reports';
import {
  formatReportCount,
  formatReportRate,
  formatReportRevenue,
  getQtyValue,
  getRevenueValue,
  REPORT_QTY_COLUMNS,
  REPORT_REVENUE_COLUMNS,
} from '../_utils/reports-format';

type ReportsSummaryTableProps = {
  items: PosOrdersReportItem[];
  totals: PosOrdersReportTotals;
};

export function ReportsSummaryTable({ items, totals }: ReportsSummaryTableProps) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-border">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50 text-slate-900 dark:bg-background-secondary dark:text-foreground">
            <th
              rowSpan={2}
              className="sticky left-0 z-20 border-b border-r border-slate-200 bg-slate-50 px-4 py-3 text-left font-semibold dark:border-border dark:bg-background-secondary"
            >
              POS
            </th>
            <th colSpan={REPORT_QTY_COLUMNS.length} className="border-b border-r border-slate-200 px-4 py-3 text-center font-semibold dark:border-border">
              Qty
            </th>
            <th colSpan={REPORT_REVENUE_COLUMNS.length} className="border-b border-slate-200 px-4 py-3 text-center font-semibold dark:border-border">
              Revenue
            </th>
          </tr>
          <tr className="bg-slate-50 text-slate-700 dark:bg-background-secondary dark:text-slate-300">
            {REPORT_QTY_COLUMNS.map((column) => (
              <th key={`qty-${column.key}`} className="border-b border-r border-slate-200 px-3 py-2 text-center font-medium whitespace-nowrap dark:border-border">
                {column.label}
              </th>
            ))}
            {REPORT_REVENUE_COLUMNS.map((column, index) => (
              <th
                key={`revenue-${column.key}`}
                className={`border-b px-3 py-2 text-center font-medium whitespace-nowrap ${
                  index < REPORT_REVENUE_COLUMNS.length - 1 ? 'border-r border-slate-200 dark:border-border' : 'border-slate-200 dark:border-border'
                }`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.shop_id} className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50/60 dark:border-border dark:hover:bg-background-secondary">
              <td className="sticky left-0 z-10 border-r border-slate-200 bg-white px-4 py-3 font-medium text-slate-900 whitespace-nowrap dark:border-border dark:bg-surface dark:text-foreground">
                {item.pos_store_name}
              </td>
              {REPORT_QTY_COLUMNS.map((column) => (
                <td key={`${item.shop_id}-qty-${column.key}`} className="border-r border-slate-200 px-3 py-3 text-center text-slate-700 whitespace-nowrap dark:border-border dark:text-slate-300">
                  {column.type === 'rate'
                    ? formatReportRate(getQtyValue(item, column.key))
                    : formatReportCount(getQtyValue(item, column.key))}
                </td>
              ))}
              {REPORT_REVENUE_COLUMNS.map((column) => (
                <td key={`${item.shop_id}-revenue-${column.key}`} className="border-r border-slate-200 px-3 py-3 text-center text-slate-700 whitespace-nowrap last:border-r-0 dark:border-border dark:text-slate-300">
                  {formatReportRevenue(getRevenueValue(item, column.key))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-100 text-slate-900 dark:bg-background-secondary dark:text-foreground">
            <td className="sticky left-0 z-10 border-r border-slate-300 bg-slate-100 px-4 py-3 font-semibold whitespace-nowrap dark:border-border dark:bg-background-secondary">
              Total
            </td>
            {REPORT_QTY_COLUMNS.map((column) => (
              <td
                key={`total-qty-${column.key}`}
                className="border-r border-slate-300 px-3 py-3 text-center font-semibold whitespace-nowrap dark:border-border"
              >
                {column.type === 'rate'
                  ? formatReportRate(totals.qty[column.key])
                  : formatReportCount(totals.qty[column.key])}
              </td>
            ))}
            {REPORT_REVENUE_COLUMNS.map((column) => (
              <td
                key={`total-revenue-${column.key}`}
                className="border-r border-slate-300 px-3 py-3 text-center font-semibold whitespace-nowrap last:border-r-0 dark:border-border"
              >
                {formatReportRevenue(totals.revenue[column.key])}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
