'use client';

import Link from 'next/link';
import { AlertTriangle, ChevronDown, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { PanelHeader, StatTile } from '../../../overview/_components/overview-ui';
import {
  formatCount,
  formatCurrency,
  formatHours,
  formatPercent,
  type RateTone,
} from '../../../overview/_utils/creative-overview-format';
import { VideoRegistryDateRangePicker } from '../../../video-registry/_components/video-registry-date-range-picker';
import { VerdictPill } from '../../performance/_constants/performance-columns';
import { useAdvertisingDashboardController } from '../_hooks/use-advertising-dashboard-controller';
import type { DashboardMetric } from '../_types/advertising-dashboard';
import { AdvertisingCalendar } from './advertising-calendar';
import { AdvertisingTrendChart } from './advertising-trend-chart';

const selectClass = 'h-9 rounded-lg border border-border/60 bg-surface px-2.5 text-xs font-medium text-foreground outline-none transition hover:border-border focus:border-primary/40 focus:ring-2 focus:ring-primary/10';

const metricSub = (metric: DashboardMetric | undefined, sub: string) => {
  if (!metric || metric.availability === 'OK') return sub;
  if (metric.availability === 'UNAVAILABLE') return 'not measured';
  return 'no data in range';
};

/** Ad spend ratio inverts the usual tone logic — lower is better. */
function arTone(value: number | null | undefined): RateTone {
  if (value == null) return 'neutral';
  if (value <= 0.3) return 'good';
  if (value <= 0.5) return 'warn';
  return 'bad';
}

export function AdvertisingDashboardScreen() {
  const controller = useAdvertisingDashboardController();
  const { data, params } = controller;
  const advertising = data?.kpis.advertising;
  const creative = data?.kpis.creative;
  const pipeline = data?.reviewPipeline;
  const ceiling = data?.scope.ceiling;
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

  const cppTone: RateTone = advertising?.costPerOrder.value != null && ceiling?.workingCeiling != null
    ? (advertising.costPerOrder.value <= ceiling.workingCeiling ? 'good' : 'bad')
    : 'neutral';

  return (
    <div className="mx-auto max-w-screen-xl">
      <PageHeader
        title="Advertising Dashboard"
        description="Is each peso of ad spend buying an order that will actually be paid for? Cost efficiency, craft signals, review flow, and data trust in one read."
        breadcrumbs="Advertising Workspace"
      />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <VideoRegistryDateRangePicker compact startDate={params.startDate} endDate={params.endDate} onChange={(range) => controller.updateParams(range)} />
          <select value={params.storeId} onChange={(event) => controller.updateParams({ storeId: event.target.value })} className={`${selectClass} w-36`} aria-label="Filter by store">
            <option value="">All stores</option>
            {data?.filters.stores.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          {(data?.filters.accounts.length ?? 0) > 1 ? (
            <select value={params.accountId} onChange={(event) => controller.updateParams({ accountId: event.target.value })} className={`${selectClass} w-40`} aria-label="Filter by Meta account">
              <option value="">All accounts</option>
              {data?.filters.accounts.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          ) : null}
          <select value={params.creatorId} onChange={(event) => controller.updateParams({ creatorId: event.target.value })} className={`${selectClass} w-36`} aria-label="Filter by creator">
            <option value="">All creators</option>
            {data?.filters.creators.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
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
            description={ceiling?.workingCeiling != null
              ? `Measured against a working ceiling of ${formatCurrency(ceiling.workingCeiling)}${ceiling.provisional ? ' — provisional, derived from the reconciled break-even' : ''}.`
              : 'No cost ceiling can be derived yet — deliver reconciled orders to earn one.'}
          />
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 xl:grid-cols-6">
            <StatTile compact label="Cost per click" info="Spend ÷ link clicks." value={formatCurrency(advertising?.costPerClick.value)} sub={metricSub(advertising?.costPerClick, 'spend ÷ link clicks')} />
            <StatTile compact label="Cost per order" info="Spend ÷ POS orders placed — never pixel purchases." value={formatCurrency(advertising?.costPerOrder.value)} tone={cppTone} sub={ceiling?.workingCeiling != null ? `vs ${formatCurrency(ceiling.workingCeiling)} ceiling` : 'no ceiling yet'} />
            <StatTile compact label="POS orders" info="Orders placed, from the POS — the only order source that counts." value={formatCount(advertising?.posOrders.value)} sub="orders placed · from POS" />
            <StatTile compact label="Ad spend ratio" info="Spend ÷ net-of-cancel/RTS sales, per the Marketing KPI exclusion policy. Lower is better. AR% for short." value={formatPercent(advertising?.adSpendRatio.value)} tone={arTone(advertising?.adSpendRatio.value)} sub="AR% · lower is better" />
            <StatTile compact label="Total ad spend" info="All spend in the selected period." value={formatCurrency(advertising?.totalSpend.value)} sub="this period" />
            <StatTile compact label="Linked-spend coverage" info="Spend on Meta ads linked to a registered creative ÷ all spend. Untraceable money earns nobody credit." value={formatPercent(advertising?.linkedSpendCoverage.value, 0)} sub={metricSub(advertising?.linkedSpendCoverage, 'of spend is linked')} />
          </div>
        </section>

        {/* 3 · Creative-signal KPI group */}
        <section className="panel panel-content shadow-card">
          <PanelHeader title="Creative signals" description="How the creatives behind the spend are performing — routed to the creative team when a floor breaks." />
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 xl:grid-cols-5">
            <StatTile compact label="Hook rate" info="3-second plays ÷ measured video impressions." value={formatPercent(creative?.hookRate.value)} sub={metricSub(creative?.hookRate, '3s plays ÷ video impr.')} />
            <StatTile compact label="Hold rate" info="ThruPlays ÷ 3-second plays." value={formatPercent(creative?.holdRate.value)} sub={metricSub(creative?.holdRate, 'thruplays ÷ 3s plays')} />
            <StatTile compact label="Completion" info="ThruPlays ÷ measured video impressions." value={formatPercent(creative?.completionRate.value)} sub={metricSub(creative?.completionRate, 'thruplays ÷ video impr.')} />
            <StatTile compact label="CTR" info="Link clicks ÷ impressions." value={formatPercent(creative?.ctr.value)} sub={metricSub(creative?.ctr, 'link clicks ÷ impressions')} />
            <StatTile compact label="CVR" info="POS orders ÷ landing-page views. Withheld when LP views are unmeasured — never switched to clicks." value={formatPercent(creative?.cvr.value)} sub={metricSub(creative?.cvr, 'orders ÷ LP views')} />
          </div>
        </section>

        {/* 4 · Review pipeline */}
        <section className="panel panel-content shadow-card">
          <PanelHeader
            title="Review pipeline"
            description="The approval queue you own. Counts deep-link into Assets."
            right={<Link href="/assets?queue=REVIEW" className="btn btn-sm btn-outline">Open queue</Link>}
          />
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 xl:grid-cols-6">
            <Link href="/assets?qcStatus=FOR_APPROVAL"><StatTile compact label="Awaiting review" value={formatCount(pipeline?.awaitingReview)} sub="For Approval" /></Link>
            <Link href="/assets?qcStatus=REVISED"><StatTile compact label="Resubmitted" value={formatCount(pipeline?.revised)} sub="Revised" /></Link>
            <Link href="/assets?qcStatus=FOR_POSTING"><StatTile compact label="Ready to post" value={formatCount(pipeline?.readyForPosting)} sub="For Posting" /></Link>
            <Link href="/assets?qcStatus=POSTED"><StatTile compact label="Posted" value={formatCount(pipeline?.postedInPeriod)} sub="in selected period" /></Link>
            <StatTile compact label="Turnaround" info="Median hours from submission to approval, rows with both timestamps only." value={formatHours(pipeline?.medianTurnaroundHours)} sub="submitted → approved" />
            <StatTile compact label="Approval rate" info="Approved ÷ (approved + cancelled) — finished decisions only." value={formatPercent(pipeline?.approvalRate, 0)} sub={`${formatCount(pipeline?.cancelledCount)} cancelled`} />
          </div>
        </section>

        {/* 5 · Monthly summary — full width so all seven weekday columns fit
            without clipping Saturday or squeezing the day cells. */}
        <section className="panel panel-content shadow-card">
          <PanelHeader title={`Monthly summary — ${data?.calendar.monthLabel ?? '…'}`} description="Spend, orders, CPP, and AR%, day by day for this specific month." />
          <div className="p-4">
            {data ? <AdvertisingCalendar month={data.calendar.month} days={data.calendar.days} /> : <p className="py-6 text-center text-sm text-muted">Loading…</p>}
          </div>
        </section>

        {/* 5b · Short trend. The header's right slot carries the period totals
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

        {/* 6 · Needs-action preview */}
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

        {/* 7 · Data confidence */}
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
