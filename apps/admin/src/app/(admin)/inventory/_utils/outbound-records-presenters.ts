import type { WmsOutboundUnitStatus } from '../_types/outbound-records';

export function formatOutboundDateTime(value: string | null) {
  if (!value) return 'Not recorded';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';

  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function formatOutboundStatus(status: WmsOutboundUnitStatus) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export function getOutboundStatusClassName(status: WmsOutboundUnitStatus) {
  if (status === 'DELIVERED') return 'pill-success';
  if (status === 'RETURNED') return 'pill-destructive';
  if (status === 'RETURNING') return 'border-warning/30 bg-warning-soft text-warning';
  return 'pill-info';
}

export function getDefaultOutboundDateRange() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 29);

  return {
    startDate: formatDateInputValue(start),
    endDate: formatDateInputValue(end),
  };
}

export function formatDateInputValue(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value ?? '';
  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  const day = parts.find((part) => part.type === 'day')?.value ?? '';
  return `${year}-${month}-${day}`;
}

export function parseDateInputValue(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}
