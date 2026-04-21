import { EmptyState } from '@/components/ui/emptystate';
import { Users } from 'lucide-react';
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
    <section className="panel panel-content">
      <div className="panel-header">
        <Users className="h-3.5 w-3.5 text-orange-500" />
        <h4 className="panel-title">
          User Assignments + Overrides
        </h4>
        {teamName ? <span className="ml-auto text-xs-tight text-slate-500">{teamName}</span> : null}
      </div>
      <div className="space-y-3 p-3">
        {hasRows ? (
          <div className="space-y-3">
            {userCategoryAssignments.length > 0 ? (
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                {userCategoryAssignments.map((row) => (
                  <div
                    key={row.id}
                    className="grid gap-1 border-b border-slate-100 px-3 py-2.5 last:border-b-0 sm:grid-cols-[1fr_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-900">{row.userName}</p>
                      <p className="text-xs text-slate-500">Category: {row.category}</p>
                    </div>
                    <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs-tight font-semibold uppercase tracking-wide text-orange-700 sm:justify-self-end">
                      Assignment
                    </span>
                  </div>
                ))}
              </div>
            ) : null}

            {userTargets.length > 0 ? (
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                {userTargets.map((row) => (
                  <div
                    key={row.id}
                    className="grid gap-1 border-b border-slate-100 px-3 py-2.5 last:border-b-0 sm:grid-cols-[1fr_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-900">{row.userName}</p>
                      <p className="text-xs text-slate-500">{row.label} override</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {row.startDate} to {row.endDate || 'Open ended'}
                      </p>
                    </div>
                    <p className="text-sm font-semibold tabular-nums text-slate-900 sm:text-right">
                      {formatMarketingMetricValue(row.targetValue, row.format)}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <EmptyState
            title="No user assignment/override"
            description="No records in this range."
          />
        )}
      </div>
    </section>
  );
}
