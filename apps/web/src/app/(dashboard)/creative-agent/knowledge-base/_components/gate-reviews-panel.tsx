'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, ShieldX, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { decideEnrollmentReview, fetchEnrollmentReviews } from '../_services/creative-knowledge.service';
import type { EnrollmentDecision, EnrollmentReview } from '../_types/creative-knowledge';

const DECISION: Record<EnrollmentDecision, { label: string; className: string; icon: typeof ShieldCheck }> = {
  APPROVE: { label: 'Approve', className: 'text-success', icon: ShieldCheck },
  REVISE: { label: 'Revise', className: 'text-warning', icon: ShieldAlert },
  REJECT: { label: 'Reject', className: 'text-destructive', icon: ShieldX },
};

/**
 * Gate recommendations awaiting a person.
 *
 * Every recommendation needs a ruling, including the ones the team agrees with,
 * because agreement is the evidence that lets the gate eventually stop being
 * purely advisory. An override needs a reason for the same purpose.
 */
export function GateReviewsPanel({ storeId, canReview }: { storeId: string; canReview: boolean }) {
  const [reviews, setReviews] = useState<EnrollmentReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReviews(await fetchEnrollmentReviews({ storeId, take: 20 }));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load gate reviews.');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return <p className="rounded-lg bg-destructive-soft px-4 py-3 text-sm text-destructive">{error}</p>;
  }

  if (reviews.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
        No creatives have been through the gate for this store yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {reviews.map((review) => (
        <ReviewRow key={review.id} review={review} canReview={canReview} onRuled={load} />
      ))}
    </div>
  );
}

function ReviewRow({
  review,
  canReview,
  onRuled,
}: {
  review: EnrollmentReview;
  canReview: boolean;
  onRuled: () => void;
}) {
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState<'ACCEPTED' | 'OVERRIDDEN' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rule = async (outcome: 'ACCEPTED' | 'OVERRIDDEN') => {
    setBusy(outcome);
    setError(null);
    try {
      await decideEnrollmentReview(review.id, { outcome, notes: notes.trim() || undefined });
      onRuled();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to record that decision.');
      setBusy(null);
    }
  };

  const meta = review.decision ? DECISION[review.decision] : null;
  const Icon = meta?.icon;
  const pending = review.status === 'COMPLETED' && review.outcome === 'PENDING';

  return (
    <article className="rounded-lg border border-border px-4 py-3">
      <header className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{review.creative?.code ?? 'Creative'}</span>
        {meta && Icon ? (
          <span className={`inline-flex items-center gap-1 text-xs font-medium ${meta.className}`}>
            <Icon className="h-3.5 w-3.5" />
            {meta.label}
          </span>
        ) : (
          <span className="text-xs text-muted">{review.status.toLowerCase()}</span>
        )}
        {review.confidence != null ? (
          <span className="text-xs tabular-nums text-muted">{review.confidence}% confident</span>
        ) : null}
        {review.shadow ? (
          <span
            className="inline-flex items-center gap-1 rounded bg-muted-soft px-2 py-0.5 text-xs text-muted"
            title="Shadow mode: this recommendation authorizes nothing."
          >
            <Eye className="h-3 w-3" />
            shadow
          </span>
        ) : null}
        <span className="ml-auto text-xs text-muted">
          judged against {review.corpusSize} {review.corpusSize === 1 ? 'entry' : 'entries'}
        </span>
      </header>

      {review.errorMessage ? (
        <p className="mt-2 text-xs text-destructive">{review.errorMessage}</p>
      ) : null}

      {review.rationale?.length ? (
        <ul className="mt-2 space-y-1.5">
          {review.rationale.map((item, index) => (
            <li key={index} className="text-sm leading-relaxed">
              <span>{item.point}</span>
              <span className="ml-1 text-xs text-muted">({item.basis})</span>
            </li>
          ))}
        </ul>
      ) : null}

      {review.requiredChanges?.length ? (
        <div className="mt-2 rounded bg-warning-soft px-3 py-2">
          <p className="mb-1 text-xs font-medium text-warning">Required changes</p>
          <ul className="space-y-1">
            {review.requiredChanges.map((item, index) => (
              <li key={index} className="text-xs leading-relaxed text-warning">
                {item.timestampSeconds != null ? `${item.timestampSeconds}s — ` : ''}
                {item.change}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {review.outcome !== 'PENDING' ? (
        <p className="mt-2 text-xs text-muted">
          {review.outcome === 'ACCEPTED' ? 'Accepted' : 'Overridden'}
          {review.decidedBy ? ` by ${review.decidedBy.firstName} ${review.decidedBy.lastName}` : ''}
          {review.decisionNotes ? `: ${review.decisionNotes}` : ''}
        </p>
      ) : pending && canReview ? (
        <div className="mt-3 space-y-2">
          <textarea
            className="input w-full text-xs"
            rows={2}
            placeholder="Notes (required if you disagree)"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              loading={busy === 'ACCEPTED'}
              onClick={() => void rule('ACCEPTED')}
            >
              Agree
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              loading={busy === 'OVERRIDDEN'}
              onClick={() => void rule('OVERRIDDEN')}
            >
              Disagree
            </Button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
