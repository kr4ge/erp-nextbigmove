import type {
  WmsForecastStatusKey,
  WmsForecastingRow,
  WmsForecastingTotals,
} from '../_types/forecast';

export type ForecastCycleSnapshot = {
  cycleDate: string;
  cycleWeekday: 'MONDAY' | 'WEDNESDAY' | 'FRIDAY';
  forecastDates: string[];
  salesWindow: {
    startDate: string;
    endDate: string;
  };
  daysForecasted: number;
  operationRangeLabel: string;
  salesWindowLabel: string;
};

const NUMBER_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

const DECIMAL_FORMATTER = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
});

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: '2-digit',
  day: '2-digit',
  year: 'numeric',
});

const SHORT_WEEKDAY_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: '2-digit',
  day: '2-digit',
  year: 'numeric',
});

export function formatForecastNumber(value: number) {
  return NUMBER_FORMATTER.format(value);
}

export function formatForecastDecimal(value: number) {
  return DECIMAL_FORMATTER.format(value);
}

export function formatForecastDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return DATE_FORMATTER.format(date);
}

export function formatForecastShortDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return SHORT_DATE_FORMATTER.format(date);
}

export function formatForecastShortWeekdayDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return SHORT_WEEKDAY_DATE_FORMATTER.format(date);
}

export function formatForecastDateList(values: string[]) {
  return values.map(formatForecastDate).join(', ');
}

export function formatCycleWeekday(value: string) {
  if (value === 'CUSTOM') {
    return 'Custom';
  }

  return value.toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

export function getTodayDateValue() {
  return toDateInputValue(new Date());
}

export function getTomorrowDateValue() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return toDateInputValue(tomorrow);
}

export function getForecastStatusClassName(status: WmsForecastStatusKey) {
  if (status === 'REORDER_NOW') {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }

  if (status === 'LOW_STOCK') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  if (status === 'ADEQUATE') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  return 'border-slate-200 bg-slate-50 text-slate-600';
}

export function getDefaultCycleDate() {
  const now = new Date();
  const local = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const validWeekdays = new Set(FORECAST_CYCLE_WEEKDAYS);

  while (!validWeekdays.has(local.getDay())) {
    local.setDate(local.getDate() - 1);
  }

  return toDateInputValue(local);
}

export function isForecastCycleDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return FORECAST_CYCLE_WEEKDAYS.includes(parsed.getDay());
}

export function getForecastCycleSnapshots(count = 2): ForecastCycleSnapshot[] {
  const snapshots: ForecastCycleSnapshot[] = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  while (snapshots.length < count) {
    if (FORECAST_CYCLE_WEEKDAYS.includes(cursor.getDay())) {
      snapshots.push(resolveForecastCycleSnapshot(toDateInputValue(cursor)));
    }

    cursor.setDate(cursor.getDate() - 1);
  }

  return snapshots;
}

export function resolveForecastCycleSnapshot(cycleDate: string): ForecastCycleSnapshot {
  const date = new Date(`${cycleDate}T00:00:00`);
  const weekday = date.getDay();

  if (weekday === 1) {
    return buildForecastCycleSnapshot(cycleDate, 'MONDAY', 2, [2, 3]);
  }

  if (weekday === 3) {
    return buildForecastCycleSnapshot(cycleDate, 'WEDNESDAY', 3, [2, 3, 4]);
  }

  if (weekday === 5) {
    return buildForecastCycleSnapshot(cycleDate, 'FRIDAY', 2, [3, 4]);
  }

  throw new Error('Forecast cycle date must be Monday, Wednesday, or Friday');
}

export function countForecastDaysInclusive(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0;
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1;
}

export function buildForecastDateRange(startDate: string, endDate: string) {
  const totalDays = countForecastDaysInclusive(startDate, endDate);

  if (totalDays <= 0) {
    return [];
  }

  return Array.from({ length: totalDays }, (_, index) => addDays(startDate, index));
}

export function getTotalsRow(totals: WmsForecastingTotals): WmsForecastingRow {
  return {
    rowId: 'totals',
    storeId: null,
    storeName: 'Totals',
    tenantId: null,
    tenantName: null,
    shopId: null,
    variationId: 'totals',
    productId: null,
    productName: 'Totals',
    productDisplayId: null,
    actualStock: totals.actualStock,
    pendingOrders: totals.pendingOrders,
    remainingStocks: totals.remainingStocks,
    past3DaySales: totals.past3DaySales,
    avgDailySales: totals.avgDailySales,
    forecastedDemand: totals.forecastedDemand,
    safetyStock: totals.safetyStock,
    suggestedOrderQty: totals.suggestedOrderQty,
    daysOfStockLeft: null,
    status: {
      key: 'NO_SALES',
      label: '',
    },
    returning: totals.returning,
  };
}

function toDateInputValue(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

const FORECAST_CYCLE_WEEKDAYS = [1, 3, 5];

function buildForecastCycleSnapshot(
  cycleDate: string,
  cycleWeekday: ForecastCycleSnapshot['cycleWeekday'],
  daysForecasted: number,
  forecastDayOffsets: number[],
): ForecastCycleSnapshot {
  const forecastDates = forecastDayOffsets.map((offset) => addDays(cycleDate, offset));
  const salesWindow = {
    startDate: addDays(cycleDate, -3),
    endDate: addDays(cycleDate, -1),
  };

  return {
    cycleDate,
    cycleWeekday,
    forecastDates,
    salesWindow,
    daysForecasted,
    operationRangeLabel: formatRangeLabel(forecastDates),
    salesWindowLabel: formatRangeLabel([salesWindow.startDate, salesWindow.endDate]),
  };
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

function formatRangeLabel(values: string[]) {
  if (values.length === 0) {
    return '';
  }

  if (values.length === 1) {
    return formatForecastDate(values[0]);
  }

  return `${formatForecastDate(values[0])} - ${formatForecastDate(values[values.length - 1])}`;
}
