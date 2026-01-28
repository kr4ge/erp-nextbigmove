import clsx from 'clsx';

type Status = 'ACTIVE' | 'PENDING' | 'ERROR' | 'DISABLED' | 'INFO';

const map: Record<Status, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  PENDING: 'bg-amber-50 text-amber-700 ring-amber-200',
  ERROR: 'bg-rose-50 text-rose-700 ring-rose-200',
  DISABLED: 'bg-slate-50 text-slate-600 ring-slate-200',
  INFO: 'bg-blue-50 text-blue-700 ring-blue-200',
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset',
        map[status]
      )}
    >
      {status}
    </span>
  );
}
