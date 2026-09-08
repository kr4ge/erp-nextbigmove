'use client';

import { TrendingUp } from 'lucide-react';
import { VERDICT_LABEL, VERDICT_PILL, peso, rate } from '../_lib/format';
import type { Position } from '../_lib/types';

export function PerformanceSection({
  position,
  loading,
}: {
  position: Position | null;
  loading: boolean;
}) {
  const ads = position?.ads ?? [];
  const counts = {
    scale: ads.filter((a) => a.verdict === 'SCALE').length,
    watch: ads.filter((a) => a.verdict === 'WATCH').length,
    kill: ads.filter((a) => a.verdict === 'KILL').length,
    early: ads.filter((a) => a.verdict === 'TOO_EARLY').length,
  };

  return (
    <section className="panel panel-content">
      <div className="panel-header flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <TrendingUp className="panel-icon" />
          <h4 className="panel-title">Ads ({ads.length})</h4>
        </div>
        <span className="ml-auto hidden shrink-0 text-xs-tight text-muted sm:inline">
          {counts.scale} scale · {counts.watch} watch · {counts.kill} kill
          {counts.early > 0 ? ` · ${counts.early} too early` : ''}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left">
          <thead className="bg-secondary/30">
            <tr>
              <th className="px-5 py-3 text-xs-tight font-medium uppercase text-muted">Verdict</th>
              <th className="px-5 py-3 text-xs-tight font-medium uppercase text-muted">Ad</th>
              <th className="px-5 py-3 text-xs-tight font-medium uppercase text-muted">Spend</th>
              <th className="px-5 py-3 text-xs-tight font-medium uppercase text-muted">Orders</th>
              <th className="px-5 py-3 text-xs-tight font-medium uppercase text-muted">Net</th>
              <th className="px-5 py-3 text-xs-tight font-medium uppercase text-muted">CPP</th>
              <th className="px-5 py-3 text-xs-tight font-medium uppercase text-muted">Delivery</th>
              <th className="px-5 py-3 text-xs-tight font-medium uppercase text-muted">Cancels</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-sm text-muted">Loading…</td>
              </tr>
            ) : ads.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-sm text-muted">
                  No advertising data for these dates. Upload the Meta report for this period first.
                </td>
              </tr>
            ) : (
              ads.map((ad) => (
                <tr key={ad.adId} className="border-b border-border/10 hover:bg-secondary/20">
                  <td className="px-5 py-3.5">
                    <span className={VERDICT_PILL[ad.verdict]}>{VERDICT_LABEL[ad.verdict]}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm-custom font-medium text-foreground">
                        {ad.adName || ad.adId}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {ad.campaignName || '—'}
                        {ad.marketingAssociate ? ` · ${ad.marketingAssociate}` : ''}
                      </p>
                      <p className="mt-1 text-xs text-muted">{ad.reason}</p>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-sm-custom text-foreground">{peso(ad.spend)}</td>
                  <td className="px-5 py-3.5 text-sm-custom text-foreground">{ad.purchases}</td>
                  <td
                    className={`px-5 py-3.5 text-sm-custom font-semibold ${
                      ad.netContribution < 0 ? 'text-destructive' : 'text-foreground'
                    }`}
                  >
                    {peso(ad.netContribution)}
                  </td>
                  <td className="px-5 py-3.5 text-sm-custom text-foreground">{peso(ad.cpp)}</td>
                  <td className="px-5 py-3.5 text-sm-custom text-foreground">{rate(ad.deliveryRate)}</td>
                  <td className="px-5 py-3.5 text-sm-custom text-foreground">{rate(ad.cancelRate)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
