'use client';

import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DriveThumbnail } from '../../video-registry/_components/drive-thumbnail';
import { RegistryStatusPill } from '../../video-registry/_components/registry-status-pill';
import { CopyCodeButton } from './copy-code-button';
import type { CreativeAsset } from '../_types/creative-assets';

export function CreativeAssetsTable({ items, onReview }: { items: CreativeAsset[]; onReview: (asset: CreativeAsset) => void }) {
  return <div className="overflow-x-auto"><table className="min-w-full text-left text-sm">
    <thead className="bg-background-secondary/70"><tr>{['Preview', 'Creative', 'Creator / store', 'QC status', 'Meta link', 'Feedback', 'Submitted', ''].map((label) => <th key={label} className="whitespace-nowrap px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted">{label}</th>)}</tr></thead>
    <tbody className="bg-surface">{items.map((item) => <tr key={item.id} className="transition hover:bg-background-secondary/50 [&>td]:border-t [&>td]:border-border">
      <td className="px-5 py-3.5"><DriveThumbnail compact mediaUrl={item.mediaUrl} title={item.title} cachedThumbnailUrl={item.thumbnailUrl} isVideo={item.thumbnailIsVideo} onClick={() => onReview(item)} /></td>
      <td className="max-w-xs px-5 py-3.5"><button type="button" onClick={() => onReview(item)} className="block max-w-full text-left"><span className="block truncate font-semibold text-foreground">{item.title}</span><span className="mt-1 flex items-center gap-1"><code className="text-xs font-semibold text-primary">{item.code}</code><CopyCodeButton code={item.code} title={item.title} creator={item.creator.name} /></span></button></td>
      <td className="px-5 py-3.5"><span className="block whitespace-nowrap font-semibold text-foreground">{item.creator.name}</span><span className="mt-1 block whitespace-nowrap text-xs text-muted">{item.store.name}</span></td>
      <td className="px-5 py-3.5">{item.revisionState !== 'NONE' ? <RegistryStatusPill type="revision" status={item.revisionState} /> : <RegistryStatusPill type="performance" status={item.performanceStatus} />}</td>
      <td className="whitespace-nowrap px-5 py-3.5">{item.linked ? <span className="pill border-none bg-success-soft/40 text-success dark:bg-success/15">Linked</span> : <span className="pill pill-neutral">Not linked</span>}</td>
      <td className="whitespace-nowrap px-5 py-3.5 text-muted">{item.commentCount} messages</td>
      <td className="whitespace-nowrap px-5 py-3.5 text-muted">{item.submittedAt ? new Date(item.submittedAt).toLocaleDateString('en-PH') : 'Not submitted'}</td>
      <td className="px-5 py-3.5 text-right"><Button size="sm" variant="ghost" iconLeft={<MessageSquare className="h-4 w-4" />} onClick={() => onReview(item)}>Open</Button></td>
    </tr>)}</tbody>
  </table></div>;
}
