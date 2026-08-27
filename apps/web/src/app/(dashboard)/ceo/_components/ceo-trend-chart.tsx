'use client';

import {
  Area,
  Bar,
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
  CHART_TOOLTIP_STYLE,
  CHART_X_MIN_TICK_GAP,
  formatPesoAxis,
  formatPesoFull,
} from '@/components/charts/chart-tokens';
import type { CeoTrendPoint } from '../_types/ceo-dashboard';

/**
 * Legend order is alphabetical rather than stacking order, matching the
 * reference: the reader scans it as an index, not as a z-order.
 */
const SERIES = {
  spend: 'Ad spend',
  cancelled: 'Cancelled ₱',
  delivered: 'Delivered ₱',
  inTransit: 'In transit ₱',
  orderValue: 'Order value ₱',
  orders: 'Orders',
  rts: 'RTS ₱',
} as const;

/** Order value is the top line, so it carries the warm accent. */
const ORDER_VALUE_COLOR = '#B7791F';

/** Orders is the only non-money series, so it reads on a colour of its own. */
const ORDERS_COLOR = '#8B5CF6';

/**
 * Delivered cash vs orders placed, ad spend, and money lost to cancels/RTS.
 *
 * Money shares the left axis; order COUNT gets the right axis and renders as
 * pale bars behind everything — it is not money, so it cannot share the peso
 * scale, and sitting behind keeps it as context rather than a sixth series.
 */
export function CeoTrendChart({ trend }: { trend: CeoTrendPoint[] }) {
  const rows = trend.map((point) => ({
    label: point.label ?? point.date.slice(5),
    [SERIES.orderValue]: point.orderValue,
    [SERIES.delivered]: point.deliveredValue,
    [SERIES.cancelled]: point.cancelledValue,
    [SERIES.rts]: point.rtsValue,
    [SERIES.inTransit]: point.inTransitValue,
    [SERIES.orders]: point.orders,
    [SERIES.spend]: point.spend,
    __deliveredOrders: point.deliveredOrders,
  }));
  const hasValues = rows.some((row) =>
    row[SERIES.orderValue] > 0 || row[SERIES.delivered] > 0 || row[SERIES.spend] > 0);

  return (
    <ChartFrame isEmpty={rows.length === 0 || !hasValues} emptyLabel="No reconciled daily data in this range." height="min-h-[20rem] flex-1">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 10, right: 4, left: -6, bottom: 0 }}>
          <defs>
            {/* Delivered is the only filled series: it is the cash that landed. */}
            <linearGradient id="ceoDeliveredFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.success} stopOpacity={0.28} />
              <stop offset="100%" stopColor={CHART_COLORS.success} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke={CHART_COLORS.grid} strokeOpacity={0.45} vertical={false} />

          <XAxis
            dataKey="label"
            minTickGap={CHART_X_MIN_TICK_GAP}
            tickLine={false}
            axisLine={{ stroke: CHART_COLORS.grid, strokeOpacity: 0.8 }}
            tick={{ fill: CHART_COLORS.axisText, fontSize: 12 }}
            tickMargin={8}
          />
          <YAxis
            yAxisId="money"
            width={56}
            tickFormatter={formatPesoAxis}
            tickLine={false}
            axisLine={false}
            tick={{ fill: CHART_COLORS.axisText, fontSize: 12 }}
          />

          {/* Orders is a COUNT, so it cannot share the peso scale — it gets
              its own axis on the right. */}
          <YAxis
            yAxisId="orders"
            orientation="right"
            width={34}
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fill: CHART_COLORS.axisText, fontSize: 12 }}
          />

          <Tooltip
            cursor={CHART_CURSOR}
            contentStyle={CHART_TOOLTIP_STYLE}
            labelStyle={{ color: CHART_COLORS.foreground, fontWeight: 600, marginBottom: 4 }}
            formatter={(value, name, item) => {
              if (name === SERIES.orders) return [`${Number(value)} placed`, name];
              const amount = formatPesoFull(Number(value));
              const payload = item?.payload as { __deliveredOrders?: number } | undefined;
              if (name === SERIES.delivered && payload?.__deliveredOrders != null) {
                return [`${amount} · ${payload.__deliveredOrders} delivered`, name];
              }
              return [amount, name];
            }}
          />
          <Legend
            iconType="circle"
            iconSize={9}
            wrapperStyle={{ paddingTop: 12 }}
            formatter={(value) => (
              <span style={{ color: CHART_COLORS.axisText, fontSize: 13, paddingRight: 6 }}>{value}</span>
            )}
          />

          <Line
            yAxisId="orders" type="monotone" dataKey={SERIES.orders}
            stroke={ORDERS_COLOR} strokeWidth={2}
            dot={false} activeDot={{ r: 3 }} animationDuration={CHART_ANIMATION_MS}
          />
          {/* Dashed = a cost or a loss; solid = money moving toward you. */}
          <Line
            yAxisId="money" type="monotone" dataKey={SERIES.spend}
            stroke={CHART_COLORS.spend} strokeWidth={2} strokeDasharray="5 4"
            dot={false} activeDot={{ r: 3 }} animationDuration={CHART_ANIMATION_MS}
          />
          <Line
            yAxisId="money" type="monotone" dataKey={SERIES.rts}
            stroke={CHART_COLORS.primary} strokeWidth={2} strokeDasharray="5 4"
            dot={false} activeDot={{ r: 3 }} animationDuration={CHART_ANIMATION_MS}
          />
          <Line
            yAxisId="money" type="monotone" dataKey={SERIES.cancelled}
            stroke={CHART_COLORS.destructive} strokeWidth={2}
            dot={false} activeDot={{ r: 3 }} animationDuration={CHART_ANIMATION_MS}
          />
          <Area
            yAxisId="money" type="monotone" dataKey={SERIES.delivered}
            stroke={CHART_COLORS.success} strokeWidth={2.5} fill="url(#ceoDeliveredFill)"
            dot={false} activeDot={{ r: 3 }} animationDuration={CHART_ANIMATION_MS}
          />
          <Line
            yAxisId="money" type="monotone" dataKey={SERIES.inTransit}
            stroke={CHART_COLORS.warning} strokeWidth={2} strokeDasharray="2 3"
            dot={false} activeDot={{ r: 3 }} animationDuration={CHART_ANIMATION_MS}
          />
          <Line
            yAxisId="money" type="monotone" dataKey={SERIES.orderValue}
            stroke={ORDER_VALUE_COLOR} strokeWidth={2.5}
            dot={false} activeDot={{ r: 3 }} animationDuration={CHART_ANIMATION_MS}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

