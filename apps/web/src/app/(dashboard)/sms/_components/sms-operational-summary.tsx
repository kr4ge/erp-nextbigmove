import {
  Activity,
  AlertTriangle,
  Clock3,
  ShieldCheck,
} from 'lucide-react';
import type { SmsOverviewResponse } from '../_types/sms';
import {
  formatSmsCount,
  formatSmsDateTime,
} from '../_utils/sms-formatters';

type SmsOperationalSummaryProps = {
  overview: SmsOverviewResponse;
};

export function SmsOperationalSummary({
  overview,
}: SmsOperationalSummaryProps) {
  const rows = [
    {
      label: 'Delivery rate',
      value:
        overview.stats.deliveryRate === null
          ? 'No terminal messages'
          : `${overview.stats.deliveryRate}%`,
      icon: Activity,
      tone: 'bg-success-soft text-success',
    },
    {
      label: 'Queued',
      value: formatSmsCount(overview.stats.pendingMessages),
      icon: Clock3,
      tone: 'bg-warning-soft text-warning',
    },
    {
      label: 'Failed',
      value: formatSmsCount(overview.stats.failedMessages),
      icon: AlertTriangle,
      tone: 'bg-destructive-soft text-destructive',
    },
  ];

  return (
    <section className="panel panel-content">
      <div className="panel-header">
        <Activity className="panel-icon" />
        <div>
          <h2 className="panel-title">Delivery health</h2>
          <p className="text-xs text-muted">
            Last activity {formatSmsDateTime(overview.stats.lastActivityAt)}
          </p>
        </div>
      </div>

      <div className="space-y-3 p-4">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background-secondary p-3"
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-lg ${row.tone}`}
              >
                <row.icon className="h-4 w-4" />
              </div>
              <span className="text-sm text-muted">{row.label}</span>
            </div>
            <span className="text-sm font-semibold text-foreground">
              {row.value}
            </span>
          </div>
        ))}

        <div className="rounded-xl border border-primary/25 bg-primary-soft p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">
              Server-managed access
            </p>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted">
            Android phones use tenant-scoped, one-time enrollment keys. The
            permanent gateway API credential is never exposed in ERP.
          </p>
        </div>
      </div>
    </section>
  );
}
