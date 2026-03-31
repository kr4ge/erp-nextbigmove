import { CalendarDays, Sparkles, Users } from 'lucide-react';

type OverviewStripProps = {
  teamName: string;
  teamCode: string;
  dateRange: string;
  eligibleUserCount: number;
  loading: boolean;
};

export function OverviewStrip({
  teamName,
  teamCode,
  dateRange,
  eligibleUserCount,
  loading,
}: OverviewStripProps) {
  return (
    <section className="overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
        <Sparkles className="h-3.5 w-3.5 text-orange-500" />
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
          Current Context
        </h4>
      </div>
      <div className="p-3">
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-6">
          <div className="rounded-lg border border-orange-100 bg-orange-50/40 px-3 py-2.5 md:col-span-2">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-500">
              <Sparkles className="h-3 w-3 text-orange-500" />
              <span>Team</span>
            </div>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">
              {teamName || 'No team'}
            </p>
            {teamCode ? <p className="text-[11px] text-slate-500">{teamCode}</p> : null}
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5 md:col-span-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-500">
              <CalendarDays className="h-3 w-3 text-slate-500" />
              <span>Range</span>
            </div>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">{dateRange}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5 md:col-span-1">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-500">
              <Users className="h-3 w-3 text-slate-500" />
              <span>Members</span>
            </div>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">
              {loading ? '...' : eligibleUserCount.toString()}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
