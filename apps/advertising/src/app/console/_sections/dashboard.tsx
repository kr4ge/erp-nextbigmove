'use client';

import { AlertTriangle, CalendarDays, LineChart, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AlertBanner } from '@/components/ui/feedback';
import { peso, rate } from '../_lib/format';
import type { Dashboard } from '../_lib/types';
import { MonthCalendar } from '../_components/month-calendar';
import { SpendChart } from '../_components/spend-chart';

/**
 * A metric card.
 *
 * `value === null` means nobody measured it, and that reads differently from a
 * measured zero — so the card says so in words instead of printing a number
 * that would be a lie.
 */
function Metric({
  label,
  value,
  formula,
  missing,
  tone = 'default',
}: {
  label: string;
  value: string | null;
  formula: string;
  missing?: string;
  tone?: 'default' | 'good' | 'bad';
}) {
  const toneClass = tone === 'good' ? 'text-success' : tone === 'bad' ? 'text-destructive' : 'text-foreground';

  return (
    <div className="card">
      <div className="min-w-0 space-y-1.5">
        <p className="card-label">{label}</p>
        {value === null ? (
          <>
            <p className="card-value text-muted">—</p>
            <p className="text-sm text-muted">{missing ?? 'hindi pa nasusukat'}</p>
          </>
        ) : (
          <>
            <p className={`card-value ${toneClass}`}>{value}</p>
            <p className="text-sm text-muted">{formula}</p>
          </>
        )}
      </div>
    </div>
  );
}

export function DashboardSection({
  data,
  loading,
  canEvaluate,
  verdict,
  evaluating,
  evaluateError,
  onEvaluate,
}: {
  data: Dashboard | null;
  loading: boolean;
  canEvaluate: boolean;
  verdict: string;
  evaluating: boolean;
  evaluateError: string;
  onEvaluate: () => void;
}) {
  if (loading && !data) {
    return (
      <section className="panel panel-content">
        <div className="p-6 text-sm text-muted">Loading…</div>
      </section>
    );
  }

  if (!data) return null;

  const { advertising: ad, creative, benchmark } = data;
  const NOT_MEASURED = 'kailangan ng video columns sa export';

  return (
    <div className="flex flex-col gap-6">
      {data.attention.map((item) => (
        <div
          key={item.message}
          className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-amber-warning-soft px-4 py-3"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div>
            <p className="text-xs-tight font-semibold uppercase tracking-wide text-warning">
              Kailangan ng atensyon
            </p>
            <p className="mt-0.5 text-sm text-foreground">{item.message}</p>
          </div>
        </div>
      ))}

      <section className="flex flex-col gap-3">
        <h3 className="text-xs-tight font-medium uppercase tracking-wide text-muted">
          Advertising metrics
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Metric
            label="Cost per click"
            value={ad.cpc === null ? null : peso(ad.cpc)}
            formula="spend ÷ link clicks"
            missing="walang link click na naitala"
          />
          <Metric
            label="Cost per purchase"
            value={ad.cpp === null ? null : peso(ad.cpp)}
            formula="spend ÷ orders placed"
            missing="walang order na naiugnay"
            tone={ad.cpp !== null && ad.cpp > benchmark.cpp ? 'bad' : 'default'}
          />
          <Metric
            label="Purchases"
            value={String(ad.purchases)}
            formula="orders placed · mula sa POS"
          />
          <Metric
            label="AR%"
            value={ad.arPct === null ? null : rate(ad.arPct)}
            formula="spend ÷ gross sales · mas mababa, mas mabuti"
            missing="walang benta sa panahong ito"
            tone={ad.arPct !== null && ad.arPct < 0.3 ? 'good' : 'default'}
          />
          <Metric
            label="Ads spent"
            value={peso(ad.spend)}
            formula="sa panahong ito"
          />
          <Metric
            label="Creative tagged"
            value={ad.creativeTaggedPct === null ? null : rate(ad.creativeTaggedPct)}
            formula={`${peso(ad.untaggedSpend)} untagged · pangalanan ang ads`}
            missing="walang gastos sa panahong ito"
            tone={ad.creativeTaggedPct !== null && ad.creativeTaggedPct < 0.8 ? 'bad' : 'good'}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-xs-tight font-medium uppercase tracking-wide text-muted">
          Creative metrics
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Metric
            label="Hook rate"
            value={creative.hookRate === null ? null : rate(creative.hookRate)}
            formula="3s plays ÷ impressions"
            missing={NOT_MEASURED}
          />
          <Metric
            label="Hold rate"
            value={creative.holdRate === null ? null : rate(creative.holdRate)}
            formula="thruplays ÷ 3s plays"
            missing={NOT_MEASURED}
          />
          <Metric
            label="ThruPlay rate"
            value={creative.thruPlayRate === null ? null : rate(creative.thruPlayRate)}
            formula="thruplays ÷ impressions"
            missing={NOT_MEASURED}
          />
          <Metric
            label="Average watch"
            value={creative.avgWatchSeconds === null ? null : `${creative.avgWatchSeconds.toFixed(0)}s`}
            formula="video average play time"
            missing={NOT_MEASURED}
          />
          <Metric
            label="Click-through rate"
            value={creative.ctr === null ? null : rate(creative.ctr)}
            formula="link clicks ÷ impressions"
            missing="walang impression sa panahong ito"
          />
          <Metric
            label="Conversion rate"
            value={creative.cvr === null ? null : rate(creative.cvr)}
            formula="orders ÷ landing page views"
            missing="kailangan ng Landing page views sa export"
          />
        </div>
      </section>

      <section className="panel panel-content">
        <div className="panel-header flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2">
            <LineChart className="panel-icon" />
            <h4 className="panel-title">Daily spend &amp; orders</h4>
          </div>
          <span className="ml-auto hidden shrink-0 text-xs-tight text-muted sm:inline">
            {peso(ad.orderValue)} order value · {peso(ad.delivered)} delivered · {peso(ad.spend)} spent
          </span>
        </div>
        <SpendChart daily={data.daily} markers={data.markers} />
      </section>

      <section className="panel panel-content">
        <div className="panel-header flex items-center gap-2">
          <CalendarDays className="panel-icon" />
          <h4 className="panel-title">Monthly summary</h4>
        </div>
        <MonthCalendar daily={data.daily} cppCeiling={benchmark.cpp} markers={data.markers} />
      </section>

      <section className="panel panel-content">
        <div className="panel-header flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2">
            <Sparkles className="panel-icon" />
            <h4 className="panel-title">Ask the evaluator</h4>
          </div>
          {canEvaluate ? (
            <div className="ml-auto shrink-0">
              <Button variant="primary" size="sm" onClick={onEvaluate} disabled={evaluating}>
                {evaluating ? 'Binabasa ang panahon…' : 'Run evaluator'}
              </Button>
            </div>
          ) : null}
        </div>
        <div className="p-3">
          {evaluateError ? <AlertBanner tone="error" message={evaluateError} /> : null}
          {verdict ? (
            <pre className="whitespace-pre-wrap break-words rounded-xl bg-secondary/30 p-4 text-sm text-foreground">
              {verdict}
            </pre>
          ) : !evaluateError ? (
            <p className="text-sm text-muted">
              Kalkulado na ang bawat numero sa itaas. Binabasa ng evaluator ang naayos nang
              posisyon at sinasabi kung ano ang dapat gawin dito.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
