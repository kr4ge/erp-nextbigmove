import type { Verdict } from './types';

/** Centavos to pesos. The API speaks centavos so nothing rounds on the way here. */
export function peso(centavos: number | null): string {
  if (centavos === null) return '—';
  const value = centavos / 100;
  const sign = value < 0 ? '-' : '';
  return `${sign}₱${Math.abs(value).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
}

export function rate(fraction: number | null): string {
  return fraction === null ? '—' : `${(fraction * 100).toFixed(1)}%`;
}

export function multiple(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(2)}×`;
}

/** Verdicts carry weight, so each one reads differently at a glance. */
export const VERDICT_PILL: Record<Verdict, string> = {
  SCALE: 'pill pill-primary',
  WATCH: 'pill pill-info',
  KILL: 'pill pill-destructive',
  TOO_EARLY: 'pill pill-neutral',
};

export const VERDICT_LABEL: Record<Verdict, string> = {
  SCALE: 'Scale',
  WATCH: 'Watch',
  KILL: 'Kill',
  TOO_EARLY: 'Too early',
};

export function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
