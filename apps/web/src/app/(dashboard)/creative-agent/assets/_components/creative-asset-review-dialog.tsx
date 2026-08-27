'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Library, MessageSquare, Pencil, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RegistryStatusPill } from '../../video-registry/_components/registry-status-pill';
import { isValidFacebookPostUrl } from '../../video-registry/_utils/facebook-post-url';
import { getGoogleDrivePreviewUrl } from '../../video-registry/_utils/google-drive-url';
import { CopyCodeButton } from './copy-code-button';
import { creativeQueryHref } from '../../video-registry/_utils/creative-navigation';
import type { CreativeAsset, CreativeAssetComment } from '../_types/creative-assets';

export function CreativeAssetReviewDialog({ asset, comments, isLoadingComments, isSaving, showPerformanceLink = false, canReview = false, onClose, onComment, onTransition, onEdit }: {
  asset: CreativeAsset | null;
  comments: CreativeAssetComment[];
  isLoadingComments: boolean;
  isSaving: boolean;
  showPerformanceLink?: boolean;
  /** Backend requires creative_agent.review for every non-maker QC transition. */
  canReview?: boolean;
  onClose: () => void;
  onComment: (message: string) => Promise<void>;
  onTransition: (status: string, reason?: string) => Promise<void>;
  onEdit: (asset: CreativeAsset) => void;
}) {
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setFeedback(''); setError(null); }, [asset?.id]);
  if (!asset) return null;

  const sendFeedback = async () => {
    if (!feedback.trim()) return setError('Write feedback before sending.');
    setError(null);
    try { await onComment(feedback.trim()); setFeedback(''); }
    catch (submitError) { setError(submitError instanceof Error ? submitError.message : 'Unable to save feedback.'); }
  };
  const transition = async (status: string, requiresReason = false) => {
    if (requiresReason && !feedback.trim()) return setError('Describe the changes you are asking for.');
    setError(null);
    try { await onTransition(status, feedback.trim() || undefined); }
    catch (submitError) { setError(submitError instanceof Error ? submitError.message : 'Unable to update this creative.'); }
  };
  // Approval is gone: a linked creative is already running. Advertising asks
  // for changes; the owner (or a reviewer) closes the request out.
  const canRequestRevision = canReview && !asset.isOwnSubmission && asset.revisionState !== 'NEEDS_REVISION';
  const canResolveRevision = asset.revisionState === 'NEEDS_REVISION' && (asset.isOwnSubmission || canReview);

  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="flex max-h-[92vh] w-11/12 max-w-5xl flex-col overflow-hidden p-0 sm:max-w-5xl">
      <DialogHeader className="shrink-0 border-b border-border px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><DialogTitle className="mb-0">{asset.title}</DialogTitle><DialogDescription className="mt-1"><span className="inline-flex items-center gap-1"><code className="font-semibold text-primary">{asset.code}</code><CopyCodeButton code={asset.code} title={asset.title} creator={asset.creator.name} customId={asset.customId} /></span> · {asset.creator.name} · {asset.store.name} · {asset.linked ? `${asset.metaAdIds.length} Meta ad${asset.metaAdIds.length === 1 ? '' : 's'} linked` : 'no Meta ad linked'}</DialogDescription></div><div className="flex flex-wrap items-center gap-2">{asset.revisionState !== 'NONE' ? <RegistryStatusPill type="revision" status={asset.revisionState} /> : null}<RegistryStatusPill type="performance" status={asset.performanceStatus} /></div></div>
      </DialogHeader>
      <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[1.1fr_0.9fr]">
        <section className="overflow-y-auto border-b border-border p-6 lg:border-b-0 lg:border-r">
          <div className="aspect-video overflow-hidden rounded-xl border border-border bg-background-secondary">
            {asset.thumbnailUrl
              ? <a href={asset.mediaUrl ?? '#'} target="_blank" rel="noreferrer" className="relative block h-full w-full">
                  {/* Cached cover from the post's og:image — signed object-storage URL. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={asset.thumbnailUrl} alt={`Cover for ${asset.title}`} className="h-full w-full object-contain" />
                  <span className="absolute inset-x-0 bottom-0 bg-foreground/70 py-1.5 text-center text-xs font-semibold text-surface">Open Facebook post</span>
                </a>
              : asset.mediaUrl && isValidFacebookPostUrl(asset.mediaUrl)
              ? <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted"><span>Facebook does not allow embedding.</span><a href={asset.mediaUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-primary-soft">Open Facebook post</a></div>
              : asset.mediaUrl
                ? <iframe src={getGoogleDrivePreviewUrl(asset.mediaUrl) ?? asset.mediaUrl} title={asset.title} className="h-full w-full" allow="autoplay" sandbox="allow-scripts allow-same-origin allow-popups" />
                : <div className="flex h-full items-center justify-center text-sm text-muted">No post link supplied</div>}
          </div>
          {asset.mediaUrl ? <a href={asset.mediaUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">Open the live post <ExternalLink className="h-4 w-4" /></a> : null}
          <dl className="mt-5 grid gap-3 rounded-xl bg-background-secondary p-4 sm:grid-cols-2">
            <div><dt className="text-xs text-muted">Format</dt><dd className="mt-1 font-semibold text-foreground">{asset.format ?? 'Not provided'}</dd></div>
            <div><dt className="text-xs text-muted">Hook type</dt><dd className="mt-1 font-semibold text-foreground">{asset.hookType ?? 'Not provided'}</dd></div>
          </dl>
          {asset.script ? <div className="mt-5"><h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Script / angle</h3><p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{asset.script}</p></div> : null}
          {asset.notes ? <div className="mt-5"><h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Creator notes</h3><p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{asset.notes}</p></div> : null}
        </section>
        <section className="flex min-h-0 flex-col bg-background-secondary/30">
          <div className="flex items-center gap-2 border-b border-border px-5 py-4"><MessageSquare className="h-4 w-4 text-primary" /><h3 className="font-semibold text-foreground">Feedback</h3><span className="ml-auto text-xs text-muted">{comments.length} messages</span></div>
          <div className="min-h-40 flex-1 space-y-3 overflow-y-auto p-5">
            {isLoadingComments ? <p className="text-sm text-muted">Loading feedback…</p> : comments.length ? comments.map((comment) => <article key={comment.id} className="rounded-xl border border-border bg-surface p-3"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-foreground">{comment.author.name}</p><time className="text-xs text-muted">{new Date(comment.createdAt).toLocaleString('en-PH')}</time></div><p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{comment.message}</p></article>) : <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted">No feedback yet. Start the review conversation below.</p>}
          </div>
          <div className="border-t border-border bg-surface p-5">
            {asset.isOwnSubmission ? <p className="mb-3 rounded-xl bg-primary-soft p-3 text-sm text-primary-soft-foreground">This is your creative. Use this thread to respond to Advertising's feedback.</p> : null}
            <textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} className="input min-h-24 w-full resize-y" placeholder={asset.isOwnSubmission ? "Reply to feedback…" : "Write clear, actionable feedback…"} />
            {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" loading={isSaving} iconLeft={<Send className="h-4 w-4" />} onClick={() => void sendFeedback()}>{asset.isOwnSubmission ? 'Reply' : 'Send feedback'}</Button>
              {asset.isOwnSubmission ? <Button size="sm" variant="outline" iconLeft={<Pencil className="h-4 w-4" />} onClick={() => onEdit(asset)}>Edit creative</Button> : null}
              {canRequestRevision ? <Button size="sm" variant="outline" loading={isSaving} onClick={() => void transition('NEEDS_REVISION', true)}>Request revision</Button> : null}
              {canResolveRevision ? <Button size="sm" loading={isSaving} onClick={() => void transition('RESOLVED')}>Mark resolved</Button> : null}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Link href={creativeQueryHref('/video-registry', asset.code)} className="btn btn-sm btn-ghost btn-icon w-full">
                <Library className="h-4 w-4" /><span>Open registry record</span>
              </Link>
              {showPerformanceLink && asset.linked ? (
                <Link href={`/performance?group=CREATIVES&creativeId=${asset.id}`} className="btn btn-sm btn-ghost btn-icon w-full">
                  <ExternalLink className="h-4 w-4" /><span>View in Performance</span>
                </Link>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </DialogContent>
  </Dialog>;
}
