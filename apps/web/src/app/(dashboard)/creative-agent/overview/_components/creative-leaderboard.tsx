'use client';

import { ArrowDown, ArrowUp, BarChart3 } from 'lucide-react';
import type { CreativeOverviewItem, OverviewLens, OverviewSortKey } from '../_types/creative-overview';
import {
  formatCount as count,
  formatCurrency as currency,
  formatDecimal as decimal,
  formatPercent as percent,
  PILL_TONE_CLASS,
} from '../_utils/creative-overview-format';
import { DashboardLoadingBar } from '../../_components/dashboard-loading-state';


/** Scale is the good outcome, kill the bad one, refresh the work-to-do middle. */
const VERDICT_CLASS: Record<string, string> = {
  SCALE: 'border-success/30 bg-success-soft/40 text-success',
  REFRESH: 'border-warning/30 bg-warning-soft/60 text-warning',
  KILL: 'border-destructive/30 bg-destructive-soft/40 text-destructive',
  TESTING: 'pill-neutral',
};

const VERDICT_LABEL: Record<string, string> = {
  SCALE: 'Scale',
  REFRESH: 'Refresh',
  KILL: 'Kill',
  TESTING: 'Testing',
};

type Column = {
  key: string;
  label: string;
  lens: 'SHARED' | OverviewLens;
  sortKey?: OverviewSortKey;
  width: string;
  align?: 'left' | 'right';
  render: (item: CreativeOverviewItem) => React.ReactNode;
};

const COLUMNS: Column[] = [
  { key: 'rank', label: 'Rank', lens: 'SHARED', width: 'w-20', render: (item) => item.testing ? <span className={PILL_TONE_CLASS.warning}>Testing</span> : item.medal ? <span className="text-lg" aria-label={`Rank ${item.rank}`}>{['🥇', '🥈', '🥉'][item.medal - 1]}</span> : <span className="font-semibold">{item.rank ?? '—'}</span> },
  { key: 'ad', label: 'Ad', lens: 'SHARED', sortKey: 'code', width: 'min-w-[280px]', render: (item) => <div className="max-w-[320px]"><div className="flex items-center gap-2"><span className="font-semibold text-foreground">{item.title}</span>{item.adCount > 1 ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs-tight font-bold text-primary">×{item.adCount}</span> : null}{item.isWinner ? <span className={PILL_TONE_CLASS.success} title="10+ orders at or under the AR% ceiling">Winner</span> : null}</div><p className="mt-0.5 font-mono text-xs font-bold text-primary">{item.code}</p>{/* "Linked" and "has Meta insight rows" are different things: an ad can be
    linked and still have no insight in this range, and calling that
    "no linked Meta ad" sends someone hunting for a link that already exists. */}
<p className="mt-1 truncate text-xs text-muted" title={item.topAd ? `${item.topAd.campaignName} › ${item.topAd.adsetId} › ${item.topAd.adName}` : undefined}>{item.topAd ? `${item.topAd.campaignName} › ${item.topAd.adsetId}` : item.linked ? `Linked · no Meta insight in range` : 'No linked Meta ad'}</p></div> },
  { key: 'orders', label: 'Orders', lens: 'SHARED', sortKey: 'orders', width: 'w-24', align: 'right', render: (item) => count(item.metrics.orders) },
  // AR% is a cost ratio: lower is better, so the healthy colour is the low end.
  { key: 'arPct', label: 'AR%', lens: 'SHARED', sortKey: 'arPct', width: 'w-24', align: 'right', render: (item) => item.metrics.arPct == null ? '—' : <span className={item.isWinner ? 'font-semibold text-success' : ''}>{percent(item.metrics.arPct)}</span> },
  { key: 'adSpent', label: 'Ad Spent', lens: 'SHARED', sortKey: 'spend', width: 'w-28', align: 'right', render: (item) => currency(item.metrics.spend) },
  // MAR% is spend ÷ gross attributed revenue (the Business Performance
  // convention); AR% above is net of cancelled/RTS money. Both are shown so the
  // two screens can be read together.
  { key: 'mar', label: 'MAR%', lens: 'SHARED', sortKey: 'mar', width: 'w-24', align: 'right', render: (item) => percent(item.metrics.mar) },
  { key: 'delivered', label: 'Delivered', lens: 'SHARED', sortKey: 'deliveredOrders', width: 'w-24', align: 'right', render: (item) => count(item.metrics.deliveredOrders) },
  { key: 'cancelRate', label: 'Cancel rate', lens: 'SHARED', sortKey: 'cancellationRate', width: 'w-28', align: 'right', render: (item) => percent(item.metrics.cancellationRate) },
  { key: 'rtsRate', label: 'RTS rate', lens: 'SHARED', sortKey: 'rtsRate', width: 'w-24', align: 'right', render: (item) => percent(item.metrics.rtsRate) },
  { key: 'delivery', label: 'Delivery rate', lens: 'SHARED', sortKey: 'deliveryRate', width: 'w-28', align: 'right', render: (item) => percent(item.metrics.deliveryRate) },
  { key: 'hook', label: 'Hook', lens: 'SHARED', sortKey: 'hookRate', width: 'w-24', align: 'right', render: (item) => item.kind === 'STATIC' ? <span className="text-xs text-muted">Static</span> : percent(item.metrics.hookRate) },
  { key: 'hold', label: 'Hold', lens: 'SHARED', sortKey: 'holdRate', width: 'w-24', align: 'right', render: (item) => item.kind === 'STATIC' ? '—' : percent(item.metrics.holdRate) },
  { key: 'ctr', label: 'CTR', lens: 'SHARED', sortKey: 'ctr', width: 'w-24', align: 'right', render: (item) => percent(item.metrics.ctr) },
  { key: 'realCpp', label: 'Real CPP', lens: 'BUSINESS', sortKey: 'costPerOrder', width: 'w-32', align: 'right', render: (item) => currency(item.metrics.costPerOrder) },
  { key: 'deliveredCpp', label: 'Delivered CPP', lens: 'BUSINESS', sortKey: 'deliveredCostPerOrder', width: 'w-36', align: 'right', render: (item) => currency(item.metrics.deliveredCostPerOrder) },
  { key: 'cancel', label: 'Cancel', lens: 'BUSINESS', sortKey: 'cancellationRate', width: 'w-24', align: 'right', render: (item) => percent(item.metrics.cancellationRate) },
  { key: 'rts', label: 'RTS', lens: 'BUSINESS', sortKey: 'rtsRate', width: 'w-24', align: 'right', render: (item) => percent(item.metrics.rtsRate) },
  { key: 'profit', label: 'Net profit', lens: 'BUSINESS', sortKey: 'netMargin', width: 'w-32', align: 'right', render: (item) => <span className={(item.metrics.netMargin ?? 0) < 0 ? 'font-semibold text-destructive' : 'font-semibold text-success'}>{currency(item.metrics.netMargin)}</span> },
  { key: 'frequency', label: 'Frequency', lens: 'BUSINESS', sortKey: 'frequency', width: 'w-28', align: 'right', render: (item) => decimal(item.metrics.frequency) },
  { key: 'winner', label: 'Winner score', lens: 'BUSINESS', width: 'w-36', align: 'right', render: () => <span className="text-xs text-muted">Not configured</span> },
  { key: 'decision', label: 'Decision', lens: 'BUSINESS', width: 'w-36', render: () => <span className={PILL_TONE_CLASS.neutral}>Not configured</span> },
  // Orders / landing-page views — the same ratio the advertising dashboard
  // calls CVR, so it carries that name here too rather than a second label for
  // one number.
  { key: 'cvr', label: 'CVR', lens: 'CREATIVE', sortKey: 'conversionRate', width: 'w-24', align: 'right', render: (item) => percent(item.metrics.conversionRate) },
  { key: 'score', label: 'C-Score', lens: 'CREATIVE', sortKey: 'creativeScore', width: 'w-28', align: 'right', render: (item) => item.metrics.creativeScore == null ? '—' : item.metrics.creativeScore.toFixed(1) },
  // The payoff column. The reason lives in the tooltip so the verdict can be
  // scanned down the page while the "why" stays one hover away.
  { key: 'verdict', label: 'Verdict', lens: 'CREATIVE', width: 'w-32', render: (item) => item.metrics.verdict
    ? <span className={`pill ${VERDICT_CLASS[item.metrics.verdict] ?? VERDICT_CLASS.TESTING}`} title={item.metrics.verdictReason ?? undefined}>{VERDICT_LABEL[item.metrics.verdict] ?? item.metrics.verdict}</span>
    : <span className="text-muted">—</span> },
];

export function CreativeLeaderboard({ items, lens, isLoading, sortKey, sortDirection, onSort, onSelect }: {
  items: CreativeOverviewItem[] | undefined;
  lens: OverviewLens;
  isLoading: boolean;
  sortKey: OverviewSortKey;
  sortDirection: 'asc' | 'desc';
  onSort: (key: OverviewSortKey) => void;
  onSelect: (item: CreativeOverviewItem) => void;
}) {
  const columns = COLUMNS.filter((column) => column.lens === 'SHARED' || column.lens === lens);
  return (
    <div className="overflow-x-auto">
      <table className={`w-full table-auto text-left ${lens === 'BUSINESS' ? 'min-w-[1900px]' : 'min-w-[1260px]'}`}>
        <thead className="border-b border-border/60 text-xs-tight font-semibold uppercase tracking-wide text-faint">
          <tr>{columns.map((column) => <th key={column.key} className={`${column.width} whitespace-nowrap px-3 py-3 ${column.align === 'right' ? 'text-right' : ''} ${column.key === 'rank' ? 'sticky left-0 z-20 bg-surface' : ''} ${column.key === 'ad' ? 'sticky left-20 z-20 bg-surface' : ''}`} aria-sort={column.sortKey === sortKey ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}>{column.sortKey ? <button type="button" className={`inline-flex items-center gap-1 ${column.align === 'right' ? 'w-full justify-end' : ''}`} onClick={() => onSort(column.sortKey as OverviewSortKey)}>{column.label}{column.sortKey === sortKey ? sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" /> : null}</button> : column.label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {isLoading ? Array.from({ length: 5 }, (_, rowIndex) => (
            <tr key={rowIndex} className="animate-pulse" aria-hidden="true">
              {columns.map((column, columnIndex) => (
                <td
                  key={column.key}
                  className={`px-3 py-4 ${column.key === 'rank' ? 'sticky left-0 z-10 bg-surface' : ''} ${column.key === 'ad' ? 'sticky left-20 z-10 bg-surface' : ''}`}
                >
                  <DashboardLoadingBar className={`h-3 ${columnIndex === 1 ? 'w-48' : 'ml-auto w-12'}`} />
                </td>
              ))}
            </tr>
          )) : items?.length ? items.map((item) => <tr key={item.id} onClick={() => onSelect(item)} className="cursor-pointer bg-surface transition hover:bg-background dark:hover:bg-background-secondary">{columns.map((column) => <td key={column.key} className={`px-3 py-2.5 text-sm-custom text-foreground ${column.align === 'right' ? 'text-right tabular-nums' : ''} ${column.key === 'rank' ? 'sticky left-0 z-10 bg-inherit' : ''} ${column.key === 'ad' ? 'sticky left-20 z-10 bg-inherit' : ''}`}>{column.render(item)}</td>)}</tr>) : <tr><td colSpan={columns.length} className="px-4 py-16 text-center"><BarChart3 className="mx-auto h-7 w-7 text-muted" /><p className="mt-2 font-semibold text-foreground">No creatives in this scope</p><p className="mt-1 text-sm text-muted">Adjust the date or filters to expand the overview.</p></td></tr>}
        </tbody>
      </table>
      {isLoading ? <span className="sr-only" role="status">Loading creative performance…</span> : null}
    </div>
  );
}
