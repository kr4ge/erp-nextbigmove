import { cn } from '@/lib/utils';

const statusClasses: Record<string, string> = {
  ACTIVE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  TRIAL: 'border-orange-200 bg-orange-50 text-orange-700',
  SUSPENDED: 'border-amber-200 bg-amber-50 text-amber-700',
  CANCELLED: 'border-rose-200 bg-rose-50 text-rose-700',
};

export function PartnerStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em]',
        statusClasses[status] || 'border-slate-200 bg-slate-50 text-slate-600',
      )}
    >
      {status}
    </span>
  );
}
