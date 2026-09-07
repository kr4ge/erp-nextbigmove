'use client';

import { Sparkles } from 'lucide-react';
import { formatCount, formatCurrency, formatPercent } from '../../../overview/_utils/creative-overview-format';
import type { CalendarDay } from '../_types/advertising-dashboard';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type CalendarCell = {
  key: string;
  dayOfMonth: number | null;
  data: CalendarDay | null;
  isWeekend: boolean;
};

type ArTone = {
  label: string;
  barClass: string;
  badgeClass: string;
  dotClass: string;
  textClass: string;
};

const AR_TONES: Record<'efficient' | 'watch' | 'high' | 'empty', ArTone> = {
  efficient: {
    label: 'Efficient ≤30%',
    barClass: 'bg-success',
    badgeClass: 'bg-success-soft/50 text-success dark:bg-success/10',
    dotClass: 'bg-success',
    textClass: 'text-success',
  },
  watch: {
    label: 'Watch >30–50%',
    barClass: 'bg-warning',
    badgeClass: 'bg-warning-soft/70 text-warning dark:bg-warning/10',
    dotClass: 'bg-warning',
    textClass: 'text-warning',
  },
  high: {
    label: 'High >50%',
    barClass: 'bg-destructive',
    badgeClass: 'bg-destructive-soft/50 text-destructive dark:bg-destructive/10',
    dotClass: 'bg-destructive',
    textClass: 'text-destructive',
  },
  empty: {
    label: 'Not measured',
    barClass: 'bg-border/60',
    badgeClass: 'bg-secondary/50 text-muted',
    dotClass: 'bg-border',
    textClass: 'text-faint',
  },
};

function resolveArTone(ratio: number | null): ArTone {
  if (ratio == null) return AR_TONES.empty;
  if (ratio <= 0.3) return AR_TONES.efficient;
  if (ratio <= 0.5) return AR_TONES.watch;
  return AR_TONES.high;
}

function hasActivity(day: CalendarDay | null): day is CalendarDay {
  return Boolean(day && (day.orders > 0 || day.spend > 0 || day.creativesEnrolled > 0));
}

function buildCalendarCells(month: string, days: CalendarDay[]): CalendarCell[] {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const first = new Date(`${month}-01T00:00:00.000Z`);
  const daysInMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const leadingBlanks = first.getUTCDay();
  const populatedCellCount = leadingBlanks + daysInMonth;
  const trailingBlanks = (7 - (populatedCellCount % 7)) % 7;
  const cells: CalendarCell[] = [];

  for (let index = 0; index < leadingBlanks; index += 1) {
    cells.push({
      key: `leading-blank-${index}`,
      dayOfMonth: null,
      data: null,
      isWeekend: index === 0 || index === 6,
    });
  }

  for (let dayOfMonth = 1; dayOfMonth <= daysInMonth; dayOfMonth += 1) {
    const date = `${month}-${String(dayOfMonth).padStart(2, '0')}`;
    const column = (leadingBlanks + dayOfMonth - 1) % 7;
    cells.push({
      key: date,
      dayOfMonth,
      data: byDate.get(date) ?? null,
      isWeekend: column === 0 || column === 6,
    });
  }

  for (let index = 0; index < trailingBlanks; index += 1) {
    const column = (populatedCellCount + index) % 7;
    cells.push({
      key: `trailing-blank-${index}`,
      dayOfMonth: null,
      data: null,
      isWeekend: column === 0 || column === 6,
    });
  }

  return cells;
}

function formatAgendaDate(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function CalendarLegend() {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs-tight font-semibold uppercase tracking-wide text-faint">
        AR efficiency <span className="normal-case tracking-normal text-muted">· lower is better</span>
      </p>
      <div className="flex flex-wrap items-center gap-3 text-xs-tight text-muted" aria-label="AR efficiency legend">
        {[AR_TONES.efficient, AR_TONES.watch, AR_TONES.high].map((tone) => (
          <span key={tone.label} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${tone.dotClass}`} aria-hidden="true" />
            {tone.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * A compact performance calendar. Orders are the primary daily signal; spend,
 * CPP, AR efficiency, and creative output remain visible without competing for
 * the same visual weight.
 */
export function AdvertisingCalendar({ month, days }: { month: string; days: CalendarDay[] }) {
  const cells = buildCalendarCells(month, days);
  const activeDays = days.filter(hasActivity);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());

  return (
    <div>
      <CalendarLegend />

      {/* The full month is shown only where every day has enough width to stay
          legible. Narrow screens use the agenda below instead of squeezing or
          horizontally scrolling seven columns. */}
      <div className="hidden overflow-hidden rounded-xl border border-border/40 bg-border/30 lg:block">
        <div className="grid grid-cols-7 gap-px border-b border-border/40 bg-border/30">
          {WEEKDAYS.map((weekday, index) => (
            <div
              key={weekday}
              className={`bg-background/80 px-3 py-2 text-center text-xs-tight font-semibold uppercase tracking-wide ${index === 0 || index === 6 ? 'text-primary' : 'text-faint'}`}
            >
              {weekday}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px">
          {cells.map((cell) => {
            if (!cell.dayOfMonth) {
              return <div key={cell.key} className="min-h-28 bg-background-secondary/40" aria-hidden="true" />;
            }

            const day = hasActivity(cell.data) ? cell.data : null;
            const tone = resolveArTone(day?.adSpendRatio ?? null);
            const isToday = cell.key === today;

            return (
              <article
                key={cell.key}
                className={`group relative flex min-h-28 flex-col overflow-hidden p-3 transition-colors ${cell.isWeekend ? 'bg-surface-warm-soft' : 'bg-surface'} hover:bg-primary-soft/30`}
                aria-label={day
                  ? `${cell.key}: ${formatCount(day.orders)} orders, ${formatCurrency(day.spend)} spent, ${formatPercent(day.adSpendRatio, 1)} AR`
                  : `${cell.key}: no recorded activity`}
              >
                {day ? <span className={`absolute inset-x-0 top-0 h-0.5 ${tone.barClass}`} aria-hidden="true" /> : null}

                <div className="flex items-center justify-between gap-2">
                  <time
                    dateTime={cell.key}
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${isToday ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted'}`}
                  >
                    {cell.dayOfMonth}
                  </time>
                  {day && day.creativesEnrolled > 0 ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-1 text-xs-tight font-semibold text-primary-soft-foreground"
                      title={`${day.creativesEnrolled} creatives registered this day`}
                    >
                      <Sparkles className="h-3 w-3" aria-hidden="true" />
                      +{formatCount(day.creativesEnrolled)}
                    </span>
                  ) : null}
                </div>

                {day ? (
                  <>
                    <div className="mt-3">
                      <p className="text-base font-semibold leading-tight text-foreground tabular-nums">
                        {formatCount(day.orders)} <span className="text-xs font-medium text-muted">orders</span>
                      </p>
                      <p className="mt-1 text-xs-tight text-muted tabular-nums">
                        {formatCurrency(day.spend)} spent
                      </p>
                    </div>

                    <dl className="mt-auto grid grid-cols-2 gap-2 border-t border-border/30 pt-2">
                      <div>
                        <dt className="text-xs-tight font-medium uppercase tracking-wide text-faint">CPP</dt>
                        <dd className="mt-0.5 text-xs font-semibold text-foreground tabular-nums">
                          {day.cpp == null ? '—' : formatCurrency(day.cpp)}
                        </dd>
                      </div>
                      <div className="text-right">
                        <dt className="text-xs-tight font-medium uppercase tracking-wide text-faint">AR</dt>
                        <dd className={`mt-0.5 text-xs font-semibold tabular-nums ${tone.textClass}`}>
                          {formatPercent(day.adSpendRatio, 1)}
                        </dd>
                      </div>
                    </dl>
                  </>
                ) : (
                  <span className="mt-auto text-xs-tight text-faint">No activity</span>
                )}
              </article>
            );
          })}
        </div>
      </div>

      {/* Agenda view preserves the same hierarchy on tablets and phones. */}
      <div className="overflow-hidden rounded-xl border border-border/40 lg:hidden">
        {activeDays.length > 0 ? (
          <div className="max-h-96 divide-y divide-border/30 overflow-y-auto">
            {activeDays.map((day) => {
              const tone = resolveArTone(day.adSpendRatio);

              return (
                <article key={day.date} className="relative flex items-center gap-3 bg-surface px-3 py-3">
                  <span className={`absolute inset-y-0 left-0 w-1 ${tone.barClass}`} aria-hidden="true" />
                  <time dateTime={day.date} className="w-20 shrink-0 text-xs font-semibold text-foreground">
                    {formatAgendaDate(day.date)}
                  </time>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground tabular-nums">
                      {formatCount(day.orders)} orders
                    </p>
                    <p className="mt-0.5 text-xs-tight text-muted tabular-nums">
                      {formatCurrency(day.spend)} spent · {day.cpp == null ? '—' : formatCurrency(day.cpp)} CPP
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`rounded-full px-2 py-1 text-xs-tight font-semibold tabular-nums ${tone.badgeClass}`}>
                      {formatPercent(day.adSpendRatio, 1)} AR
                    </span>
                    {day.creativesEnrolled > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs-tight font-medium text-primary">
                        <Sparkles className="h-3 w-3" aria-hidden="true" />
                        +{formatCount(day.creativesEnrolled)} creative{day.creativesEnrolled === 1 ? '' : 's'}
                      </span>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="bg-surface px-4 py-8 text-center text-sm text-muted">No calendar activity in this month.</p>
        )}
      </div>

      <p className="mt-3 text-xs-tight leading-relaxed text-faint">
        Creative badges show enrollment output for that day. AR is ad spend ÷ net-of-cancel/RTS sales; lower is more efficient.
      </p>
    </div>
  );
}
