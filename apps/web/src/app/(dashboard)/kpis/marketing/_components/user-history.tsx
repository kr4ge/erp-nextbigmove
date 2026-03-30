import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/emptystate';
import type { CategoryAssignmentRow, KpiTargetRow } from '../types';
import { formatMarketingMetricValue } from '../utils';

type UserHistoryProps = {
  teamName?: string;
  userCategoryAssignments: CategoryAssignmentRow[];
  userTargets: KpiTargetRow[];
};

export function UserHistory({
  teamName,
  userCategoryAssignments,
  userTargets,
}: UserHistoryProps) {
  const hasRows = userCategoryAssignments.length > 0 || userTargets.length > 0;

  return (
    <Card>
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">
          History: User Assignment + Direct KPI {teamName ? `for ${teamName}` : ''}
        </h2>
        {hasRows ? (
          <div className="space-y-3">
            {userCategoryAssignments.map((row) => (
              <div key={row.id} className="rounded-xl border border-slate-200 px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">{row.userName}</p>
                <p className="text-xs text-slate-500">Category: {row.category}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {row.startDate} to {row.endDate || 'Open ended'}
                </p>
              </div>
            ))}

            {userTargets.map((row) => (
              <div key={row.id} className="rounded-xl border border-slate-200 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{row.userName}</p>
                    <p className="text-xs text-slate-500">{row.label} override</p>
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
            title="No user assignment or direct KPI override"
            description="No user assignment or direct KPI records found for the selected range."
          />
        )}
      </div>
    </Card>
  );
}
