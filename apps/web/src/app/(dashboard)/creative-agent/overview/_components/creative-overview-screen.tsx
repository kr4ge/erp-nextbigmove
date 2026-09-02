'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ChevronLeft, ChevronRight, ExternalLink, FolderCheck, Info, Library, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader } from '@/components/ui/page-header';
import { VideoRegistryDateRangePicker } from '../../video-registry/_components/video-registry-date-range-picker';
import { useCreativeOverviewController } from '../_hooks/use-creative-overview-controller';
import type { CreativeOverviewItem, OverviewMetric, OverviewSortKey } from '../_types/creative-overview';
import { formatCount, formatCurrency, formatPercent } from '../_utils/creative-overview-format';
import { CreativeLeaderboard } from './creative-leaderboard';
import { CreativeScorecard } from './creative-scorecard';
import { PanelHeader } from './overview-ui';
import { creativeQueryHref } from '../../video-registry/_utils/creative-navigation';

const selectClass = 'h-9 rounded-lg border border-border/60 bg-surface px-2.5 text-xs font-medium text-foreground outline-none transition hover:border-border focus:border-primary/40 focus:ring-2 focus:ring-primary/10';


function DetailDialog({ item, showAssets, onClose }: { item: CreativeOverviewItem; showAssets: boolean; onClose: () => void }) {
  const metrics = [
    ['Hook rate', formatPercent(item.metrics.hookRate)], ['Hold rate', formatPercent(item.metrics.holdRate)],
    ['Completion', formatPercent(item.metrics.completionRate)], ['CTR', formatPercent(item.metrics.ctr)],
    ['LP rate', formatPercent(item.metrics.lpRate)], ['Order rate', formatPercent(item.metrics.conversionRate)],
    ['Impressions', formatCount(item.metrics.impressions)], ['Link clicks', formatCount(item.metrics.linkClicks)],
  ];
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border/40 p-5 pr-12">
          <p className="font-mono text-sm font-bold text-primary">{item.code}</p>
          <DialogTitle className="mb-0 mt-1 text-xl">{item.title}</DialogTitle>
          <DialogDescription>{item.store.name} · {item.creator.name}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 px-5 sm:grid-cols-4">
          {metrics.map(([name, value]) => (
            <div key={name} className="stat-tile px-3 py-2">
              <p className="stat-label">{name}</p>
              <p className="stat-value">{value}</p>
            </div>
          ))}
        </div>
        <div className="px-5 text-sm-custom text-muted">
          Linked Meta ads: <span className="font-semibold text-foreground">{item.adCount}</span>
          {item.metaAdIds.length ? <p className="mt-1 break-all font-mono text-xs text-faint">{item.metaAdIds.join(', ')}</p> : null}
        </div>
        <DialogFooter className="border-t border-border/40 px-5 py-4">
          {showAssets ? (
            <Link href={creativeQueryHref('/assets', item.code)} className="btn btn-md btn-outline btn-icon">
              <FolderCheck className="h-4 w-4" /><span>Open feedback</span>
            </Link>
          ) : null}
          <Link href={creativeQueryHref('/video-registry', item.code)} className="btn btn-md btn-primary-soft btn-icon">
            <Library className="h-4 w-4" /><span>Open registry</span>
          </Link>
          {item.mediaUrl ? <a href={item.mediaUrl} target="_blank" rel="noreferrer" className="btn btn-md btn-ghost btn-icon"><ExternalLink className="h-4 w-4" /><span>Drive file</span></a> : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function floorHealthy(value: number | null | undefined, floor: number | null | undefined): boolean {
  return floor != null && value != null && value >= floor;
}

export function CreativeOverviewScreen() {
  const controller = useCreativeOverviewController();
  const { data, params } = controller;
  const [selected, setSelected] = useState<CreativeOverviewItem | null>(null);
  const floors = data?.floors;
  // 3 rows x 4 cols. Everything is computed from the viewer's OWN creatives
  // (the API scopes a maker to createdById), so a creative only ever sees
  // their own numbers here.
  const craftSub = (value: number | null | undefined, floor: number | null | undefined) =>
    value == null ? 'not measured' : floor != null ? `vs ${formatPercent(floor)} floor` : undefined;
  const rateSub = (value: number | null | undefined) => (value == null ? 'not measured' : undefined);
  const kpiTiles: Array<{ label: string; info: string; value: string; healthy?: boolean; sub?: string }> = [
    { label: 'Hook', info: '3-second plays ÷ video impressions across your creatives.', value: formatPercent(data?.kpis.hookRate?.value ?? null), healthy: floorHealthy(data?.kpis.hookRate?.value, floors?.values.hookRate), sub: craftSub(data?.kpis.hookRate?.value, floors?.values.hookRate) },
    { label: 'Hold', info: 'ThruPlays ÷ 3-second plays.', value: formatPercent(data?.kpis.holdRate?.value ?? null), healthy: floorHealthy(data?.kpis.holdRate?.value, floors?.values.holdRate), sub: craftSub(data?.kpis.holdRate?.value, floors?.values.holdRate) },
    { label: 'Completion', info: 'ThruPlays ÷ video impressions.', value: formatPercent(data?.kpis.completionRate?.value ?? null), healthy: floorHealthy(data?.kpis.completionRate?.value, floors?.values.completionRate), sub: craftSub(data?.kpis.completionRate?.value, floors?.values.completionRate) },
    { label: 'CTR', info: 'Link clicks ÷ impressions.', value: formatPercent(data?.kpis.ctr?.value ?? null), healthy: floorHealthy(data?.kpis.ctr?.value, floors?.values.ctr), sub: craftSub(data?.kpis.ctr?.value, floors?.values.ctr) },
    { label: 'Orders', info: 'Attributed orders across your linked ads in the period.', value: formatCount(data?.kpis.orders?.value ?? null), sub: 'attributed in period' },
    { label: 'Ad Spent', info: 'Meta spend on your linked ads in the period.', value: formatCurrency(data?.kpis.adSpend?.value ?? null), sub: 'linked ads' },
    { label: 'MAR% (AR%)', info: 'Ad spend ÷ attributed revenue — same AR % formula as Business Performance.', value: formatPercent(data?.kpis.mar?.value ?? null), sub: rateSub(data?.kpis.mar?.value) ?? 'spend ÷ revenue' },
    { label: 'Video Output', info: 'Creatives you enrolled in the period.', value: formatCount(data?.kpis.output?.value ?? null), sub: 'enrolled in period' },
    { label: 'Delivered', info: 'Delivered orders across your linked ads.', value: formatCount(data?.kpis.delivered?.value ?? null), sub: 'orders delivered' },
    { label: 'Cancellation Rate', info: 'Cancelled ÷ resolved (delivered + cancelled + RTS).', value: formatPercent(data?.kpis.cancellationRate?.value ?? null), sub: rateSub(data?.kpis.cancellationRate?.value) ?? 'of resolved orders' },
    { label: 'RTS Rate', info: 'RTS ÷ resolved (delivered + cancelled + RTS).', value: formatPercent(data?.kpis.rtsRate?.value ?? null), sub: rateSub(data?.kpis.rtsRate?.value) ?? 'of resolved orders' },
    { label: 'Delivery Rate', info: 'Delivered ÷ resolved (delivered + cancelled + RTS).', value: formatPercent(data?.kpis.deliveryRate?.value ?? null), sub: rateSub(data?.kpis.deliveryRate?.value) ?? 'of resolved orders' },
  ];

  return (
    <div className="mx-auto max-w-screen-xl">
      <PageHeader
        title={data?.permissions.canReadAll ? 'Creative Dashboard' : 'My Creative Dashboard'}
        description={data?.permissions.canReadAll
          ? 'Output, approval flow, craft signals, and linked performance across the team.'
          : 'Your output, approval progress, craft signals, and linked performance in one focused view.'}
        breadcrumbs="Creative Workspace"
      />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-56 flex-[1_1_16rem]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
            <input
              value={controller.searchText}
              onChange={(event) => controller.setSearchText(event.target.value)}
              placeholder="Search creative or creator"
              className="input h-9 w-full rounded-lg border-border/60 py-0 pl-8 pr-3 text-xs"
            />
          </label>
          <VideoRegistryDateRangePicker compact startDate={params.startDate} endDate={params.endDate} onChange={(range) => controller.updateParams(range)} />
          <select value={params.storeId} onChange={(event) => controller.updateParams({ storeId: event.target.value })} className={`${selectClass} w-36`} aria-label="Filter by store">
            <option value="">All stores</option>
            {data?.filters.stores.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select value={params.kind} onChange={(event) => controller.updateParams({ kind: event.target.value as typeof params.kind })} className={`${selectClass} w-28`} aria-label="Filter by type">
            <option value="">All types</option>
            <option value="VIDEO">Video</option>
            <option value="STATIC">Static</option>
          </select>
          {data?.permissions.canReadAll ? (
            <select value={params.creatorId} onChange={(event) => controller.updateParams({ creatorId: event.target.value })} className={`${selectClass} w-36`} aria-label="Filter by creator">
              <option value="">All creators</option>
              {data.filters.creators.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
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

        {data?.warnings.length ? (
          <div className="grid gap-2 rounded-xl border border-warning/30 bg-warning-soft/40 px-4 py-3 dark:bg-warning/10">
            {data.warnings.map((warning) => (
              <div key={warning.code} className="flex items-start gap-2 text-sm-custom text-foreground">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <span>{warning.message}</span>
              </div>
            ))}
          </div>
        ) : null}

        {/* Call deck: hidden while the API reports the capability unavailable — no call-tracking data source exists in this ERP yet. */}

        <CreativeScorecard scorecard={data?.scorecard} floors={floors} isLoading={controller.isLoading} kpiTiles={kpiTiles} />

        <section className="panel panel-content shadow-card transition-colors hover:border-border/40">
          <PanelHeader
            title={data?.permissions.canReadAll ? 'Leaderboard' : 'My creative performance'}
            description="Ranked by Creative Score — the funnel the editor controls. Bottleneck names the first step that broke."
            right={(
              <>
                {data?.permissions.canViewMoney ? (
                  <div className="flex h-9 rounded-lg border border-border/60 bg-secondary/20 p-0.5 dark:bg-background-secondary" role="group" aria-label="Leaderboard lens">
                    <button type="button" onClick={() => controller.updateParams({ lens: 'CREATIVE', sortKey: 'creativeScore' })} className={`rounded-md px-2.5 text-xs font-semibold transition ${params.lens === 'CREATIVE' ? 'bg-surface text-primary shadow-sm' : 'text-muted'}`}>Creative</button>
                    <button type="button" onClick={() => controller.updateParams({ lens: 'BUSINESS', sortKey: 'netMargin' })} className={`rounded-md px-2.5 text-xs font-semibold transition ${params.lens === 'BUSINESS' ? 'bg-surface text-primary shadow-sm' : 'text-muted'}`}>Business</button>
                  </div>
                ) : null}
                <select
                  value={`${params.sortKey}:${params.sortDirection}`}
                  onChange={(event) => {
                    const [sortKey, sortDirection] = event.target.value.split(':') as [OverviewSortKey, 'asc' | 'desc'];
                    controller.updateParams({ sortKey, sortDirection });
                  }}
                  className={`${selectClass} w-44`}
                  aria-label="Sort leaderboard"
                >
                  {params.lens === 'CREATIVE' ? (
                    <>
                      <option value="creativeScore:desc">Creative score</option>
                      <option value="hookRate:desc">Hook rate</option>
                      <option value="holdRate:desc">Hold rate</option>
                      <option value="ctr:desc">CTR</option>
                    </>
                  ) : (
                    <>
                      <option value="netMargin:desc">Net margin</option>
                      <option value="orders:desc">Orders</option>
                      <option value="spend:desc">Spend</option>
                    </>
                  )}
                  <option value="code:asc">Code A–Z</option>
                </select>
              </>
            )}
          />

          <CreativeLeaderboard
            items={data?.items}
            lens={params.lens}
            isLoading={controller.isLoading}
            sortKey={params.sortKey}
            sortDirection={params.sortDirection}
            onSort={(sortKey) => controller.updateParams({
              sortKey,
              sortDirection: params.sortKey === sortKey && params.sortDirection === 'desc' ? 'asc' : 'desc',
            })}
            onSelect={setSelected}
          />

          {data ? (
            <div className="flex items-center justify-between border-t border-border/40 px-5 py-3">
              <p className="text-sm-custom text-muted">
                Showing {data.pagination.total === 0 ? 0 : (data.pagination.page - 1) * data.pagination.pageSize + 1}–{Math.min(data.pagination.page * data.pagination.pageSize, data.pagination.total)} of {data.pagination.total}
              </p>
              <div className="flex items-center gap-2">
                <button type="button" disabled={data.pagination.page <= 1} onClick={() => controller.updateParams({ page: data.pagination.page - 1 })} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 text-muted transition hover:border-border hover:text-foreground disabled:opacity-40" aria-label="Previous page">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs font-semibold text-foreground tabular-nums">{data.pagination.page} / {data.pagination.totalPages}</span>
                <button type="button" disabled={data.pagination.page >= data.pagination.totalPages} onClick={() => controller.updateParams({ page: data.pagination.page + 1 })} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 text-muted transition hover:border-border hover:text-foreground disabled:opacity-40" aria-label="Next page">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}
        </section>


        {/* Landing pages: hidden while the API reports the capability unavailable — landing-page performance is not tracked by this ERP yet. */}
      </div>

      {selected ? <DetailDialog item={selected} showAssets={!data?.permissions.canReadAll} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}
