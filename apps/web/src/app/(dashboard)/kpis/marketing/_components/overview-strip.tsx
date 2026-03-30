import { Card } from '@/components/ui/card';

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
    <Card>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Selected Team</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {teamName || 'No team selected'}
          </p>
          {teamCode ? <p className="text-xs text-slate-500">{teamCode}</p> : null}
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Date Range</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{dateRange}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Eligible Users</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {loading ? 'Refreshing…' : eligibleUserCount.toString()}
          </p>
        </div>
      </div>
    </Card>
  );
}
