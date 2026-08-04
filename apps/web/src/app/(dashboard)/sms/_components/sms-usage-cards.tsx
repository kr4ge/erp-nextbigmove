import { CalendarDays, Clock3 } from 'lucide-react';
import type { SmsOverviewResponse } from '../_types/sms';
import { formatSmsCount } from '../_utils/sms-formatters';

type SmsUsageCardsProps = {
  overview: SmsOverviewResponse;
};

function getUsagePercent(used: number, capacity: number) {
  if (capacity <= 0) return 0;
  return Math.min((used / capacity) * 100, 100);
}

export function SmsUsageCards({ overview }: SmsUsageCardsProps) {
  const cards = [
    {
      label: 'Today',
      used: overview.usage.today.sent,
      capacity: overview.usage.today.outboundLimit,
      received: overview.usage.today.received,
      footer: `${formatSmsCount(overview.usage.today.outboundRemaining)} outbound messages remaining`,
      icon: Clock3,
    },
    {
      label: 'Last 30 days',
      used: overview.usage.last30Days.sent,
      capacity: overview.usage.last30Days.outboundCapacity,
      received: overview.usage.last30Days.received,
      footer: `${formatSmsCount(overview.usage.last30Days.total)} sent and received`,
      icon: CalendarDays,
    },
  ];

  return (
    <div>
      <div className="grid gap-4 lg:grid-cols-2">
        {cards.map((card) => {
          const percent = getUsagePercent(card.used, card.capacity);

          return (
            <article key={card.label} className="panel panel-content p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-muted">{card.label}</p>
                <card.icon className="h-4 w-4 text-muted" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-xl-loose font-semibold text-foreground">
                  {formatSmsCount(card.used)}
                </span>
                <span className="text-sm text-muted">
                  / {formatSmsCount(card.capacity)}
                </span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-background-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-500"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                <span>{card.footer}</span>
                <span>{formatSmsCount(card.received)} received</span>
              </div>
            </article>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted">
        Outbound messages use tenant capacity. Customer replies are counted but do not consume it.
      </p>
    </div>
  );
}
