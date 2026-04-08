import type { LocationStatus, WarehouseStatus } from '../_types/warehouses';

type EntityStatusBadgeProps = {
  status: WarehouseStatus | LocationStatus;
};

const toneMap = {
  ACTIVE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  INACTIVE: 'border-amber-200 bg-amber-50 text-amber-700',
  ARCHIVED: 'border-slate-200 bg-slate-100 text-slate-600',
} as const;

export function EntityStatusBadge({ status }: EntityStatusBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${toneMap[status]}`}
    >
      {status}
    </span>
  );
}
