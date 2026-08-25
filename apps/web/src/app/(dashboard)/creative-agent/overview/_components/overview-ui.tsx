'use client';

import type { ReactNode } from 'react';
import { RATE_TONE_TEXT, type RateTone } from '../_utils/creative-overview-format';

/**
 * Small presentation kit for the creative dashboard, adapted from the B.E.X
 * reference: editorial serif panel headers, info dots with hover/focus
 * definitions, and label/value/sub stat tiles. Built on ERP tokens only.
 */

export function InfoTip({ text }: { text: string }) {
  return (
    <span
      tabIndex={0}
      className="group relative inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full border border-border/70 text-xs-tight font-normal normal-case leading-none text-faint outline-none transition-colors hover:border-primary hover:text-primary focus-visible:border-primary focus-visible:text-primary"
      aria-label={text}
    >
      i
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 hidden w-60 -translate-x-1/2 rounded-lg border border-border bg-surface px-3 py-2 text-left text-xs-tight font-normal normal-case leading-snug tracking-normal text-muted shadow-card group-hover:block group-focus-visible:block"
      >
        {text}
      </span>
    </span>
  );
}

export function PanelHeader({ title, description, right }: {
  title: string;
  description?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/40 px-5 py-3">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        {description ? <p className="mt-0.5 text-sm-custom leading-snug text-muted">{description}</p> : null}
      </div>
      {right ? <div className="flex shrink-0 flex-wrap items-center gap-2">{right}</div> : null}
    </div>
  );
}

export function StatTile({ label, info, value, tone = 'neutral', sub, compact = false }: {
  label: string;
  info?: string;
  value: string;
  tone?: RateTone;
  sub?: string;
  compact?: boolean;
}) {
  return (
    <div className={`min-w-0 ${compact ? 'stat-tile px-3 py-2' : 'stat-tile px-4 py-3.5'}`}>
      <p className={`stat-label ${compact ? '' : 'text-sm'}`}>
        <span className="min-w-0 truncate" title={label}>{label}</span>
        {info ? <InfoTip text={info} /> : null}
      </p>
      <p className={`stat-value ${compact ? '' : 'mt-1.5 text-lg-loose'} ${tone === 'neutral' ? '' : RATE_TONE_TEXT[tone]}`}>
        {value}
      </p>
      {sub ? <p className={`stat-sub ${compact ? '' : 'mt-2 text-xs'}`}>{sub}</p> : null}
    </div>
  );
}
