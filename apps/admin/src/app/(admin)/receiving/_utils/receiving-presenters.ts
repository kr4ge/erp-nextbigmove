import type { WmsReceivingBatchStatus } from '../_types/receiving';

const STATUS_CLASS_MAP: Record<WmsReceivingBatchStatus, string> = {
  DRAFT: 'border-slate-200 bg-slate-50 text-slate-700',
  ARRIVED: 'border-sky-200 bg-sky-50 text-sky-700',
  COUNTED: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  STAGED: 'border-amber-200 bg-amber-50 text-amber-700',
  PUTAWAY_PENDING: 'border-orange-200 bg-orange-50 text-orange-700',
  COMPLETED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  CANCELED: 'border-rose-200 bg-rose-50 text-rose-700',
};

export function formatReceivingStatusLabel(status: WmsReceivingBatchStatus) {
  return status
    .toLowerCase()
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

export function getReceivingStatusClassName(status: WmsReceivingBatchStatus) {
  return STATUS_CLASS_MAP[status];
}

export function formatShortDate(value: string | null | undefined) {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}
