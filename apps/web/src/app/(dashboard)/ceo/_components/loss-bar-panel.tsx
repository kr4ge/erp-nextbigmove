'use client';

import type { CeoDashboardResponse } from '../_types/ceo-dashboard';
import { count, percent, peso } from './ceo-ui';

/**
 * Where every order ended up.
 *
 * Cancelled and returned are kept apart deliberately: a cancellation costs the
 * whole sale but no freight — nothing was dispatched. A return costs freight
 * both ways and the goods come back sellable. Collapsing them into one "lost"
 * figure hides which problem you actually have.
 */
const SEGMENT_FILL: Record<string, string> = {
  DELIVERED: 'bg-success',
  CANCELLED: 'bg-destructive',
  RTS: 'bg-warning',
  SHIPPED: 'bg-info',
  IN_PROCESS: 'bg-muted',
};

export function LossBarPanel({ lossBar }: { lossBar: CeoDashboardResponse['lossBar'] | undefined }) {
  const segments = (lossBar?.segments ?? []).filter((segment) => segment.count > 0);
  const hasData = segments.length > 0;

  return (
    <section className="panel panel-content shadow-card">
      <div className="border-b border-border/40 px-5 py-3">
        <h3 className="text-sm-custom font-semibold text-foreground">Where every order ended up</h3>
        <p className="mt-0.5 text-xs text-muted">
          Every order in the period — count, share, and pesos on the line. Orders still in flight have not landed either way yet.
        </p>
      </div>
      <div className="p-5">
        {hasData ? (
          <>
            <div className="flex h-4 w-full overflow-hidden rounded-full" role="img" aria-label="Order outcome distribution">
              {segments.map((segment) => (
                <span
                  key={segment.key}
                  className={SEGMENT_FILL[segment.key] ?? 'bg-muted'}
                  style={{ width: `${(segment.share ?? 0) * 100}%` }}
                  title={`${segment.label}: ${count(segment.count)} (${percent(segment.share)})`}
                />
              ))}
            </div>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {segments.map((segment) => (
                <div key={segment.key} className="rounded-xl border border-border/50 p-3">
                  <dt className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${SEGMENT_FILL[segment.key] ?? 'bg-muted'}`} />
                    <span className="text-sm-custom font-semibold text-foreground">{segment.label}</span>
                    <span className="ml-auto text-xs text-muted tabular-nums">
                      {count(segment.count)} · {percent(segment.share)}
                    </span>
                  </dt>
                  <dd className="mt-1.5 pl-4.5">
                    <p className="text-sm-custom font-semibold text-foreground tabular-nums">{peso(segment.value)}</p>
                    <p className="text-xs-tight text-faint">{segment.note}</p>
                  </dd>
                </div>
              ))}
            </dl>
            {lossBar && lossBar.inFlightOrders > 0 ? (
              <p className="mt-4 text-xs-tight leading-snug text-faint">
                {count(lossBar.inFlightOrders)} orders are still in flight — the rates elsewhere are calculated on the
                orders that have settled, since an undelivered order is not a failure yet.
              </p>
            ) : null}
          </>
        ) : (
          <p className="py-6 text-center text-sm text-muted">No orders in this period.</p>
        )}
      </div>
    </section>
  );
}
