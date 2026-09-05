'use client';

import Link from 'next/link';
import { AlertTriangle, ChevronDown, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { PanelHeader, StatTile } from '../../../overview/_components/overview-ui';
import {
  formatCount,
  formatCurrency,
  formatPercent,
} from '../../../overview/_utils/creative-overview-format';
import { VideoRegistryDateRangePicker } from '../../../video-registry/_components/video-registry-date-range-picker';
import { VerdictPill } from '../../performance/_constants/performance-columns';
import { AnalyticsMultiSelectPicker } from '../../../../analytics/_components/analytics-multi-select-picker';
import { useAdvertisingDashboardController } from '../_hooks/use-advertising-dashboard-controller';
import type { DashboardMetric } from '../_types/advertising-dashboard';
import { AdvertisingCalendar } from './advertising-calendar';
import { AdvertisingTrendChart } from './advertising-trend-chart';

const selectClass = 'h-9 rounded-lg border border-border/60 bg-surface px-2.5 text-xs font-medium text-foreground outline-none transition hover:border-border focus:border-primary/40 focus:ring-2 focus:ring-primary/10';

function floorHealthy(metric: DashboardMetric | undefined, floor: number | undefined): boolean {
  return metric?.value != null && floor != null && metric.value >= floor;
}

export function AdvertisingDashboardScreen() {
  const controller = useAdvertisingDashboardController();
  const { data, params } = controller;

  // Store/creator filters use the standard multi-select picker: an empty
  // array means "All", and toggling out of All expands to the full set first
  // so unchecking one option keeps the rest selected.
  const storeOptions = data?.filters.stores ?? [];
  const creatorOptions = data?.filters.creators ?? [];
  const allStoresSelected = params.storeIds.length === 0;
  const allCreatorsSelected = params.creatorIds.length === 0;
  const selectedStoreLabel = allStoresSelected
    ? 'All stores'
    : params.storeIds.length === 1
      ? storeOptions.find((option) => option.value === params.storeIds[0])?.label ?? '1 selected'
      : `${params.storeIds.length} selected`;
  const selectedCreatorLabel = allCreatorsSelected
    ? 'All creators'
    : params.creatorIds.length === 1
      ? creatorOptions.find((option) => option.value === params.creatorIds[0])?.label ?? '1 selected'
      : `${params.creatorIds.length} selected`;
  const toggleStore = (value: string) => {
    const current = allStoresSelected ? storeOptions.map((option) => option.value) : params.storeIds;
    const next = current.includes(value) ? current.filter((id) => id !== value) : [...current, value];
    controller.updateParams({ storeIds: next });
  };
  const toggleCreator = (value: string) => {
    const current = allCreatorsSelected ? creatorOptions.map((option) => option.value) : params.creatorIds;
    const next = current.includes(value) ? current.filter((id) => id !== value) : [...current, value];
    // Creator owns the store scope. Reset the child selection immediately so
    // an old store cannot leak into the next creator's request.
    controller.updateParams({ creatorIds: next, storeIds: [] });
  };
  const advertising = data?.kpis.advertising;
  const creative = data?.kpis.creative;
  const floors = data?.floors;
  const craftSub = (metric: DashboardMetric | undefined, floor: number | undefined) => {
    if (!metric || metric.value == null) return 'not measured';
    return floor != null ? `vs ${formatPercent(floor)} floor` : undefined;
  };
  const rateSub = (metric: DashboardMetric | undefined, measured: string) =>
    !metric || metric.value == null ? 'not measured' : measured;
  const kpiTiles = [
    { label: 'Hook', info: '3-second plays ÷ video impressions across the selected creators’ linked ads.', value: formatPercent(creative?.hookRate.value), healthy: floorHealthy(creative?.hookRate, floors?.values.hookRate), sub: craftSub(creative?.hookRate, floors?.values.hookRate) },
    { label: 'Hold', info: 'ThruPlays ÷ 3-second plays.', value: formatPercent(creative?.holdRate.value), healthy: floorHealthy(creative?.holdRate, floors?.values.holdRate), sub: craftSub(creative?.holdRate, floors?.values.holdRate) },
    { label: 'Completion', info: 'ThruPlays ÷ video impressions.', value: formatPercent(creative?.completionRate.value), healthy: floorHealthy(creative?.completionRate, floors?.values.completionRate), sub: craftSub(creative?.completionRate, floors?.values.completionRate) },
    { label: 'CTR', info: 'Link clicks ÷ impressions.', value: formatPercent(creative?.ctr.value), healthy: floorHealthy(creative?.ctr, floors?.values.ctr), sub: craftSub(creative?.ctr, floors?.values.ctr) },
    { label: 'Orders', info: 'Attributed POS orders across the selected creators’ linked ads in the period.', value: formatCount(creative?.orders.value), sub: 'attributed in period' },
    { label: 'Ad Spend', info: 'Meta spend on the selected creators’ linked ads in the period.', value: formatCurrency(creative?.adSpend.value), sub: 'linked ads' },
    { label: 'MAR% (AR%)', info: 'Ad spend ÷ attributed gross revenue — the same formula as the Creative Dashboard.', value: formatPercent(creative?.mar.value), sub: rateSub(creative?.mar, 'spend ÷ revenue') },
    { label: 'Video Output', info: 'Creatives enrolled by the selected creators in the period.', value: formatCount(creative?.output.value), sub: 'enrolled in period' },
    { label: 'Delivered', info: 'Delivered orders across the selected creators’ linked ads.', value: formatCount(creative?.delivered.value), sub: 'orders delivered' },
    { label: 'Cancellation Rate', info: 'Cancelled ÷ all attributed orders — the same convention as the Creative Dashboard.', value: formatPercent(creative?.cancellationRate.value), sub: rateSub(creative?.cancellationRate, 'of all orders') },
    { label: 'RTS Rate', info: 'RTS ÷ (delivered + RTS) — the same convention as the Creative Dashboard.', value: formatPercent(creative?.rtsRate.value), sub: rateSub(creative?.rtsRate, 'of delivered + RTS') },
    { label: 'Delivery Rate', info: 'Delivered ÷ all attributed orders — the same convention as the Creative Dashboard.', value: formatPercent(creative?.deliveryRate.value), sub: rateSub(creative?.deliveryRate, 'of all orders') },
  ];
  const criticalAlertCount = data?.alerts.filter((alert) => alert.severity === 'critical').length ?? 0;
  // Summed from the very rows the chart plots, so the header figures and the
  // curve can never disagree about the same period.
  const trendTotals = (data?.trend ?? []).reduce(
    (totals, point) => ({
      grossValue: totals.grossValue + point.grossValue,
      deliveredValue: totals.deliveredValue + point.deliveredValue,
      spend: totals.spend + point.spend,
      orders: totals.orders + point.orders,
      deliveredOrders: totals.deliveredOrders + point.deliveredOrders,
    }),
    { grossValue: 0, deliveredValue: 0, spend: 0, orders: 0, deliveredOrders: 0 },
  );

  return (
    <div className="mx-auto max-w-screen-xl">
      <PageHeader
        title="Advertising Dashboard"
        description="Is each peso of ad spend buying an order that will actually be paid for? Cost efficiency, daily trends, decisions, and data trust in one read."
        breadcrumbs="Advertising Workspace"
      />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <VideoRegistryDateRangePicker compact startDate={params.startDate} endDate={params.endDate} onChange={(range) => controller.updateParams(range)} />
          <AnalyticsMultiSelectPicker
            className="relative"
            selectTitle="Select creators"
            selectedLabel={selectedCreatorLabel}
            options={creatorOptions}
            allChecked={allCreatorsSelected}
            isChecked={(value) => allCreatorsSelected || params.creatorIds.includes(value)}
            onToggleAll={() => controller.updateParams({ creatorIds: [], storeIds: [] })}
            onToggle={toggleCreator}
            onOnly={(value) => controller.updateParams({ creatorIds: [value], storeIds: [] })}
            onClear={() => controller.updateParams({ creatorIds: [], storeIds: [] })}
          />
          <AnalyticsMultiSelectPicker
            className="relative"
            selectTitle={allCreatorsSelected ? 'Select stores' : 'Select stores for chosen creators'}
            selectedLabel={selectedStoreLabel}
            options={storeOptions}
            allChecked={allStoresSelected}
            isChecked={(value) => allStoresSelected || params.storeIds.includes(value)}
            onToggleAll={() => controller.updateParams({ storeIds: [] })}
            onToggle={toggleStore}
            onOnly={(value) => controller.updateParams({ storeIds: [value] })}
            onClear={() => controller.updateParams({ storeIds: [] })}
          />
          {(data?.filters.accounts.length ?? 0) > 1 ? (
            <select value={params.accountId} onChange={(event) => controller.updateParams({ accountId: event.target.value })} className={`${selectClass} w-40`} aria-label="Filter by Meta account">
              <option value="">All accounts</option>
              {data?.filters.accounts.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          ) : null}
        </div>

        {controller.error ? (
          <div className="panel border-destructive/20 bg-destructive/5 p-5 text-center shadow-card">
            <AlertTriangle className="mx-auto h-6 w-6 text-destructive" />
            <p className="mt-2 font-semibold text-foreground">Dashboard could not load</p>
            <p className="mt-1 text-sm text-muted">{controller.error}</p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => void controller.retry()}>Try again</Button>
          </div>
        ) : null}

        {/* 1 · Attention banner — sits above the numbers because each item changes
            how much to trust them. Collapsed to one line to keep the dashboard
            short, but opened by default when anything critical is waiting. */}
        {data?.alerts.length ? (
          <details className="panel panel-content group shadow-card" open={criticalAlertCount > 0}>
            <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3 [&::-webkit-details-marker]:hidden">
              <ChevronDown className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
              <div className="min-w-0">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                  Needs attention · {data.alerts.length}
                </h2>
                <p className="mt-0.5 truncate text-sm-custom leading-snug text-muted">
                  {criticalAlertCount > 0
                    ? `${criticalAlertCount} critical · current actionable warnings only.`
                    : 'Current actionable warnings only — resolved issues disappear on their own.'}
                </p>
              </div>
              <span className="ml-auto flex shrink-0 items-center gap-1.5">
                {criticalAlertCount > 0 ? (
                  <span className="inline-flex items-center rounded-full bg-destructive-soft/50 px-2 py-0.5 text-xs-tight font-semibold uppercase tracking-wide text-destructive dark:bg-destructive/15">
                    {criticalAlertCount} critical
                  </span>
                ) : null}
                {data.alerts.length - criticalAlertCount > 0 ? (
                  <span className="inline-flex items-center rounded-full bg-warning-soft px-2 py-0.5 text-xs-tight font-semibold uppercase tracking-wide text-warning dark:bg-warning/15">
                    {data.alerts.length - criticalAlertCount} warning
                  </span>
                ) : null}
              </span>
            </summary>
            <div className="grid gap-2 border-t border-border/40 p-4">
              {data.alerts.map((alert) => (
                <div key={alert.code} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm-custom ${alert.severity === 'critical' ? 'bg-destructive-soft/40 text-destructive dark:bg-destructive/10' : 'bg-warning-soft/60 text-foreground dark:bg-warning/10'}`}>
                  <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${alert.severity === 'critical' ? 'text-destructive' : 'text-warning'}`} />
                  <span className="min-w-0">
                    {alert.message}
                    {alert.href ? <Link href={alert.href} className="ml-1 font-semibold text-primary hover:underline">Open →</Link> : null}
                  </span>
                </div>
              ))}
            </div>
          </details>
        ) : null}

        {/* 2 · Advertising KPI group */}
        <section className="panel panel-content shadow-card">
          <PanelHeader
            title="Advertising metrics"
            description="The same creative and attributed-order scorecard used by the Creative Dashboard, scoped by creator and store."
          />
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
            {kpiTiles.map((tile) => (
              <StatTile
                key={tile.label}
                label={tile.label}
                info={tile.info}
                value={tile.value}
                tone={tile.healthy ? 'good' : 'neutral'}
                sub={tile.sub}
              />
            ))}
          </div>
          <p className="border-t border-border/40 px-4 py-3 text-xs-tight leading-snug text-faint">
            Hitting a floor exactly scores 7. Anything unmeasurable (a static has no hook rate) is left out rather than counted as zero.
            {floors?.provisional ? ' Floors are provisional defaults.' : ''}
          </p>
        </section>

        {/* 3 · Monthly summary — full width so all seven weekday columns fit
            without clipping Saturday or squeezing the day cells. */}
        <section className="panel panel-content shadow-card">
          <PanelHeader title={`Monthly summary — ${data?.calendar.monthLabel ?? '…'}`} description="Spend, orders, CPP, and AR%, day by day for this specific month." />
          <div className="p-4">
            {data ? <AdvertisingCalendar month={data.calendar.month} days={data.calendar.days} /> : <p className="py-6 text-center text-sm text-muted">Loading…</p>}
          </div>
        </section>

        {/* 4 · Short trend. The header's right slot carries the period totals
            so the chart itself never needs a second axis to state them. */}
        <section className="panel panel-content shadow-card">
          <PanelHeader
            title="Daily spend & orders"
            description="Ad spend vs the peso value of orders placed (by order date) and delivered (by delivery date) — all in ₱ so the lines are directly comparable."
            right={data ? (
              <dl className="flex flex-wrap items-start gap-x-6 gap-y-2 text-right">
                <div>
                  <dt className="text-xs-tight font-semibold uppercase tracking-wide text-faint">Order amount</dt>
                  <dd className="text-base font-semibold text-foreground tabular-nums">{formatCurrency(trendTotals.grossValue)}</dd>
                  <dd className="text-xs-tight text-muted tabular-nums">{formatCount(trendTotals.orders)} orders</dd>
                </div>
                <div>
                  <dt className="text-xs-tight font-semibold uppercase tracking-wide text-faint">Delivered</dt>
                  <dd className="text-base font-semibold text-success tabular-nums">{formatCurrency(trendTotals.deliveredValue)}</dd>
                  <dd className="text-xs-tight text-muted tabular-nums">{formatCount(trendTotals.deliveredOrders)} delivered</dd>
                </div>
                <div>
                  <dt className="text-xs-tight font-semibold uppercase tracking-wide text-faint">Ad spend</dt>
                  <dd className="text-base font-semibold text-foreground tabular-nums">{formatCurrency(trendTotals.spend)}</dd>
                </div>
                <div>
                  <dt className="text-xs-tight font-semibold uppercase tracking-wide text-faint">CPP</dt>
                  <dd className="text-base font-semibold text-foreground tabular-nums">{formatCurrency(advertising?.costPerOrder.value)}</dd>
                </div>
              </dl>
            ) : undefined}
          />
          <div className="p-4">
            {data ? <AdvertisingTrendChart trend={data.trend} /> : <p className="py-6 text-center text-sm text-muted">Loading…</p>}
          </div>
        </section>

        {/* 5 · Needs-action preview */}
        <section className="panel panel-content shadow-card">
          <PanelHeader
            title="Needs action today"
            description={data?.needsAction.suppressed
              ? 'Verdicts are suppressed while attribution coverage is below the minimum.'
              : `Top ${Math.min(5, data?.needsAction.total ?? 0)} of ${data?.needsAction.total ?? 0} rows needing a decision, by spend.`}
            right={<Link href="/performance?verdict=NEEDS_ACTION" className="btn btn-sm btn-outline">Open Performance</Link>}
          />
          {data?.needsAction.suppressed ? (
            <p className="px-4 py-6 text-center text-sm text-muted">
              Improve order attribution coverage to re-enable per-ad verdicts — a verdict drawn from a fraction of the orders is a guess wearing a badge.
            </p>
          ) : data?.needsAction.items.length ? (
            <div className="divide-y divide-border/40">
              {data.needsAction.items.map((row) => (
                <Link
                  key={row.key}
                  href={`/performance?group=ADS&adId=${encodeURIComponent(row.adId ?? '')}`}
                  className="flex flex-wrap items-center gap-3 px-4 py-2.5 transition hover:bg-background dark:hover:bg-background-secondary"
                >
                  <VerdictPill row={row} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm-custom font-semibold text-foreground">{row.adName ?? row.adId}</p>
                    <p className="truncate text-xs-tight text-muted">{row.verdict.reason}</p>
                  </div>
                  <div className="flex shrink-0 gap-4 text-right text-xs tabular-nums">
                    <span><span className="text-faint">Spend </span><span className="font-semibold text-foreground">{formatCurrency(row.metrics.spend)}</span></span>
                    <span><span className="text-faint">Orders </span><span className="font-semibold text-foreground">{row.metrics.orders}</span></span>
                    <span><span className="text-faint">CPP </span><span className="font-semibold text-foreground">{formatCurrency(row.metrics.cpp)}</span></span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-muted">Nothing needs a decision today.</p>
          )}
        </section>

        {/* 6 · Data confidence */}
        <section className="panel panel-content shadow-card">
          <PanelHeader title="Data confidence" description="Is this data whole and trustworthy? Coverage figures have different denominators on purpose." />
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 xl:grid-cols-6">
            <StatTile compact label="Latest Meta data" value={data?.dataConfidence.latestInsightDate ?? '—'} sub="most recent insight day" />
            <StatTile compact label="Latest reconciliation" value={data?.dataConfidence.latestReconcileDate ?? '—'} sub="most recent reconciled day" />
            <StatTile compact label="Order attribution" info="POS orders matched to a specific ad ÷ all reconciled POS orders. Below the minimum, per-ad verdicts are suppressed." value={formatPercent(data?.dataConfidence.orderAttributionCoverage.value, 0)} tone={data?.dataConfidence.verdictsSuppressed ? 'warn' : 'neutral'} sub="of orders id-matched to ads" />
            <StatTile compact label="Linked spend" info="Spend on ads linked to registered creatives ÷ all spend — a different denominator from order attribution." value={formatPercent(data?.dataConfidence.linkedSpendCoverage.value, 0)} sub="of spend is creative-linked" />
            <StatTile compact label="Missing video data" value={formatCount(data?.dataConfidence.missingVideoMetricsCount)} sub="ads without 3s-play data" />
            <StatTile compact label="Withheld rates" info="Rates withheld because a source reported an impossible value above 100%." value={formatCount(data?.dataConfidence.withheldRateCount)} sub="impossible values withheld" />
          </div>
          <div className="flex items-start gap-2 border-t border-border/40 px-4 py-3 text-xs-tight text-faint">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {data?.dataConfidence.posMetaPurchaseGap.reason} Dashboard reads persisted, worker-synchronized data — nothing here triggers a Meta sync.
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
