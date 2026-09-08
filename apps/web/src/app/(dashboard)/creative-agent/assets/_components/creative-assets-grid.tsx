'use client';

import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DriveThumbnail } from '../../video-registry/_components/drive-thumbnail';
import { RegistryStatusPill } from '../../video-registry/_components/registry-status-pill';
import { formatCompactCurrency, formatRate } from '../../video-registry/_utils/video-registry-formatters';
import { CopyCodeButton } from './copy-code-button';
import type { CreativeAsset } from '../_types/creative-assets';

export function CreativeAssetsGrid({ items, onReview }: { items: CreativeAsset[]; onReview: (asset: CreativeAsset) => void }) {
  return <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">{items.map((item) => (
    <article key={item.id} className="panel overflow-hidden">
      <div className="p-3 pb-0"><DriveThumbnail mediaUrl={item.mediaUrl} title={item.title} cachedThumbnailUrl={item.thumbnailUrl} isVideo={item.thumbnailIsVideo} onClick={() => onReview(item)} /></div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><h3 className="truncate font-semibold text-foreground">{item.title}</h3><p className="mt-1 flex items-center gap-1 font-mono text-xs font-semibold text-primary">{item.code}<CopyCodeButton code={item.code} title={item.title} creator={item.creator.adName ?? item.creator.name} customId={item.customId} /></p></div>
          <Button size="sm" variant="ghost" iconLeft={<MessageSquare className="h-4 w-4" />} onClick={() => onReview(item)}>Open</Button>
        </div>
        <p className="mt-2 truncate text-xs text-muted">{item.creator.name} · {item.store.name}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2"><RegistryStatusPill type="performance" status={item.performanceStatus} />{item.revisionState !== 'NONE' ? <RegistryStatusPill type="revision" status={item.revisionState} /> : null}<span className="pill border border-border bg-background-secondary text-muted">{item.kind === 'VIDEO' ? 'Video' : 'Static'}</span>{item.linked ? <span className="pill border-none bg-success-soft/40 text-success dark:bg-success/15">Meta linked</span> : <span className="pill pill-neutral">Not linked</span>}</div>
        {/* A static has no hook or hold to measure, so it reports reach instead. */}
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
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted"><span>{item.commentCount} feedback {item.commentCount === 1 ? 'message' : 'messages'}</span><span>{item.submittedAt ? `Submitted ${new Date(item.submittedAt).toLocaleDateString('en-PH')}` : 'Not submitted'}</span></div>
      </div>
    </article>
  ))}</div>;
}
