import { cn } from '@/lib/utils';

const toneMap: Record<string, string> = {
  RECEIPT: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  ADJUSTMENT_IN: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  TRANSFER_IN: 'border-sky-200 bg-sky-50 text-sky-700',
  RESTOCK: 'border-teal-200 bg-teal-50 text-teal-700',
  RTS_RECEIPT: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  RESERVE: 'border-amber-200 bg-amber-50 text-amber-700',
  RELEASE: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  PICK: 'border-orange-200 bg-orange-50 text-orange-700',
  DISPATCH: 'border-violet-200 bg-violet-50 text-violet-700',
  TRANSFER_OUT: 'border-sky-200 bg-sky-50 text-sky-700',
  ADJUSTMENT_OUT: 'border-rose-200 bg-rose-50 text-rose-700',
  DAMAGE: 'border-rose-200 bg-rose-50 text-rose-700',
};

export function InventoryMovementBadge({ movementType }: { movementType: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]',
        toneMap[movementType] || 'border-slate-200 bg-slate-100 text-slate-600',
      )}
    >
      {movementType.replaceAll('_', ' ')}
    </span>
  );
}
