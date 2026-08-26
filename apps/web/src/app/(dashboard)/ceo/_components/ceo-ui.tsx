'use client';

import type { ReactNode } from 'react';
import { InfoTip } from '../../creative-agent/overview/_components/overview-ui';
import type { StoryCard as StoryCardData, StoryStat, Tone } from '../_types/ceo-dashboard';

/**
 * Four tones, defined once, used by every tile, pill and bar on the screen.
 * Semantic colour is kept separate from the brand accent so green always means
 * good rather than "series 2". Grey is "not measured" — never the same as zero.
 */
export const TONE_TEXT: Record<Tone, string> = {
  healthy: 'text-success',
  warning: 'text-warning',
  critical: 'text-destructive',
  unknown: 'text-muted',
};

export const TONE_SURFACE: Record<Tone, string> = {
  healthy: 'border-success/30 bg-success-soft/40 dark:bg-success/10',
  warning: 'border-warning/30 bg-warning-soft/60 dark:bg-warning/10',
  critical: 'border-destructive/30 bg-destructive-soft/40 dark:bg-destructive/10',
  unknown: 'border-border/50 bg-secondary/20 dark:bg-background-secondary',
};

export const TONE_FILL: Record<Tone, string> = {
  healthy: 'bg-success',
  warning: 'bg-warning',
  critical: 'bg-destructive',
  unknown: 'bg-muted',
};

/** Every value renders as an em dash when unmeasurable — never 0 or 0%. */
export const peso = (value: number | null | undefined) =>
  value == null ? '—' : `₱${Math.round(value).toLocaleString('en-PH')}`;
export const count = (value: number | null | undefined) =>
  value == null ? '—' : new Intl.NumberFormat('en-PH').format(value);
export const percent = (value: number | null | undefined, digits = 1) =>
  value == null ? '—' : `${(value * 100).toFixed(digits)}%`;
export const decimal = (value: number | null | undefined, digits = 2) =>
  value == null ? '—' : value.toFixed(digits);
export const multiple = (value: number | null | undefined) =>
  value == null ? '—' : `${value.toFixed(2)}×`;

export function formatStat(stat: StoryStat): string {
  switch (stat.format) {
    case 'currency': return peso(stat.value);
    case 'percent': return percent(stat.value);
    case 'decimal': return decimal(stat.value);
    case 'multiple': return multiple(stat.value);
    default: return count(stat.value);
  }
}

/**
 * Every section opens with an eyebrow written as a question, so the page reads
 * as an argument rather than a list of widgets.
 */
export function SectionHeader({ eyebrow, title, description }: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <header className="mb-3">
      <p className="text-xs-tight font-semibold uppercase tracking-wide text-primary">{eyebrow}</p>
      <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">{title}</h2>
      {description ? <p className="mt-1 max-w-3xl text-sm-custom leading-snug text-muted">{description}</p> : null}
    </header>
  );
}

/** label + value + optional sub — used everywhere outside the story cards. */
/**
 * One tile carrying two related counts.
 *
 * Used where a single number would blend two different questions — returning
 * stock is still at risk, returned stock is waiting to be re-shelved — and
 * summing them would hide both.
 */
export function SplitTile({ label, left, right, tone = 'unknown', info }: {
  label: string;
  left: { caption: string; value: string };
  right: { caption: string; value: string };
  tone?: Tone;
  info?: string;
}) {
  return (
    <div className="stat-tile">
      <p className="stat-label">
        {label}
        {info ? <InfoTip text={info} /> : null}
      </p>
      <div className="mt-1 flex items-end gap-4">
        {[left, right].map((part, index) => (
          <div key={part.caption} className={index === 1 ? 'border-l border-border/50 pl-4' : ''}>
            <p className={`stat-value text-lg-loose ${index === 0 && tone !== 'unknown' ? TONE_TEXT[tone] : ''}`}>
              {part.value}
            </p>
            <p className="stat-sub">{part.caption}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Tile({ label, value, sub, tone = 'unknown', info }: {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
  info?: string;
}) {
  return (
    <div className="stat-tile">
      <p className="stat-label">
        {label}
        {info ? <InfoTip text={info} /> : null}
      </p>
      <p className={`stat-value mt-1 text-lg-loose ${tone === 'unknown' ? '' : TONE_TEXT[tone]}`}>{value}</p>
      {sub ? <p className="stat-sub">{sub}</p> : null}
    </div>
  );
}

/**
 * Hero number + three stats + a written sentence. The sentence comes from the
 * API and changes with the tone: a number alone makes the reader do the
 * interpretation, the sentence does it for them and cannot be misread.
 */
export function StoryCard({ eyebrow, title, question, card, heroFormat, heroInfo }: {
  eyebrow: string;
  title: string;
  question: string;
  card: StoryCardData | undefined;
  heroFormat: 'currency' | 'percent';
  heroInfo?: string;
}) {
  const tone = card?.tone ?? 'unknown';
  const heroValue = heroFormat === 'currency' ? peso(card?.hero.value) : percent(card?.hero.value);
  return (
    <section className="panel panel-content flex flex-col shadow-card">
      <div className="border-b border-border/40 px-5 py-3">
        <p className="text-xs-tight font-semibold uppercase tracking-wide text-faint">{eyebrow}</p>
        <h3 className="mt-0.5 text-lg font-semibold tracking-tight text-foreground">{title}</h3>
        <p className="mt-0.5 text-sm-custom text-muted">{question}</p>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="stat-label">
          {card?.hero.label ?? '—'}
          {heroInfo ? <InfoTip text={heroInfo} /> : null}
        </p>
        <p className={`mt-1 text-4xl font-semibold tracking-tight tabular-nums ${TONE_TEXT[tone]}`}>{heroValue}</p>
        <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-border/40 pt-4">
          {(card?.stats ?? []).map((stat) => (
            <div key={stat.label} className="min-w-0">
              <dt className="truncate text-xs-tight text-faint" title={stat.label}>{stat.label}</dt>
              <dd className="mt-0.5 text-sm-custom font-semibold text-foreground tabular-nums">{formatStat(stat)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-sm-custom leading-snug text-foreground">{card?.sentence ?? '—'}</p>
      </div>
    </section>
  );
}

export function CollapsibleSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="panel panel-content group shadow-card">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3 [&::-webkit-details-marker]:hidden">
        <span className="text-muted transition-transform group-open:rotate-90">▸</span>
        <span className="text-sm-custom font-semibold text-foreground">{title}</span>
      </summary>
      <div className="border-t border-border/40 p-5">{children}</div>
    </details>
  );
}
