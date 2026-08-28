'use client';

import { Eye } from 'lucide-react';
import { CopyCodeButton } from "../../assets/_components/copy-code-button";
import { Button } from '@/components/ui/button';
import type { VideoRegistryItem } from '../_types/video-registry';
import { formatCompactCurrency, formatRate } from '../_utils/video-registry-formatters';
import { DriveThumbnail } from './drive-thumbnail';
import { RegistryStatusPill } from './registry-status-pill';

export function VideoRegistryGrid({ items, actionLabel, onReview }: { items: VideoRegistryItem[]; actionLabel: string; onReview: (item: VideoRegistryItem) => void }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <article key={item.id} className="panel overflow-hidden">
          <div className="p-3 pb-0">
            <DriveThumbnail mediaUrl={item.mediaUrl} title={item.title} cachedThumbnailUrl={item.thumbnailUrl} isVideo={item.thumbnailIsVideo} onClick={() => onReview(item)} />
          </div>
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-semibold text-foreground">{item.title}</h3>
                <div className="mt-1 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1"><code className="text-xs font-semibold text-primary">{item.code}</code><CopyCodeButton code={item.code} title={item.title} creator={item.creator.adName ?? item.creator.name} customId={item.customId} /></span>
                  <span className="pill border border-border bg-background-secondary text-muted">{item.kind === 'VIDEO' ? 'Video' : 'Static'}</span>
                </div>
              </div>
              <Button type="button" size="sm" variant="ghost" iconLeft={<Eye className="h-4 w-4" />} onClick={() => onReview(item)}>
                {actionLabel}
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted">{item.creator.name} · {item.store.name}</p>
            {/* One status badge. A revision pill appears only when Advertising
                has actually asked for something. */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <RegistryStatusPill type="performance" status={item.performanceStatus} />
              {item.revisionState !== 'NONE' ? (
                <RegistryStatusPill type="revision" status={item.revisionState} />
              ) : null}
            </div>
            <dl className="mt-4 grid grid-cols-4 gap-2 border-t border-border pt-4">
              {(item.kind === 'VIDEO' ? [
                ['Spend', formatCompactCurrency(item.metrics.spend)],
                ['Hook', formatRate(item.metrics.hookRate)],
                ['Hold', formatRate(item.metrics.holdRate)],
                ['CTR', formatRate(item.metrics.ctr)],
              ] : [
                ['Spend', formatCompactCurrency(item.metrics.spend)],
                ['CTR', formatRate(item.metrics.ctr)],
                ['Impressions', item.metrics.impressions.toLocaleString('en-PH')],
                ['Clicks', item.metrics.clicks.toLocaleString('en-PH')],
              ]).map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd className="mt-1 truncate text-sm font-semibold tabular-nums text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </article>
      ))}
    </div>
  );
}
