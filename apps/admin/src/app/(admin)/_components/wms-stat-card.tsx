import type { LucideIcon } from 'lucide-react';

type WmsStatCardProps = {
  label: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  accent?: 'orange' | 'emerald' | 'amber' | 'rose';
};

const toneMap = {
  orange: 'bg-orange-50 text-orange-600 ring-orange-100',
  emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  amber: 'bg-amber-50 text-amber-600 ring-amber-100',
  rose: 'bg-rose-50 text-rose-600 ring-rose-100',
} as const;

export function WmsStatCard({
  label,
  value,
  icon: Icon,
  accent = 'orange',
}: WmsStatCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {label}
          </p>
          <p className="text-[1.75rem] font-semibold tracking-tight text-slate-950 tabular-nums">
            {value}
          </p>
        </div>
        <div
          className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ring-1 ${toneMap[accent]}`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}
