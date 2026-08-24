'use client';

import { ArrowDown, ArrowUp, BarChart3 } from 'lucide-react';
import type { CreativeOverviewItem, OverviewLens, OverviewSortKey } from '../_types/creative-overview';

const percent = (value: number | null | undefined) => value == null ? '—' : `${(value * 100).toFixed(1)}%`;
const count = (value: number | null | undefined) => value == null ? '—' : new Intl.NumberFormat('en-PH').format(value);
const decimal = (value: number | null | undefined) => value == null ? '—' : value.toFixed(2);
const currency = (value: number | null | undefined) => value == null ? '—' : new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(value);
const titleCase = (value: string) => value.toLowerCase().replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());

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
  { key: 'rank', label: 'Rank', lens: 'SHARED', width: 'w-20', render: (item) => item.testing ? <span className="rounded-full bg-warning/10 px-2 py-1 text-[11px] font-bold text-warning">Testing</span> : item.medal ? <span className="text-lg" aria-label={`Rank ${item.rank}`}>{['🥇', '🥈', '🥉'][item.medal - 1]}</span> : <span className="font-semibold">{item.rank ?? '—'}</span> },
  { key: 'ad', label: 'Ad', lens: 'SHARED', sortKey: 'code', width: 'min-w-[280px]', render: (item) => <div className="max-w-[320px]"><div className="flex items-center gap-2"><span className="font-semibold text-foreground">{item.title}</span>{item.adCount > 1 ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">×{item.adCount}</span> : null}</div><p className="mt-0.5 font-mono text-xs font-bold text-primary">{item.code}</p><p className="mt-1 truncate text-xs text-muted" title={item.topAd ? `${item.topAd.campaignName} › ${item.topAd.adsetId} › ${item.topAd.adName}` : undefined}>{item.topAd ? `${item.topAd.campaignName} › ${item.topAd.adsetId}` : 'No linked Meta ad'}</p></div> },
  { key: 'orders', label: 'Orders', lens: 'SHARED', sortKey: 'orders', width: 'w-24', align: 'right', render: (item) => count(item.metrics.orders) },
  { key: 'delivery', label: 'Delivery', lens: 'SHARED', sortKey: 'deliveryRate', width: 'w-28', align: 'right', render: (item) => percent(item.metrics.deliveryRate) },
  { key: 'hook', label: 'Hook', lens: 'SHARED', sortKey: 'hookRate', width: 'w-24', align: 'right', render: (item) => item.kind === 'STATIC' ? <span className="text-xs text-muted">Static</span> : percent(item.metrics.hookRate) },
  { key: 'hold', label: 'Hold', lens: 'SHARED', sortKey: 'holdRate', width: 'w-24', align: 'right', render: (item) => item.kind === 'STATIC' ? '—' : percent(item.metrics.holdRate) },
  { key: 'ctr', label: 'CTR', lens: 'SHARED', sortKey: 'ctr', width: 'w-24', align: 'right', render: (item) => percent(item.metrics.ctr) },
  { key: 'realCpp', label: 'Real CPP', lens: 'BUSINESS', sortKey: 'costPerOrder', width: 'w-32', align: 'right', render: (item) => currency(item.metrics.costPerOrder) },
  { key: 'deliveredCpp', label: 'Delivered CPP', lens: 'BUSINESS', sortKey: 'deliveredCostPerOrder', width: 'w-36', align: 'right', render: (item) => currency(item.metrics.deliveredCostPerOrder) },
  { key: 'cancel', label: 'Cancel', lens: 'BUSINESS', sortKey: 'cancellationRate', width: 'w-24', align: 'right', render: (item) => percent(item.metrics.cancellationRate) },
  { key: 'rts', label: 'RTS', lens: 'BUSINESS', sortKey: 'rtsRate', width: 'w-24', align: 'right', render: (item) => percent(item.metrics.rtsRate) },
  { key: 'profit', label: 'Net profit', lens: 'BUSINESS', sortKey: 'netMargin', width: 'w-32', align: 'right', render: (item) => <span className={(item.metrics.netMargin ?? 0) < 0 ? 'font-semibold text-danger' : 'font-semibold text-success'}>{currency(item.metrics.netMargin)}</span> },
  { key: 'spend', label: 'Spend', lens: 'BUSINESS', sortKey: 'spend', width: 'w-28', align: 'right', render: (item) => currency(item.metrics.spend) },
  { key: 'frequency', label: 'Frequency', lens: 'BUSINESS', sortKey: 'frequency', width: 'w-28', align: 'right', render: (item) => decimal(item.metrics.frequency) },
  { key: 'winner', label: 'Winner score', lens: 'BUSINESS', width: 'w-36', align: 'right', render: () => <span className="text-xs text-muted">Not configured</span> },
  { key: 'decision', label: 'Decision', lens: 'BUSINESS', width: 'w-36', render: () => <span className="rounded-full bg-background-secondary px-2 py-1 text-[11px] font-semibold text-muted">Not configured</span> },
  { key: 'lpRate', label: 'LP rate', lens: 'CREATIVE', sortKey: 'lpRate', width: 'w-28', align: 'right', render: (item) => percent(item.metrics.lpRate) },
  { key: 'orderRate', label: 'Order rate', lens: 'CREATIVE', sortKey: 'conversionRate', width: 'w-28', align: 'right', render: (item) => percent(item.metrics.conversionRate) },
  { key: 'score', label: 'C-Score', lens: 'CREATIVE', sortKey: 'creativeScore', width: 'w-28', align: 'right', render: (item) => item.metrics.creativeScore == null ? '—' : item.metrics.creativeScore.toFixed(1) },
  { key: 'bottleneck', label: 'Bottleneck', lens: 'CREATIVE', width: 'w-32', render: (item) => item.metrics.bottleneck ? <span className="rounded-full bg-danger/10 px-2 py-1 text-[11px] font-bold text-danger">{titleCase(item.metrics.bottleneck)}</span> : <span className="text-muted">—</span> },
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
      <table className={`w-full table-auto text-left ${lens === 'BUSINESS' ? 'min-w-[1900px]' : 'min-w-[1280px]'}`}>
        <thead className="bg-background-secondary text-xs font-bold uppercase tracking-wider text-muted">
          <tr>{columns.map((column) => <th key={column.key} className={`${column.width} whitespace-nowrap px-3 py-3 ${column.align === 'right' ? 'text-right' : ''} ${column.key === 'rank' ? 'sticky left-0 z-20 bg-background-secondary' : ''} ${column.key === 'ad' ? 'sticky left-20 z-20 bg-background-secondary' : ''}`} aria-sort={column.sortKey === sortKey ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}>{column.sortKey ? <button type="button" className={`inline-flex items-center gap-1 ${column.align === 'right' ? 'w-full justify-end' : ''}`} onClick={() => onSort(column.sortKey as OverviewSortKey)}>{column.label}{column.sortKey === sortKey ? sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" /> : null}</button> : column.label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border">
          {isLoading && !items ? <tr><td colSpan={columns.length} className="px-4 py-16 text-center text-muted">Loading creative intelligence…</td></tr> : items?.length ? items.map((item) => <tr key={item.id} onClick={() => onSelect(item)} className="cursor-pointer bg-surface transition hover:bg-background-secondary">{columns.map((column) => <td key={column.key} className={`px-3 py-3 text-sm text-foreground ${column.align === 'right' ? 'text-right tabular-nums' : ''} ${column.key === 'rank' ? 'sticky left-0 z-10 bg-inherit' : ''} ${column.key === 'ad' ? 'sticky left-20 z-10 bg-inherit' : ''}`}>{column.render(item)}</td>)}</tr>) : <tr><td colSpan={columns.length} className="px-4 py-16 text-center"><BarChart3 className="mx-auto h-7 w-7 text-muted" /><p className="mt-2 font-semibold text-foreground">No creatives in this scope</p><p className="mt-1 text-sm text-muted">Adjust the date or filters to expand the overview.</p></td></tr>}
        </tbody>
      </table>
    </div>
  );
}
