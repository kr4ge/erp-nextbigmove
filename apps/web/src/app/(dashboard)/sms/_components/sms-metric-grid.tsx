import { Inbox, MessageSquare, Radio, Smartphone } from 'lucide-react';
import type { SmsOverviewResponse } from '../_types/sms';
import { formatSmsCount } from '../_utils/sms-formatters';

type SmsMetricGridProps = {
  overview: SmsOverviewResponse;
};

const metrics = [
  {
    key: 'totalOutbound' as const,
    label: 'SMS sent all time',
    helper: null,
    icon: MessageSquare,
    tone: 'bg-primary-soft text-primary',
  },
  {
    key: 'totalInbound' as const,
    label: 'SMS received all time',
    helper: null,
    icon: Inbox,
    tone: 'bg-info-soft text-info',
  },
  {
    key: 'activeDevices' as const,
    label: 'Devices',
    helper: 'enabled',
    icon: Smartphone,
    tone: 'bg-success-soft text-success',
  },
  {
    key: 'activeSims' as const,
    label: 'Active SIMs',
    helper: 'available',
    icon: Radio,
    tone: 'bg-warning-soft text-warning',
  },
];

export function SmsMetricGrid({ overview }: SmsMetricGridProps) {
  return (
    <section className="panel panel-content grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <article key={metric.key} className="flex items-center gap-3 px-2 py-1">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${metric.tone}`}>
            <metric.icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg-loose font-semibold text-foreground">
              {formatSmsCount(overview.stats[metric.key])}
            </p>
            <div className="flex items-center gap-1 text-xs text-muted">
              <span>{metric.label}</span>
              {metric.helper ? <span>{metric.helper}</span> : null}
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
