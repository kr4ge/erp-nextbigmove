'use client';

import { useState } from 'react';
import { BookOpen, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { promoteKnowledgeEntry } from '../../knowledge-base/_services/creative-knowledge.service';
import type { KnowledgeLabel } from '../../knowledge-base/_types/creative-knowledge';

/**
 * Add a finished analysis to its store's knowledge base.
 *
 * The label is normally computed from reconciled spend and contribution, which
 * is the auditable path. The override exists because an advertiser sometimes
 * knows something the numbers do not yet show, and a forced label is recorded
 * as MANUAL so nobody later mistakes it for a measurement.
 */
export function CreativeAiPromotePanel({
  creativeId,
  runId,
  canManage,
}: {
  creativeId: string;
  runId: string;
  canManage: boolean;
}) {
  const [label, setLabel] = useState<KnowledgeLabel | 'AUTO'>('AUTO');
  const [rationale, setRationale] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!canManage) return null;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const entry = await promoteKnowledgeEntry(creativeId, {
        runId,
        label: label === 'AUTO' ? undefined : label,
        labelRationale: rationale.trim() || undefined,
      });
      setDone(`Recorded as ${entry.label.toLowerCase()}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add this to the knowledge base.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-3 sm:col-span-2 xl:col-span-1">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <BookOpen className="h-3.5 w-3.5" />
        </span>
        <span className="text-sm font-semibold">Knowledge base</span>
      </div>

      {done ? (
        <p className="flex items-center gap-1.5 text-xs text-success">
          <Check className="h-3.5 w-3.5" />
          {done}
        </p>
      ) : (
        <>
          <p className="mb-2 text-xs leading-relaxed text-muted">
            Add this to the store&apos;s library so future creatives are judged against it.
          </p>
          <label className="form-label text-xs" htmlFor="promote-label">
            Outcome
          </label>
          <select
            id="promote-label"
            className="input mt-1 h-9 w-full text-xs"
            value={label}
            onChange={(event) => setLabel(event.target.value as KnowledgeLabel | 'AUTO')}
          >
            <option value="AUTO">Decide from spend and contribution</option>
            <option value="WINNER">Winner</option>
            <option value="LOSER">Loser</option>
            <option value="INCONCLUSIVE">Not conclusive</option>
          </select>

          {label !== 'AUTO' ? (
            <textarea
              className="input mt-2 w-full text-xs"
              rows={2}
              placeholder="Why are you setting this by hand?"
              value={rationale}
              onChange={(event) => setRationale(event.target.value)}
            />
          ) : null}

          {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}

          <Button
            type="button"
            variant="outline"
            className="mt-2 w-full"
            loading={busy}
            onClick={() => void submit()}
          >
            Add to knowledge base
          </Button>
        </>
      )}
    </div>
  );
}
