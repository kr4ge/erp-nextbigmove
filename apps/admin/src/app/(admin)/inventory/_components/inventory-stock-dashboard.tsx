'use client';

import { useMemo, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { CalendarDays, LineChart, ScatterChart, TrendingDown, TrendingUp, Truck } from 'lucide-react';
import { WmsCompactPanel } from '../../_components/wms-compact-panel';
import type { WmsInventoryOverviewResponse } from '../_types/inventory';
import {
  buildInventoryStockDashboard,
  type StaticMilestone,
  type StockHeadlineMetric,
} from '../_utils/inventory-stock-dashboard';
import { InventoryLogisticsReportsPanel } from './inventory-logistics-reports-panel';

type LogisticsDateSelection = {
  startDate: string;
  endDate: string;
};

type LogisticsDatePickerValue = {
  startDate: Date | null;
  endDate: Date | null;
};

type InventoryStockDashboardProps = {
  overview: WmsInventoryOverviewResponse | null;
  isFetching: boolean;
  filters?: ReactNode;
};

const Datepicker = dynamic(() => import('react-tailwindcss-datepicker'), { ssr: false });

export function InventoryStockDashboard({
  overview,
  isFetching,
  filters,
}: InventoryStockDashboardProps) {
  const dashboard = buildInventoryStockDashboard(overview);
  const [logisticsDateRange, setLogisticsDateRange] = useState<LogisticsDateSelection>(() => getTodayDateSelection());
  const today = useMemo(() => formatDateInputValue(new Date()), []);
  const datePickerValue = useMemo<LogisticsDatePickerValue>(
    () => ({
      startDate: parseDateInputValue(logisticsDateRange.startDate),
      endDate: parseDateInputValue(logisticsDateRange.endDate),
    }),
    [logisticsDateRange.endDate, logisticsDateRange.startDate],
  );
  const isTodayRange = logisticsDateRange.startDate === today && logisticsDateRange.endDate === today;
  const dateRangeButtonLabel = formatDateRangeButtonLabel(logisticsDateRange);

  const handleLogisticsDateRangeChange = (value: {
    startDate?: Date | string | null;
    endDate?: Date | string | null;
  } | null) => {
    setLogisticsDateRange((current) => {
      const nextStart = normalizeDatepickerValue(value?.startDate, current.startDate || today);
      const nextEnd = normalizeDatepickerValue(value?.endDate, nextStart);

      return {
        startDate: nextStart,
        endDate: nextEnd < nextStart ? nextStart : nextEnd,
      };
    });
  };

  return (
    <div className="space-y-5">
      <WmsCompactPanel
        title="Warehouse and Shipment Management"
        icon={<Truck className='panel-icon' />}
      >

        {filters ? (
          <div className="mb-4 border-b border-[#e7edf2] pb-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-stretch xl:justify-between">
              <div className="min-w-0 flex-1">
                {filters}
              </div>

              <div className="relative flex h-10 shrink-0 items-stretch self-stretch">
                <Datepicker
                  value={datePickerValue}
                  onChange={handleLogisticsDateRangeChange}
                  useRange={false}
                  asSingle={false}
                  showShortcuts={false}
                  showFooter={false}
                  primaryColor="yellow"
                  readOnly
                  inputClassName={`h-full cursor-pointer rounded-xl border border-slate-200 bg-white p-0 text-transparent caret-transparent placeholder:text-transparent shadow-sm transition-[width] duration-300 ease-out focus:border-[#214c63] focus:outline-none focus:ring-2 focus:ring-[#dce4ea] dark:!border-slate-200 dark:!bg-white dark:!text-transparent ${
                    isTodayRange ? 'w-10' : 'w-[200px] sm:w-[236px]'
                  }`}
                  containerClassName=""
                  popupClassName={(defaultClass) => `${defaultClass} z-50 kpi-datepicker-light`}
                  displayFormat="MM/DD/YYYY"
                  separator=" - "
                  popoverDirection="down"
                  toggleIcon={() => (
                    <span className="flex w-full items-center gap-2 overflow-hidden">
                      <CalendarDays className="h-4 w-4 shrink-0" />
                      <span
                        className={`whitespace-nowrap text-xs font-medium text-slate-700 transition-all duration-300 ease-out ${
                          isTodayRange
                            ? 'max-w-0 -translate-x-1 opacity-0'
                            : 'max-w-[148px] translate-x-0 opacity-100 sm:max-w-[184px]'
                        }`}
                      >
                        {dateRangeButtonLabel}
                      </span>
                    </span>
                  )}
                  toggleClassName="absolute inset-0 flex cursor-pointer items-center justify-start px-3 text-slate-600 hover:text-primary"
                  placeholder=" "
                />
              </div>
            </div>
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
        <InventoryLogisticsReportsPanel
          units={overview?.units ?? []}
          dateRange={logisticsDateRange}
        />

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

function getTodayDateSelection(): LogisticsDateSelection {
  const today = formatDateInputValue(new Date());

  return { startDate: today, endDate: today };
}

function parseDateInputValue(value: string) {
  const [year, month, day] = value.split('-').map(Number);

  if (!year || !month || !day) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function normalizeDatepickerValue(value: unknown, fallbackYmd: string) {
  if (!value) {
    return fallbackYmd;
  }

  if (typeof value === 'string') {
    return value.slice(0, 10);
  }

  if (value instanceof Date) {
    return formatDateInputValue(value);
  }

  return fallbackYmd;
}

function formatDateRangeButtonLabel(dateRange: LogisticsDateSelection) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const start = parseDateInputValue(dateRange.startDate);
  const end = parseDateInputValue(dateRange.endDate);

  if (!start || !end) {
    return 'Select dates';
  }

  if (dateRange.startDate === dateRange.endDate) {
    return formatter.format(start);
  }

  return `${formatter.format(start)} - ${formatter.format(end)}`;
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
      className="rounded-2xl border border-dashed border-[#dce4ea] bg-[#fbfcfd]"
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
      className="mt-5 h-11 w-[78px] text-primary"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Milestone trend"
    >
      <path d={path} fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="4" />
    </svg>
  );
}
