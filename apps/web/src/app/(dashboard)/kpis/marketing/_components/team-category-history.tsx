import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/emptystate';
import type { KpiTargetRow } from '../types';
import { formatMarketingMetricValue } from '../utils';

type TeamCategoryHistoryProps = {
  teamName?: string;
  rows: KpiTargetRow[];
};

export function TeamCategoryHistory({ teamName, rows }: TeamCategoryHistoryProps) {
  return (
    <Card>
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">
          History: Team + Category KPI {teamName ? `for ${teamName}` : ''}
        </h2>
        {rows.length > 0 ? (
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.id} className="rounded-xl border border-slate-200 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{row.label}</p>
                    <p className="text-xs text-slate-500">
                      {row.scopeType === 'TEAM' ? 'Team KPI' : `${row.category} category KPI`}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    {formatMarketingMetricValue(row.targetValue, row.format)}
                  </p>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {row.startDate} to {row.endDate || 'Open ended'}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No team or category KPI targets"
            description="No historical team/category KPI records found for the selected range."
          />
        )}
      </div>
    </Card>
  );
}
