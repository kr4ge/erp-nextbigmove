'use client';

import { formatCount, formatCurrency, formatPercent } from '../../../overview/_utils/creative-overview-format';
import type { CalendarDay } from '../_types/advertising-dashboard';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * The month at a glance: which days ran hot. Spend is toned against the
 * ceiling-derived AR thresholds. The panel always names its specific month —
 * never "all time".
 */
export function AdvertisingCalendar({ month, days }: { month: string; days: CalendarDay[] }) {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const first = new Date(`${month}-01T00:00:00.000Z`);
  const daysInMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const leadingBlanks = first.getUTCDay();
  const cells: Array<{ key: string; dayOfMonth: number | null; data: CalendarDay | null }> = [];
  for (let index = 0; index < leadingBlanks; index += 1) {
    cells.push({ key: `blank-${index}`, dayOfMonth: null, data: null });
  }
  for (let dayOfMonth = 1; dayOfMonth <= daysInMonth; dayOfMonth += 1) {
    const date = `${month}-${String(dayOfMonth).padStart(2, '0')}`;
    cells.push({ key: date, dayOfMonth, data: byDate.get(date) ?? null });
  }

  const arTone = (ratio: number | null) => {
    if (ratio == null) return 'text-faint';
    if (ratio <= 0.3) return 'text-success';
    if (ratio <= 0.5) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <div>
      {/* Desktop month grid */}
      {/* Full-width row: all seven columns fit, so no horizontal scroll and no
          clipped Saturday. */}
      <div className="hidden sm:block">
        <div className="grid grid-cols-7 gap-px rounded-lg bg-border/40 p-px">
          {WEEKDAYS.map((weekday) => (
            <div key={weekday} className="bg-surface px-2 py-1.5 text-center text-xs-tight font-semibold uppercase tracking-wide text-faint">
              {weekday}
            </div>
          ))}
          {cells.map((cell) => (
            <div key={cell.key} className="min-h-[4.5rem] bg-surface p-1.5">
              {cell.dayOfMonth ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs-tight font-semibold text-muted">{cell.dayOfMonth}</span>
                    {cell.data && cell.data.creativesEnrolled > 0 ? (
                      <span className="rounded-full bg-primary-soft px-1.5 text-xs-tight font-semibold text-primary-soft-foreground" title={`${cell.data.creativesEnrolled} creatives registered this day`}>
                        +{cell.data.creativesEnrolled}
                      </span>
                    ) : null}
                  </div>
                  {cell.data && (cell.data.orders > 0 || cell.data.spend > 0) ? (
                    <div className="mt-1 space-y-0.5 text-xs-tight leading-tight">
                      <p className="font-semibold text-foreground tabular-nums">{formatCount(cell.data.orders)} orders</p>
                      <p className="text-muted tabular-nums">{cell.data.cpp == null ? '—' : formatCurrency(cell.data.cpp)} CPP</p>
                      <p className="text-muted tabular-nums">{formatCurrency(cell.data.spend)} spent</p>
                      <p className={`tabular-nums ${arTone(cell.data.adSpendRatio)}`}>{formatPercent(cell.data.adSpendRatio, 1)} AR</p>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      {/* Mobile agenda alternative */}
      <div className="sm:hidden">
        <div className="max-h-80 space-y-1 overflow-y-auto">
          {days.filter((day) => day.orders > 0 || day.spend > 0 || day.creativesEnrolled > 0).map((day) => (
            <div key={day.date} className="flex items-center justify-between gap-2 rounded-lg border border-border/40 px-3 py-2 text-xs">
              <span className="font-semibold text-foreground">{day.date.slice(8)}</span>
              <span className="tabular-nums text-muted">{formatCount(day.orders)} ord</span>
              <span className="tabular-nums text-muted">{formatCurrency(day.spend)}</span>
              <span className={`tabular-nums ${arTone(day.adSpendRatio)}`}>{formatPercent(day.adSpendRatio, 0)} AR</span>
              {day.creativesEnrolled > 0 ? <span className="text-primary">+{day.creativesEnrolled}</span> : <span />}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 text-xs-tight text-faint">+n marks creatives registered that day. AR% is spend ÷ net-of-cancel/RTS sales, per the Marketing KPI policy.</p>
    </div>
  );
}
