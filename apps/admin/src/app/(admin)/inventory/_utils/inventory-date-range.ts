import type { WmsInventoryDateRange } from '../_types/inventory';

export function getDefaultInventoryDateRange(): WmsInventoryDateRange {
  const today = formatInventoryDateInputValue(new Date());
  return { startDate: today, endDate: today };
}

export function parseInventoryDateInputValue(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;

  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatInventoryDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function normalizeInventoryDatePickerValue(value: unknown, fallbackYmd: string) {
  if (typeof value === 'string') return value.slice(0, 10);
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatInventoryDateInputValue(value);
  }
  return fallbackYmd;
}

export function formatInventoryDateRangeLabel(dateRange: WmsInventoryDateRange) {
  const start = parseInventoryDateInputValue(dateRange.startDate);
  const end = parseInventoryDateInputValue(dateRange.endDate);
  if (!start || !end) return 'Select dates';

  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  if (dateRange.startDate === dateRange.endDate) return formatter.format(start);
  return `${formatter.format(start)} - ${formatter.format(end)}`;
}
