'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { fetchDraftBatches, retryDraftBatch } from '../_services/meta-launch.service';
import type { DraftBatch, DraftStatus } from '../_types/meta-launch';

const STATUS_TONE: Record<DraftStatus, string> = {
  QUEUED: 'border-border bg-background-secondary text-muted',
  RUNNING: 'border-info/30 bg-info-soft text-info',
  COMPLETED: 'border-success/30 bg-success-soft/40 text-success',
  FAILED: 'border-destructive/30 bg-destructive-soft text-destructive',
};

const STATUS_LABEL: Record<DraftStatus, string> = {
  QUEUED: 'Queued',
  RUNNING: 'Sending',
  COMPLETED: 'Drafted in Meta',
  FAILED: 'Failed',
};

/**
 * Recent sends and where each one stands. A batch in flight polls itself;
 * a finished one links straight to the campaign in Ads Manager, which is
 * where the person's work starts.
 */
export function DraftBatchesPanel({ storeId, canSend, refreshKey }: { storeId: string; canSend: boolean; refreshKey: number }) {
  const [batches, setBatches] = useState<DraftBatch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setBatches(await fetchDraftBatches({ storeId: storeId || undefined, take: 12 }));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load recent sends.');
    }
  }, [storeId]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  // Poll while anything is still moving.
  const active = batches?.some((batch) => batch.status === 'QUEUED' || batch.status === 'RUNNING') ?? false;
  useEffect(() => {
    if (!active) return;
    const handle = window.setInterval(() => { void load(); }, 6000);
    return () => window.clearInterval(handle);
  }, [active, load]);

  const retry = async (id: string) => {
    setRetrying(id);
    try {
      await retryDraftBatch(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to retry that send.');
    } finally {
      setRetrying(null);
    }
  };

  if (batches === null) {
    return <div className="flex items-center gap-2 px-5 py-6 text-sm text-muted"><Spinner /> Loading recent sends…</div>;
  }
  if (batches.length === 0) {
    return <p className="px-5 py-6 text-sm text-muted">Nothing has been sent to Meta yet.</p>;
  }

  return (
    <div className="divide-y divide-border">
      {error ? <p className="px-5 py-2 text-xs text-destructive">{error}</p> : null}
      {batches.map((batch) => (
        <div key={batch.id} className="px-5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`pill border font-semibold ${STATUS_TONE[batch.status]}`}>{STATUS_LABEL[batch.status]}</span>
            <span className="truncate font-mono text-xs font-semibold text-foreground" title={batch.campaignName}>{batch.campaignName}</span>
            <span className="text-xs text-muted">· {batch.storeName} · {batch.drafts.length} ad{batch.drafts.length === 1 ? '' : 's'} · {new Date(batch.createdAt).toLocaleString('en-PH')}</span>
            <span className="ml-auto flex items-center gap-2">
              {batch.status === 'FAILED' && canSend ? (
                <Button size="sm" variant="outline" loading={retrying === batch.id} iconLeft={<RefreshCcw className="h-3.5 w-3.5" />} onClick={() => void retry(batch.id)}>Retry</Button>
              ) : null}
              <a href={batch.adsManagerUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                Ads Manager <ExternalLink className="h-3 w-3" />
              </a>
            </span>
          </div>
          <ul className="mt-2 grid gap-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
            {batch.drafts.map((draft) => (
              <li key={draft.id} className="flex min-w-0 items-center gap-2">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${draft.status === 'COMPLETED' ? 'bg-success' : draft.status === 'FAILED' ? 'bg-destructive' : 'bg-info'}`} />
                <span className="truncate text-foreground" title={draft.adName}>{draft.code} · {draft.title}</span>
                <span className="ml-auto shrink-0 text-muted">
                  {draft.status === 'COMPLETED' ? 'ad created' : draft.mediaUploadedAt ? 'media in Meta' : draft.status === 'FAILED' ? 'failed' : 'uploading'}
                </span>
              </li>
            ))}
          </ul>
          {batch.errorMessage ? <p className="mt-2 rounded-lg bg-destructive-soft px-3 py-2 text-xs text-destructive">{batch.errorMessage}</p> : null}
        </div>
      ))}
    </div>
  );
}
