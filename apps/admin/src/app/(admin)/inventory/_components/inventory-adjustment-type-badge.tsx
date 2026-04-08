import { cn } from '@/lib/utils';

const toneMap: Record<string, string> = {
  OPENING: 'border-sky-200 bg-sky-50 text-sky-700',
  INCREASE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  DECREASE: 'border-amber-200 bg-amber-50 text-amber-700',
  WRITE_OFF: 'border-rose-200 bg-rose-50 text-rose-700',
};

export function InventoryAdjustmentTypeBadge({ adjustmentType }: { adjustmentType: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]',
        toneMap[adjustmentType] || 'border-slate-200 bg-slate-100 text-slate-600',
      )}
    >
      {adjustmentType.replaceAll('_', ' ')}
    </span>
  );
}
