'use client';

import { type ReactNode } from 'react';
import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatMetricValue } from '../_utils/metrics';

export type AnalyticsMetricFormat = 'currency' | 'number' | 'percent';

type MetricCount = {
  value: number;
  delta?: number | null;
  label?: string;
};

type AnalyticsMetricCardProps = {
  label: string;
  value: number;
  format: AnalyticsMetricFormat;
  precision?: number;
  delta: number | null;
  count?: MetricCount;
  tooltip?: ReactNode;
  tooltipMode?: 'hover' | 'popover';
  className?: string;
};

const formatCountValue = (value: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value || 0);

const formatDeltaLabel = (value: number | null | undefined) => {
  if (value === null || value === undefined) return '--';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
};

const getDeltaColor = (value: number | null | undefined) => {
  if (value === null || value === undefined) return 'text-slate-400';
  return value >= 0 ? 'text-emerald-600' : 'text-rose-500';
};

function TooltipIcon({ label, content, mode }: { label: string; content: ReactNode; mode: 'hover' | 'popover' }) {
  if (mode === 'popover') {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex cursor-help"
            aria-label={`${label} formula`}
          >
            <Info className="h-4 w-4 text-slate-400 hover:text-emerald-600 focus:text-emerald-600" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="center" side="bottom" sideOffset={8} className="w-80">
          {content}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <span
      className="relative group inline-flex cursor-help"
      tabIndex={0}
      aria-label={`${label} formula`}
    >
      <Info className="h-4 w-4 text-slate-400 group-hover:text-emerald-600 group-focus-within:text-emerald-600" />
      <div className="absolute left-1/2 top-full z-30 mt-2 hidden w-80 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] leading-relaxed text-slate-700 shadow-lg group-hover:block group-focus-within:block">
        {content}
      </div>
    </span>
  );
}

export function AnalyticsMetricCard({
  label,
  value,
  format,
  precision,
  delta,
  count,
  tooltip,
  tooltipMode = 'hover',
  className,
}: AnalyticsMetricCardProps) {
  const valuePrecision =
    precision === undefined ? (format === 'percent' ? 1 : 2) : precision;

  return (
    <div
      className={`rounded-lg border border-slate-200 bg-white px-3 py-2.5 ${className ?? ''}`.trim()}
    >
      <div className="text-xs text-slate-500 flex items-center gap-1">
        {label}
        {tooltip ? <TooltipIcon label={label} content={tooltip} mode={tooltipMode} /> : null}
      </div>

      <div className="mt-1 flex items-center justify-between">
        <p className="text-lg font-semibold text-slate-900">
          {formatMetricValue(value, format, valuePrecision)}
        </p>
        <p className={`text-xs ${getDeltaColor(delta)}`}>{formatDeltaLabel(delta)}</p>
      </div>

      {count ? (
        <div className="mt-1 flex items-center justify-between">
          <span className="text-sm text-slate-700">
            <span className="font-normal text-slate-600">{count.label ?? 'ord'}:</span>{' '}
            <span className="font-semibold text-slate-900">{formatCountValue(count.value)}</span>
          </span>
          <span className={`text-xs ${getDeltaColor(count.delta)}`}>
            {formatDeltaLabel(count.delta)}
          </span>
        </div>
      ) : null}
    </div>
  );
}
