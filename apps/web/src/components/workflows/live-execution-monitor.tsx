'use client';

import { useWorkflowExecution } from '@/hooks/use-workflow-execution';

export function LiveExecutionMonitor({ executionId }: { executionId: string }) {
  const execution = useWorkflowExecution(executionId);

  if (!execution) {
    return (
      <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-600">
        Connect to live updates…
      </div>
    );
  }

  const totalDays =
    execution.dayProgress?.totalDays ?? execution.totalDays ?? 0;
  const percent =
    execution.progress && execution.progress.total > 0
      ? Math.round(
          (execution.progress.current / execution.progress.total) * 100,
        )
      : 0;
  const completedDays = execution.dayProgress?.completedDays ?? 0;
  const displayDay =
    totalDays === 0
      ? 0
      : execution.status === 'COMPLETED'
        ? totalDays
        : execution.activeDay ?? Math.min(completedDays + 1, totalDays);

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 p-4 bg-white">
      <div className="flex items-center gap-2">
        {execution.isLive && (
          <span className="flex items-center gap-1 text-xs text-blue-600">
            <span className="h-2 w-2 rounded-full bg-blue-600 animate-ping" />
            LIVE
          </span>
        )}
        <span className="text-sm font-semibold text-slate-900">
          {execution.status || 'FETCHING'}
        </span>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-slate-600">
          <span>
            {totalDays > 0
              ? `Processing ${Math.min(displayDay, totalDays)} of ${totalDays} days${
                  execution.currentDate ? ` – ${execution.currentDate}` : ''
                }`
              : 'Calculating date range…'}
          </span>
          <span>
            {execution.progress && execution.progress.total > 0
              ? `${percent}%`
              : '--'}
          </span>
        </div>
        <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
          <div
            className="h-full bg-indigo-600 transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg bg-slate-50 p-3">
          <div className="text-slate-500">Meta fetched</div>
          <div className="text-2xl font-semibold text-slate-900">{execution.metaFetched || 0}</div>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <div className="text-slate-500">POS fetched</div>
          <div className="text-2xl font-semibold text-slate-900">{execution.posFetched || 0}</div>
        </div>
      </div>

      <div className="rounded-lg bg-slate-50 p-3 max-h-64 overflow-y-auto">
        <div className="text-sm font-semibold text-slate-900 mb-2">Live events</div>
        <div className="space-y-1 text-xs font-mono text-slate-700">
          {(execution.events || []).map((evt, idx) => (
            <div key={idx} className="break-all">
              <span className="text-slate-400 mr-1">
                {new Date(evt.timestamp).toLocaleTimeString()}
              </span>
              {evt.event}: {JSON.stringify(evt.data)}
            </div>
          ))}
          {(!execution.events || execution.events.length === 0) && (
            <div className="text-slate-500">Awaiting events…</div>
          )}
        </div>
      </div>
    </div>
  );
}
