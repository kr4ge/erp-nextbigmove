'use client';

import type { ReactNode } from 'react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { CheckCircle2, RotateCcw, ShoppingCart, Truck, Volume2 } from 'lucide-react';
import { InfoTip } from '../../creative-agent/overview/_components/overview-ui';
import type { CeoDashboardResponse, CeoTrendPoint } from '../_types/ceo-dashboard';
import { count, percent, peso } from './ceo-ui';

/**
 * The five headline figures, each over its own sparkline of the same series
 * plotted in the main chart below — so the card and the chart can never tell
 * different stories about the same number.
 */
type CardTone = 'primary' | 'info' | 'success' | 'spend' | 'destructive';

const TONE: Record<CardTone, { stroke: string; iconBg: string; iconText: string }> = {
  primary: { stroke: 'rgb(var(--primary))', iconBg: 'bg-primary-soft', iconText: 'text-primary-soft-foreground' },
  info: { stroke: 'rgb(var(--info))', iconBg: 'bg-info-soft', iconText: 'text-info' },
  success: { stroke: 'rgb(var(--success))', iconBg: 'bg-success-soft/50', iconText: 'text-success' },
  spend: { stroke: '#3B82F6', iconBg: 'bg-info-soft', iconText: 'text-info' },
  destructive: { stroke: 'rgb(var(--destructive))', iconBg: 'bg-destructive-soft/50', iconText: 'text-destructive' },
};

function KpiCard({ label, value, sub, icon, tone, trend, sparkKey, info }: {
  label: string;
  value: string;
  sub: string;
  icon: ReactNode;
  tone: CardTone;
  trend: CeoTrendPoint[];
  sparkKey: string;
  info?: string;
}) {
  const palette = TONE[tone];
  const series = trend.map((point) => ({
    v: Number((point as unknown as Record<string, number>)[sparkKey] ?? 0),
  }));
  const hasShape = series.some((row) => row.v > 0);
  const gradientId = `spark-${sparkKey}`;

  return (
    <div className="panel panel-content flex flex-col p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <p className="stat-label">
          {label}
          {info ? <InfoTip text={info} /> : null}
        </p>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${palette.iconBg} ${palette.iconText}`}>
          {icon}
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted">{sub}</p>
      {/* The sparkline is decoration for scanning, not a readable axis. */}
      <div className="mt-3 h-10" aria-hidden="true">
        {hasShape ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={palette.stroke} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={palette.stroke} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={palette.stroke}
                strokeWidth={1.75}
                fill={`url(#${gradientId})`}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : null}
      </div>
    </div>
  );
}

export function HeadlineKpiRow({ data }: { data: CeoDashboardResponse | null }) {
  const headline = data?.headline;
  const trend = data?.trend ?? [];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
      <KpiCard
        label="Order amount" tone="primary" trend={trend} sparkKey="orderValue"
        icon={<ShoppingCart className="h-4 w-4" />}
        value={peso(headline?.orderAmount.value)}
        sub={`${count(headline?.orderAmount.count)} placed`}
      />
      <KpiCard
        label="In transit amount" tone="info" trend={trend} sparkKey="inTransitValue"
        icon={<Truck className="h-4 w-4" />}
        value={peso(headline?.inTransitAmount.value)}
        sub={`${count(headline?.inTransitAmount.count)} riding`}
      />
      <KpiCard
        label="Delivered amount" tone="success" trend={trend} sparkKey="deliveredValue"
        icon={<CheckCircle2 className="h-4 w-4" />}
        value={peso(headline?.deliveredAmount.value)}
        sub={`${count(headline?.deliveredAmount.count)} delivered`}
      />
      <KpiCard
        label="Ad spent" tone="spend" trend={trend} sparkKey="spend"
        icon={<Volume2 className="h-4 w-4" />}
        info="Total ad spend in the period, with the average daily pace beneath it."
        value={peso(headline?.adSpend.value)}
        sub={`${peso(headline?.adSpend.perDay)}/day`}
      />
      <KpiCard
        label="RTS rate" tone="destructive" trend={trend} sparkKey="rtsValue"
        icon={<RotateCcw className="h-4 w-4" />}
        info="Returned ÷ units that shipped (delivered + returned). Cancelled orders are excluded because they never left the warehouse — break-even uses a different RTS figure measured on all resolved orders."
        value={percent(headline?.rtsRate.value)}
        sub={`${count(headline?.rtsRate.numerator)} of ${count(headline?.rtsRate.denominator)}`}
      />
    </div>
  );
}
