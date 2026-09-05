import { CheckCircle2, RotateCcw, Truck, Undo2 } from 'lucide-react';
import type { WmsOutboundRecordsResponse } from '../_types/outbound-records';

type OutboundRecordsSummaryProps = {
  summary: WmsOutboundRecordsResponse['summary'] | null | undefined;
  isFetching: boolean;
};

const metrics = [
  { key: 'shipped', label: 'Shipped', icon: Truck, tone: 'text-info bg-info-soft' },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2, tone: 'text-success bg-success-soft/50' },
  { key: 'returning', label: 'Returning', icon: Undo2, tone: 'text-warning bg-warning-soft' },
  { key: 'returned', label: 'Returned', icon: RotateCcw, tone: 'text-destructive bg-destructive-soft/50' },
] as const;

export function OutboundRecordsSummary({ summary, isFetching }: OutboundRecordsSummaryProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-busy={isFetching}>
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <div key={metric.key} className="card flex items-center justify-between gap-3">
            <div>
              <p className="card-label">{metric.label}</p>
              <p className="card-value mt-1">{summary?.[metric.key] ?? 0}</p>
              <p className="mt-0.5 text-xs text-muted">during selected dates</p>
            </div>
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${metric.tone}`}>
              <Icon className="h-4 w-4" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
