'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, RefreshCcw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Spinner } from '@/components/ui/spinner';
import {
  fetchGateCalibration,
  fetchKnowledgeCoverage,
  fetchKnowledgeEntries,
} from '../_services/creative-knowledge.service';
import type {
  GateCalibration,
  KnowledgeCoverage,
  KnowledgeEntry,
  KnowledgeLabel,
  KnowledgeReadiness,
} from '../_types/creative-knowledge';
import { KnowledgeEntryDialog, LabelPill, SharedWarning } from './knowledge-entry-dialog';

const READINESS: Record<KnowledgeReadiness, { label: string; className: string; blurb: string }> = {
  EMPTY: {
    label: 'Empty',
    className: 'bg-muted-soft text-muted',
    blurb: 'No creatives recorded yet. The gate cannot judge anything for this store.',
  },
  BUILDING: {
    label: 'Building',
    className: 'bg-warning-soft text-warning',
    blurb: 'Too few examples to reason from. Keep adding analyzed winners and losers.',
  },
  ADVISORY: {
    label: 'Advisory',
    className: 'bg-primary-soft text-primary',
    blurb: 'Enough to offer an opinion, not enough to lean on. Treat every call as a suggestion.',
  },
  READY: {
    label: 'Ready',
    className: 'bg-success-soft/50 text-success',
    blurb: 'Enough winners and losers to draw a real contrast.',
  },
};

/**
 * The knowledge base.
 *
 * Scope is a store, always. A fragrance store and a supplement store advertise
 * differently, so their libraries stay separate and the store picker is the
 * first control on the page rather than a filter buried in a toolbar.
 */
export function KnowledgeBaseScreen() {
  const [coverage, setCoverage] = useState<KnowledgeCoverage[]>([]);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [label, setLabel] = useState<KnowledgeLabel | 'ALL'>('ALL');
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [calibration, setCalibration] = useState<GateCalibration | null>(null);
  const [selected, setSelected] = useState<KnowledgeEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCoverage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchKnowledgeCoverage();
      setCoverage(rows);
      setStoreId((current) => current ?? rows.find((row) => row.total > 0)?.storeId ?? rows[0]?.storeId ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the knowledge base.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCoverage();
  }, [loadCoverage]);

  const loadEntries = useCallback(async () => {
    if (!storeId) return;
    setEntriesLoading(true);
    try {
      const [result, gate] = await Promise.all([
        fetchKnowledgeEntries({
          storeId,
          label: label === 'ALL' ? undefined : label,
          take: 60,
        }),
        fetchGateCalibration(storeId).catch(() => null),
      ]);
      setEntries(result.items);
      setTotal(result.total);
      setCalibration(gate);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load entries.');
    } finally {
      setEntriesLoading(false);
    }
  }, [storeId, label]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const activeStore = useMemo(
    () => coverage.find((row) => row.storeId === storeId) ?? null,
    [coverage, storeId],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Knowledge Base"
        description="What has won and lost for each store, and how those creatives were built."
        actions={
          <Button variant="secondary" size="sm" onClick={loadCoverage} disabled={loading}>
            <RefreshCcw className="mr-1.5 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {error ? (
        <p className="rounded-lg bg-destructive-soft px-4 py-3 text-sm text-destructive">{error}</p>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : coverage.length === 0 ? (
        <EmptyLibrary />
      ) : (
        <>
          <section className="flex flex-wrap gap-2">
            {coverage.map((store) => {
              const active = store.storeId === storeId;
              return (
                <button
                  key={store.storeId}
                  type="button"
                  onClick={() => setStoreId(store.storeId)}
                  className={`rounded-lg border px-3 py-2 text-left transition ${
                    active ? 'border-primary bg-primary-soft' : 'border-border hover:border-muted'
                  }`}
                >
                  <span className="block text-sm font-medium">{store.storeName}</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {store.winners}W · {store.losers}L
                    {store.inconclusive > 0 ? ` · ${store.inconclusive} unclear` : ''}
                  </span>
                </button>
              );
            })}
          </section>

          {activeStore ? <StoreStatus store={activeStore} calibration={calibration} /> : null}

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-1.5">
                {(['ALL', 'WINNER', 'LOSER', 'INCONCLUSIVE'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setLabel(option)}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                      label === option ? 'bg-foreground text-background' : 'bg-muted-soft text-muted hover:text-foreground'
                    }`}
                  >
                    {option === 'ALL' ? 'All' : option.toLowerCase()}
                  </button>
                ))}
              </div>
              <span className="text-xs text-muted">
                {total} {total === 1 ? 'entry' : 'entries'}
              </span>
            </div>

            {entriesLoading ? (
              <div className="flex justify-center py-12">
                <Spinner />
              </div>
            ) : entries.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
                Nothing recorded here yet. Analyze a creative that has spent, then add it to the knowledge base.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {entries.map((entry) => (
                  <EntryCard key={entry.id} entry={entry} onOpen={() => setSelected(entry)} />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {selected ? <KnowledgeEntryDialog entry={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function StoreStatus({
  store,
  calibration,
}: {
  store: KnowledgeCoverage;
  calibration: GateCalibration | null;
}) {
  const readiness = READINESS[store.readiness];
  return (
    <section className="grid gap-3 rounded-lg border border-border px-4 py-3 md:grid-cols-2">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-muted" />
          <span className="text-sm font-medium">Corpus</span>
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${readiness.className}`}>
            {readiness.label}
          </span>
        </div>
        <p className="text-xs leading-relaxed text-muted">{readiness.blurb}</p>
        {!store.hasStoreRules ? (
          <p className="text-xs text-warning">
            This store has no rules written. The gate will fall back to workspace-wide rules only.
          </p>
        ) : null}
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted" />
          <span className="text-sm font-medium">Enrollment gate</span>
        </div>
        {calibration && calibration.ruled > 0 ? (
          <p className="text-xs leading-relaxed text-muted">
            Agreed with your team on {calibration.accepted} of {calibration.ruled} reviews
            {calibration.agreementRate != null ? ` (${calibration.agreementRate}%)` : ''}.{' '}
            {calibration.readyToLeaveShadow
              ? 'It has earned the right to advise beyond shadow mode.'
              : 'Still in shadow mode: it records what it would decide, and changes nothing.'}
          </p>
        ) : (
          <p className="text-xs leading-relaxed text-muted">
            No reviews have been ruled on yet, so there is no evidence the gate agrees with your team.
            It stays in shadow mode until there is.
          </p>
        )}
      </div>
    </section>
  );
}

function EntryCard({ entry, onOpen }: { entry: KnowledgeEntry; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex flex-col gap-2 rounded-lg border border-border px-4 py-3 text-left transition hover:border-muted"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{entry.creative?.code ?? 'Entry'}</span>
        <LabelPill label={entry.label} />
        {entry.attribution === 'SHARED' ? <SharedWarning /> : null}
      </div>
      {entry.creative?.title ? (
        <span className="line-clamp-1 text-xs text-muted">{entry.creative.title}</span>
      ) : null}
      {entry.digest ? (
        <span className="line-clamp-3 whitespace-pre-line text-xs leading-relaxed text-muted">
          {entry.digest}
        </span>
      ) : null}
    </button>
  );
}

function EmptyLibrary() {
  return (
    <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
      <BookOpen className="mx-auto mb-3 h-8 w-8 text-muted" />
      <h3 className="text-sm font-medium">No stores are set up yet</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">
        The knowledge base is organised by store, because what wins for one niche rarely transfers to
        another. Configure a store first, then analyze creatives that have spent.
      </p>
    </div>
  );
}
