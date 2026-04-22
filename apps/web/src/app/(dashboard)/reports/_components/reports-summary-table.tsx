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
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50 text-slate-900">
            <th
              rowSpan={2}
              className="sticky left-0 z-20 border-b border-r border-slate-200 bg-slate-50 px-4 py-3 text-left font-semibold"
            >
              POS
            </th>
            <th colSpan={REPORT_QTY_COLUMNS.length} className="border-b border-r border-slate-200 px-4 py-3 text-center font-semibold">
              Qty
            </th>
            <th colSpan={REPORT_REVENUE_COLUMNS.length} className="border-b border-slate-200 px-4 py-3 text-center font-semibold">
              Revenue
            </th>
          </tr>
          <tr className="bg-slate-50 text-slate-700">
            {REPORT_QTY_COLUMNS.map((column) => (
              <th key={`qty-${column.key}`} className="border-b border-r border-slate-200 px-3 py-2 text-center font-medium whitespace-nowrap">
                {column.label}
              </th>
            ))}
            {REPORT_REVENUE_COLUMNS.map((column, index) => (
              <th
                key={`revenue-${column.key}`}
                className={`border-b px-3 py-2 text-center font-medium whitespace-nowrap ${
                  index < REPORT_REVENUE_COLUMNS.length - 1 ? 'border-r border-slate-200' : 'border-slate-200'
                }`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.shop_id} className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50/60">
              <td className="sticky left-0 z-10 border-r border-slate-200 bg-white px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                {item.pos_store_name}
              </td>
              {REPORT_QTY_COLUMNS.map((column) => (
                <td key={`${item.shop_id}-qty-${column.key}`} className="border-r border-slate-200 px-3 py-3 text-center text-slate-700 whitespace-nowrap">
                  {column.type === 'rate'
                    ? formatReportRate(getQtyValue(item, column.key))
                    : formatReportCount(getQtyValue(item, column.key))}
                </td>
              ))}
              {REPORT_REVENUE_COLUMNS.map((column) => (
                <td key={`${item.shop_id}-revenue-${column.key}`} className="border-r border-slate-200 px-3 py-3 text-center text-slate-700 whitespace-nowrap last:border-r-0">
                  {formatReportRevenue(getRevenueValue(item, column.key))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-100 text-slate-900">
            <td className="sticky left-0 z-10 border-r border-slate-300 bg-slate-100 px-4 py-3 font-semibold whitespace-nowrap">
              Total
            </td>
            {REPORT_QTY_COLUMNS.map((column) => (
              <td
                key={`total-qty-${column.key}`}
                className="border-r border-slate-300 px-3 py-3 text-center font-semibold whitespace-nowrap"
              >
                {column.type === 'rate'
                  ? formatReportRate(totals.qty[column.key])
                  : formatReportCount(totals.qty[column.key])}
              </td>
            ))}
            {REPORT_REVENUE_COLUMNS.map((column) => (
              <td
                key={`total-revenue-${column.key}`}
                className="border-r border-slate-300 px-3 py-3 text-center font-semibold whitespace-nowrap last:border-r-0"
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
