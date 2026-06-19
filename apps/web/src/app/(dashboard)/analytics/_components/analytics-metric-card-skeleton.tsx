'use client';

type AnalyticsMetricCardSkeletonProps = {
  className?: string;
};

export function AnalyticsMetricCardSkeleton({ className }: AnalyticsMetricCardSkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-lg border border-border bg-slate-50 px-3 py-2.5 dark:bg-background-secondary ${className ?? ''}`.trim()}
    >
      <div className="h-3 w-20 rounded bg-slate-200 dark:bg-slate-600" />
      <div className="mt-1.5 h-5 w-16 rounded bg-slate-200 dark:bg-slate-600" />
      <div className="mt-1 h-2.5 w-14 rounded bg-slate-200 dark:bg-slate-600" />
    </div>
  );
}
