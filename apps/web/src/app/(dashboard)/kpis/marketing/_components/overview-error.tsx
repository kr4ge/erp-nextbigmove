import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type OverviewErrorProps = {
  message: string;
  onRetry: () => void;
  loading?: boolean;
};

export function OverviewError({ message, onRetry, loading }: OverviewErrorProps) {
  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-rose-700">Unable to load KPI data</p>
          <p className="text-sm text-slate-600">{message}</p>
        </div>
        <Button onClick={onRetry} loading={loading}>
          Retry
        </Button>
      </div>
    </Card>
  );
}
