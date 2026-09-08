'use client';

import { useEffect, useState } from 'react';
import { Upload } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { AlertBanner } from '@/components/ui/feedback';
import type { UploadJob } from '../_lib/types';

export function ImportSection({ onImported }: { onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [job, setJob] = useState<UploadJob | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    setJob(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const response = await apiClient.post<{ jobId: string }>('/advertising/import', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setJob({
        jobId: response.data.jobId,
        state: 'waiting',
        progress: {
          stage: 'QUEUED',
          message: 'queued',
          processedRows: 0,
          totalRows: null,
          insightsUpserted: 0,
          datesProcessed: [],
          percent: null,
        },
        failedReason: null,
        result: null,
      });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e?.response?.data?.message || e?.message || 'The upload was not accepted.');
    } finally {
      setUploading(false);
    }
  };

  // Reconciliation runs a day at a time, so a wide report takes a while. Poll
  // until it settles, then tell the console to reload what it is showing.
  useEffect(() => {
    if (!job || job.state === 'completed' || job.state === 'failed') return undefined;

    const timer = setInterval(async () => {
      try {
        const response = await apiClient.get<UploadJob>(`/advertising/import/${job.jobId}`);
        setJob(response.data);
        if (response.data.state === 'completed') onImported();
      } catch {
        // A poll that fails is not the upload failing; the next tick tries again.
      }
    }, 2000);

    return () => clearInterval(timer);
  }, [job, onImported]);

  const busy = job !== null && job.state !== 'completed' && job.state !== 'failed';

  return (
    <section className="panel panel-content">
      <div className="panel-header flex items-center gap-2">
        <Upload className="panel-icon" />
        <h4 className="panel-title">Import report</h4>
      </div>

      <div className="flex flex-col gap-4 p-5">
        <p className="max-w-prose text-sm text-muted">
          An Ads Manager export, one row per ad per day. It lands in the same place the ERP&apos;s
          own upload writes to, so marketing analytics and the KPI scorecards see it too.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            className="input"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setJob(null);
              setError('');
            }}
          />
          <Button
            variant="primary"
            size="md"
            onClick={upload}
            disabled={!file || uploading || busy}
          >
            {uploading ? 'Sending…' : 'Upload'}
          </Button>
        </div>

        {error ? <AlertBanner tone="error" message={error} /> : null}

        {job && job.state !== 'failed' ? (
          <div className="rounded-xl bg-secondary/30 p-3 text-sm text-foreground">
            {job.state === 'completed' && job.result ? (
              <>
                Imported {job.result.rowsReceived} row
                {job.result.rowsReceived === 1 ? '' : 's'} into {job.result.insightsUpserted} insight
                {job.result.insightsUpserted === 1 ? '' : 's'} across{' '}
                {job.result.datesProcessed.length} day
                {job.result.datesProcessed.length === 1 ? '' : 's'}.
                {job.result.reconcileMarketingCompleted
                  ? ' Reconciliation finished — Performance is up to date.'
                  : ' Reconciliation is still catching up.'}
              </>
            ) : (
              <>
                {job.progress.message || job.state}
                {job.progress.totalRows
                  ? ` — ${job.progress.processedRows} of ${job.progress.totalRows} rows`
                  : ''}
              </>
            )}
          </div>
        ) : null}

        {job?.state === 'failed' ? (
          <AlertBanner tone="error" message={job.failedReason || 'The import failed.'} />
        ) : null}

        <div className="border-t border-border/10 pt-4">
          <p className="text-base text-foreground">Import history — not built yet.</p>
          <p className="mt-1 max-w-prose text-sm text-muted">
            Every past upload, who sent it, what it changed, and the ability to undo one. The ERP
            keeps deletion requests for this; nothing surfaces them here yet.
          </p>
        </div>
      </div>
    </section>
  );
}
