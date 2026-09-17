'use client';

import { AlertTriangle, BookOpen, CheckCircle2, Database, Layers, ShieldAlert, Target, Wrench } from 'lucide-react';
import type { DashboardTabItem } from '@/components/ui/dashboard-tabs';
import type { CreativeAiResultAnalyst, CreativeAiResultReviewer } from '../_types/creative-ai';

/**
 * Tabbed renderers for the two-prompt results.
 *
 * The running analyst returns a verdict on what a creative earned; the reviewer
 * returns a decision on how a new creative is made. Each gets its own tab set,
 * so a long report never becomes one scroll and the reader can jump straight to
 * the evidence, the fixes, or the classification.
 */

export type AnalystTab = 'overview' | 'evidence' | 'diagnosis' | 'structure' | 'lesson';
export type ReviewerTab = 'overview' | 'fixes' | 'risk' | 'data' | 'structure';

export function analystTabs(result: CreativeAiResultAnalyst): DashboardTabItem<AnalystTab>[] {
  const flags = result.complianceFlags?.length ?? 0;
  return [
    { value: 'overview', label: 'Overview' },
    { value: 'evidence', label: 'Evidence', badge: result.evidence.length },
    { value: 'diagnosis', label: 'Why', icon: <Target className="h-3.5 w-3.5" /> },
    { value: 'structure', label: 'How it is built', icon: <Layers className="h-3.5 w-3.5" /> },
    { value: 'lesson', label: 'Lesson', icon: <BookOpen className="h-3.5 w-3.5" />, ...(flags ? { badge: flags } : {}) },
  ];
}

export function reviewerTabs(result: CreativeAiResultReviewer): DashboardTabItem<ReviewerTab>[] {
  return [
    { value: 'overview', label: 'Overview' },
    { value: 'fixes', label: 'Keep & fix', icon: <Wrench className="h-3.5 w-3.5" />, badge: result.whatToFix.length },
    { value: 'risk', label: 'Audience risk', icon: <ShieldAlert className="h-3.5 w-3.5" />, badge: result.audienceQualityFlags.length },
    { value: 'data', label: 'What our data says', icon: <Database className="h-3.5 w-3.5" /> },
    { value: 'structure', label: 'How it is built', icon: <Layers className="h-3.5 w-3.5" /> },
  ];
}

const VERDICT_TONE: Record<string, string> = {
  SCALE: 'border-success/30 bg-success-soft/30 text-success',
  WATCH: 'border-warning/30 bg-warning-soft/40 text-warning',
  KILL: 'border-destructive/30 bg-destructive-soft text-destructive',
  APPROVE: 'border-success/30 bg-success-soft/30 text-success',
  REVISE: 'border-warning/30 bg-warning-soft/40 text-warning',
  REJECT: 'border-destructive/30 bg-destructive-soft text-destructive',
};

const seconds = (value: number | null | undefined) => (value == null ? null : `${value % 1 === 0 ? value : value.toFixed(1)}s`);
const words = (value: string) => value.replaceAll('_', ' ').toLowerCase();

export function RunningAnalystView({
  result,
  tab,
  modeNote,
  warnings,
}: {
  result: CreativeAiResultAnalyst;
  tab: string;
  modeNote: string | null;
  warnings: string[];
}) {
  switch (tab) {
    case 'evidence':
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted">Every number here comes from Meta or the ERP for the analysed period. The note beside each says how it compares with the product&apos;s target, or that no target is set.</p>
          <section className="rounded-xl border border-border bg-surface">
            <div className="divide-y divide-border">
              {result.evidence.map((row, index) => (
                <div key={index} className="grid gap-1 px-4 py-3 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4">
                  <span className="text-sm text-muted">{row.metric}</span>
                  <span>
                    <span className="text-sm font-medium tabular-nums">{row.value}</span>
                    {row.versusTarget ? <span className="mt-0.5 block text-xs leading-relaxed text-muted">{row.versusTarget}</span> : null}
                  </span>
                </div>
              ))}
            </div>
          </section>
          <DataNotes warnings={warnings} />
        </div>
      );
    case 'diagnosis':
      return (
        <div className="space-y-4">
          <section className="rounded-xl border border-border bg-surface p-5">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Funnel reading</h4>
            <p className="mt-2 text-sm leading-relaxed">{result.diagnosis.funnelReading}</p>
            <h4 className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted">What in the creative explains it</h4>
            <p className="mt-2 text-sm leading-relaxed">{result.diagnosis.creativeElement}</p>
            {result.diagnosis.notTheCreative ? (
              <p className="mt-4 rounded-lg bg-muted-soft px-3 py-2 text-sm text-muted">Not the creative&apos;s fault: {result.diagnosis.notTheCreative}</p>
            ) : null}
          </section>
          {result.audienceQuality.failed ? (
            <Note tone="stop" icon={<ShieldAlert className="h-4 w-4" />} title="Audience-quality failure">
              {result.audienceQuality.suspectedElement ?? 'The buyers this creative attracted did not pay.'}
            </Note>
          ) : (
            <p className="text-xs text-muted">No audience-quality failure was found.</p>
          )}
        </div>
      );
    case 'structure':
      return <AttributesGrid attributes={result.attributes} />;
    case 'lesson':
      return (
        <div className="space-y-4">
          <section className="rounded-xl border border-primary/30 bg-primary-soft/40 p-5">
            <h4 className="flex items-center gap-2 text-sm font-semibold"><BookOpen className="h-4 w-4 text-primary" /> Lesson for the knowledge base</h4>
            <p className="mt-2 text-sm leading-relaxed">{result.lesson}</p>
            <p className="mt-3 text-xs text-muted">This one line, with the classification and the verdict, is what the knowledge base keeps when you add this creative to it.</p>
          </section>
          {result.complianceFlags?.length ? (
            <Note tone="stop" icon={<ShieldAlert className="h-4 w-4" />} title="Needs compliance review">
              <ul className="space-y-1">{result.complianceFlags.map((flag) => <li key={flag}>• {flag}</li>)}</ul>
            </Note>
          ) : (
            <p className="text-xs text-muted">No compliance flags were raised.</p>
          )}
        </div>
      );
    default:
      return (
        <div className="space-y-4">
          <section className={`rounded-xl border p-5 ${VERDICT_TONE[result.verdict] ?? 'border-border bg-surface'}`}>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span className="rounded-full border border-current px-2 py-0.5 text-sm">{result.verdict}</span>
              <span className="rounded bg-surface/70 px-2 py-0.5 text-foreground">{words(result.verdictReason)}</span>
              <span className="rounded bg-surface/70 px-2 py-0.5 text-foreground">{result.confidence} confidence</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-foreground">{result.action.what}</p>
            <p className="mt-1 text-xs text-foreground/80">
              {result.action.byHowMuch ? `${result.action.byHowMuch} · ` : ''}
              {result.action.when}
            </p>
            {modeNote ? <p className="mt-2 text-xs text-foreground/70">{modeNote}</p> : null}
          </section>
          {!result.dataSufficiency.sufficient ? (
            <Note tone="warn" icon={<AlertTriangle className="h-4 w-4" />} title="Not enough data yet">
              {result.dataSufficiency.note}
              {result.dataSufficiency.recheckAfter ? ` Re-check ${result.dataSufficiency.recheckAfter}.` : ''}
            </Note>
          ) : null}
          <section className="rounded-xl border border-border bg-surface p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">In short</h4>
            <p className="mt-2 text-sm leading-relaxed">{result.diagnosis.funnelReading}</p>
          </section>
        </div>
      );
  }
}

export function NewReviewerView({
  result,
  tab,
  modeNote,
  warnings,
}: {
  result: CreativeAiResultReviewer;
  tab: string;
  modeNote: string | null;
  warnings: string[];
}) {
  switch (tab) {
    case 'fixes':
      return (
        <div className="grid gap-3 lg:grid-cols-2">
          <section className="rounded-xl border border-success/20 bg-success-soft/20 p-4">
            <h4 className="flex items-center gap-2 text-sm font-semibold"><CheckCircle2 className="h-4 w-4 text-success" /> Keep these</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted">{result.whatWorks.map((item) => <li key={item}>• {item}</li>)}</ul>
          </section>
          <section className="rounded-xl border border-warning/20 bg-warning-soft/30 p-4">
            <h4 className="flex items-center gap-2 text-sm font-semibold"><Wrench className="h-4 w-4 text-warning" /> Fix these</h4>
            {result.whatToFix.length ? (
              <ol className="mt-3 space-y-3 text-sm">
                {result.whatToFix.map((fix, index) => (
                  <li key={index} className="flex gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface text-[11px] font-semibold text-warning">{index + 1}</span>
                    <span className="min-w-0">
                      <span className="text-foreground">
                        {seconds(fix.timestampSeconds) ? <span className="mr-1.5 font-mono text-xs text-primary">{seconds(fix.timestampSeconds)}</span> : null}
                        {fix.fix}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-muted">{fix.why}</span>
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-sm text-muted">Nothing to fix.</p>
            )}
          </section>
          {result.unfixableReason ? (
            <div className="lg:col-span-2">
              <Note tone="stop" icon={<AlertTriangle className="h-4 w-4" />} title="Why a re-edit cannot solve it">{result.unfixableReason}</Note>
            </div>
          ) : null}
        </div>
      );
    case 'risk':
      return result.audienceQualityFlags.length ? (
        <Note tone="stop" icon={<ShieldAlert className="h-4 w-4" />} title="Elements that may attract buyers who do not pay">
          <ul className="space-y-2.5">
            {result.audienceQualityFlags.map((flag, index) => (
              <li key={index}>
                {seconds(flag.timestampSeconds) ? <span className="mr-1.5 font-mono text-xs">{seconds(flag.timestampSeconds)}</span> : null}
                {flag.element}
                <span className="block text-xs opacity-80">{flag.basis === 'CRAFT_JUDGEMENT' ? 'Craft judgement, no record supports it yet' : flag.basis}</span>
              </li>
            ))}
          </ul>
        </Note>
      ) : (
        <div className="rounded-xl border border-success/20 bg-success-soft/20 p-5 text-sm">
          <p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4 text-success" /> None found</p>
          <p className="mt-1 text-muted">Nothing in this creative looks like it would pull in orders that get cancelled or refused.</p>
        </div>
      );
    case 'data':
      return (
        <div className="space-y-4">
          <section className={`rounded-xl border p-5 ${result.dataBasis.corpusUsable ? 'border-border bg-surface' : 'border-warning/30 bg-warning-soft/30'}`}>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">{result.dataBasis.corpusUsable ? 'Compared with this store’s knowledge base' : 'Knowledge base too thin to compare against'}</h4>
            <p className="mt-2 text-sm leading-relaxed">{result.dataBasis.note}</p>
            {result.dataBasis.matchedPatterns?.length ? (
              <ul className="mt-3 space-y-1.5 text-sm">{result.dataBasis.matchedPatterns.map((pattern) => <li key={pattern}>• {pattern}</li>)}</ul>
            ) : null}
          </section>
          {result.checksNotPerformed?.length ? (
            <p className="text-xs text-muted">Not checked: {result.checksNotPerformed.join('; ')}</p>
          ) : null}
          <DataNotes warnings={warnings} />
        </div>
      );
    case 'structure':
      return <AttributesGrid attributes={result.attributes} />;
    default:
      return (
        <div className="space-y-4">
          <section className={`rounded-xl border p-5 ${VERDICT_TONE[result.decision] ?? 'border-border bg-surface'}`}>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span className="rounded-full border border-current px-2 py-0.5 text-sm">{result.decision}</span>
              <span className="rounded bg-surface/70 px-2 py-0.5 text-foreground">quality {result.qualityScore}/100</span>
              <span className="rounded bg-surface/70 px-2 py-0.5 text-foreground">{words(result.noveltyLabel)}</span>
              <span className="rounded bg-surface/70 px-2 py-0.5 text-foreground">{result.confidence}% confidence</span>
            </div>
            {result.iteratesOn ? <p className="mt-3 text-sm leading-relaxed text-foreground">{result.iteratesOn}</p> : null}
            {result.testHypothesis ? <p className="mt-3 text-sm leading-relaxed text-foreground">{result.testHypothesis}</p> : null}
            {modeNote ? <p className="mt-2 text-xs text-foreground/70">{modeNote}</p> : null}
          </section>
          {result.openingQuote ? (
            <section className="rounded-xl border border-border bg-surface p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">First 3 seconds</h4>
              <p className="mt-2 text-sm italic leading-relaxed">&ldquo;{result.openingQuote}&rdquo;</p>
            </section>
          ) : null}
          {result.scoreBreakdown ? <ScoreBreakdown breakdown={result.scoreBreakdown} /> : null}
        </div>
      );
  }
}

function ScoreBreakdown({ breakdown }: { breakdown: NonNullable<CreativeAiResultReviewer['scoreBreakdown']> }) {
  const rows: Array<[string, number | undefined, number]> = [
    ['Hook, first 3 seconds', breakdown.hook, 30],
    ['Clarity of message and offer', breakdown.clarity, 20],
    ['Structure and pacing', breakdown.structurePacing, 15],
    ['Production quality', breakdown.production, 15],
    ['Call to action', breakdown.cta, 10],
    ['Originality against our library', breakdown.originality, 10],
  ];
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Quality score</h4>
      <p className="mt-1 text-xs text-muted">How well the creative is made. Not a forecast of performance.</p>
      <div className="mt-3 space-y-2">
        {rows.map(([label, value, max]) => (
          <div key={label} className="grid grid-cols-[1fr_auto] items-center gap-3 text-sm">
            <span className="text-muted">{label}</span>
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-24 overflow-hidden rounded-full bg-muted-soft">
                <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.round(((value ?? 0) / max) * 100)}%` }} />
              </span>
              <span className="w-12 text-right tabular-nums">{value ?? '–'}/{max}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function AttributesGrid({ attributes }: { attributes: CreativeAiResultAnalyst['attributes'] }) {
  const rows: Array<[string, string]> = [
    ['Angle', attributes.angle],
    ['Hook', attributes.hookType],
    ['Format', attributes.format],
    ['Speaker', attributes.speaker],
    ['Length', attributes.durationBucket],
    ['Offer', attributes.offerShown],
    ['CTA', attributes.ctaType],
    ['Price shown', attributes.priceVisible ? 'yes' : 'no'],
  ];
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">The fixed classification every creative gets, so records in the knowledge base can be compared with each other.</p>
      <section className="rounded-xl border border-border bg-surface p-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        {attributes.otherNote ? <p className="mt-3 text-xs text-muted">{attributes.otherNote}</p> : null}
      </section>
    </div>
  );
}

function Note({ tone, icon, title, children }: { tone: 'warn' | 'stop'; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  const classes = tone === 'stop' ? 'border-destructive/30 bg-destructive-soft text-destructive' : 'border-warning/30 bg-warning-soft/40 text-warning';
  return (
    <section className={`rounded-xl border p-4 ${classes}`}>
      <h4 className="flex items-center gap-2 text-sm font-semibold">{icon} {title}</h4>
      <div className="mt-2 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

function DataNotes({ warnings }: { warnings: string[] }) {
  if (!warnings.length) return null;
  return (
    <section className="rounded-xl border border-border bg-background-secondary/40 p-4">
      <h4 className="text-sm font-semibold">Data notes</h4>
      <ul className="mt-2 space-y-1 text-xs text-muted">{[...new Set(warnings)].map((note) => <li key={note}>• {words(note)}</li>)}</ul>
    </section>
  );
}
