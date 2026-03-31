import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

type OverviewErrorProps = {
  message: string;
  onRetry: () => void;
  loading?: boolean;
};

export function OverviewError({ message, onRetry, loading }: OverviewErrorProps) {
  return (
    <section className="overflow-visible rounded-xl border border-rose-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-rose-100 bg-rose-50/40 px-3 py-2">
        <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
        <h4 className="text-xs font-semibold uppercase tracking-wide text-rose-700">
          KPI Overview Error
        </h4>
      </div>
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-rose-700">Unable to load KPI overview</p>
          <p className="text-sm text-slate-600">{message}</p>
        </div>
        <Button onClick={onRetry} loading={loading}>
          Retry
        </Button>
      </div>
    </section>
  );
}
