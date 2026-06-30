'use client';

import type { WmsForecastingResponse, WmsForecastingRow } from '../_types/forecast';

type ForecastStoreGroup = {
  storeId: string;
  title: string;
  rows: WmsForecastingRow[];
  totals: {
    remainingStocks: number;
    pendingOrders: number;
    past3DaySales: number;
    avgDailySales: number;
    forecastedDemand: number;
    safetyStock: number;
    suggestedOrderQty: number;
    returning: number;
  };
};

const FORECAST_HEADER_COLUMNS = [
  'Item',
  'Remaining Stocks',
  'Pending Orders',
  'Past N-Day Sales',
  'Avg Daily Sales',
  'Forecasted Demand',
  'Safety Stock',
  'Suggested Order Qty',
  'Status',
  'Returning',
];

export async function exportForecastWorkbook(data: WmsForecastingResponse) {
  const XLSX = await import('xlsx');
  const xlsx = (XLSX as unknown as { default?: typeof XLSX }).default ?? XLSX;
  const workbook = xlsx.utils.book_new();
  const worksheetData: Array<Array<string | number>> = [];
  const groups = buildStoreGroups(data.rows);
  const partnerLabel = data.context.activeTenantName ?? 'WMS';
  const salesLabel = `Past ${data.context.pastSalesWindowDays}-day sales`;
  const forecastDates = data.context.forecastDates.join(', ');
  const generatedDate = formatDate(data.generatedAt);

  worksheetData.push([`${partnerLabel} — SMART ORDER FORECASTING`]);
  worksheetData.push([]);
  worksheetData.push(['Client:', partnerLabel, '', '', '', '', 'Forecasted Ordering Dates:', forecastDates]);
  worksheetData.push(['Purchase Request Date:', generatedDate, '', '', '', '', 'Days Forecasted:', data.context.daysForecasted]);
  worksheetData.push(['Safety Stock Buffer (%):', data.context.safetyStockPct, '', '', '', '', 'Reorder Trigger (days of stock left):', data.context.reorderTriggerDays]);
  worksheetData.push(['Sales Window:', `${formatDate(data.context.salesWindow.startDate)} to ${formatDate(data.context.salesWindow.endDate)}`, '', '', '', '', 'Past Sales Range:', `${data.context.pastSalesWindowDays} days`]);
  worksheetData.push([]);

  for (const group of groups) {
    worksheetData.push([group.title]);
    worksheetData.push([
      FORECAST_HEADER_COLUMNS[0],
      FORECAST_HEADER_COLUMNS[1],
      FORECAST_HEADER_COLUMNS[2],
      salesLabel,
      FORECAST_HEADER_COLUMNS[4],
      FORECAST_HEADER_COLUMNS[5],
      FORECAST_HEADER_COLUMNS[6],
      FORECAST_HEADER_COLUMNS[7],
      FORECAST_HEADER_COLUMNS[8],
      FORECAST_HEADER_COLUMNS[9],
    ]);

    for (const row of group.rows) {
      worksheetData.push([
        row.productDisplayId ? `${row.productName} · Code ${row.productDisplayId}` : row.productName,
        row.remainingStocks,
        row.pendingOrders,
        row.past3DaySales,
        row.avgDailySales,
        row.forecastedDemand,
        row.safetyStock,
        row.suggestedOrderQty,
        row.status.label,
        row.returning,
      ]);
    }

    worksheetData.push([
      'TOTALS',
      group.totals.remainingStocks,
      group.totals.pendingOrders,
      group.totals.past3DaySales,
      group.totals.avgDailySales,
      group.totals.forecastedDemand,
      group.totals.safetyStock,
      group.totals.suggestedOrderQty,
      '',
      group.totals.returning,
    ]);
    worksheetData.push([]);
  }

  const worksheet = xlsx.utils.aoa_to_sheet(worksheetData);
  worksheet['!cols'] = [
    { wch: 42 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 20 },
    { wch: 16 },
    { wch: 22 },
    { wch: 18 },
    { wch: 14 },
  ];

  const merges: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }> = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
  ];

  let rowCursor = 7;
  for (const group of groups) {
    merges.push({ s: { r: rowCursor, c: 0 }, e: { r: rowCursor, c: 9 } });
    rowCursor += group.rows.length + 4;
  }
  worksheet['!merges'] = merges;

  xlsx.utils.book_append_sheet(workbook, worksheet, 'Forecast');
  const fileName = buildFileName(data);
  xlsx.writeFile(workbook, fileName);
}

function buildStoreGroups(rows: WmsForecastingRow[]): ForecastStoreGroup[] {
  const groups = new Map<string, ForecastStoreGroup>();

  for (const row of rows) {
    const key = row.storeId ?? row.rowId;
    const title = row.tenantName ? `${row.storeName} — ${row.tenantName}` : row.storeName;
    const existing = groups.get(key) ?? {
      storeId: key,
      title,
      rows: [],
      totals: {
        remainingStocks: 0,
        pendingOrders: 0,
        past3DaySales: 0,
        avgDailySales: 0,
        forecastedDemand: 0,
        safetyStock: 0,
        suggestedOrderQty: 0,
        returning: 0,
      },
    };

    existing.rows.push(row);
    existing.totals.remainingStocks += row.remainingStocks;
    existing.totals.pendingOrders += row.pendingOrders;
    existing.totals.past3DaySales += row.past3DaySales;
    existing.totals.avgDailySales += row.avgDailySales;
    existing.totals.forecastedDemand += row.forecastedDemand;
    existing.totals.safetyStock += row.safetyStock;
    existing.totals.suggestedOrderQty += row.suggestedOrderQty;
    existing.totals.returning += row.returning;

    groups.set(key, existing);
  }

  return Array.from(groups.values()).map((group) => ({
    ...group,
    totals: {
      ...group.totals,
      avgDailySales: roundTo(group.totals.avgDailySales, 2),
      forecastedDemand: roundTo(group.totals.forecastedDemand, 2),
      safetyStock: roundTo(group.totals.safetyStock, 2),
    },
  }));
}

function buildFileName(data: WmsForecastingResponse) {
  const partner = (data.context.activeTenantName ?? 'forecast')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${partner || 'forecast'}-${data.context.cycleDate}.xlsx`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function roundTo(value: number, precision: number) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}
