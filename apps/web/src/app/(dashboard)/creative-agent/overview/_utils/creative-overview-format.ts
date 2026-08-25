/**
 * Display formatting for the creative dashboard. All metric math happens on
 * the backend; these helpers only turn API fractions and counts into text.
 * `null` always renders as an em dash — missing data is never shown as 0%.
 */

export const formatPercent = (value: number | null | undefined, decimals = 1) =>
  value == null ? '—' : `${(value * 100).toFixed(decimals)}%`;

export const formatCount = (value: number | null | undefined) =>
  value == null ? '—' : new Intl.NumberFormat('en-PH').format(value);

export const formatDecimal = (value: number | null | undefined, decimals = 2) =>
  value == null ? '—' : value.toFixed(decimals);

export const formatCurrency = (value: number | null | undefined) =>
  value == null
    ? '—'
    : new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(value);

export const formatHours = (value: number | null | undefined) => {
  if (value == null) return '—';
  if (value >= 48) return `${(value / 24).toFixed(1)}d`;
  return `${value.toFixed(1)}h`;
};

export const formatScore = (value: number | null | undefined, decimals = 1) =>
  value == null ? '—' : value.toFixed(decimals);

export const titleCase = (value: string) =>
  value.toLowerCase().replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());

/**
 * Display tone for a rate against its floor — three bands, not two:
 * at/above the floor, within 80% of it, or below the kill line.
 * Purely presentational; the verdicts themselves come from the API.
 */
export type RateTone = 'good' | 'warn' | 'bad' | 'neutral';

export function rateTone(value: number | null | undefined, floor: number | null | undefined): RateTone {
  if (value == null || floor == null) return 'neutral';
  if (value >= floor) return 'good';
  if (value >= floor * 0.8) return 'warn';
  return 'bad';
}

/** Inverted tone for rates where lower is better (cancel rate). */
export function inverseRateTone(value: number | null | undefined, floor: number | null | undefined): RateTone {
  if (value == null || floor == null) return 'neutral';
  if (value <= floor) return 'good';
  if (value <= floor * 1.25) return 'warn';
  return 'bad';
}

export const RATE_TONE_TEXT: Record<RateTone, string> = {
  good: 'text-success',
  warn: 'text-warning',
  bad: 'text-destructive',
  neutral: 'text-foreground',
};

/** One severity definition drives every status pill so a state reads the same on every screen. */
export type PillTone = 'neutral' | 'info' | 'success' | 'warning' | 'destructive';

const PILL_BASE = 'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs-tight font-semibold uppercase tracking-wide';

export const REVISION_STATE_META: Record<string, { label: string; tone: PillTone }> = {
  NONE: { label: 'No requests', tone: 'neutral' },
  NEEDS_REVISION: { label: 'Needs Revision', tone: 'warning' },
  RESOLVED: { label: 'Resolved', tone: 'success' },
};

export const PILL_TONE_CLASS: Record<PillTone, string> = {
  neutral: `${PILL_BASE} bg-secondary/40 text-muted dark:bg-secondary/15 dark:text-slate-300`,
  info: `${PILL_BASE} bg-info-soft text-info dark:bg-info/15`,
  success: `${PILL_BASE} bg-success-soft/40 text-success dark:bg-success/15`,
  warning: `${PILL_BASE} bg-warning-soft text-warning dark:bg-warning/15`,
  destructive: `${PILL_BASE} bg-destructive-soft/50 text-destructive dark:bg-destructive/15`,
};

export const CRAFT_VERDICT_META: Record<string, { label: string; tone: PillTone }> = {
  SCALE: { label: 'Scale', tone: 'success' },
  REFRESH: { label: 'Refresh', tone: 'warning' },
  RETIRE: { label: 'Retire', tone: 'destructive' },
};
