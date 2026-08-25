'use client';

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartFrame } from '@/components/charts/chart-frame';
import {
  CHART_ANIMATION_MS,
  CHART_COLORS,
  CHART_CURSOR,
  CHART_MARGIN,
  CHART_TOOLTIP_STYLE,
  CHART_X_MIN_TICK_GAP,
  CHART_Y_AXIS_WIDTH,
  formatPesoAxis,
  formatPesoFull,
} from '@/components/charts/chart-tokens';
import type { TrendPoint } from '../_types/advertising-dashboard';

const SERIES = {
  orderValue: 'Order value',
  delivered: 'Delivered',
  adSpend: 'Ad spend',
} as const;

/**
 * A composed chart: two line series over one area series, all bound to a
 * single peso axis.
 *
 * One axis, one unit. The purple line plots order VALUE, not order count — a
 * count on a second axis reads as misleading, because two scales let any two
 * series be made to cross or diverge purely by choosing the scale. The counts
 * still ride in the row payload and surface only in the tooltip.
 *
 * Spend is an area because it is the floor every other series has to clear;
 * a filled region reads as a baseline rather than a fourth competing line.
 */
export function AdvertisingTrendChart({ trend }: { trend: TrendPoint[] }) {
  const rows = trend.map((point) => ({
    label: point.label ?? point.date.slice(5),
    [SERIES.orderValue]: point.grossValue,
    [SERIES.delivered]: point.deliveredValue,
    [SERIES.adSpend]: point.spend,
    __orders: point.orders,
    __deliveredOrders: point.deliveredOrders,
  }));
  const hasValues = rows.some((row) =>
    row[SERIES.orderValue] > 0 || row[SERIES.delivered] > 0 || row[SERIES.adSpend] > 0);

  return (
    <ChartFrame isEmpty={rows.length === 0 || !hasValues} emptyLabel="No reconciled daily data in this range.">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={CHART_MARGIN}>
          <defs>
            {/* Vertical fade, 22% → 2%. Never a solid fill: at full opacity an
                area reads as a bar chart and fights the lines above it. */}
            <linearGradient id="adSpendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.spend} stopOpacity={0.22} />
              <stop offset="100%" stopColor={CHART_COLORS.spend} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          {/* Horizontal only — vertical lines add nothing when X is dates. */}
          <CartesianGrid stroke={CHART_COLORS.grid} strokeOpacity={0.5} vertical={false} />

          <XAxis
            dataKey="label"
            minTickGap={CHART_X_MIN_TICK_GAP}
            tickLine={false}
            axisLine={{ stroke: CHART_COLORS.grid, strokeOpacity: 0.6 }}
            tick={{ fill: CHART_COLORS.axisText, fontSize: 11 }}
          />
          <YAxis
            width={CHART_Y_AXIS_WIDTH}
            tickFormatter={formatPesoAxis}
            tickLine={false}
            axisLine={false}
            tick={{ fill: CHART_COLORS.axisText, fontSize: 11 }}
          />

          <Tooltip
            cursor={CHART_CURSOR}
            contentStyle={CHART_TOOLTIP_STYLE}
            labelStyle={{ color: CHART_COLORS.foreground, fontWeight: 600, marginBottom: 4 }}
            itemStyle={{ padding: 0 }}
            formatter={(value, name, item) => {
              const amount = formatPesoFull(Number(value));
              const payload = item?.payload as { __orders?: number; __deliveredOrders?: number } | undefined;
              // The count rides in the payload and surfaces only here, so the
              // reader never has to convert between two axis scales.
              if (name === SERIES.orderValue && payload?.__orders != null) {
                return [`${amount} · ${payload.__orders} orders`, name];
              }
              if (name === SERIES.delivered && payload?.__deliveredOrders != null) {
                return [`${amount} · ${payload.__deliveredOrders} delivered`, name];
              }
              return [amount, name];
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => (
              <span style={{ color: CHART_COLORS.axisText, fontSize: 12 }}>{value}</span>
            )}
          />

          {/* Declared top-line → bottom, so the legend reads in the same order
              the lines stack and the area's fill paints last, beneath them. */}
          <Line
            type="monotone"
            dataKey={SERIES.orderValue}
            stroke={CHART_COLORS.primary}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3 }}
            animationDuration={CHART_ANIMATION_MS}
          />
          <Line
            type="monotone"
            dataKey={SERIES.delivered}
            stroke={CHART_COLORS.success}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3 }}
            animationDuration={CHART_ANIMATION_MS}
          />
          <Area
            type="monotone"
            dataKey={SERIES.adSpend}
            stroke={CHART_COLORS.spend}
            strokeWidth={2.5}
            fill="url(#adSpendFill)"
            dot={false}
            activeDot={{ r: 3 }}
            animationDuration={CHART_ANIMATION_MS}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
