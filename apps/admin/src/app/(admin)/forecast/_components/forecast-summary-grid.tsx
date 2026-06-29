'use client';

import { CalendarDays, PackageCheck, RotateCcw, ShoppingCart, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';
import type { WmsForecastingResponse } from '../_types/forecast';
import {
  formatForecastNumber,
} from '../_utils/forecast-formatters';

type ForecastSummaryGridProps = {
  data: WmsForecastingResponse | null;
  isLoading: boolean;
};

export function ForecastSummaryGrid({ data, isLoading }: ForecastSummaryGridProps) {
  const totals = data?.totals;
  const pastSalesWindowDays = data?.context.pastSalesWindowDays ?? 3;

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <ForecastMetricCard
        label="Remaining stocks"
        value={totals ? formatForecastNumber(totals.remainingStocks) : '0'}
        icon={<PackageCheck className="h-4 w-4" />}
        isLoading={isLoading && !data}
      />
      <ForecastMetricCard
        label="Pending orders"
        value={totals ? formatForecastNumber(totals.pendingOrders) : '0'}
        icon={<ShoppingCart className="h-4 w-4" />}
        isLoading={isLoading && !data}
      />
      <ForecastMetricCard
        label={`Past ${pastSalesWindowDays}-day sales`}
        value={totals ? formatForecastNumber(totals.past3DaySales) : '0'}
        icon={<TrendingUp className="h-4 w-4" />}
        isLoading={isLoading && !data}
      />
      <ForecastMetricCard
        label="Suggested order"
        value={totals ? formatForecastNumber(totals.suggestedOrderQty) : '0'}
        icon={<CalendarDays className="h-4 w-4" />}
        isLoading={isLoading && !data}
      />
      <ForecastMetricCard
        label="Returning"
        value={totals ? formatForecastNumber(totals.returning) : '0'}
        icon={<RotateCcw className="h-4 w-4" />}
        isLoading={isLoading && !data}
      />
    </div>
  );
}

function ForecastMetricCard({
  label,
  value,
  icon,
  isLoading,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  isLoading: boolean;
}) {
  return (
    <div className="card">
      <div className="flex items-center justify-between gap-3">
        <p className="card-label">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-info-soft text-primary">
          {icon}
        </span>
      </div>
      {isLoading ? (
        <div className="mt-4 h-8 w-24 animate-pulse rounded-xl bg-secondary/40" />
      ) : (
        <p className="card-value mt-4">{value}</p>
      )}
    </div>
  );
}
