'use client';

import { ArrowDown, ArrowUp, ArrowUpDown, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { GetVideoRegistryParams, VideoRegistryItem, VideoRegistrySortKey } from '../_types/video-registry';
import { DriveThumbnail } from './drive-thumbnail';
import { RegistryStatusPill } from './registry-status-pill';
import { formatCompactCurrency, formatRate } from '../_utils/video-registry-formatters';

type Props = {
  items: VideoRegistryItem[];
  params: GetVideoRegistryParams;
  onSort: (key: VideoRegistrySortKey) => void;
  onReview: (item: VideoRegistryItem) => void;
};

function SortButton({ label, sortKey, params, onSort }: {
  label: string;
  sortKey: VideoRegistrySortKey;
  params: GetVideoRegistryParams;
  onSort: (key: VideoRegistrySortKey) => void;
}) {
  const active = params.sortKey === sortKey;
  const Icon = active ? (params.sortDirection === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <button type="button" onClick={() => onSort(sortKey)} className="inline-flex items-center gap-1 font-semibold text-muted transition hover:text-foreground">
      {label}<Icon className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  );
}

export function VideoRegistryTable({ items, params, onSort, onReview }: Props) {
  return (
    <div className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="bg-background-secondary/70">
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted">Preview</th>
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted"><SortButton label="Creative" sortKey="title" params={params} onSort={onSort} /></th>
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted">Creator / Store</th>
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted">Approval</th>
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted">Performance</th>
              <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted"><SortButton label="Spend" sortKey="spend" params={params} onSort={onSort} /></th>
              <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted"><SortButton label="Hook" sortKey="hookRate" params={params} onSort={onSort} /></th>
              <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted"><SortButton label="Hold" sortKey="holdRate" params={params} onSort={onSort} /></th>
              <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted"><SortButton label="CTR" sortKey="ctr" params={params} onSort={onSort} /></th>
              <th className="px-5 py-3 text-right"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="bg-surface">
            {items.map((item) => (
              <tr key={item.id} className="transition hover:bg-background-secondary/50 [&>td]:border-t [&>td]:border-border">
                <td className="px-5 py-3.5"><DriveThumbnail compact mediaUrl={item.mediaUrl} title={item.title} onClick={() => onReview(item)} /></td>
                <td className="max-w-xs px-5 py-3.5">
                  <button type="button" onClick={() => onReview(item)} className="block max-w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                    <span className="block truncate font-semibold text-foreground">{item.title}</span>
                    <span className="mt-1 flex items-center gap-2">
                      <code className="text-xs font-semibold text-primary">{item.code}</code>
                      <span className="pill border border-border bg-background-secondary text-muted">{item.kind === 'VIDEO' ? 'Video' : 'Static'}</span>
                    </span>
                  </button>
                  {item.aliases.length > 0 ? <span className="mt-1 block text-xs text-muted">Alias: {item.aliases.join(', ')}</span> : null}
                </td>
                <td className="px-5 py-3.5">
                  <span className="block whitespace-nowrap font-semibold text-foreground">{item.creator.name}</span>
                  <span className="mt-1 block max-w-48 truncate text-xs text-muted">{item.store.name}</span>
                </td>
                <td className="px-5 py-3.5"><RegistryStatusPill type="qc" status={item.qcStatus} /></td>
                <td className="px-5 py-3.5"><RegistryStatusPill type="performance" status={item.performanceStatus} /></td>
                <td className="whitespace-nowrap px-5 py-3.5 text-right font-semibold text-foreground">{formatCompactCurrency(item.metrics.spend)}</td>
                <td className="whitespace-nowrap px-5 py-3.5 text-right tabular-nums text-foreground">{formatRate(item.metrics.hookRate)}</td>
                <td className="whitespace-nowrap px-5 py-3.5 text-right tabular-nums text-foreground">{formatRate(item.metrics.holdRate)}</td>
                <td className="whitespace-nowrap px-5 py-3.5 text-right tabular-nums text-foreground">{formatRate(item.metrics.ctr)}</td>
                <td className="px-5 py-3.5 text-right">
                  <Button type="button" size="sm" variant="ghost" iconLeft={<Eye className="h-4 w-4" />} onClick={() => onReview(item)}>Review</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
