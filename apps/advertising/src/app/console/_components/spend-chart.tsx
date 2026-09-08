'use client';

import { useMemo, useState } from 'react';
import { peso } from '../_lib/format';

/**
 * Ad spend against what the orders were worth, day by day.
 *
 * Drawn as inline SVG rather than pulled from a chart library: three series and
 * a few markers do not justify a dependency, and hand-drawing it means the
 * gridlines and the empty state behave exactly as intended.
 *
 * All three series are pesos, so they share one axis and can be read against
 * each other directly — the whole point of the panel is the gap between the
 * blue line and the other two.
 */

export interface DayPoint {
  date: string;
  spend: number;
  orders: number;
  orderValue: number;
  delivered: number;
}

export interface DayMarker {
  date: string;
  titles: string[];
}

const SERIES = [
  { key: 'spend' as const, label: 'Ad spend', stroke: 'stroke-blue-500', dot: 'fill-blue-500', swatch: 'bg-blue-500' },
  { key: 'delivered' as const, label: 'Delivered', stroke: 'stroke-emerald-600', dot: 'fill-emerald-600', swatch: 'bg-emerald-600' },
  { key: 'orderValue' as const, label: 'Order value', stroke: 'stroke-orange-600', dot: 'fill-orange-600', swatch: 'bg-orange-600' },
];

const W = 900;
const H = 260;
const PAD = { top: 16, right: 16, bottom: 28, left: 64 };

function niceCeiling(value: number): number {
  if (value <= 0) return 100_00;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

export function SpendChart({ daily, markers }: { daily: DayPoint[]; markers: DayMarker[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const { points, max, path } = useMemo(() => {
    const highest = Math.max(
      0,
      ...daily.map((d) => Math.max(d.spend, d.delivered, d.orderValue)),
    );
    const ceiling = niceCeiling(highest);
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;

    const x = (i: number) => PAD.left + (daily.length <= 1 ? innerW / 2 : (i / (daily.length - 1)) * innerW);
    const y = (v: number) => PAD.top + innerH - (ceiling === 0 ? 0 : (v / ceiling) * innerH);

    const line = (key: 'spend' | 'delivered' | 'orderValue') =>
      daily.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d[key]).toFixed(1)}`).join(' ');

    return {
      max: ceiling,
      points: daily.map((d, i) => ({ ...d, x: x(i), y: y(d.spend) })),
      path: { spend: line('spend'), delivered: line('delivered'), orderValue: line('orderValue') },
    };
  }, [daily]);

  if (!daily.length) {
    return (
      <p className="p-6 text-sm text-muted">
        Walang gastos na naitala sa panahong ito.
      </p>
    );
  }

  const markerByDate = new Map(markers.map((m) => [m.date, m.titles]));
  const gridLines = [0, 0.25, 0.5, 0.75, 1];
  const active = hover !== null ? points[hover] : null;

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-64 w-full min-w-[36rem]"
          role="img"
          aria-label="Ad spend against order value and delivered value, day by day"
        >
          {gridLines.map((g) => {
            const y = PAD.top + (H - PAD.top - PAD.bottom) * (1 - g);
            return (
              <g key={g}>
                <line
                  x1={PAD.left} x2={W - PAD.right} y1={y} y2={y}
                  className="stroke-border/30" strokeWidth="1"
                />
                <text
                  x={PAD.left - 8} y={y + 4} textAnchor="end"
                  className="fill-muted text-[10px]"
                >
                  {peso(max * g)}
                </text>
              </g>
            );
          })}

          {points.map((p) =>
            markerByDate.has(p.date) ? (
              <line
                key={`m-${p.date}`}
                x1={p.x} x2={p.x} y1={PAD.top} y2={H - PAD.bottom}
                className="stroke-destructive/50" strokeWidth="1" strokeDasharray="3 3"
              />
            ) : null,
          )}

          {SERIES.map((s) => (
            <path
              key={s.key}
              d={path[s.key]}
              fill="none"
              className={s.stroke}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

          {active ? (
            <line
              x1={active.x} x2={active.x} y1={PAD.top} y2={H - PAD.bottom}
              className="stroke-foreground/25" strokeWidth="1"
            />
          ) : null}

          {points.map((p, i) => (
            <rect
              key={p.date}
              x={p.x - 6} y={PAD.top} width="12" height={H - PAD.top - PAD.bottom}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}

          {points.map((p, i) => {
            const step = Math.max(1, Math.ceil(points.length / 8));
            if (i % step !== 0 && i !== points.length - 1) return null;
            return (
              <text
                key={`x-${p.date}`}
                x={p.x} y={H - 8} textAnchor="middle"
                className="fill-muted text-[10px]"
              >
                {p.date.slice(5)}
              </text>
            );
          })}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-2 text-xs text-muted">
            <span className={`inline-block h-2 w-2 rounded-full ${s.swatch}`} />
            {s.label}
          </span>
        ))}
        {markers.length ? (
          <span className="inline-flex items-center gap-2 text-xs text-muted">
            <span className="inline-block h-3 w-px border-l border-dashed border-destructive/60" />
            {markers.length} naitalang pagbabago
          </span>
        ) : null}
      </div>

      {active ? (
        <div className="rounded-xl bg-secondary/30 p-3 text-sm">
          <p className="font-semibold text-foreground">{active.date}</p>
          <p className="text-muted">
            gastos <span className="font-medium text-foreground">{peso(active.spend)}</span>
            {' · '}order value <span className="font-medium text-foreground">{peso(active.orderValue)}</span>
            {' · '}delivered <span className="font-medium text-foreground">{peso(active.delivered)}</span>
            {' · '}{active.orders} order{active.orders === 1 ? '' : 's'}
          </p>
          {markerByDate.get(active.date)?.map((title) => (
            <p key={title} className="mt-1 text-xs text-destructive">↳ {title}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
