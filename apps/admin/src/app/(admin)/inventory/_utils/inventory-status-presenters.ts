import type { WmsInventoryUnitStatus } from '../_types/inventory';

const STATUS_CLASS_MAP: Record<WmsInventoryUnitStatus, string> = {
  RECEIVED: 'border-amber-200 bg-amber-50 text-amber-700',
  STAGED: 'border-sky-200 bg-sky-50 text-sky-700',
  PUTAWAY: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  EXPIRED: 'border-red-300 bg-red-50 text-red-800',
  DEADSTOCK: 'border-yellow-200 bg-yellow-50 text-yellow-800',
  RESERVED: 'border-violet-200 bg-violet-50 text-violet-700',
  PICKED: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  PACKED: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  DISPATCHED: 'border-slate-200 bg-slate-100 text-slate-700',
  RTS: 'border-orange-200 bg-orange-50 text-orange-700',
  DAMAGED: 'border-rose-200 bg-rose-50 text-rose-700',
  LOST: 'border-red-200 bg-red-50 text-red-700',
  ARCHIVED: 'border-zinc-200 bg-zinc-100 text-zinc-600',
};

export function formatInventoryStatusLabel(status: WmsInventoryUnitStatus) {
  return status
    .toLowerCase()
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

export function getInventoryStatusClassName(status: WmsInventoryUnitStatus) {
  return STATUS_CLASS_MAP[status];
}

export function formatInventoryExpirationDate(value: string | null) {
  if (!value) {
    return 'Not set';
  }

  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) {
    return value.slice(0, 10);
  }

  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Manila',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export type InventoryExpirationState =
  | 'NOT_SET'
  | 'VALID'
  | 'EXPIRES_TODAY'
  | 'EXPIRED';

export function getInventoryExpirationState(
  value: string | null,
  now = new Date(),
): InventoryExpirationState {
  if (!value) {
    return 'NOT_SET';
  }

  const expirationDate = value.slice(0, 10);
  const today = getManilaDateKey(now);

  if (expirationDate < today) {
    return 'EXPIRED';
  }
  if (expirationDate === today) {
    return 'EXPIRES_TODAY';
  }

  return 'VALID';
}

function getManilaDateKey(value: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}
