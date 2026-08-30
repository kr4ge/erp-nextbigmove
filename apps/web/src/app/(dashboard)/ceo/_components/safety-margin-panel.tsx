'use client';

import { InfoTip } from '../../creative-agent/overview/_components/overview-ui';
import { Spinner } from '@/components/ui/spinner';
import type { CeoDashboardResponse } from '../_types/ceo-dashboard';
import { multiple, peso, TONE_FILL, TONE_TEXT } from './ceo-ui';
import type { Tone } from '../_types/ceo-dashboard';

const TONE_PILL: Record<Tone, string> = {
  healthy: 'bg-success-soft/50 text-success dark:bg-success/15',
  warning: 'bg-warning-soft text-warning dark:bg-warning/15',
  critical: 'bg-destructive-soft/50 text-destructive dark:bg-destructive/15',
  unknown: 'bg-secondary/40 text-muted dark:bg-secondary/15',
};

/**
 * The hero panel: can I scale?
 *
 * The same fact is shown twice on purpose. The multiple is precise but
 * abstract; the bar is imprecise but instantly legible — how close am I to the
 * edge. Different people read the two differently and showing both costs
 * nothing.
 */
export function SafetyMarginPanel({ safety, loading }: { safety: CeoDashboardResponse['safetyMargin'] | undefined; loading?: boolean }) {
  const tone = safety?.tone ?? 'unknown';
  const headroom = safety?.headroom ?? null;
  const label = headroom === null
    ? 'Not measured'
    : headroom < 1 ? 'Losing money'
    : headroom <= 2 ? 'Thin margin'
    : 'Room to scale';

  return (
    <div className="grid gap-4">
      {/* Left: the multiple. */}
      <section className="panel panel-content shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 px-4 py-2.5">
          <h3 className="flex items-center gap-1 text-sm-custom font-semibold text-foreground">
            Safety margin
            <InfoTip text="Break-even CPP ÷ what you actually pay per order. Above 1× each order can afford what it cost to acquire." />
            <span className="font-normal text-muted"> — can you scale?</span>
          </h3>
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs-tight font-semibold ${TONE_PILL[tone]}`}>
            {label}
          </span>
        </div>
        <div className="px-4 py-4">
          <p className={`text-4xl font-semibold leading-none tracking-tight tabular-nums ${TONE_TEXT[tone]} ${tone === 'critical' ? 'motion-safe:animate-pulse' : ''}`}>
            {loading ? <Spinner className="h-6 w-6" /> : multiple(headroom)}
          </p>

          {/* Three bands with a marker. The scale tops out at 4× — beyond that
              the exact number stops changing any decision. */}
          <div className="mt-4">
            <div className="relative h-2 w-full overflow-hidden rounded-full">
              <div className="absolute inset-0 flex">
                <span className="h-full bg-destructive/70" style={{ width: '25%' }} />
                <span className="h-full bg-warning/70" style={{ width: '25%' }} />
                <span className="h-full bg-success/70" style={{ width: '50%' }} />
              </div>
            </div>
            {safety?.markerPosition != null ? (
              <div className="relative h-3">
                <span
                  className="absolute -translate-x-1/2 text-xs-tight text-foreground"
                  style={{ left: `${safety.markerPosition * 100}%` }}
                  aria-hidden="true"
                >
                  ▲
                </span>
              </div>
            ) : <div className="h-3" />}
            <div className="flex justify-between text-xs-tight text-faint">
              <span>Losing &lt;1×</span>
              <span>Thin</span>
              <span>Scale &gt;2×</span>
            </div>
          </div>
        </div>
      </section>

      {/* Right: the same fact, physically. */}
      <section className="panel panel-content shadow-card">
        <div className="border-b border-border/40 px-4 py-2.5">
          <h3 className="text-sm-custom font-semibold text-foreground">What you pay vs what you can afford</h3>
          <p className="mt-0.5 text-xs text-muted">Ad spend per order, against the break-even ceiling</p>
        </div>
        <div className="px-4 py-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="stat-label">CPP<InfoTip text="Ad spend ÷ orders placed — what you actually pay to buy one order." /></p>
              <p className="mt-0.5 text-xl font-semibold text-foreground tabular-nums">{loading ? <Spinner className="h-4 w-4" /> : peso(safety?.cpp)}</p>
            </div>
            <div className="text-right">
              <p className="stat-label justify-end">Break-even<InfoTip text="deliveryRate × margin − rtsRate × RTS cost. The most an order can afford to have cost in ads." /></p>
              <p className="mt-0.5 text-xl font-semibold text-foreground tabular-nums">{loading ? <Spinner className="h-4 w-4" /> : peso(safety?.breakevenCpp)}</p>
            </div>
          </div>

          {/* A bar filling toward the break-even line. Touching the line means
              you are paying exactly what you can afford, and nothing more. */}
          <div className="relative mt-4 h-2.5 w-full overflow-hidden rounded-full bg-secondary/40 dark:bg-background-secondary">
            <div
              className={`h-full rounded-full transition-all ${TONE_FILL[tone]}`}
              style={{ width: `${(safety?.fill ?? 0) * 100}%` }}
            />
            <span className="absolute inset-y-0 right-0 w-0.5 bg-destructive" aria-hidden="true" />
          </div>
          <p className="mt-2 text-xs text-muted">
            {safety?.netPerOrder == null
              ? 'Not enough delivered orders to measure the room per order.'
              : safety.netPerOrder >= 0
                ? `${peso(safety.netPerOrder)} of room per order.`
                : `${peso(Math.abs(safety.netPerOrder))} short on every order.`}
          </p>
        </div>
      </section>
    </div>
  );
}
