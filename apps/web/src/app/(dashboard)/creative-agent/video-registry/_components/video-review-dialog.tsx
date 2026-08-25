'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, FileText, FolderCheck, Link2, MessageSquare, Pencil, StickyNote, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { CreativePermissions, CreativeReviewComment, CreativeStatusDimension, VideoRegistryItem } from '../_types/video-registry';
import { isValidFacebookPostUrl } from '../_utils/facebook-post-url';
import { getGoogleDrivePreviewUrl } from '../_utils/google-drive-url';
import { formatCurrency, formatDate, formatNumber, formatRate } from '../_utils/video-registry-formatters';
import { creativeQueryHref } from '../_utils/creative-navigation';
import { RegistryStatusPill } from './registry-status-pill';

type Props = { item: VideoRegistryItem | null; comments: CreativeReviewComment[]; isLoadingComments: boolean; permissions: CreativePermissions; isSaving: boolean; onClose: () => void; onEdit: (item: VideoRegistryItem) => void; onTransition: (id: string, dimension: CreativeStatusDimension, status: string, reason?: string) => Promise<void> };

export function VideoReviewDialog({ item, comments, isLoadingComments, permissions, isSaving, onClose, onEdit, onTransition }: Props) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setReason(''); setError(null); }, [item?.id]);
  const previewUrl = getGoogleDrivePreviewUrl(item?.mediaUrl);
  // Facebook blocks embedding, so a post link gets an explicit open-out card
  // rather than an iframe that silently renders blank.
  const facebookUrl = item?.mediaUrl && isValidFacebookPostUrl(item.mediaUrl) ? item.mediaUrl : null;
  const canEditContent = Boolean(item && ['DRAFT', 'FOR_REVISION'].includes(item.qcStatus) && (permissions.canEdit || permissions.canEditAll));
  const transition = async (dimension: CreativeStatusDimension, status: string) => {
    if ((status === 'FOR_REVISION' || status === 'CANCELLED') && !reason.trim()) return setError('Add a reason before sending back or cancelling.');
    setError(null);
    try { if (item) await onTransition(item.id, dimension, status, reason.trim() || undefined); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to update status.'); }
  };
  return (
    <Dialog open={Boolean(item)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto p-0">
        {item ? (
          <div className="grid lg:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.8fr)]">
            <div className="min-h-80 bg-slate-950">
              {previewUrl ? (
                <iframe src={previewUrl} title={`Preview for ${item.title}`} className="h-full min-h-[32rem] w-full" allow="autoplay" sandbox="allow-scripts allow-same-origin allow-popups" />
              ) : facebookUrl ? (
                <div className="flex min-h-[32rem] flex-col items-center justify-center gap-3 px-8 text-center text-slate-300">
                  <Video className="h-10 w-10" />
                  <p className="font-semibold">Facebook post</p>
                  <p className="max-w-sm text-sm text-slate-400">Facebook does not allow embedding, so the post opens in a new tab.</p>
                  <a href={facebookUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-primary-soft">Open Facebook post</a>
                </div>
              ) : (
                <div className="flex min-h-[32rem] flex-col items-center justify-center gap-3 px-8 text-center text-slate-300">
                  <Video className="h-10 w-10" />
                  <p className="font-semibold">No post link yet</p>
                  <p className="max-w-sm text-sm text-slate-400">Add the Facebook post link so reviewers can open the live creative.</p>
                </div>
              )}
            </div>
            <div className="p-6">
              <DialogHeader>
                <DialogTitle className="pr-8 leading-snug">{item.title}</DialogTitle>
                <DialogDescription><code className="font-bold text-primary">{item.code}</code> · {item.store.name} · {item.kind === 'VIDEO' ? 'Video' : 'Static'}</DialogDescription>
              </DialogHeader>
              <div className="mt-4 flex flex-wrap gap-2">
                <RegistryStatusPill type="qc" status={item.qcStatus} />
                <RegistryStatusPill type="performance" status={item.performanceStatus} />
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-background-secondary p-4">
                {[
                  ['Spend', formatCurrency(item.metrics.spend)],
                  ['Impressions', formatNumber(item.metrics.impressions)],
                  ['Hook rate', formatRate(item.metrics.hookRate)],
                  ['Hold rate', formatRate(item.metrics.holdRate)],
                  ['Completion', formatRate(item.metrics.completionRate)],
                  ['CTR', formatRate(item.metrics.ctr)],
                ].map(([label, value]) => <div key={label}><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 font-semibold tabular-nums text-foreground">{value}</dd></div>)}
              </dl>
              <div className="mt-5 space-y-4 text-sm">
                <div><p className="text-xs font-semibold uppercase tracking-wide text-muted">Details</p><p className="mt-1 text-foreground">{item.creator.name} · {item.format ?? 'Format not set'} · {item.hookType ?? 'Hook not set'}</p></div>
                {item.script ? <div><p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted"><FileText className="h-3.5 w-3.5" /> Script / angle</p><p className="mt-1 whitespace-pre-wrap text-foreground">{item.script}</p></div> : null}
                {item.notes ? <div><p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted"><StickyNote className="h-3.5 w-3.5" /> Notes</p><p className="mt-1 whitespace-pre-wrap text-foreground">{item.notes}</p></div> : null}
                {item.aliases.length ? <div><p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted"><Link2 className="h-3.5 w-3.5" /> Meta aliases</p><p className="mt-1 font-mono text-foreground">{item.aliases.join(', ')}</p></div> : null}
                <p className="text-xs text-muted">Updated {formatDate(item.updatedAt)}</p>
              </div>
              <div className="mt-5 border-t border-border pt-5">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted"><MessageSquare className="h-3.5 w-3.5" /> QC feedback</p>
                <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
                  {isLoadingComments ? <p className="text-sm text-muted">Loading feedback…</p> : comments.length ? comments.map((comment) => <article key={comment.id} className="rounded-xl border border-border bg-background-secondary p-3"><div className="flex items-center justify-between gap-2"><p className="font-semibold text-foreground">{comment.author.name}</p><time className="text-xs text-muted">{new Date(comment.createdAt).toLocaleString('en-PH')}</time></div><p className="mt-1 whitespace-pre-wrap text-foreground">{comment.message}</p></article>) : <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted">No QC feedback yet.</p>}
                </div>
              </div>
              {(permissions.canReview || permissions.canManagePerformance || permissions.canEdit || permissions.canEditAll) ? (
                <div className="mt-5 space-y-3 border-t border-border pt-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Workflow actions</p>
                  {canEditContent ? <p className="rounded-xl bg-primary-soft p-3 text-sm text-primary-soft-foreground">Edit and save the requested changes before submitting this creative for approval.</p> : null}
                  {permissions.canReview ? <textarea value={reason} onChange={(event) => setReason(event.target.value)} className="input min-h-20 w-full resize-y" placeholder="Reason required when sending back or cancelling" /> : null}
                  <div className="flex flex-wrap gap-2">
                    {canEditContent ? <Button size="sm" variant="outline" iconLeft={<Pencil className="h-4 w-4" />} onClick={() => onEdit(item)}>Edit creative</Button> : null}
                    {item.qcStatus === 'FOR_REVISION' && (permissions.canEdit || permissions.canEditAll) ? <Button size="sm" loading={isSaving} onClick={() => transition('QC', 'REVISED')}>Submit revision</Button> : null}
                    {permissions.canReview && ['FOR_APPROVAL', 'REVISED'].includes(item.qcStatus) ? <Button size="sm" loading={isSaving} onClick={() => transition('QC', 'FOR_POSTING')}>Approve for posting</Button> : null}
                    {permissions.canReview && ['FOR_APPROVAL', 'REVISED', 'FOR_POSTING'].includes(item.qcStatus) ? <Button size="sm" variant="outline" loading={isSaving} onClick={() => transition('QC', 'FOR_REVISION')}>Send back</Button> : null}
                    {permissions.canReview && item.qcStatus === 'FOR_POSTING' ? <Button size="sm" loading={isSaving} onClick={() => transition('QC', 'POSTED')}>Mark posted</Button> : null}
                    {permissions.canReview && !['POSTED', 'CANCELLED'].includes(item.qcStatus) ? <Button size="sm" variant="danger" loading={isSaving} onClick={() => transition('QC', 'CANCELLED')}>Cancel</Button> : null}
                    {permissions.canManagePerformance && item.performanceStatus === 'DRAFT' ? <Button size="sm" variant="outline" loading={isSaving} onClick={() => transition('PERFORMANCE', 'LIVE')}>Set live</Button> : null}
                    {permissions.canManagePerformance && item.performanceStatus === 'LIVE' ? <><Button size="sm" variant="outline" loading={isSaving} onClick={() => transition('PERFORMANCE', 'WINNER')}>Mark winner</Button><Button size="sm" variant="outline" loading={isSaving} onClick={() => transition('PERFORMANCE', 'FATIGUED')}>Mark fatigued</Button></> : null}
                    {permissions.canManagePerformance && item.performanceStatus === 'FATIGUED' ? <Button size="sm" variant="outline" loading={isSaving} onClick={() => transition('PERFORMANCE', 'LIVE')}>Return live</Button> : null}
                    {permissions.canManagePerformance && item.performanceStatus !== 'RETIRED' ? <Button size="sm" variant="ghost" loading={isSaving} onClick={() => transition('PERFORMANCE', 'RETIRED')}>Retire</Button> : null}
                  </div>
                  {error ? <p className="text-sm text-destructive">{error}</p> : null}
                </div>
              ) : null}
              {!permissions.canReview ? (
                <Link href={creativeQueryHref('/assets', item.code)} className="btn btn-md btn-outline btn-icon mt-6 w-full">
                  <FolderCheck className="h-4 w-4" /><span>Open in Assets</span>
                </Link>
              ) : null}
              {item.mediaUrl ? <a href={item.mediaUrl} target="_blank" rel="noreferrer" className="mt-6 block"><Button type="button" variant="outline" className="w-full" iconLeft={<ExternalLink className="h-4 w-4" />}>Open the live post</Button></a> : null}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
