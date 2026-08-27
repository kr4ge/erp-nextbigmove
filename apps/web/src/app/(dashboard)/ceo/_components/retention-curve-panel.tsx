'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartFrame } from '@/components/charts/chart-frame';
import {
  CHART_ANIMATION_MS,
  CHART_COLORS,
  CHART_MARGIN,
  CHART_TOOLTIP_STYLE,
} from '@/components/charts/chart-tokens';
import type { CeoDashboardResponse } from '../_types/ceo-dashboard';
import { count, percent } from './ceo-ui';

/**
 * Turns a single repeat-rate percentage into a shape, which tells you when to
 * send the reminder rather than just whether people return.
 *
 * A repeat order requires a DELIVERED first order followed by another at least
 * `gateDays` later — without that gate, a replacement for a failed delivery
 * files as loyalty.
 */
export function RetentionCurvePanel({ retention }: { retention: CeoDashboardResponse['retention'] | undefined }) {
  const points = (retention?.points ?? []).map((point) => ({
    label: point.label,
    share: point.share == null ? null : point.share * 100,
    customers: point.customers,
  }));
  const secondOrderShare = retention?.points?.[1]?.share ?? null;
  const verdict = secondOrderShare == null
    ? null
    : secondOrderShare < 0.1
      ? { tone: 'text-destructive', label: 'Cratering — no repeat base' }
      : secondOrderShare < 0.25
        ? { tone: 'text-warning', label: 'Thin repeat base' }
        : { tone: 'text-success', label: 'Healthy repeat base' };

  return (
    <section className="panel panel-content shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/40 px-5 py-3">
        <div>
          <h3 className="text-sm-custom font-semibold text-foreground">Repeat-purchase survival curve</h3>
          <p className="mt-0.5 text-xs text-muted">
            Share of customers who come back for another order — does it flatten, or crater?
            A repeat needs a delivered first order plus a {retention?.gateDays ?? 10}-day gap.
          </p>
        </div>
        {verdict ? <span className={`text-sm-custom font-semibold ${verdict.tone}`}>{verdict.label}</span> : null}
      </div>
      <div className="p-4">
        <ChartFrame
          isEmpty={!retention || retention.deliveredCustomers === 0}
          emptyLabel="No delivered customers in this range yet."
          height="h-56"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={CHART_MARGIN}>
              <defs>
                <linearGradient id="retentionFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={CHART_COLORS.grid} strokeOpacity={0.5} vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={{ stroke: CHART_COLORS.grid, strokeOpacity: 0.6 }}
                tick={{ fill: CHART_COLORS.axisText, fontSize: 11 }}
              />
              <YAxis
                width={44}
                domain={[0, 100]}
                tickFormatter={(value: number) => `${value}%`}
                tickLine={false}
                axisLine={false}
                tick={{ fill: CHART_COLORS.axisText, fontSize: 11 }}
              />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                labelStyle={{ color: CHART_COLORS.foreground, fontWeight: 600, marginBottom: 4 }}
                formatter={(value, _name, item) => {
                  const payload = item?.payload as { customers?: number } | undefined;
                  const share = value == null ? '—' : `${Number(value).toFixed(1)}%`;
                  return [`${share} · ${count(payload?.customers)} customers`, 'Came back'];
                }}
              />
              <Area
                type="monotone"
                dataKey="share"
                stroke={CHART_COLORS.primary}
                strokeWidth={2.5}
                fill="url(#retentionFill)"
                connectNulls={false}
                animationDuration={CHART_ANIMATION_MS}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartFrame>
        {retention && retention.deliveredCustomers > 0 ? (
          <p className="mt-2 text-xs-tight leading-snug text-faint">
            {percent(secondOrderShare)} of {count(retention.deliveredCustomers)} delivered customers place a second order.
            {secondOrderShare != null && secondOrderShare < 0.1
              ? ' With no repeat base, growth spend leaks out instead of compounding — fixing the first-order experience matters more than scaling ads.'
              : ''}
          </p>
        ) : null}
      </div>
    </section>
  );
}
