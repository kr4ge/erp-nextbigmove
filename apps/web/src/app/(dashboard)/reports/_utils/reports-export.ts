import type { PosOrdersReportItem, PosOrdersReportResponse } from '../_types/reports';
import {
  buildPosOrdersReportTotals,
  buildReportDateRangeLabel,
  buildReportFilename,
  getQtyValue,
  getRevenueValue,
  REPORT_QTY_COLUMNS,
  REPORT_REVENUE_COLUMNS,
} from './reports-format';

const CSV_SECOND_HEADER = [
  'POS',
  ...REPORT_QTY_COLUMNS.map((column) => column.label),
  ...REPORT_REVENUE_COLUMNS.map((column) => column.label),
];

const buildTopHeaderRow = (): string[] => [
  'POS',
  'QTY',
  ...Array.from({ length: REPORT_QTY_COLUMNS.length - 1 }, () => ''),
  'REVENUE',
  ...Array.from({ length: REPORT_REVENUE_COLUMNS.length - 1 }, () => ''),
];

const buildDateHeaderRow = (report: PosOrdersReportResponse): string[] => [
  buildReportDateRangeLabel(report.selected.start_date, report.selected.end_date),
  ...Array.from(
    { length: REPORT_QTY_COLUMNS.length + REPORT_REVENUE_COLUMNS.length },
    () => '',
  ),
];

const escapeCsvValue = (value: string | number) => {
  const raw = `${value ?? ''}`;
  if (!raw.includes(',') && !raw.includes('"') && !raw.includes('\n')) {
    return raw;
  }
  return `"${raw.replace(/"/g, '""')}"`;
};

const buildExportDataRow = (item: PosOrdersReportItem): Array<string | number> => [
  item.pos_store_name,
  ...REPORT_QTY_COLUMNS.map((column) => {
    const value = getQtyValue(item, column.key);
    return column.type === 'rate' ? `${(value * 100).toFixed(2)}%` : Math.round(value);
  }),
  ...REPORT_REVENUE_COLUMNS.map((column) => getRevenueValue(item, column.key).toFixed(2)),
];

const buildTotalsRow = (report: PosOrdersReportResponse): Array<string | number> => {
  const totals = buildPosOrdersReportTotals(report.items);

  return [
    'Total',
    ...REPORT_QTY_COLUMNS.map((column) => {
      const value = totals.qty[column.key];
      return column.type === 'rate' ? `${(value * 100).toFixed(2)}%` : Math.round(value);
    }),
    ...REPORT_REVENUE_COLUMNS.map((column) => totals.revenue[column.key].toFixed(2)),
  ];
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

export function exportPosOrdersReportCsv(report: PosOrdersReportResponse) {
  const rows = [
    buildDateHeaderRow(report),
    buildTopHeaderRow(),
    CSV_SECOND_HEADER,
    ...report.items.map((item) => buildExportDataRow(item)),
    buildTotalsRow(report),
  ];

  const csv = rows
    .map((row) => row.map((cell) => escapeCsvValue(cell)).join(','))
    .join('\n');

  downloadBlob(
    new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
    buildReportFilename(report.selected.start_date, report.selected.end_date, 'csv'),
  );
}

export async function exportPosOrdersReportXlsx(report: PosOrdersReportResponse) {
  const XLSX = await import('xlsx');
  const totalColumnCount = REPORT_QTY_COLUMNS.length + REPORT_REVENUE_COLUMNS.length;
  const qtyStartColumnIndex = 1;
  const qtyEndColumnIndex = REPORT_QTY_COLUMNS.length;
  const revenueStartColumnIndex = qtyEndColumnIndex + 1;
  const revenueEndColumnIndex = qtyEndColumnIndex + REPORT_REVENUE_COLUMNS.length;
  const totals = buildPosOrdersReportTotals(report.items);
  const totalRowIndex = report.items.length + 3;
  const rows: Array<Array<string | number>> = [
    buildDateHeaderRow(report),
    buildTopHeaderRow(),
    ['POS', ...REPORT_QTY_COLUMNS.map((column) => column.label), ...REPORT_REVENUE_COLUMNS.map((column) => column.label)],
    ...report.items.map((item) => [
      item.pos_store_name,
      ...REPORT_QTY_COLUMNS.map((column) => getQtyValue(item, column.key)),
      ...REPORT_REVENUE_COLUMNS.map((column) => getRevenueValue(item, column.key)),
    ]),
    [
      'Total',
      ...REPORT_QTY_COLUMNS.map((column) => totals.qty[column.key]),
      ...REPORT_REVENUE_COLUMNS.map((column) => totals.revenue[column.key]),
    ],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: totalColumnCount } },
    { s: { r: 1, c: 0 }, e: { r: 2, c: 0 } },
    { s: { r: 1, c: qtyStartColumnIndex }, e: { r: 1, c: qtyEndColumnIndex } },
    { s: { r: 1, c: revenueStartColumnIndex }, e: { r: 1, c: revenueEndColumnIndex } },
  ];
  worksheet['!cols'] = [
    { wch: 28 },
    ...REPORT_QTY_COLUMNS.map((column) => ({ wch: column.type === 'rate' ? 16 : 12 })),
    ...REPORT_REVENUE_COLUMNS.map(() => ({ wch: 14 })),
  ];

  const rateColumnIndexes = REPORT_QTY_COLUMNS
    .map((column, index) => (column.type === 'rate' ? qtyStartColumnIndex + index : null))
    .filter((value): value is number => value !== null);

  for (let rowIndex = 2; rowIndex < rows.length; rowIndex += 1) {
    for (let columnIndex = 1; columnIndex <= revenueEndColumnIndex; columnIndex += 1) {
      const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
      const cell = worksheet[cellAddress];
      if (!cell || cell.t !== 'n') continue;

      if (rateColumnIndexes.includes(columnIndex)) {
        cell.z = '0.00%';
        continue;
      }

      if (columnIndex >= revenueStartColumnIndex) {
        cell.z = '#,##0.00';
        continue;
      }

      cell.z = '0';
    }
  }

  for (let columnIndex = 0; columnIndex <= revenueEndColumnIndex; columnIndex += 1) {
    const cellAddress = XLSX.utils.encode_cell({ r: totalRowIndex, c: columnIndex });
    const cell = worksheet[cellAddress];
    if (!cell) continue;
    cell.s = {
      ...(cell.s || {}),
      font: {
        ...(cell.s?.font || {}),
        bold: true,
      },
    };
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'POS Orders Report');
  XLSX.writeFile(
    workbook,
    buildReportFilename(report.selected.start_date, report.selected.end_date, 'xlsx'),
  );
}
