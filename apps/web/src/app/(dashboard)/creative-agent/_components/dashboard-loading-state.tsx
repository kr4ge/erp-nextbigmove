'use client';

type DashboardMetricGridSkeletonProps = {
  count?: number;
  className?: string;
  compact?: boolean;
};

export function DashboardLoadingBar({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block rounded bg-slate-200 dark:bg-slate-600 ${className}`.trim()}
    />
  );
}

export function DashboardMetricGridSkeleton({
  count = 12,
  className = 'grid grid-cols-2 gap-3 p-4 sm:grid-cols-4',
  compact = false,
}: DashboardMetricGridSkeletonProps) {
  return (
    <div
      className={`${className} animate-pulse`.trim()}
      role="status"
      aria-label="Loading dashboard metrics"
    >
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className={`stat-tile ${compact ? 'px-3 py-2' : 'px-4 py-3.5'}`}
          aria-hidden="true"
        >
          <DashboardLoadingBar className="h-3 w-20" />
          <DashboardLoadingBar className={`${compact ? 'mt-1 h-5' : 'mt-2 h-6'} w-16`} />
          <DashboardLoadingBar className={`${compact ? 'mt-1' : 'mt-2'} h-2.5 w-24 max-w-full`} />
        </div>
      ))}
      <span className="sr-only">Loading dashboard metrics…</span>
    </div>
  );
}

export function DashboardChartSkeleton({ className = 'h-64' }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg border border-border/40 bg-secondary/10 p-4 animate-pulse ${className}`.trim()}
      role="status"
      aria-label="Loading chart"
    >
      <div className="flex h-full items-end gap-3" aria-hidden="true">
        {[38, 58, 44, 72, 54, 82, 66, 88, 62, 76, 48, 68].map((height, index) => (
          <div key={index} className="flex h-full flex-1 items-end">
            <div className="w-full rounded-t bg-slate-200 dark:bg-slate-600" style={{ height: `${height}%` }} />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading chart…</span>
    </div>
  );
}

export function DashboardListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border/40 animate-pulse" role="status" aria-label="Loading dashboard list">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-3" aria-hidden="true">
          <DashboardLoadingBar className="h-6 w-20 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <DashboardLoadingBar className="h-3.5 w-48 max-w-full" />
            <DashboardLoadingBar className="h-2.5 w-72 max-w-[80%]" />
          </div>
          <DashboardLoadingBar className="hidden h-4 w-32 shrink-0 sm:block" />
        </div>
      ))}
      <span className="sr-only">Loading dashboard list…</span>
    </div>
  );
}

export function DashboardCalendarSkeleton() {
  return (
    <div className="animate-pulse" role="status" aria-label="Loading monthly summary">
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-border/40 p-px" aria-hidden="true">
        {Array.from({ length: 35 }, (_, index) => (
          <div key={index} className="min-h-[4.5rem] bg-surface p-2">
            <DashboardLoadingBar className="h-2.5 w-5" />
            {index % 3 === 0 ? <DashboardLoadingBar className="mt-3 h-2.5 w-3/4" /> : null}
            {index % 3 === 0 ? <DashboardLoadingBar className="mt-1.5 h-2.5 w-1/2" /> : null}
          </div>
        ))}
      </div>
      <span className="sr-only">Loading monthly summary…</span>
    </div>
  );
}
