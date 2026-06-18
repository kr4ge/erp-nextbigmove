'use client';

import { Activity, BarChart3, Clock3, Store } from 'lucide-react';
import { WmsCompactPanel } from '../../_components/wms-compact-panel';
import type { WmsDispatchReportsResponse } from '../_types/dispatch';

type DispatchReportsPanelProps = {
  data: WmsDispatchReportsResponse | null;
  isLoading: boolean;
  selectedWindowDays: number;
  windowOptions: number[];
  onWindowDaysChange: (value: number) => void;
};

export function DispatchReportsPanel({
  data,
  isLoading,
  selectedWindowDays,
  windowOptions,
  onWindowDaysChange,
}: DispatchReportsPanelProps) {
  const trendMax = Math.max(
    1,
    ...(data?.trend ?? []).map((point) => (
      point.packedOrders + point.shippedOrders + point.deliveredOrders + point.returnedOrders
    )),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-[#dce4ea] bg-[#f9fbfc] px-4 py-3">
        <div>
          <p className="card-label">Dispatch Reports</p>
          <p className="mt-1 text-sm text-[#5f7483]">
            Track packing, shipment, delivery, RTS verification, and final return placement in one operational view.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {windowOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onWindowDaysChange(option)}
              className={`rounded-full border px-3.5 py-2 text-[12px] font-semibold transition ${
                selectedWindowDays === option
                  ? 'border-[#12384b] bg-[#12384b] text-white'
                  : 'border-[#d7e0e7] bg-white text-[#4d6677] hover:border-[#c5d5df] hover:text-[#12384b]'
              }`}
            >
              {option} days
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]">
        <WmsCompactPanel title="Flow Trend" icon={<BarChart3 className="panel-icon" />}>
          {isLoading && !data ? (
            <ReportsSkeleton rows={6} />
          ) : data && data.trend.length > 0 ? (
            <div className="space-y-3">
              {data.trend.map((point) => {
                const total = point.packedOrders + point.shippedOrders + point.deliveredOrders + point.returnedOrders;
                const packedWidth = total > 0 ? (point.packedOrders / trendMax) * 100 : 0;
                const shippedWidth = total > 0 ? (point.shippedOrders / trendMax) * 100 : 0;
                const deliveredWidth = total > 0 ? (point.deliveredOrders / trendMax) * 100 : 0;
                const returnedWidth = total > 0 ? (point.returnedOrders / trendMax) * 100 : 0;

                return (
                  <div key={point.date} className="rounded-[20px] border border-[#e4ebf0] bg-white px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-primary">{formatReportDate(point.date)}</p>
                      <p className="text-[12px] font-medium text-[#6f8290]">{total} completed events</p>
                    </div>

                    <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#edf2f6]">
                      <div className="flex h-full overflow-hidden rounded-full">
                        <span className="bg-[#12384b]" style={{ width: `${packedWidth}%` }} />
                        <span className="bg-[#2c7fb8]" style={{ width: `${shippedWidth}%` }} />
                        <span className="bg-[#2f9e78]" style={{ width: `${deliveredWidth}%` }} />
                        <span className="bg-[#cf7d2b]" style={{ width: `${returnedWidth}%` }} />
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 text-[12px] text-[#5f7483] sm:grid-cols-4">
                      <MetricPill label="Packed" value={point.packedOrders} tone="slate" />
                      <MetricPill label="Shipped" value={point.shippedOrders} tone="blue" />
                      <MetricPill label="Delivered" value={point.deliveredOrders} tone="green" />
                      <MetricPill label="Returned" value={point.returnedOrders} tone="amber" />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyReportsState message="No dispatch activity was recorded for this reporting window." />
          )}
        </WmsCompactPanel>

        <WmsCompactPanel title="Recent Activity" icon={<Activity className="panel-icon" />}>
          {isLoading && !data ? (
            <ReportsSkeleton rows={5} compact />
          ) : data && data.recentActivity.length > 0 ? (
            <div className="space-y-3">
              {data.recentActivity.map((activity) => (
                <article key={activity.id} className="rounded-[20px] border border-[#e4ebf0] bg-white px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-primary">{activity.label}</p>
                      {activity.detail ? (
                        <p className="mt-1 text-[12px] text-[#5f7483]">{activity.detail}</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-[11px] font-medium text-[#7b8e9c]">
                      {formatReportTimestamp(activity.createdAt)}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[#6f8290]">
                    {activity.storeName ? (
                      <span className="rounded-full border border-[#dce4ea] bg-[#f9fbfc] px-2.5 py-1">
                        {activity.storeName}
                      </span>
                    ) : null}
                    {activity.tenantName ? (
                      <span className="rounded-full border border-[#dce4ea] bg-[#f9fbfc] px-2.5 py-1">
                        {activity.tenantName}
                      </span>
                    ) : null}
                    {activity.actor ? (
                      <span className="rounded-full border border-[#dce4ea] bg-[#f9fbfc] px-2.5 py-1">
                        {activity.actor.name}
                      </span>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyReportsState message="Recent dispatch actions will appear here once packing, shipping, or RTS work is recorded." />
          )}
        </WmsCompactPanel>
      </div>

      <WmsCompactPanel title="Store Breakdown" icon={<Store className="panel-icon" />}>
        {isLoading && !data ? (
          <ReportsSkeleton rows={6} />
        ) : data && data.stores.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed border-separate border-spacing-y-2">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-[#748798]">
                  <th className="px-3 py-2 font-semibold">Store</th>
                  <th className="px-3 py-2 font-semibold">Packed</th>
                  <th className="px-3 py-2 font-semibold">Shipped</th>
                  <th className="px-3 py-2 font-semibold">Delivered</th>
                  <th className="px-3 py-2 font-semibold">Returning</th>
                  <th className="px-3 py-2 font-semibold">Returned</th>
                  <th className="px-3 py-2 font-semibold">Dispatch units</th>
                  <th className="px-3 py-2 font-semibold">RTS units</th>
                </tr>
              </thead>
              <tbody>
                {data.stores.map((store) => (
                  <tr key={store.storeId} className="rounded-[20px] bg-white shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                    <td className="rounded-l-[18px] border border-r-0 border-[#e4ebf0] px-3 py-3 align-top">
                      <p className="font-semibold text-primary">{store.storeName}</p>
                      <p className="mt-1 text-[12px] text-[#6f8290]">{store.tenantName ?? 'No tenant'}</p>
                    </td>
                    <StoreMetricCell value={store.packedOrders} />
                    <StoreMetricCell value={store.shippedOrders} />
                    <StoreMetricCell value={store.deliveredOrders} />
                    <StoreMetricCell value={store.returningOrders} tone="amber" />
                    <StoreMetricCell value={store.returnedOrders} tone="amber" />
                    <StoreMetricCell value={store.dispatchedUnits} tone="blue" />
                    <StoreMetricCell value={store.rtsUnits} tone="rose" rounded="right" />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyReportsState message="No store-level dispatch totals are available for the current scope." />
        )}
      </WmsCompactPanel>

      {data?.window.startDate && data.window.endDate ? (
        <div className="flex items-center gap-2 text-[12px] text-[#6f8290]">
          <Clock3 className="h-3.5 w-3.5" />
          Window: {data.window.startDate} to {data.window.endDate}
        </div>
      ) : null}
    </div>
  );
}

function MetricPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'slate' | 'blue' | 'green' | 'amber';
}) {
  const toneClassName = tone === 'blue'
    ? 'bg-[#eef6ff] text-[#2c7fb8]'
    : tone === 'green'
      ? 'bg-[#ebfaf4] text-[#2f9e78]'
      : tone === 'amber'
        ? 'bg-[#fff5e9] text-[#cf7d2b]'
        : 'bg-[#f2f5f8] text-[#4d6677]';

  return (
    <div className={`rounded-full px-3 py-2 ${toneClassName}`}>
      <span className="mr-2 font-medium">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function StoreMetricCell({
  value,
  tone = 'neutral',
  rounded = 'none',
}: {
  value: number;
  tone?: 'neutral' | 'amber' | 'blue' | 'rose';
  rounded?: 'none' | 'right';
}) {
  const toneClassName = tone === 'amber'
    ? 'text-[#a66313]'
    : tone === 'blue'
      ? 'text-[#2c7fb8]'
      : tone === 'rose'
        ? 'text-[#b85069]'
        : 'text-primary';

  return (
    <td
      className={`border border-l-0 border-r-0 border-[#e4ebf0] px-3 py-3 text-sm font-semibold ${toneClassName} ${
        rounded === 'right' ? 'rounded-r-[18px] border-r' : ''
      }`}
    >
      {value}
    </td>
  );
}

function ReportsSkeleton({
  rows,
  compact = false,
}: {
  rows: number;
  compact?: boolean;
}) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className={`animate-pulse rounded-[20px] border border-[#e4ebf0] bg-white ${
            compact ? 'h-20' : 'h-24'
          }`}
        />
      ))}
    </div>
  );
}

function EmptyReportsState({
  message,
}: {
  message: string;
}) {
  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-[22px] border border-dashed border-[#dce4ea] bg-[#fbfcfd] px-6 text-center text-sm text-[#6f8290]">
      {message}
    </div>
  );
}

function formatReportDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatReportTimestamp(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
