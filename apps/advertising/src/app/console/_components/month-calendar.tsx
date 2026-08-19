'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { peso, rate } from '../_lib/format';
import type { DayPoint } from './spend-chart';

/**
 * The month, one cell per day.
 *
 * A day whose CPP is over the ceiling is coloured, and nothing else is. The
 * point of the grid is to find those days by looking rather than by reading
 * every number, so only the number that needs a decision gets to shout.
 */

const WEEKDAYS = ['Lin', 'Lun', 'Mar', 'Miy', 'Huw', 'Biy', 'Sab'];

export function MonthCalendar({
  daily,
  cppCeiling,
  markers,
}: {
  daily: DayPoint[];
  cppCeiling: number;
  markers: { date: string; titles: string[] }[];
}) {
  const months = useMemo(
    () => Array.from(new Set(daily.map((d) => d.date.slice(0, 7)))).sort(),
    [daily],
  );
  const [index, setIndex] = useState(() => Math.max(0, months.length - 1));
  const current = months[index];

  const byDate = useMemo(() => new Map(daily.map((d) => [d.date, d])), [daily]);
  const markerCount = useMemo(
    () => new Map(markers.map((m) => [m.date, m.titles.length])),
    [markers],
  );

  const cells = useMemo(() => {
    if (!current) return [];
    const [year, month] = current.split('-').map(Number);
    const first = new Date(Date.UTC(year, month - 1, 1));
    const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const lead = first.getUTCDay();

    const out: (string | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= days; d += 1) {
      out.push(`${current}-${String(d).padStart(2, '0')}`);
    }
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [current]);

  const totals = useMemo(() => {
    const rows = daily.filter((d) => d.date.startsWith(current ?? ''));
    const spend = rows.reduce((t, d) => t + d.spend, 0);
    const orders = rows.reduce((t, d) => t + d.orders, 0);
    const value = rows.reduce((t, d) => t + d.orderValue, 0);
    return {
      orders,
      spend,
      cpp: orders > 0 ? spend / orders : null,
      ar: value > 0 ? spend / value : null,
    };
  }, [daily, current]);

  if (!months.length) {
    return <p className="p-6 text-sm text-muted">Walang araw na may datos sa panahong ito.</p>;
  }

  const monthLabel = new Date(`${current}-01T00:00:00Z`).toLocaleDateString('en-PH', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  });

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="pill pill-neutral"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            aria-label="Nakaraang buwan"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="text-sm-custom font-semibold text-foreground">{monthLabel}</span>
          <button
            type="button"
            className="pill pill-neutral"
            onClick={() => setIndex((i) => Math.min(months.length - 1, i + 1))}
            disabled={index === months.length - 1}
            aria-label="Susunod na buwan"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="text-xs text-muted">
          {totals.orders} orders · {totals.cpp !== null ? peso(totals.cpp) : '—'} CPP ·{' '}
          {totals.ar !== null ? rate(totals.ar) : '—'} AR · {peso(totals.spend)} spent
        </p>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[38rem] grid-cols-7 gap-px rounded-xl bg-border/20">
          {WEEKDAYS.map((d) => (
            <div key={d} className="bg-secondary/40 px-2 py-1.5 text-xs-tight uppercase text-muted">
              {d}
            </div>
          ))}

          {cells.map((date, i) => {
            if (!date) return <div key={`pad-${i}`} className="min-h-20 bg-surface/40" />;
            const day = byDate.get(date);
            const over = day && day.orders > 0 && day.spend / day.orders > cppCeiling;
            const registered = markerCount.get(date);

            return (
              <div key={date} className="min-h-20 bg-surface px-2 py-1.5">
                <div className="flex items-start justify-between gap-1">
                  <span className="text-xs text-muted">{Number(date.slice(8))}</span>
                  {registered ? (
                    <span className="pill pill-neutral text-xs-tight">+{registered}</span>
                  ) : null}
                </div>

                {day ? (
                  <div className="mt-0.5">
                    <p className="text-sm-custom font-semibold text-foreground">
                      {day.orders} <span className="font-normal text-muted">orders</span>
                    </p>
                    <p className={`text-xs ${over ? 'text-destructive' : 'text-muted'}`}>
                      {day.orders > 0 ? peso(day.spend / day.orders) : '—'} CPP
                    </p>
                    <p className="text-xs text-muted">{peso(day.spend)} spent</p>
                    <p className="text-xs text-muted">
                      {day.orderValue > 0 ? rate(day.spend / day.orderValue) : '—'} AR
                    </p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-muted">
        Pula ang CPP na lampas sa {peso(cppCeiling)} na bubong mo. Ang <span className="pill pill-neutral text-xs-tight">+n</span> ay naitalang pagbabago sa araw na 'yon.
      </p>
    </div>
  );
}
