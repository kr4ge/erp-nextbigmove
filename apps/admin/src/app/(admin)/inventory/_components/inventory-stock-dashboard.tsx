'use client';

import type { ReactNode } from 'react';
import {LineChart, ScatterChart, TrendingDown, TrendingUp, Truck } from 'lucide-react';
import { WmsCompactPanel } from '../../_components/wms-compact-panel';
import type { WmsInventoryOverviewResponse } from '../_types/inventory';
import {
  buildInventoryStockDashboard,
  type StaticMilestone,
  type StockHeadlineMetric,
} from '../_utils/inventory-stock-dashboard';
import { InventoryLogisticsReportsPanel } from './inventory-logistics-reports-panel';

type InventoryStockDashboardProps = {
  overview: WmsInventoryOverviewResponse | null;
  isFetching: boolean;
  filters?: ReactNode;
};

export function InventoryStockDashboard({
  overview,
  isFetching,
  filters,
}: InventoryStockDashboardProps) {
  const dashboard = buildInventoryStockDashboard(overview);

  return (
    <div className="space-y-5">
      <WmsCompactPanel
        title="Warehouse and Shipment Management"
        icon={<Truck className='panel-icon' />}
      >

        {filters ? (
          <div className="mb-4 border-b border-[#e7edf2] pb-4">
            {filters}
          </div>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
          <div className="min-w-0">
            <div className="grid gap-3 md:grid-cols-3">
              {dashboard.headline.map((metric) => (
                <HeadlineMetricCard key={metric.id} metric={metric} />
              ))}
            </div>
          </div>

          <div className="min-w-0 xl:border-l xl:border-slate-200 xl:pl-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-2">
              {dashboard.milestones.map((milestone) => (
                <MilestoneCard key={milestone.id} milestone={milestone} />
              ))}
            </div>
          </div>
        </div>

        <div className="sr-only" aria-live="polite">
          {isFetching ? 'Refreshing stock dashboard' : 'Stock dashboard ready'}
        </div>
      </WmsCompactPanel>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
        <InventoryLogisticsReportsPanel units={overview?.units ?? []} />

        <div className="space-y-5">
          <PlaceholderPanel title="Shipping Statistics" icon={<LineChart className='panel-icon' />}>
            <div className="grid min-h-[104px] gap-3 md:grid-cols-3">
              <BlankColumn />
              <BlankColumn />
              <BlankColumn />
            </div>
          </PlaceholderPanel>

          <PlaceholderPanel title="Shipment Distribution" icon={<ScatterChart className='panel-icon' />}>
            <div className="grid min-h-[180px] gap-3 md:grid-cols-[minmax(0,1fr)_160px]">
              <BlankColumn />
              <BlankColumn />
            </div>
          </PlaceholderPanel>
        </div>
      </div>
    </div>
  );
}

function PlaceholderPanel({
  title,
  children,
  icon,
}: {
  title: string;
  children: ReactNode;
  icon: ReactNode;
}) {
  return (
    <WmsCompactPanel title={title} icon={icon}>
      {children}
    </WmsCompactPanel>
  );
}

function BlankColumn() {
  return (
    <div
      className="rounded-[16px] border border-dashed border-[#dce4ea] bg-[#fbfcfd]"
      aria-hidden="true"
    />
  );
}

function HeadlineMetricCard({ metric }: { metric: StockHeadlineMetric }) {
  return (
    <div className="card">
      <p className="card-label">
        {metric.label}
      </p>
      <p className="card-value">
        {metric.value}
      </p>
    </div>
  );
}

function MilestoneCard({ milestone }: { milestone: StaticMilestone }) {
  const TrendIcon = milestone.direction === 'up' ? TrendingUp : TrendingDown;

  return (
    <div className="card">
      <p className="card-label">
        {milestone.label}
      </p>
      <div className="grid h-full grid-cols-[minmax(0,0.92fr)_auto] gap-2">
        <div className="min-w-0">
          <p className="card-value">
            {milestone.value}
          </p>
          <span
            className={`mt-1 inline-flex items-center gap-1 text-[12px] font-bold ${
              milestone.direction === 'down' ? 'text-destructive' : 'text-success'
            }`}
          >
            <TrendIcon className="h-3.5 w-3.5" />
            {milestone.trend}
          </span>
        </div>

        <Sparkline points={milestone.points} />
      </div>
    </div>
  );
}

function Sparkline({ points }: { points: number[] }) {
  const width = 78;
  const height = 44;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const path = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = height - ((point - min) / range) * (height - 8) - 4;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <svg
      className="mt-5 h-11 w-[78px] text-[#12384b]"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Milestone trend"
    >
      <path d={path} fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="4" />
    </svg>
  );
}
