'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { decideEnrollmentReview } from '../../knowledge-base/_services/creative-knowledge.service';
import type { OverrideTarget } from '../_types/meta-launch';

/**
 * A person disagrees with the gate.
 *
 * Overriding a REVISE or REJECT is what makes a creative sendable; overriding
 * an APPROVE is what stops one. Either way the reason is required, because the
 * disagreement is the only signal that calibrates the gate.
 */
export function OverrideGateDialog({ row, onClose, onDone }: {
  row: OverrideTarget;
  onClose: () => void;
  onDone: () => void;
}) {
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const decision = row.gate?.decision ?? 'UNREVIEWED';
  const unblocks = decision !== 'APPROVE';

  const submit = async () => {
    if (!row.gate || !notes.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await decideEnrollmentReview(row.gate.reviewId, { outcome: 'OVERRIDDEN', notes: notes.trim() });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to record the override.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Override the gate on {row.code}</DialogTitle>
          <DialogDescription>
            The gate said <span className="font-semibold">{decision}</span>.
            {unblocks
              ? ' Overriding makes this creative sendable. Say why the gate was wrong; that note is what teaches it.'
              : ' Overriding blocks this creative from being sent. Say what the gate missed.'}
          </DialogDescription>
        </DialogHeader>
        <label className="block">
          <span className="form-label">Why</span>
          <textarea
            id={`override-notes-${row.id}`}
            className="input mt-1.5 min-h-24 w-full resize-y"
            value={notes}
            maxLength={2000}
            placeholder={unblocks ? 'e.g. The claim it flags is cleared by the FDA letter in the reference documents.' : 'e.g. The hook copies a competitor ad we were told to avoid.'}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
        {error ? <p className="rounded-lg bg-destructive-soft px-3 py-2 text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="button" loading={saving} disabled={!notes.trim()} onClick={() => void submit()}>Record override</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
