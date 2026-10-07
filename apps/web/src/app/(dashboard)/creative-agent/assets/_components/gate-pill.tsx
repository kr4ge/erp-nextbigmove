'use client';

import { HelpCircle, ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react';
import type { CreativeAsset } from '../_types/creative-assets';

const VERDICT = {
  APPROVE: { label: 'Approve', icon: ShieldCheck, tone: 'border-success/30 bg-success-soft/40 text-success' },
  REVISE: { label: 'Revise', icon: ShieldAlert, tone: 'border-warning/30 bg-warning-soft/60 text-warning' },
  REJECT: { label: 'Reject', icon: ShieldX, tone: 'border-destructive/30 bg-destructive-soft text-destructive' },
} as const;

/**
 * What the enrollment gate said about a creative, in the same pill language
 * the row already uses for QC and Meta link. Says "running" while a review is
 * in flight and "No gate" when none has been run, so the absence is visible.
 */
export function GatePill({ asset }: { asset: Pick<CreativeAsset, 'gate' | 'gateInProgress'> }) {
  if (asset.gateInProgress) {
    return <span className="pill border border-info/30 bg-info-soft text-info">Gate running…</span>;
  }
  const gate = asset.gate;
  if (!gate || !gate.decision) {
    return <span className="pill inline-flex items-center gap-1 border border-border bg-background-secondary text-muted"><HelpCircle className="h-3 w-3" />No gate</span>;
  }
  const verdict = VERDICT[gate.decision];
  const Icon = verdict.icon;
  const ruling = gate.outcome === 'OVERRIDDEN' ? 'overridden by a person' : gate.outcome === 'ACCEPTED' ? 'accepted' : 'awaiting a person';
  const title = `${verdict.label} · ${ruling}${gate.confidence != null ? ` · ${gate.confidence}% confidence` : ''}${gate.shadow ? ' · shadow mode' : ''}`;
  return (
    <span className={`pill inline-flex items-center gap-1 border font-semibold ${verdict.tone}`} title={title}>
      <Icon className="h-3 w-3" />{verdict.label}{gate.outcome === 'OVERRIDDEN' ? <span className="font-normal opacity-80">· overridden</span> : null}
    </span>
  );
}
