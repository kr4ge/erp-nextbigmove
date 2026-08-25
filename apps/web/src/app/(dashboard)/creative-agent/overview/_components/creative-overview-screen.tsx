'use client';

import { useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Info, Search, X } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { VideoRegistryDateRangePicker } from '../../video-registry/_components/video-registry-date-range-picker';
import { useCreativeOverviewController } from '../_hooks/use-creative-overview-controller';
import type { CreativeOverviewItem, OverviewMetric, OverviewSortKey } from '../_types/creative-overview';
import { CreativeLeaderboard } from './creative-leaderboard';

const selectClass = 'h-10 rounded-xl border border-border bg-surface px-3 text-sm-custom font-semibold text-foreground outline-none transition hover:border-primary/30 focus:border-primary/40 focus:ring-2 focus:ring-primary/10';
const percent = (value: number | null | undefined) => value == null ? '—' : `${(value * 100).toFixed(1)}%`;
const number = (value: number | null | undefined) => value == null ? '—' : new Intl.NumberFormat('en-PH').format(value);

function KpiCard({ title, metric, formatter = number, note }: { title: string; metric?: OverviewMetric; formatter?: (value: number | null | undefined) => string; note: string }) {
  return (
    <article className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-muted">{title}</p>
      <p className="mt-2 text-2xl font-bold text-foreground">{formatter(metric?.value)}</p>
      <p className="mt-1 text-xs text-muted">{note}</p>
    </article>
  );
}

function DetailDialog({ item, onClose }: { item: CreativeOverviewItem; onClose: () => void }) {
  const metrics = [
    ['Hook rate', percent(item.metrics.hookRate)], ['Hold rate', percent(item.metrics.holdRate)],
    ['Completion', percent(item.metrics.completionRate)], ['CTR', percent(item.metrics.ctr)],
    ['LP rate', percent(item.metrics.lpRate)], ['Order rate', percent(item.metrics.conversionRate)],
    ['Impressions', number(item.metrics.impressions)], ['Link clicks', number(item.metrics.linkClicks)],
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" onMouseDown={onClose}>
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-surface shadow-xl" role="dialog" aria-modal="true" aria-label={`${item.code} metric details`} onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-border p-5">
          <div><p className="font-mono text-sm font-bold text-primary">{item.code}</p><h2 className="mt-1 text-xl font-semibold text-foreground">{item.title}</h2><p className="mt-1 text-sm text-muted">{item.store.name} · {item.creator.name}</p></div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-background-secondary hover:text-foreground" aria-label="Close details"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">{metrics.map(([name, value]) => <div key={name} className="rounded-xl bg-background-secondary p-3"><p className="text-xs text-muted">{name}</p><p className="mt-1 font-semibold text-foreground">{value}</p></div>)}</div>
        <div className="border-t border-border px-5 py-4 text-sm text-muted">
          Linked Meta ads: <span className="font-semibold text-foreground">{item.adCount}</span>
          {item.metaAdIds.length ? <p className="mt-1 break-all font-mono text-xs text-foreground">{item.metaAdIds.join(', ')}</p> : null}
        </div>
      </div>
    </div>
  );
}

export function CreativeOverviewScreen() {
  const controller = useCreativeOverviewController();
  const { data, params } = controller;
  const [selected, setSelected] = useState<CreativeOverviewItem | null>(null);
  const creativeKpis = [
    ['Hook', data?.kpis.hookRate, percent, '3-second plays ÷ measured impressions'],
    ['Hold', data?.kpis.holdRate, percent, 'ThruPlays ÷ measured 3-second plays'],
    ['Completion', data?.kpis.completionRate, percent, 'ThruPlays ÷ measured impressions'],
    ['CTR', data?.kpis.ctr, percent, 'Link clicks ÷ impressions'],
    ['CVR', data?.kpis.cvr, percent, 'Attributed orders ÷ link clicks'],
    ['Output', data?.kpis.output, number, 'Creatives enrolled in range'],
    ['Approval', data?.kpis.approvalRate, percent, 'Approved ÷ decided creatives'],
    ['Turnaround', data?.kpis.medianTurnaroundHours, (value: number | null | undefined) => value == null ? '—' : `${value}h`, 'Median submission to first approval'],
  ] as const;

  return (
    <div>
      <PageHeader title="Creative Agent" description="Creative production quality and linked business performance in one decision-ready view." breadcrumbs="Creative Agent / Overview" />
      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-3 sm:px-4">
          <label className="relative min-w-60 flex-[1_1_18rem]"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input value={controller.searchText} onChange={(event) => controller.setSearchText(event.target.value)} placeholder="Search creative or creator" className="input h-10 w-full rounded-xl pl-9 text-sm-custom" /></label>
          <VideoRegistryDateRangePicker startDate={params.startDate} endDate={params.endDate} onChange={(range) => controller.updateParams(range)} />
          <select value={params.storeId} onChange={(event) => controller.updateParams({ storeId: event.target.value })} className={`${selectClass} w-40`} aria-label="Filter by store"><option value="">All stores</option>{data?.filters.stores.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
          <select value={params.kind} onChange={(event) => controller.updateParams({ kind: event.target.value as typeof params.kind })} className={`${selectClass} w-32`} aria-label="Filter by type"><option value="">All types</option><option value="VIDEO">Video</option><option value="STATIC">Static</option></select>
          {data?.permissions.canReadAll ? <select value={params.creatorId} onChange={(event) => controller.updateParams({ creatorId: event.target.value })} className={`${selectClass} w-40`} aria-label="Filter by creator"><option value="">All creators</option>{data.filters.creators.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : null}
        </div>

        {controller.error ? <div className="m-4 rounded-xl border border-danger/20 bg-danger/5 p-5 text-center"><AlertTriangle className="mx-auto h-6 w-6 text-danger" /><p className="mt-2 font-semibold text-foreground">Overview could not load</p><p className="mt-1 text-sm text-muted">{controller.error}</p><button type="button" onClick={() => void controller.retry()} className="btn btn-sm btn-secondary mt-3">Try again</button></div> : null}
        {data?.warnings.length ? <div className="grid gap-2 border-b border-border bg-warning/5 px-4 py-3">{data.warnings.map((warning) => <div key={warning.code} className="flex items-start gap-2 text-sm text-foreground"><Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" /><span>{warning.message}</span></div>)}</div> : null}

        <div className="grid gap-3 bg-background-secondary p-4 sm:grid-cols-2 xl:grid-cols-4">
          {creativeKpis.map(([title, metric, formatter, note]) => <KpiCard key={title} title={title} metric={metric} formatter={formatter} note={note} />)}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border px-4 py-3"><div><h2 className="font-semibold text-foreground">Creative leaderboard</h2><p className="text-xs text-muted">Creative signals use Meta insights; business outcomes use reconciled Meta and POS order data.</p></div><div className="ml-auto flex flex-wrap items-center gap-2">{data?.permissions.canViewMoney ? <div className="flex h-10 rounded-xl border border-border bg-background-secondary p-1"><button type="button" onClick={() => controller.updateParams({ lens: 'CREATIVE', sortKey: 'creativeScore' })} className={`rounded-lg px-3 text-sm font-semibold ${params.lens === 'CREATIVE' ? 'bg-surface text-primary shadow-sm' : 'text-muted'}`}>Creative</button><button type="button" onClick={() => controller.updateParams({ lens: 'BUSINESS', sortKey: 'netMargin' })} className={`rounded-lg px-3 text-sm font-semibold ${params.lens === 'BUSINESS' ? 'bg-surface text-primary shadow-sm' : 'text-muted'}`}>Business</button></div> : null}<select value={`${params.sortKey}:${params.sortDirection}`} onChange={(event) => { const [sortKey, sortDirection] = event.target.value.split(':') as [OverviewSortKey, 'asc' | 'desc']; controller.updateParams({ sortKey, sortDirection }); }} className={`${selectClass} w-52`}>{params.lens === 'CREATIVE' ? <><option value="creativeScore:desc">Creative score</option><option value="hookRate:desc">Hook rate</option><option value="holdRate:desc">Hold rate</option><option value="ctr:desc">CTR</option></> : <><option value="netMargin:desc">Net margin</option><option value="orders:desc">Orders</option><option value="spend:desc">Spend</option></>}<option value="code:asc">Code A–Z</option></select></div></div>
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
        {data ? <div className="flex items-center justify-between border-t border-border px-4 py-3"><p className="text-sm text-muted">Showing {data.pagination.total === 0 ? 0 : (data.pagination.page - 1) * data.pagination.pageSize + 1}–{Math.min(data.pagination.page * data.pagination.pageSize, data.pagination.total)} of {data.pagination.total}</p><div className="flex items-center gap-2"><button type="button" disabled={data.pagination.page <= 1} onClick={() => controller.updateParams({ page: data.pagination.page - 1 })} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button><span className="text-sm font-semibold text-foreground">{data.pagination.page} / {data.pagination.totalPages}</span><button type="button" disabled={data.pagination.page >= data.pagination.totalPages} onClick={() => controller.updateParams({ page: data.pagination.page + 1 })} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border disabled:opacity-40" aria-label="Next page"><ChevronRight className="h-4 w-4" /></button></div></div> : null}
      </section>
      {selected ? <DetailDialog item={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}
