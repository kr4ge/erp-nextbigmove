export type SalesProductsExportRow = {
  product: string;
  grossRevenue: number;
  grossSales: number;
  cogs: number;
  aov: number;
  cpp: number;
  processedCpp: number;
  adSpend: number;
  arPct: number;
  rtsPct: number;
  pePct: number;
  contributionMargin: number;
  cmRtsForecast: number;
  netMargin: number;
};

type SalesProductsExportInput = {
  startDate: string;
  endDate: string;
  cmRtsLabel: string;
  rows: SalesProductsExportRow[];
};

const escapeCsvValue = (value: string | number) => {
  const raw = `${value ?? ''}`;
  if (!raw.includes(',') && !raw.includes('"') && !raw.includes('\n')) return raw;
  return `"${raw.replace(/"/g, '""')}"`;
};

const buildFilename = (
  startDate: string,
  endDate: string,
  extension: 'csv' | 'xlsx',
) => `sales-products_${startDate}_to_${endDate}.${extension}`;

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

const buildHeaders = (cmRtsLabel: string) => [
  'Product',
  'Gross Revenue',
  'Gross Sales',
  'COGS',
  'AOV',
  'CPP',
  'Processed CPP',
  'Ad Spend',
  'AR %',
  'RTS %',
  'P.E %',
  'Contribution Margin',
  cmRtsLabel,
  'Net Margin',
];

export function exportSalesProductsCsv(input: SalesProductsExportInput) {
  const headers = buildHeaders(input.cmRtsLabel);
  const rows = input.rows.map((row) => [
    row.product,
    row.grossRevenue.toFixed(2),
    Math.round(row.grossSales),
    row.cogs.toFixed(2),
    row.aov.toFixed(2),
    row.cpp.toFixed(2),
    row.processedCpp.toFixed(2),
    row.adSpend.toFixed(2),
    `${row.arPct.toFixed(2)}%`,
    `${row.rtsPct.toFixed(2)}%`,
    `${row.pePct.toFixed(2)}%`,
    row.contributionMargin.toFixed(2),
    row.cmRtsForecast.toFixed(2),
    row.netMargin.toFixed(2),
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => escapeCsvValue(cell)).join(','))
    .join('\n');

  downloadBlob(
    new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
    buildFilename(input.startDate, input.endDate, 'csv'),
  );
}

export async function exportSalesProductsXlsx(input: SalesProductsExportInput) {
  const XLSX = await import('xlsx');
  const headers = buildHeaders(input.cmRtsLabel);
  const rows: Array<Array<string | number>> = [
    headers,
    ...input.rows.map((row) => [
      row.product,
      row.grossRevenue,
      row.grossSales,
      row.cogs,
      row.aov,
      row.cpp,
      row.processedCpp,
      row.adSpend,
      row.arPct / 100,
      row.rtsPct / 100,
      row.pePct / 100,
      row.contributionMargin,
      row.cmRtsForecast,
      row.netMargin,
    ]),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 28 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 20 },
    { wch: 20 },
    { wch: 14 },
  ];

  const currencyColumns = new Set([1, 3, 4, 5, 6, 7, 11, 12, 13]);
  const percentColumns = new Set([8, 9, 10]);

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    for (let columnIndex = 1; columnIndex < headers.length; columnIndex += 1) {
      const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
      const cell = worksheet[cellAddress];
      if (!cell || cell.t !== 'n') continue;

      if (columnIndex === 2) {
        cell.z = '0';
        continue;
      }

      if (percentColumns.has(columnIndex)) {
        cell.z = '0.00%';
        continue;
      }

      if (currencyColumns.has(columnIndex)) {
        cell.z = '#,##0.00';
      }
    }
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Revenue per Product');
  XLSX.writeFile(workbook, buildFilename(input.startDate, input.endDate, 'xlsx'));
}
