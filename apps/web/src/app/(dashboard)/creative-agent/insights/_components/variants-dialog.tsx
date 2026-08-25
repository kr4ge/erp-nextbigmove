'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { InsightRow, VariantBrief, VariantsResponse } from '../_types/creative-insights';

/**
 * The next batch, as cards. Each brief names which axes it moved — that is the
 * Andromeda constraint made visible, so nobody quietly enrolls six near-clones.
 */
export function VariantsDialog({ parent, busy, error, result, onEnroll, onClose }: {
  parent: InsightRow;
  busy: boolean;
  error: string | null;
  result: VariantsResponse | null;
  onEnroll: (brief: VariantBrief) => Promise<string>;
  onClose: () => void;
}) {
  const [enrolling, setEnrolling] = useState<number | null>(null);
  const [enrolled, setEnrolled] = useState<Record<number, string>>({});
  const [enrollError, setEnrollError] = useState<string | null>(null);

  const enroll = async (brief: VariantBrief, index: number) => {
    setEnrolling(index);
    setEnrollError(null);
    try {
      const code = await onEnroll(brief);
      setEnrolled((current) => ({ ...current, [index]: code }));
    } catch (err) {
      setEnrollError(err instanceof Error ? err.message : 'Enrollment failed.');
    } finally {
      setEnrolling(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8">
      <div className="w-full max-w-4xl rounded-2xl bg-surface shadow-lg">
        <div className="flex items-center justify-between border-b border-border/20 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">Variants of {parent.code}</h3>
            <p className="text-xs text-muted">{parent.title} — each variant moves at least two axes, so the batch reads as six distinct ads, not six clones.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"><X className="h-5 w-5 text-muted" /></button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto p-5">
          {busy ? (
            <p className="py-10 text-center text-sm text-muted">Writing six distinct briefs…</p>
          ) : error ? (
            <p className="py-6 text-center text-sm text-destructive">{error}</p>
          ) : result?.variants ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {result.variants.map((brief, index) => (
                <div key={index} className="flex flex-col rounded-xl border border-border/40 p-4">
                  <p className="text-sm font-semibold text-foreground">{brief.title}</p>
                  <p className="mt-1 text-xs text-muted">{[brief.angle, brief.hookType, brief.format].filter(Boolean).join(' · ')}</p>
                  <p className="mt-2 rounded-lg bg-secondary/20 px-3 py-2 text-sm text-foreground">“{brief.hook}”</p>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-medium text-primary">Full script</summary>
                    <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-muted">{brief.script}</p>
                  </details>
                  <p className="mt-2 text-xs text-muted">{brief.rationale}</p>
                  {brief.differsBy?.length ? (
                    <p className="mt-1 text-xs text-muted">Moves: <span className="text-foreground">{brief.differsBy.join(', ')}</span></p>
                  ) : null}
                  <div className="mt-auto pt-3">
                    {enrolled[index] ? (
                      <span className="text-xs font-semibold text-success">Enrolled as {enrolled[index]}</span>
                    ) : (
                      <Button variant="secondary" size="sm" onClick={() => enroll(brief, index)} disabled={enrolling !== null}>
                        {enrolling === index ? 'Enrolling…' : 'Enroll in registry'}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : result?.raw ? (
            <div>
              <p className="mb-2 text-xs text-muted">The model answered off-format; here is the raw output:</p>
              <pre className="whitespace-pre-wrap rounded-lg bg-secondary/20 p-3 text-xs text-foreground">{result.raw}</pre>
            </div>
          ) : null}
          {enrollError ? <p className="mt-3 text-sm text-destructive">{enrollError}</p> : null}
        </div>
      </div>
    </div>
  );
}
