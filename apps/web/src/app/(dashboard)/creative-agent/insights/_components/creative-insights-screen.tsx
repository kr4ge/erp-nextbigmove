'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCcw, Sparkles, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { PanelHeader } from '../../overview/_components/overview-ui';
import { createVideoRegistryItem } from '../../video-registry/_services/video-registry.service';
import { fetchInsightQueue, generateVariants, runDiagnose } from '../_services/creative-insights.service';
import type { InsightQueueResponse, InsightSuggestion, SuggestionUrgency, VariantBrief, VariantsResponse } from '../_types/creative-insights';
import { VariantsDialog } from './variants-dialog';

const pct = (value: number | null | undefined, decimals = 1) =>
  value == null ? '—' : `${(value * 100).toFixed(decimals)}%`;

const URGENCY_META: Record<SuggestionUrgency, { label: string; className: string }> = {
  REFRESH_NOW: { label: 'Refresh now', className: 'bg-warning-soft text-warning' },
  MORE_VARIATIONS: { label: 'Proven winner', className: 'bg-success-soft/40 text-success' },
};

/** Week-over-week cell: current value with last week's beside it when it moved. */
function Trend({ cur, prev }: { cur: number | null; prev: number | null }) {
  if (cur == null) return <span className="text-muted">—</span>;
  if (prev == null) return <span>{pct(cur)}</span>;
  const falling = cur < prev;
  return (
    <span className="whitespace-nowrap">
      {pct(cur)}
      <span className={`ml-1 text-xs ${falling ? 'text-destructive' : 'text-muted'}`}>← {pct(prev)}</span>
    </span>
  );
}

export function CreativeInsightsScreen() {
  const [data, setData] = useState<InsightQueueResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnoseError, setDiagnoseError] = useState<string | null>(null);
  const [variantsFor, setVariantsFor] = useState<InsightSuggestion | null>(null);
  const [variants, setVariants] = useState<VariantsResponse | null>(null);
  const [variantsBusy, setVariantsBusy] = useState(false);
  const [variantsError, setVariantsError] = useState<string | null>(null);
  const [enrollNotice, setEnrollNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try { setData(await fetchInsightQueue()); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to load Creative Insights.'); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const diagnose = async () => {
    setDiagnosing(true);
    setDiagnoseError(null);
    try {
      const run = await runDiagnose();
      setData((current) => (current ? { ...current, latestRun: run, diagnoseUsedToday: true } : current));
    } catch (err) {
      setDiagnoseError(err instanceof Error ? err.message : 'Analysis failed.');
    } finally {
      setDiagnosing(false);
    }
  };

  const openVariants = async (row: InsightSuggestion) => {
    setVariantsFor(row);
    setVariants(null);
    setVariantsError(null);
    setVariantsBusy(true);
    try { setVariants(await generateVariants(row.id)); }
    catch (err) { setVariantsError(err instanceof Error ? err.message : 'Variant generation failed.'); }
    finally { setVariantsBusy(false); }
  };

  const enrollVariant = async (brief: VariantBrief) => {
    if (!variants?.creative.storeId || !variantsFor) {
      throw new Error('The parent creative has no store — enroll from the Video Registry instead.');
    }
    const created = await createVideoRegistryItem({
      storeId: variants.creative.storeId,
      // A variant sells what its parent sells, so it inherits the item when the
      // parent has one. A parent registered before items were recorded has
      // none, and that no longer blocks the enrolment.
      variationId: variants.creative.variationId ?? undefined,
      kind: 'VIDEO',
      title: brief.title,
      mediaUrl: '',
      format: brief.format,
      hookType: brief.hookType,
      angle: brief.angle,
      remixOfCode: variantsFor.code,
      script: [`HOOK: ${brief.hook}`, '', brief.script].join('\n'),
      notes: `Creative Insights variant of ${variantsFor.code} — ${brief.rationale}`,
    });
    setEnrollNotice(`${created.code} enrolled as a variant of ${variantsFor.code}.`);
    await load();
    return created.code;
  };

  return (
    <div className="mx-auto max-w-screen-xl">
      <PageHeader
        title="Creative Insights"
        description="Which of your creatives deserve fresh versions, and the angles that are working — so your next batch is ready before the current one fades."
        breadcrumbs="Creative Workspace"
      />

      <div className="space-y-4">
        {error ? (
          <div className="panel panel-content p-6 text-center">
            <p className="text-sm font-semibold text-foreground">Creative Insights could not load</p>
            <p className="mt-1 text-sm text-muted">{error}</p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={load}>Try again</Button>
          </div>
        ) : null}

        {enrollNotice ? (
          <div className="panel panel-content flex items-center justify-between gap-3 border-success/40 p-4">
            <p className="text-sm text-foreground">{enrollNotice}</p>
            <button type="button" className="text-xs font-medium text-muted hover:text-foreground" onClick={() => setEnrollNotice(null)}>Dismiss</button>
          </div>
        ) : null}

        <section className="panel panel-content shadow-card">
          <PanelHeader
            title="Make these next"
            description={data
              ? `Suggested refreshes from ${data.window.econStart} to ${data.window.end}. A creative lands here by earning it — a winner worth more variations, or a performer starting to fade.`
              : 'Suggested refreshes from your last 30 days.'}
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead>
                <tr className="border-b border-border/20 text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-5 py-3 font-medium">Suggestion</th>
                  <th className="px-3 py-3 font-medium">Creative</th>
                  <th className="px-3 py-3 text-right font-medium">Orders</th>
                  <th className="px-3 py-3 text-right font-medium">AR%</th>
                  <th className="px-3 py-3 text-right font-medium">Hook (wk)</th>
                  <th className="px-3 py-3 text-right font-medium">CTR (wk)</th>
                  <th className="px-3 py-3 font-medium">Why</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {isLoading && !data ? (
                  <tr><td colSpan={8} className="px-5 py-10 text-center text-muted">Reading your last 30 days…</td></tr>
                ) : data && data.suggestions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-muted">
                      Nothing to refresh yet — a creative lands here once it proves itself (10+ orders under the AR% bar) or starts to fade while working. Keep publishing; the registry is where it starts.
                    </td>
                  </tr>
                ) : (
                  data?.suggestions.map((row) => (
                    <tr key={row.id} className="border-b border-border/10 align-top last:border-0">
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${URGENCY_META[row.urgency].className}`}>
                          {URGENCY_META[row.urgency].label}
                        </span>
                      </td>
                      <td className="px-3 py-3.5">
                        <p className="font-semibold text-foreground">{row.title}</p>
                        <p className="mt-0.5 font-mono text-xs font-bold text-primary">{row.code}
                          {row.remixOfCode ? <span className="ml-2 font-sans font-normal text-muted">↳ from {row.remixOfCode}</span> : null}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">
                          {[row.angle, row.hookType, row.format].filter(Boolean).join(' · ') || 'no tags — add angle in the registry'}
                        </p>
                      </td>
                      <td className="px-3 py-3.5 text-right tabular-nums">{row.metrics.orders30 || '—'}</td>
                      <td className="px-3 py-3.5 text-right tabular-nums">{pct(row.metrics.arPct30)}</td>
                      <td className="px-3 py-3.5 text-right tabular-nums"><Trend cur={row.metrics.hookCur} prev={row.metrics.hookPrev} /></td>
                      <td className="px-3 py-3.5 text-right tabular-nums"><Trend cur={row.metrics.ctrCur} prev={row.metrics.ctrPrev} /></td>
                      <td className="max-w-[300px] px-3 py-3.5 text-xs leading-snug text-muted">{row.reason}</td>
                      <td className="px-5 py-3.5 text-right">
                        <Button variant="secondary" size="sm" iconLeft={<Wand2 className="h-4 w-4" />} onClick={() => openVariants(row)} disabled={!data.aiConfigured} title={data.aiConfigured ? 'Generate variant briefs' : 'Ask the main admin to add the Anthropic key in Settings → AI'}>
                          Variants
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {data && data.others.length > 0 ? (
            <details className="border-t border-border/40 px-5 py-3">
              <summary className="cursor-pointer text-xs font-medium text-muted">
                Not in the list yet · {data.others.length} creative{data.others.length === 1 ? '' : 's'}
              </summary>
              <ul className="mt-2 space-y-1.5">
                {data.others.map((row) => (
                  <li key={row.id} className="text-xs text-muted">
                    <span className="font-mono font-semibold text-foreground">{row.code}</span>
                    <span className="ml-2">{row.title}</span>
                    <span className="ml-2">— {row.note}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>

        <section className="panel panel-content shadow-card">
          <PanelHeader
            title="What's working — winners vs losers"
            description="The overall read of your rolling last 30 days: what the winners share, what the losers share, the best angles, and the variations to try next. One run per day — you click it, nothing sends on its own."
            right={(
              <Button
                variant="primary" size="sm"
                iconLeft={diagnosing ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                onClick={diagnose}
                disabled={diagnosing || !data?.aiConfigured || data?.diagnoseUsedToday}
                title={data?.aiConfigured === false
                  ? 'Ask the main admin to add the Anthropic key in Settings → AI'
                  : data?.diagnoseUsedToday
                    ? 'Today’s run is done — back tomorrow'
                    : undefined}
              >
                {diagnosing ? 'Analyzing…' : data?.diagnoseUsedToday ? 'Done for today' : 'Run analysis'}
              </Button>
            )}
          />
          <div className="p-5">
            {data?.aiConfigured === false ? (
              <p className="text-sm text-muted">AI analysis is off — ask the main admin to add the Anthropic key in <span className="font-medium text-foreground">Settings → AI</span>.</p>
            ) : diagnoseError ? (
              <p className="text-sm text-destructive">{diagnoseError}</p>
            ) : data?.latestRun ? (
              <div>
                <p className="text-xs text-muted">
                  {new Date(data.latestRun.createdAt).toLocaleString('en-PH')} · {data.latestRun.model} · {data.latestRun.periodStart.slice(0, 10)} to {data.latestRun.periodEnd.slice(0, 10)}
                </p>
                <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{data.latestRun.answer}</div>
              </div>
            ) : (
              <p className="text-sm text-muted">No analysis yet. Run it once a few of your creatives have real results — it refuses to guess from thin data.</p>
            )}
          </div>
        </section>
      </div>

      {variantsFor ? (
        <VariantsDialog
          parent={variantsFor}
          busy={variantsBusy}
          error={variantsError}
          result={variants}
          onEnroll={enrollVariant}
          onClose={() => { setVariantsFor(null); setVariants(null); setVariantsError(null); }}
        />
      ) : null}
    </div>
  );
}
