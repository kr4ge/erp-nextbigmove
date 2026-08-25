'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCcw, Sparkles, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { PanelHeader } from '../../overview/_components/overview-ui';
import { createVideoRegistryItem } from '../../video-registry/_services/video-registry.service';
import { fetchInsightQueue, generateVariants, runDiagnose } from '../_services/ads-insight.service';
import type { InsightQueueResponse, InsightRow, InsightVerdict, VariantBrief, VariantsResponse } from '../_types/ads-insight';
import { VariantsDialog } from './variants-dialog';

const pct = (value: number | null | undefined, decimals = 1) =>
  value == null ? '—' : `${(value * 100).toFixed(decimals)}%`;
const peso = (value: number) => `₱${Math.round(value).toLocaleString('en-PH')}`;

const VERDICT_META: Record<InsightVerdict, { label: string; className: string }> = {
  SCALE: { label: 'Scale', className: 'bg-success-soft/40 text-success' },
  REFRESH: { label: 'Refresh', className: 'bg-warning-soft text-warning' },
  KILL: { label: 'Kill', className: 'bg-destructive-soft/50 text-destructive' },
  WATCH: { label: 'Watch', className: 'bg-info-soft text-info' },
  TESTING: { label: 'Testing', className: 'bg-secondary/40 text-muted dark:bg-secondary/15 dark:text-slate-300' },
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

export function AdsInsightScreen() {
  const [data, setData] = useState<InsightQueueResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnoseError, setDiagnoseError] = useState<string | null>(null);
  const [variantsFor, setVariantsFor] = useState<InsightRow | null>(null);
  const [variants, setVariants] = useState<VariantsResponse | null>(null);
  const [variantsBusy, setVariantsBusy] = useState(false);
  const [variantsError, setVariantsError] = useState<string | null>(null);
  const [enrollNotice, setEnrollNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try { setData(await fetchInsightQueue()); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to load Ads Insight.'); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const diagnose = async () => {
    setDiagnosing(true);
    setDiagnoseError(null);
    try {
      const run = await runDiagnose();
      setData((current) => (current ? { ...current, latestRun: run } : current));
    } catch (err) {
      setDiagnoseError(err instanceof Error ? err.message : 'Analysis failed.');
    } finally {
      setDiagnosing(false);
    }
  };

  const openVariants = async (row: InsightRow) => {
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
      kind: 'VIDEO',
      title: brief.title,
      mediaUrl: '',
      format: brief.format,
      hookType: brief.hookType,
      angle: brief.angle,
      remixOfCode: variantsFor.code,
      script: [`HOOK: ${brief.hook}`, '', brief.script].join('\n'),
      notes: `Ads Insight variant of ${variantsFor.code} — ${brief.rationale}`,
    });
    setEnrollNotice(`${created.code} enrolled as a variant of ${variantsFor.code}.`);
    await load();
    return created.code;
  };

  const counts = data?.counts;

  return (
    <div className="mx-auto max-w-screen-xl">
      <PageHeader
        title="Ads Insight"
        description="This week's decisions: what to scale, what to refresh before it dies, what to kill — and the next batch to make."
        breadcrumbs="Creative Workspace"
      />

      <div className="space-y-4">
        {error ? (
          <div className="panel panel-content p-6 text-center">
            <p className="text-sm font-semibold text-foreground">Ads Insight could not load</p>
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
            title="Decide queue"
            description={data
              ? `Economics over ${data.window.econStart} to ${data.window.end}; fatigue compared week-over-week. Winner bar: 10+ orders at AR% ≤ ${pct(data.window.rule.arCeiling, 0)}; kill line ${pct(data.window.rule.killLine, 0)}.`
              : 'Economics over the last 30 days; fatigue compared week-over-week.'}
            right={counts ? (
              <div className="flex flex-wrap items-center gap-2">
                {(Object.keys(VERDICT_META) as InsightVerdict[]).map((key) => (
                  <span key={key} className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${VERDICT_META[key].className}`}>
                    {VERDICT_META[key].label} · {counts[key] ?? 0}
                  </span>
                ))}
              </div>
            ) : undefined}
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="border-b border-border/20 text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-5 py-3 font-medium">Verdict</th>
                  <th className="px-3 py-3 font-medium">Creative</th>
                  <th className="px-3 py-3 text-right font-medium">Orders</th>
                  <th className="px-3 py-3 text-right font-medium">AR%</th>
                  <th className="px-3 py-3 text-right font-medium">Ad Spent</th>
                  <th className="px-3 py-3 text-right font-medium">Hook (wk)</th>
                  <th className="px-3 py-3 text-right font-medium">CTR (wk)</th>
                  <th className="px-3 py-3 font-medium">Why</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {isLoading && !data ? (
                  <tr><td colSpan={9} className="px-5 py-10 text-center text-muted">Loading the queue…</td></tr>
                ) : data && data.rows.length === 0 ? (
                  <tr><td colSpan={9} className="px-5 py-10 text-center text-muted">No creatives enrolled yet — the queue starts at the Video Registry.</td></tr>
                ) : (
                  data?.rows.map((row) => (
                    <tr key={row.id} className="border-b border-border/10 align-top last:border-0">
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${VERDICT_META[row.verdict].className}`}>
                          {VERDICT_META[row.verdict].label}
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
                      <td className="px-3 py-3.5 text-right font-semibold">{peso(row.metrics.spend30)}</td>
                      <td className="px-3 py-3.5 text-right tabular-nums"><Trend cur={row.metrics.hookCur} prev={row.metrics.hookPrev} /></td>
                      <td className="px-3 py-3.5 text-right tabular-nums"><Trend cur={row.metrics.ctrCur} prev={row.metrics.ctrPrev} /></td>
                      <td className="max-w-[300px] px-3 py-3.5 text-xs leading-snug text-muted">{row.reason}</td>
                      <td className="px-5 py-3.5 text-right">
                        {row.verdict === 'SCALE' || row.verdict === 'REFRESH' ? (
                          <Button variant="secondary" size="sm" iconLeft={<Wand2 className="h-4 w-4" />} onClick={() => openVariants(row)} disabled={!data.aiConfigured} title={data.aiConfigured ? 'Generate variant briefs' : 'Set ANTHROPIC_API_KEY on the API to enable'}>
                            Variants
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel panel-content shadow-card">
          <PanelHeader
            title="What's working — winners vs losers"
            description="Claude reads every judged creative's script, ad copy, tags, and numbers, and says what the winners share, what the losers share, and the three sharpest next tests."
            right={(
              <Button variant="primary" size="sm" iconLeft={diagnosing ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} onClick={diagnose} disabled={diagnosing || !data?.aiConfigured} title={data?.aiConfigured === false ? 'Set ANTHROPIC_API_KEY on the API to enable' : undefined}>
                {diagnosing ? 'Analyzing…' : data?.latestRun ? 'Run again' : 'Run analysis'}
              </Button>
            )}
          />
          <div className="p-5">
            {data?.aiConfigured === false ? (
              <p className="text-sm text-muted">AI analysis is off — set <code>ANTHROPIC_API_KEY</code> on the API server to enable this and the variant generator.</p>
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
              <p className="text-sm text-muted">No analysis yet. Run it once there are a few judged creatives — it refuses to guess from thin data.</p>
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
