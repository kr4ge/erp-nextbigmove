'use client';

import { useCallback, useEffect, useState } from 'react';
import { Film, RefreshCcw } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { AlertBanner } from '@/components/ui/feedback';
import { peso } from '../_lib/format';

/**
 * The creatives that ran, as Meta knows them.
 *
 * Nobody uploads anything here. The spend still arrives by CSV; this asks Meta
 * one question about the ads that CSV already reported — what did they look
 * like — and the mapping comes back exact, id to id.
 */

interface CreativeRow {
  id: string;
  metaCreativeId: string;
  name: string | null;
  thumbnailUrl: string | null;
  imageUrl: string | null;
  videoId: string | null;
  title: string | null;
  body: string | null;
  adIds: string[];
  adNames: string[];
  lastSyncedAt: string;
  ads: number;
  spend: number;
  purchases: number;
  deliveredCod: number;
}

interface SyncResult {
  adsConsidered: number;
  creativesFound: number;
  adsWithoutCreative: number;
}

export function AssetsSection({
  canManage,
  startDate,
  endDate,
}: {
  canManage: boolean;
  startDate: string;
  endDate: string;
}) {
  const [creatives, setCreatives] = useState<CreativeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<CreativeRow[]>('/advertising/creatives', {
        params: { startDate, endDate },
      });
      setCreatives(response.data);
      setError('');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message || 'Could not load creatives.');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    load();
  }, [load]);

  const sync = async () => {
    setSyncing(true);
    setError('');
    setSyncResult(null);
    try {
      const response = await apiClient.post<SyncResult>('/advertising/creatives/sync', null, {
        params: { startDate, endDate },
      });
      setSyncResult(response.data);
      await load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e?.response?.data?.message || e?.message || 'The sync could not run.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="panel panel-content">
        <div className="panel-header flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2">
            <Film className="panel-icon" />
            <h4 className="panel-title">Creatives ({creatives.length})</h4>
          </div>
          {canManage ? (
            <div className="ml-auto shrink-0">
              <Button
                variant="primary"
                size="sm"
                onClick={sync}
                disabled={syncing}
                iconLeft={<RefreshCcw className="h-4 w-4" />}
              >
                {syncing ? 'Asking Meta…' : 'Sync from Meta'}
              </Button>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 p-5">
          <p className="max-w-prose text-sm text-muted">
            Pulled from Meta for the ads in this period. The link is Meta&apos;s own — an ad knows
            its creative — so nothing here depends on a code being typed correctly into an ad name.
          </p>

          {error ? <AlertBanner tone="error" message={error} /> : null}

          {syncResult ? (
            <AlertBanner
              tone={syncResult.adsWithoutCreative > 0 ? 'warning' : 'success'}
              message={
                `Found ${syncResult.creativesFound} creative${syncResult.creativesFound === 1 ? '' : 's'} `
                + `across ${syncResult.adsConsidered} ad${syncResult.adsConsidered === 1 ? '' : 's'}.`
                + (syncResult.adsWithoutCreative > 0
                  ? ` ${syncResult.adsWithoutCreative} ad${syncResult.adsWithoutCreative === 1 ? '' : 's'} came back without one — usually deleted in Meta, or outside this token's access.`
                  : '')
              }
            />
          ) : null}
        </div>
      </section>

      <section className="panel panel-content">
        <div className="flex flex-col">
          {loading ? (
            <p className="p-6 text-sm text-muted">Loading…</p>
          ) : creatives.length === 0 ? (
            <p className="p-6 text-sm text-muted">
              Nothing synced yet. Run a sync and every ad in this period will report back what it
              looked like.
            </p>
          ) : (
            creatives.map((creative) => (
              <article key={creative.id} className="border-b border-border/10 p-5 last:border-b-0">
                <div className="flex flex-wrap items-start gap-4">
                  {creative.thumbnailUrl ? (
                    // Meta-hosted and short-lived; refreshed on each sync.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={creative.thumbnailUrl}
                      alt={creative.name || 'Ad creative'}
                      className="h-20 w-20 shrink-0 rounded-xl object-cover ring-1 ring-border/20"
                    />
                  ) : (
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-secondary/40 ring-1 ring-border/20">
                      <Film className="h-5 w-5 text-muted" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <p className="text-sm-custom font-semibold text-foreground">
                        {creative.name || creative.title || `Creative ${creative.metaCreativeId}`}
                      </p>
                      {creative.videoId ? (
                        <span className="pill pill-neutral">Video</span>
                      ) : (
                        <span className="pill pill-neutral">Image</span>
                      )}
                      <span className="text-xs text-muted">
                        {creative.adIds.length} ad{creative.adIds.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    {creative.body ? (
                      <p className="mt-1 max-w-prose truncate text-sm text-muted">
                        {creative.body}
                      </p>
                    ) : null}

                    {creative.adNames.length ? (
                      <p className="mt-2 truncate text-xs text-muted">
                        Ran as: {creative.adNames.join(' · ')}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-muted">
                        No spend in this period.
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="card-label">Earned in period</p>
                    <p className="text-lg-loose font-semibold text-foreground">
                      {peso(creative.deliveredCod)}
                    </p>
                    <p className="text-xs text-muted">
                      {peso(creative.spend)} spent · {creative.purchases} order
                      {creative.purchases === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
