'use client';

type AnalyticsMetricCardSkeletonProps = {
  className?: string;
};

export function AnalyticsMetricCardSkeleton({ className }: AnalyticsMetricCardSkeletonProps) {
  return (
    <div
      className={`rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 animate-pulse ${className ?? ''}`.trim()}
    >
      <div className="h-3 w-20 bg-slate-200 rounded" />
      <div className="mt-1.5 h-5 w-16 bg-slate-200 rounded" />
      <div className="mt-1 h-2.5 w-14 bg-slate-200 rounded" />
    </div>
  );
}
