'use client';

import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { VideoRegistryDateRangePicker } from '../../creative-agent/video-registry/_components/video-registry-date-range-picker';
import { AnalyticsMultiSelectPicker } from '../../analytics/_components/analytics-multi-select-picker';
import { useCeoDashboardController } from '../_hooks/use-ceo-dashboard-controller';
import { CeoOrdersChart, CeoTrendChart } from './ceo-trend-chart';
import { HeadlineKpiRow } from './headline-kpi-row';
import {
  CollapsibleSection,
  count,
  decimal,
  percent,
  peso,
  SectionHeader,
  StoryCard,
  SplitTile,
  Tile,
} from './ceo-ui';
import { LossBarPanel } from './loss-bar-panel';
import { RetentionCurvePanel } from './retention-curve-panel';
import { SafetyMarginPanel } from './safety-margin-panel';

const selectClass = 'h-9 rounded-lg border border-border/60 bg-surface px-2.5 text-xs font-medium text-foreground outline-none transition hover:border-border focus:border-primary/40 focus:ring-2 focus:ring-primary/10';

/** "3 hours ago" reads as currency; a timestamp does not. */
function relativeTime(iso: string | null): string {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'never';
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60_000));
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  return `${Math.round(hours / 24)} days ago`;
}

/**
 * The only screen that answers "is the business making money?".
 *
 * Deliberately built as a story, not a metrics dump: the order of the screen
 * is the order of the argument — where you stand → the three ways a business
 * fails → what physically moved → what to fix. Everything else is folded away.
 */
export function CeoDashboardScreen() {
  const controller = useCeoDashboardController();
  const { data, params } = controller;
  const failedChecks = (data?.integrity.checks ?? []).filter((check) => !check.passed);
  const storeOptions = data?.filters.stores ?? [];
  // No explicit selection means every store in range — the same lens the API
  // applies when shopIds is omitted.
  const allStoresSelected = params.shopIds.length === 0;
  const selectedStoreLabel = allStoresSelected
    ? 'All stores'
    : params.shopIds.length === 1
      ? storeOptions.find((option) => option.value === params.shopIds[0])?.label ?? '1 selected'
      : `${params.shopIds.length} selected`;
  const breakdown = data?.breakdown ?? {};

  return (
    <div className="mx-auto max-w-screen-xl">
      <PageHeader
        title="Business Dashboard"
        description="Every figure counts an order on the day it was placed, so a campaign is judged by what it bought. Reports uses the opposite lens — the day things happened."
        breadcrumbs="Owner & Admin"
      />

      <div className="space-y-6">
        {/* Filters + 0 · freshness line */}
        <div className="flex flex-wrap items-center gap-2">
          <VideoRegistryDateRangePicker
            compact
            startDate={params.startDate}
            endDate={params.endDate}
            onChange={(range) => controller.updateParams(range)}
          />
          {(data?.filters.accounts.length ?? 0) > 1 ? (
            <select
              value={params.accountId}
              onChange={(event) => controller.updateParams({ accountId: event.target.value })}
              className={`${selectClass} w-44`}
              aria-label="Filter by ad account"
            >
              <option value="">All ad accounts</option>
              {data?.filters.accounts.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          ) : null}
          <AnalyticsMultiSelectPicker
            className="relative"
            selectTitle="Select stores"
            selectedLabel={selectedStoreLabel}
            options={storeOptions}
            allChecked={allStoresSelected}
            isChecked={(value) => allStoresSelected || params.shopIds.includes(value)}
            onToggleAll={() => controller.updateParams({ shopIds: [] })}
            onToggle={(value) => {
              // Toggling out of "all" starts from the full set, so unchecking
              // one store leaves the rest selected rather than clearing them.
              const current = allStoresSelected ? storeOptions.map((option) => option.value) : params.shopIds;
              const next = current.includes(value)
                ? current.filter((id) => id !== value)
                : [...current, value];
              controller.updateParams({ shopIds: next });
            }}
            onOnly={(value) => controller.updateParams({ shopIds: [value] })}
            onClear={() => controller.updateParams({ shopIds: [] })}
          />
          {data ? (
            <p className="text-xs-tight text-faint">
              Orders synced {relativeTime(data.freshness.ordersSyncedAt)} · ad spend imported{' '}
              {data.freshness.adSpendImportedDate ?? 'never'}
            </p>
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

        {/* 0 · integrity banner — above every figure, never a footnote. */}
        {failedChecks.length > 0 ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive-soft/40 p-4 dark:bg-destructive/10">
            <p className="flex items-center gap-2 text-sm-custom font-semibold text-destructive">
              <AlertTriangle className="h-4 w-4" />
              These figures did not pass their own arithmetic checks
            </p>
            <ul className="mt-2 space-y-1 text-sm-custom text-foreground">
              {failedChecks.map((check) => (
                <li key={check.code}>· {check.label}{check.detail ? ` — ${check.detail}` : ''}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Headline KPI row */}
        <HeadlineKpiRow data={data} />

        {/* 1 · Sales trend (left) beside 3 · health + 4 · safety margin (right).
            The chart is the wide element, so the narrow column carries the
            argument about where the business stands. */}
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <section className="panel panel-content flex flex-col shadow-card">
            <div className="flex items-start justify-between gap-5 border-b border-border/40 px-5 py-3">
              <div className="min-w-0 flex-1">
                <h3 className="whitespace-nowrap text-lg font-semibold tracking-tight text-foreground">Sales over time</h3>
                <p className="mt-0.5 text-xs leading-snug text-muted">
                  Delivered cash vs orders placed, ad spend, and money lost to cancels/RTS — day by day
                </p>
              </div>
              <dl className="flex shrink-0 items-start gap-x-5 text-right">
                <div>
                  <dt className="whitespace-nowrap text-xs-tight font-semibold uppercase tracking-wide text-faint">Order amount</dt>
                  <dd className="whitespace-nowrap text-base font-semibold text-foreground tabular-nums">{peso(data?.headline.orderAmount.value)}</dd>
                  <dd className="whitespace-nowrap text-xs-tight text-muted tabular-nums">{count(data?.headline.orderAmount.count)} placed</dd>
                </div>
                <div>
                  <dt className="whitespace-nowrap text-xs-tight font-semibold uppercase tracking-wide text-faint">In transit amount</dt>
                  <dd className="whitespace-nowrap text-base font-semibold text-foreground tabular-nums">{peso(data?.headline.inTransitAmount.value)}</dd>
                  <dd className="whitespace-nowrap text-xs-tight text-muted tabular-nums">{count(data?.headline.inTransitAmount.count)} riding</dd>
                </div>
                <div>
                  <dt className="whitespace-nowrap text-xs-tight font-semibold uppercase tracking-wide text-faint">Delivered amount</dt>
                  <dd className="whitespace-nowrap text-base font-semibold text-success tabular-nums">{peso(data?.headline.deliveredAmount.value)}</dd>
                  <dd className="whitespace-nowrap text-xs-tight text-muted tabular-nums">{count(data?.headline.deliveredAmount.count)} delivered</dd>
                </div>
                <div>
                  <dt className="whitespace-nowrap text-xs-tight font-semibold uppercase tracking-wide text-faint">Ad spent</dt>
                  <dd className="whitespace-nowrap text-base font-semibold text-foreground tabular-nums">{peso(data?.headline.adSpend.value)}</dd>
                  <dd className="whitespace-nowrap text-xs-tight text-muted tabular-nums">{peso(data?.headline.adSpend.perDay)}/day</dd>
                </div>
                <div>
                  <dt className="whitespace-nowrap text-xs-tight font-semibold uppercase tracking-wide text-faint">RTS rate</dt>
                  <dd className="whitespace-nowrap text-base font-semibold text-destructive tabular-nums">{percent(data?.headline.rtsRate.value, 0)}</dd>
                  <dd className="whitespace-nowrap text-xs-tight text-muted tabular-nums">
                    {count(data?.headline.rtsRate.numerator)} of {count(data?.headline.rtsRate.denominator)}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="flex min-h-0 flex-1 flex-col p-4">
              {/* The plot sits inside its own hairline frame, as in the
                  reference — it separates the axes from the card padding, and
                  stretches to whatever height the sidebar column sets. */}
              <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border/50 p-4">
                {data ? <CeoTrendChart trend={data.trend} /> : <p className="py-16 text-center text-sm text-muted">Loading…</p>}
              </div>
              {/* Orders placed sits below on its own axis: it is a count, not
                  money, so it cannot share the peso scale above. shrink-0 keeps
                  it out of the flex-1 fight with the money chart, which would
                  otherwise claim the whole column and squeeze this to nothing. */}
              {data ? (
                <div className="mt-3 shrink-0 rounded-lg border border-border/50 p-4">
                  <p className="stat-label mb-1">Orders placed</p>
                  <CeoOrdersChart trend={data.trend} />
                </div>
              ) : null}
            </div>
          </section>

          <div className="flex flex-col gap-4">
            {/* The lens note, stated once and prominently: it governs every
                figure on the screen. */}
            <section className="rounded-xl bg-foreground px-4 py-3.5 text-background dark:bg-background-secondary dark:text-foreground">
              <p className="text-xs-tight font-semibold uppercase tracking-wide opacity-70">Where you stand</p>
              <h2 className="mt-0.5 text-lg font-semibold tracking-tight">Position &amp; safety margin</h2>
              <p className="mt-1.5 text-sm-custom leading-snug opacity-80">
                Campaign performance is attributed to the order&rsquo;s placed date.
              </p>
              <p className="mt-1.5 text-xs leading-snug opacity-70">
                Every figure here counts an order on the day it was PLACED, so a campaign is judged by what it bought.
                Reports uses the opposite lens — the day things happened — so the two answer different questions rather
                than disagreeing.
              </p>
            </section>

            <SafetyMarginPanel safety={data?.safetyMargin} />
          </div>
        </div>

        {/* 2 · Stock & supply — from WMS, deliberately not date-filtered. */}
        {data?.stock.available ? (
          <section>
            <SectionHeader
              eyebrow="Can we keep selling"
              title="Stock & supply"
              description="Units, not pesos, following one item down the line: in the warehouse, arriving, shipped, coming back. Follows the store filter, but on-hand stock is a running balance so it ignores the date range."
            />
            {/* Six tiles, 3 × 2 — one item's journey down the line. Values are
                toned only where the number carries a warning. */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <Tile
                label="In Warehouse"
                value={count(data.stock.onHand)}
                sub={data.stock.onHand === 0 ? 'record a count to start' : 'in the warehouse'}
              />
              <Tile
                label="Incoming"
                info="Approved quantities on purchasing batches that have not yet been received into the warehouse."
                value={data.stock.incoming === 0 ? '—' : count(data.stock.incoming)}
                sub={data.stock.incoming === 0 ? 'nothing staged' : 'staged, not yet shelved'}
              />
              <Tile
                label="In Transit"
                value={count(data.stock.inTransit)}
                sub="shipped, not yet delivered"
              />
              <SplitTile
                label="Returns"
                info="Returning is still with the courier on its way back. Returned has arrived and needs re-shelving."
                left={{ caption: 'Returning', value: count(data.stock.returning) }}
                right={{ caption: 'Returned', value: count(data.stock.returned) }}
                tone={data.stock.returning > 0 ? 'warning' : 'unknown'}
              />
              <Tile
                label="Sold"
                info="Units inside delivered orders in the selected range — delivery is confirmed in POS, not in the warehouse."
                value={count(data.stock.sold)}
                tone={data.stock.sold > 0 ? 'healthy' : 'unknown'}
                sub="delivered and paid"
              />
              <Tile
                label="Runs Out"
                info="Units on hand ÷ average units shipped per day over the selected range."
                value={data.stock.daysOfCover == null ? '—' : `${decimal(data.stock.daysOfCover, 1)}d`}
                tone={data.stock.daysOfCover != null && data.stock.daysOfCover < 7 ? 'critical' : 'unknown'}
                sub={data.stock.averageUnitsShippedPerDay == null
                  ? 'needs a count'
                  : `at ${decimal(data.stock.averageUnitsShippedPerDay, 1)} units/day`}
              />
            </div>
            <p className="mt-2 text-right text-xs-tight text-faint">
              Cancelled orders are never deducted — they never left the shelf.
              {data.stock.unsellable > 0 ? ` ${count(data.stock.unsellable)} units are expired, damaged or lost and are excluded from on-hand.` : ''}
            </p>
          </section>
        ) : null}

        {/* 5 · The three story cards */}
        <section>
          <SectionHeader
            eyebrow="The three questions"
            title="Acquisition, retention, profit"
            description="A business only fails three ways: you pay too much for customers, they never come back, or the maths never worked. One card each, with the single number that answers it."
          />
          <div className="grid gap-4 xl:grid-cols-3">
            <StoryCard
              eyebrow="Acquisition"
              title="Buying customers"
              question="Are you getting paying customers profitably?"
              card={data?.stories.acquisition}
              heroFormat="currency"
              heroInfo="Ad spend ÷ delivered customers. Cost per DELIVERED customer, not per order — an order that cancels bought you nothing."
            />
            <StoryCard
              eyebrow="Retention"
              title="Keeping customers"
              question="Do they come back — and what are they worth?"
              card={data?.stories.retention}
              heroFormat="percent"
              heroInfo="Customers who ordered again ÷ customers with a delivered order. A repeat needs a delivered first order plus a 10-day gap, so a replacement for a failed delivery is not counted as loyalty."
            />
            <StoryCard
              eyebrow="Finance"
              title="The bottom line"
              question="After ad cost, are you actually making money?"
              card={data?.stories.finance}
              heroFormat="currency"
              heroInfo="Break-even CPP minus what you actually pay per order — what is left per order after ad cost."
            />
          </div>
        </section>

        {/* 6 · Shipped volume + 8 · Loss bar + 9 · Retention curve */}
        <section>
          <SectionHeader
            eyebrow="What moved"
            title="Volume and where orders end up"
            description="How much actually shipped, where orders die between placed and paid, and how long buyers take to come back."
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <Tile label="Orders shipped" value={count(data?.shippedVolume.shippedOrders)} sub="left the warehouse" />
            <Tile label="Ship value" value={peso(data?.shippedVolume.shippedValue)} sub="value dispatched" />
            <Tile label="Delivered" value={count(data?.shippedVolume.deliveredOrders)} sub="delivered & paid" tone="healthy" />
            <Tile label="Delivered value" value={peso(data?.shippedVolume.deliveredValue)} sub="cash collected" tone="healthy" />
            <Tile label="Units delivered" value={count(data?.shippedVolume.deliveredUnits)} sub="items paid for" />
            <Tile
              label="Came back unpaid"
              value={peso(data?.shippedVolume.rtsValue)}
              sub={`${count(data?.shippedVolume.rtsOrders)} orders · freight paid twice`}
              tone={data && data.shippedVolume.rtsOrders > 0 ? 'warning' : 'unknown'}
            />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <LossBarPanel lossBar={data?.lossBar} />
            <RetentionCurvePanel retention={data?.retention} />
          </div>
        </section>

        {/* 10 · Biggest leak & first move */}
        <section>
          <SectionHeader
            eyebrow="What to fix"
            title="Biggest leak & first move"
            description="One problem and one action, chosen for the money they move rather than how easy they are."
          />
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="panel panel-content p-5 shadow-card">
              <p className="text-xs-tight font-semibold uppercase tracking-wide text-destructive">Biggest leak</p>
              <h3 className="mt-1 text-lg font-semibold tracking-tight text-foreground">{data?.firstMove.leak.title ?? '—'}</h3>
              <p className="mt-2 text-sm-custom leading-snug text-muted">{data?.firstMove.leak.detail ?? ''}</p>
            </div>
            <div className="panel panel-content p-5 shadow-card">
              <p className="text-xs-tight font-semibold uppercase tracking-wide text-primary">Do this first</p>
              <h3 className="mt-1 text-lg font-semibold tracking-tight text-foreground">{data?.firstMove.action.title ?? '—'}</h3>
              <p className="mt-2 text-sm-custom leading-snug text-muted">{data?.firstMove.action.detail ?? ''}</p>
            </div>
          </div>
        </section>

        {/* 11 · Full breakdown — ranked, not deleted. */}
        <CollapsibleSection title="Show full breakdown — every number, grouped by the story it tells">
          <div className="grid gap-6 lg:grid-cols-3">
            <div>
              <p className="text-xs-tight font-semibold uppercase tracking-wide text-faint">Cost & profit</p>
              <dl className="mt-2 space-y-1.5 text-sm-custom">
                {[
                  ['Ad spend', peso(breakdown.adSpend)],
                  ['Delivered COGS', peso(breakdown.deliveredCogs)],
                  ['Fulfilment cost', peso(breakdown.fulfillmentCost)],
                  ['COGS per unit', peso(breakdown.cogsPerUnit)],
                  ['Fulfilment per parcel', peso(breakdown.fulfillmentPerParcel)],
                  ['Margin per delivered order', peso(breakdown.marginPerDeliveredOrder)],
                  ['RTS cost per order', peso(breakdown.rtsCostPerOrder)],
                  ['Contribution after ads', peso(breakdown.contributionAfterAds)],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-3">
                    <dt className="text-muted">{label}</dt>
                    <dd className="font-semibold text-foreground tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div>
              <p className="text-xs-tight font-semibold uppercase tracking-wide text-faint">Order size</p>
              <dl className="mt-2 space-y-1.5 text-sm-custom">
                {[
                  ['Delivered AOV', peso(breakdown.deliveredAov)],
                  ['Cancelled AOV', peso(breakdown.cancelledAov)],
                  ['Units per order', decimal(breakdown.unitsPerOrder)],
                  ['Order value', peso(breakdown.orderValue)],
                  ['Delivered value', peso(breakdown.deliveredValue)],
                  ['Cancelled value', peso(breakdown.cancelledValue)],
                  ['RTS value', peso(breakdown.rtsValue)],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-3">
                    <dt className="text-muted">{label}</dt>
                    <dd className="font-semibold text-foreground tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div>
              <p className="text-xs-tight font-semibold uppercase tracking-wide text-faint">Outcomes & integrity</p>
              <dl className="mt-2 space-y-1.5 text-sm-custom">
                {[
                  ['Orders placed', count(breakdown.rawOrders)],
                  ['Resolved base', count(breakdown.resolvedBase)],
                  ['Still in flight', count(breakdown.inFlight)],
                  ['Delivery rate', percent(breakdown.deliveryRate)],
                  ['Cancel rate', percent(breakdown.cancelRate)],
                  ['RTS rate', percent(breakdown.rtsRate)],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-3">
                    <dt className="text-muted">{label}</dt>
                    <dd className="font-semibold text-foreground tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
              {data ? (
                <p className={`mt-3 flex items-center gap-1.5 text-xs-tight font-semibold ${data.integrity.passed ? 'text-success' : 'text-destructive'}`}>
                  {data.integrity.passed
                    ? <><CheckCircle2 className="h-3.5 w-3.5" /> All {data.integrity.checks.length} arithmetic checks passed</>
                    : <><Info className="h-3.5 w-3.5" /> {failedChecks.length} of {data.integrity.checks.length} checks failed</>}
                </p>
              ) : null}
            </div>
          </div>
        </CollapsibleSection>
      </div>
    </div>
  );
}
