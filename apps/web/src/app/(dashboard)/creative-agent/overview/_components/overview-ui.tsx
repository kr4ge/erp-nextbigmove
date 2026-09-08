'use client';

import { useId, type ReactNode } from 'react';
import { RATE_TONE_TEXT, type RateTone } from '../_utils/creative-overview-format';

/**
 * Small presentation kit for the creative dashboard, adapted from the B.E.X
 * reference: editorial serif panel headers, info dots with hover/focus
 * definitions, and label/value/sub stat tiles. Built on ERP tokens only.
 */

export function InfoTip({ text }: { text: string }) {
  return (
    <span
      tabIndex={0}
      className="group relative inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full border border-border/70 text-xs-tight font-normal normal-case leading-none text-faint outline-none transition-colors hover:border-primary hover:text-primary focus-visible:border-primary focus-visible:text-primary"
      aria-label={text}
    >
      i
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 hidden w-60 -translate-x-1/2 rounded-lg border border-border bg-surface px-3 py-2 text-left text-xs-tight font-normal normal-case leading-snug tracking-normal text-muted shadow-card group-hover:block group-focus-visible:block"
      >
        {text}
      </span>
    </span>
  );
}

export function PanelHeader({ title, description, right }: {
  title: string;
  description?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/40 px-5 py-3">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        {description ? <p className="mt-0.5 text-sm-custom leading-snug text-muted">{description}</p> : null}
      </div>
      {right ? <div className="flex shrink-0 flex-wrap items-center gap-2">{right}</div> : null}
    </div>
  );
}

/**
 * The stroke/fill pair each tone paints its sparkline with. Kept as literal
 * `rgb(var(--token))` rather than Tailwind classes because SVG `stroke` and
 * `fill` need a colour value, not a utility class.
 */
const SPARK_STROKE: Record<RateTone, string> = {
  neutral: 'rgb(var(--primary))',
  good: 'rgb(var(--success))',
  warn: 'rgb(var(--warning))',
  bad: 'rgb(var(--destructive))',
};

/**
 * A day-by-day trace of the number above it — shape only, no axes.
 *
 * Nulls are gaps the metric genuinely has no value for (a ratio over an empty
 * denominator), so the path breaks there instead of diving to zero and drawing
 * a crash that never happened. A series with fewer than two real points has no
 * shape to show and renders nothing rather than a misleading flat line.
 */
export function Sparkline({ values, tone = 'neutral', label }: {
  values: Array<number | null>;
  tone?: RateTone;
  label?: string;
}) {
  // Hooks must run before any early return, so the id is claimed up front even
  // for a series that turns out to have nothing to draw.
  const gradientId = useId();
  const real = values.filter((value): value is number => value != null && Number.isFinite(value));
  if (real.length < 2) return null;

  const width = 100;
  const height = 28;
  const min = Math.min(...real);
  const max = Math.max(...real);
  // A dead-flat series would divide by zero; park it on the mid-line instead.
  const span = max - min || 1;
  const stepX = values.length > 1 ? width / (values.length - 1) : width;
  const pointAt = (value: number, index: number) => {
    const x = index * stepX;
    const y = height - ((value - min) / span) * (height - 4) - 2;
    return [x, y] as const;
  };

  // Build one path per unbroken run, so gaps stay gaps.
  const runs: Array<Array<readonly [number, number]>> = [];
  let run: Array<readonly [number, number]> = [];
  values.forEach((value, index) => {
    if (value == null || !Number.isFinite(value)) {
      if (run.length) runs.push(run);
      run = [];
      return;
    }
    run.push(pointAt(value, index));
  });
  if (run.length) runs.push(run);

  const stroke = SPARK_STROKE[tone];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="block h-7 w-full"
      role="img"
      aria-label={label ? `${label} trend over the selected period` : 'Trend over the selected period'}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {runs.map((points, index) => {
        // A run of one is a day whose neighbours have no value. A one-point
        // path draws nothing, so mark it with a dot — otherwise a sparse
        // metric renders as an empty box and reads as "no data at all".
        if (points.length === 1) {
          const [x, y] = points[0];
          const at = `${x.toFixed(2)},${y.toFixed(2)}`;
          // A zero-length round-capped stroke, not a <circle>: the viewBox is
          // stretched horizontally by preserveAspectRatio="none", which would
          // squash a real circle into an ellipse. A non-scaling stroke cap is
          // measured in device pixels, so it stays round at any tile width.
          return (
            <path
              key={index}
              d={`M ${at} L ${at}`}
              stroke={stroke}
              strokeWidth="3"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          );
        }
        const line = points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' L ');
        const first = points[0];
        const last = points[points.length - 1];
        return (
          <g key={index}>
            <path
              d={`M ${line} L ${last[0].toFixed(2)},${height} L ${first[0].toFixed(2)},${height} Z`}
              fill={`url(#${gradientId})`}
            />
            <path
              d={`M ${line}`}
              fill="none"
              stroke={stroke}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })}
    </svg>
  );
}

export function StatTile({ label, info, value, tone = 'neutral', sub, compact = false, spark }: {
  label: string;
  info?: string;
  value: string;
  tone?: RateTone;
  sub?: string;
  compact?: boolean;
  /** Day-by-day values behind `value`, same order as the selected period. */
  spark?: Array<number | null>;
}) {
  return (
    <div className={`flex min-w-0 flex-col overflow-hidden ${compact ? 'stat-tile px-3 py-2' : 'stat-tile px-4 py-3.5'}`}>
      <p className={`stat-label ${compact ? '' : 'text-sm'}`}>
        <span className="min-w-0 truncate" title={label}>{label}</span>
        {info ? <InfoTip text={info} /> : null}
      </p>
      <p className={`stat-value ${compact ? '' : 'mt-1.5 text-lg-loose'} ${tone === 'neutral' ? '' : RATE_TONE_TEXT[tone]}`}>
        {value}
      </p>
      {sub ? <p className={`stat-sub ${compact ? '' : 'mt-2 text-xs'}`}>{sub}</p> : null}
      {/* Full-bleed: the trace runs edge to edge and sits flush on the tile's
          bottom, so it reads as the tile's own baseline rather than a chart
          someone dropped inside it. The negative margins cancel the padding;
          overflow-hidden lets the rounded corners clip it. */}
      {spark ? (
        <div className={`mt-auto ${compact ? '-mx-3 -mb-2 pt-1.5' : '-mx-4 -mb-3.5 pt-2'}`}>
          <Sparkline values={spark} tone={tone} label={label} />
        </div>
      ) : null}
    </div>
  );
}
