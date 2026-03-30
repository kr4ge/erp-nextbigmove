import { CONFIRMATION_STATUS_OPTIONS } from './constants';
import type { OrderStatusMeta } from '../_types/confirmation';

export const ORDER_STATUS_LABELS: Record<number, OrderStatusMeta> = {
  0: { label: 'New', color: '#64748B' },
  1: { label: 'Confirmed', color: '#003EB3' },
  2: { label: 'Shipped', color: '#FA8C16' },
  3: { label: 'Delivered', color: '#52C41A' },
  4: { label: 'Returning', color: '#E0695C' },
  5: { label: 'Returned', color: '#A8071A' },
  6: { label: 'Canceled', color: '#F5222D' },
  7: { label: 'Deleted recently', color: '#434343' },
  8: { label: 'Packaging', color: '#722ED1' },
  9: { label: 'Waiting for pick up', color: '#EB2F96' },
  11: { label: 'Restocking', color: '#AD8B00' },
  12: { label: 'Wait for printing', color: '#13C2C2' },
  13: { label: 'Printed', color: '#08979C' },
  15: { label: 'Partial return', color: '#531DAB' },
  16: { label: 'Collected money', color: '#237804' },
  17: { label: 'Waiting for confirmation', color: '#1677FF' },
  20: { label: 'Purchased', color: '#389E0D' },
};

export const FALLBACK_STATUS_META: OrderStatusMeta = {
  label: '—',
  color: '#64748B',
};

export const getStatusMeta = (
  status: number | string | null,
  isAbandoned?: boolean | null,
): OrderStatusMeta => {
  const normalizedStatus = typeof status === 'string' ? Number(status) : status;

  if (normalizedStatus === 0 && isAbandoned) {
    return { label: 'Abandoned', color: ORDER_STATUS_LABELS[0].color };
  }

  if (typeof normalizedStatus === 'number' && Number.isFinite(normalizedStatus)) {
    return ORDER_STATUS_LABELS[normalizedStatus] || {
      label: String(normalizedStatus),
      color: FALLBACK_STATUS_META.color,
    };
  }

  if (normalizedStatus === null || normalizedStatus === undefined) return FALLBACK_STATUS_META;
  return { label: String(normalizedStatus), color: FALLBACK_STATUS_META.color };
};

export const formatStatusLabel = (
  status: number | string | null,
  _statusName?: string | null,
  isAbandoned?: boolean | null,
) => getStatusMeta(status, isAbandoned).label;

export const getHistoryStatusBadgeColor = (
  status: number | string | null,
  isAbandoned?: boolean | null,
): string => getStatusMeta(status, isAbandoned).color;

export const toNonNegativeNumber = (value: number | null | undefined): number => {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num) || num < 0) return 0;
  return num;
};

export const computeReturnRate = (
  success: number | null | undefined,
  fail: number | null | undefined,
): number | null => {
  const successCount = toNonNegativeNumber(success);
  const failCount = toNonNegativeNumber(fail);
  const total = successCount + failCount;
  if (total <= 0) return null;
  return (failCount / total) * 100;
};

export const formatReturnRate = (
  success: number | null | undefined,
  fail: number | null | undefined,
): string => {
  const rate = computeReturnRate(success, fail);
  if (rate === null) return '—';
  return `${rate.toFixed(2)}%`;
};

export const getReturnRateColorClass = (
  success: number | null | undefined,
  fail: number | null | undefined,
): string => {
  const successCount = toNonNegativeNumber(success);
  const failCount = toNonNegativeNumber(fail);
  const total = successCount + failCount;
  const rate = computeReturnRate(successCount, failCount);

  if (total <= 0 || rate === null) return 'text-slate-900';

  if (successCount === 0) {
    if (failCount >= 3) return 'text-red-600';
    if (failCount === 2) return 'text-amber-500';
    if (failCount === 1) return 'text-emerald-600';
  }

  if (total >= 3) {
    if (rate <= 69) return 'text-emerald-600';
    if (rate <= 80) return 'text-amber-500';
    return 'text-red-600';
  }

  if (rate <= 69) return 'text-emerald-600';
  if (rate <= 80) return 'text-amber-500';
  return 'text-red-600';
};

export const getConfirmationStatusOptionLabel = (value: number | null): string | null => {
  if (typeof value !== 'number') return null;
  const found = CONFIRMATION_STATUS_OPTIONS.find((item) => item.value === value);
  return found?.label || null;
};
