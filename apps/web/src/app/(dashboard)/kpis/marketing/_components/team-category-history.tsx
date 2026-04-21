import { EmptyState } from '@/components/ui/emptystate';
import { Target } from 'lucide-react';
import type { KpiTargetRow } from '../types';
import { formatMarketingMetricValue } from '../utils';

type TeamCategoryHistoryProps = {
  teamName?: string;
  rows: KpiTargetRow[];
};

export function TeamCategoryHistory({ teamName, rows }: TeamCategoryHistoryProps) {
  return (
    <section className="panel panel-content">
      <div className="panel-header">
        <Target className="h-3.5 w-3.5 text-orange-500" />
        <h4 className="panel-title">
          Team + Category Targets
        </h4>
        {teamName ? <span className="ml-auto text-xs-tight text-slate-500">{teamName}</span> : null}
      </div>
      <div className="space-y-3 p-3">
        {rows.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            {rows.map((row) => (
              <div
                key={row.id}
                className="grid gap-1 border-b border-slate-100 px-3 py-2.5 last:border-b-0 sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-900">{row.label}</p>
                  <p className="text-xs text-slate-500">
                    {row.scopeType === 'TEAM' ? 'Team KPI' : `${row.category} category KPI`}
                  </p>
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
        ) : (
          <EmptyState
            title="No team/category targets"
            description="No records in this range."
          />
        )}
      </div>
    </section>
  );
}
