import { cn } from '@/lib/utils';

const toneMap: Record<string, string> = {
  POSTED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  DRAFT: 'border-amber-200 bg-amber-50 text-amber-700',
  CANCELED: 'border-rose-200 bg-rose-50 text-rose-700',
};

export function ReceiptStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]',
        toneMap[status] || 'border-slate-200 bg-slate-100 text-slate-600',
      )}
    >
      {status}
    </span>
  );
}
