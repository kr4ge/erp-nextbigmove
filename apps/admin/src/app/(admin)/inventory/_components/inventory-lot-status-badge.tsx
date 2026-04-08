import { cn } from '@/lib/utils';

const toneMap: Record<string, string> = {
  ACTIVE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  HOLD: 'border-amber-200 bg-amber-50 text-amber-700',
  DEPLETED: 'border-slate-200 bg-slate-100 text-slate-600',
  CLOSED: 'border-slate-300 bg-slate-100 text-slate-700',
};

export function InventoryLotStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em]',
        toneMap[status] || 'border-slate-200 bg-slate-100 text-slate-600',
      )}
    >
      {status}
    </span>
  );
}
