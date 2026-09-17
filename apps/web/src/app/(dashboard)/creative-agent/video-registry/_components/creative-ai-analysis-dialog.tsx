'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock3,
  Film,
  FlaskConical,
  ShieldAlert,
  Sparkles,
  Terminal,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DashboardTabs, type DashboardTabItem } from '@/components/ui/dashboard-tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { useCreativeAiAnalysis } from '../_hooks/use-creative-ai-analysis';
import {
  CREATIVE_AI_SECTION_KEYS,
  isAnalystResult,
  isReviewerResult,
  isSectionedResult,
  type CreativeAiEvidenceType,
  type CreativeAiFinding,
  type CreativeAiRecommendation,
  type CreativeAiResult,
  type CreativeAiResultV1,
  type CreativeAiResultV2,
  type CreativeAiRun,
  type CreativeAiRunStatus,
  type CreativeAiSection,
  type CreativeAiSectionKey,
  type CreativeAiTarget,
  type CreativeLens,
} from '../_types/creative-ai';
import { VideoRegistryDateRangePicker } from './video-registry-date-range-picker';
import { CreativeAiProviderControls } from './creative-ai-provider-controls';
import { CreativeAiPromptPanel } from './creative-ai-prompt-panel';
import { CreativeAiPromotePanel } from './creative-ai-promote-panel';
import {
  NewReviewerView,
  RunningAnalystView,
  analystTabs,
  reviewerTabs,
  type AnalystTab,
  type ReviewerTab,
} from './creative-ai-verdict-views';

const STATUS_LABELS: Record<CreativeAiRunStatus, string> = {
  QUEUED: 'Queued',
  PREPROCESSING: 'Preparing video',
  CONTEXT_BUILDING: 'Loading performance',
  ANALYZING: 'Analyzing',
  COMPLETED: 'Complete',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
};

const SECTION_LABELS: Record<CreativeAiSectionKey, string> = {
  hook: 'Hook',
  storyPacing: 'Story & pacing',
  messageOffer: 'Message & offer',
  productProof: 'Product & proof',
  callToAction: 'Call to action',
  performance: 'Performance',
};

const LENS_LABELS: Record<CreativeLens, string> = {
  DRAFT: 'Launch readiness',
  LIVE: 'Live optimisation',
  WINNER: 'Protect & scale',
  FATIGUED: 'Refresh',
  RETIRED: 'Post-mortem',
};

const EVIDENCE_TONES: Record<CreativeAiEvidenceType, string> = {
  OBSERVED: 'border-info/30 bg-info-soft text-info',
  MEASURED: 'border-success/30 bg-success-soft/40 text-success',
  HYPOTHESIS: 'border-warning/30 bg-warning-soft/60 text-warning',
};

const PRIORITY_TONES: Record<CreativeAiRecommendation['priority'], string> = {
  HIGH: 'bg-destructive-soft text-destructive',
  MEDIUM: 'bg-warning-soft text-warning',
  LOW: 'bg-background-secondary text-muted',
};

const PRIORITY_ORDER: Record<CreativeAiRecommendation['priority'], number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

type TabKey = 'overview' | CreativeAiSectionKey | 'tests' | AnalystTab | ReviewerTab;
/** The six-section report indexes by section; the two-prompt tab keys must never reach it. */
const isSectionKey = (key: TabKey): key is CreativeAiSectionKey => (CREATIVE_AI_SECTION_KEYS as readonly string[]).includes(key);

/** A sectioned result together with the run metadata the worker stores beside it. */
type SectionedResult = CreativeAiResultV2 & Pick<CreativeAiResult, '_run'>;

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTimestamp(seconds: number | null) {
  if (seconds === null) return 'Overall';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

function runLabel(run: CreativeAiRun) {
  const date = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(run.createdAt));
  return `${date} · ${STATUS_LABELS[run.status]}`;
}

function scoreTone(score: number) {
  if (score >= 4) return 'text-success';
  if (score === 3) return 'text-warning';
  return 'text-destructive';
}

function ScoreDots({ score }: { score: number }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`Score ${score} of 5`}>
      {[1, 2, 3, 4, 5].map((step) => (
        <span key={step} className={`h-2 w-2 rounded-full ${step <= score ? (score >= 4 ? 'bg-success' : score === 3 ? 'bg-warning' : 'bg-destructive') : 'bg-border'}`} />
      ))}
      <span className={`ml-1 text-xs font-semibold tabular-nums ${scoreTone(score)}`}>{score}/5</span>
    </span>
  );
}

/** Three dots that fade in sequence, so a still screen still reads as alive. */
function AnimatedEllipsis() {
  return (
    <span aria-hidden className="inline-flex">
      {[0, 0.2, 0.4].map((delay) => (
        <span key={delay} className="animate-[creativeAiDot_1.4s_ease-in-out_infinite]" style={{ animationDelay: `${delay}s` }}>.</span>
      ))}
    </span>
  );
}

/** How long the current step has been running, for the spinning row. */
function useStepSeconds(active: boolean, key: string) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    setSeconds(0);
    if (!active) return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [active, key]);
  return seconds;
}

function formatElapsed(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

/** Ticks once a second so a long model call reads as progress, not a freeze. */
function useElapsed(startedAt: string | null, active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active || !startedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active, startedAt]);
  if (!startedAt) return null;
  return Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000));
}

/**
 * The agent's activity while it works, in the shape an agent console uses:
 * one line per step, the finished ones ticked, the current one spinning.
 * Steps arrive as marker lines the worker writes; anything else is the
 * model's own narration.
 */
type ActivityStep = { kind: 'TOOL' | 'THINKING' | 'TEXT'; label: string; detail?: string };

function parseActivity(text: string): ActivityStep[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap<ActivityStep>((line) => {
      if (line.startsWith('@@TOOL|')) {
        const [, tool, target] = line.split('|');
        return [{ kind: 'TOOL', label: tool || 'Tool', detail: target || undefined }];
      }
      if (line.startsWith('@@THINKING|')) return [{ kind: 'THINKING', label: 'Thinking' }];
      // Narration can arrive as several sentences at once.
      return line
        .replace(/([.!?])(?=[A-Z"'])/g, '$1\n')
        .split('\n')
        .map((sentence) => sentence.trim())
        .filter(Boolean)
        .map((sentence) => ({ kind: 'TEXT' as const, label: sentence }));
    });
}

/**
 * The thinking step. Claude Code redacts the reasoning itself, so there is no
 * text to show; what we can show is that it is working and for how long.
 */
function ThinkingRow({ stepKey }: { stepKey: string }) {
  const seconds = useStepSeconds(true, stepKey);
  return (
    <div className="flex items-start gap-2 text-xs leading-relaxed">
      <span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center">
        <Spinner className="h-3 w-3 text-info" />
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span className="italic text-muted">Thinking<AnimatedEllipsis /></span>
        <span className="flex gap-1" aria-hidden>
          {[0, 0.15, 0.3].map((delay) => (
            <span
              key={delay}
              className="h-1 w-1 rounded-full bg-info/60 animate-[creativeAiDot_1.2s_ease-in-out_infinite]"
              style={{ animationDelay: `${delay}s` }}
            />
          ))}
        </span>
        {seconds > 2 ? <span className="ml-auto shrink-0 tabular-nums text-muted">{formatElapsed(seconds)}</span> : null}
      </span>
    </div>
  );
}

function LiveOutput({ text }: { text: string }) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const steps = useMemo(() => parseActivity(text), [text]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [steps.length]);
  if (!steps.length) return null;

  return (
    <section className="rounded-xl border border-border bg-background-secondary/40">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <Terminal className="h-3.5 w-3.5 text-muted" />
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Activity</h4>
        <span className="ml-auto text-xs tabular-nums text-muted">{steps.filter((step) => step.kind === 'TOOL').length} steps</span>
      </div>
      <div className="max-h-56 space-y-1 overflow-y-auto px-4 py-3">
        {steps.map((step, index) => {
          const current = index === steps.length - 1;
          if (current && step.kind === 'THINKING') return <ThinkingRow key={`${index}-thinking`} stepKey={String(index)} />;
          return (
            <div key={`${index}-${step.label}`} className="flex items-start gap-2 text-xs leading-relaxed">
              <span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                {current
                  ? <Spinner className="h-3 w-3 text-info" />
                  : step.kind === 'TOOL'
                    ? <Check className="h-3 w-3 text-success" />
                    : <span className="h-1 w-1 rounded-full bg-border" />}
              </span>
              {step.kind === 'TOOL' ? (
                <span className="min-w-0">
                  <span className="font-semibold text-foreground">{step.label}</span>
                  {step.detail ? <span className="ml-1.5 font-mono text-muted">{step.detail}</span> : null}
                </span>
              ) : step.kind === 'THINKING' ? (
                <span className="italic text-muted">Thought for a moment</span>
              ) : (
                <span className="text-muted">{step.label}</span>
              )}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
    </section>
  );
}

function AnalysisStatus({ run }: { run: CreativeAiRun }) {
  const failed = run.status === 'FAILED';
  const complete = run.status === 'COMPLETED';
  const cancelled = run.status === 'CANCELLED';
  const ended = failed || complete || cancelled;
  const Icon = failed ? AlertCircle : complete ? CheckCircle2 : Clock3;
  const tone = failed ? 'bg-destructive-soft text-destructive' : complete ? 'bg-success-soft text-success' : cancelled ? 'bg-background-secondary text-muted' : 'bg-info-soft text-info';
  const bar = failed ? 'bg-destructive' : complete ? 'bg-success' : cancelled ? 'bg-muted' : 'bg-info';
  const elapsed = useElapsed(run.startedAt, !ended);
  return (
    <section className="rounded-xl border border-border bg-background-secondary/40 p-4" aria-live="polite">
      <div className="flex items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone}`}>
          {ended ? <Icon className="h-4 w-4" /> : <Spinner className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-1 font-semibold text-foreground">
              {STATUS_LABELS[run.status]}
              {!ended ? <AnimatedEllipsis /> : null}
            </p>
            {/* A percentage would be a guess: the model gives no progress
                signal, so elapsed time is the only honest measure. */}
            <span className="text-xs font-semibold tabular-nums text-muted">
              {elapsed !== null ? formatElapsed(elapsed) : null}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">{run.stage}</p>
          {run.status === 'ANALYZING' ? (
            <p className="mt-1 text-xs text-muted">Reading the frames, then composing the report. Usually 2 to 5 minutes; deeper thinking levels take longer.</p>
          ) : null}
          {ended ? (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-background-secondary">
              <div className={`h-full rounded-full ${bar}`} style={{ width: '100%' }} />
            </div>
          ) : (
            // Indeterminate: a sweep that says "working" without implying a
            // position, because there is no real percentage to report.
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-background-secondary">
              <div className="h-full w-1/3 animate-[creativeAiSweep_1.6s_ease-in-out_infinite] rounded-full bg-info" />
            </div>
          )}
        </div>
      </div>
      {run.errorMessage ? <p className="mt-3 text-sm text-destructive">{run.errorMessage}</p> : null}
    </section>
  );
}

function FindingRow({ finding }: { finding: CreativeAiFinding }) {
  return (
    <article className="py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-semibold text-foreground">{formatTimestamp(finding.timestampSeconds)}</span>
        <span className={`rounded-lg border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${EVIDENCE_TONES[finding.evidenceType]}`}>{finding.evidenceType.toLowerCase()}</span>
      </div>
      <p className="mt-1.5 text-sm text-foreground">{finding.observation}</p>
      {finding.metricConnection ? <p className="mt-1 text-xs leading-relaxed text-muted">{finding.metricConnection}</p> : null}
    </article>
  );
}

function RecommendationCard({ recommendation, index, category }: { recommendation: CreativeAiRecommendation; index: number; category?: CreativeAiSectionKey }) {
  return (
    <article className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-xs font-bold text-primary-soft-foreground">{index + 1}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${PRIORITY_TONES[recommendation.priority]}`}>{recommendation.priority.toLowerCase()}</span>
            {category ? <span className="text-xs text-muted">{SECTION_LABELS[category]}</span> : null}
          </div>
          <p className="mt-2 font-semibold text-foreground">{recommendation.action}</p>
          <p className="mt-1 text-sm text-muted">{recommendation.rationale}</p>
          <dl className="mt-3 grid gap-2 rounded-xl bg-background-secondary/60 p-3 text-xs sm:grid-cols-2">
            <div><dt className="font-semibold text-foreground">Hypothesis</dt><dd className="mt-0.5 text-muted">{recommendation.hypothesis}</dd></div>
            <div><dt className="font-semibold text-foreground">Test</dt><dd className="mt-0.5 text-muted">{recommendation.test}</dd></div>
          </dl>
        </div>
      </div>
    </article>
  );
}

function OverviewView({ result, warnings }: { result: SectionedResult; warnings: string[] }) {
  const { overview } = result;
  const notes = [...new Set([...overview.dataQuality, ...warnings])];
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-primary/30 bg-primary-soft p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="pill border-primary/30 bg-surface px-2 py-1 text-xs font-semibold text-primary-soft-foreground">{overview.confidence} confidence</span>
          {result._run?.lens ? <span className="pill border-primary/30 bg-surface px-2 py-1 text-xs font-semibold text-primary-soft-foreground">{LENS_LABELS[result._run.lens]}</span> : null}
          <span className="text-xs text-primary-soft-foreground">AI recommendations require human review</span>
        </div>
        <h3 className="mt-3 text-lg font-semibold leading-snug text-foreground">{overview.verdict}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">{overview.summary}</p>
      </section>

      <section className="grid gap-2 sm:grid-cols-3">
        {CREATIVE_AI_SECTION_KEYS.map((key) => (
          <div key={key} className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2.5">
            <span className="text-sm font-semibold text-foreground">{SECTION_LABELS[key]}</span>
            <ScoreDots score={result.sections[key].score} />
          </div>
        ))}
      </section>

      {overview.complianceFlags.length ? (
        <section className="rounded-xl border border-destructive/30 bg-destructive-soft p-4">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground"><ShieldAlert className="h-4 w-4 text-destructive" /> Needs compliance review</h4>
          <ul className="mt-2 space-y-1 text-sm text-foreground">
            {overview.complianceFlags.map((flag) => <li key={flag}>• {flag}</li>)}
          </ul>
        </section>
      ) : null}

      {overview.topActions.length ? (
        <section className="space-y-3">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground"><Sparkles className="h-4 w-4 text-primary" /> Do these first</h4>
          {overview.topActions.map((action, index) => <RecommendationCard key={`${action.action}-${index}`} recommendation={action} index={index} category={action.category} />)}
        </section>
      ) : null}

      {notes.length ? (
        <section className="rounded-xl border border-border bg-background-secondary/40 p-4">
          <h4 className="text-sm font-semibold text-foreground">Data notes</h4>
          <ul className="mt-2 space-y-1 text-xs text-muted">
            {notes.map((note) => <li key={note}>• {note.replaceAll('_', ' ').toLowerCase()}</li>)}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function SectionView({ section, label }: { section: CreativeAiSection; label: string }) {
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-foreground">{label}</h3>
          <ScoreDots score={section.score} />
        </div>
        <p className="mt-2 text-sm leading-relaxed text-foreground">{section.verdict}</p>
      </section>

      {section.findings.length ? (
        <section className="rounded-xl border border-border bg-surface px-4">
          <h4 className="pt-3 text-sm font-semibold text-foreground">Evidence</h4>
          <div className="divide-y divide-border">
            {section.findings.map((finding, index) => <FindingRow key={`${finding.timestampSeconds}-${index}`} finding={finding} />)}
          </div>
        </section>
      ) : null}

      {section.recommendations.length ? (
        <section className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground">Recommendations</h4>
          {section.recommendations.map((recommendation, index) => <RecommendationCard key={`${recommendation.action}-${index}`} recommendation={recommendation} index={index} />)}
        </section>
      ) : (
        <p className="text-sm text-muted">No changes recommended for this category.</p>
      )}
    </div>
  );
}

function TestsView({ result }: { result: SectionedResult }) {
  const tests = CREATIVE_AI_SECTION_KEYS
    .flatMap((key) => result.sections[key].recommendations.map((recommendation) => ({ recommendation, category: key })))
    .sort((a, b) => PRIORITY_ORDER[a.recommendation.priority] - PRIORITY_ORDER[b.recommendation.priority]);
  if (!tests.length) return <p className="text-sm text-muted">No tests were recommended.</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Every recommendation across all categories, highest priority first. Each one names what to change, why, the expected effect, and how to measure it.</p>
      {tests.map((entry, index) => <RecommendationCard key={`${entry.category}-${index}`} recommendation={entry.recommendation} index={index} category={entry.category} />)}
    </div>
  );
}

/** Runs analysed before the sectioned prompt keep their flat layout. */
function LegacyResultView({ result, warnings }: { result: CreativeAiResultV1; warnings: string[] }) {
  const notes = [...new Set([...result.dataQuality, ...warnings])];
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">This analysis used the earlier report format. Run it again to get scores per category.</p>
      <section className="rounded-xl border border-primary/30 bg-primary-soft p-5">
        <span className="pill border-primary/30 bg-surface px-2 py-1 text-xs font-semibold text-primary-soft-foreground">{result.confidence} confidence</span>
        <h3 className="mt-3 text-lg font-semibold leading-snug text-foreground">{result.verdict}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">{result.summary}</p>
      </section>
      <div className="grid gap-3 sm:grid-cols-2">
        <section className="rounded-xl border border-success/20 bg-success-soft/20 p-4">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground"><CheckCircle2 className="h-4 w-4 text-success" /> What works</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted">{result.strengths.map((item) => <li key={item}>• {item}</li>)}</ul>
        </section>
        <section className="rounded-xl border border-warning/20 bg-warning-soft/30 p-4">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground"><AlertTriangle className="h-4 w-4 text-warning" /> Risks</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted">{result.risks.map((item) => <li key={item}>• {item}</li>)}</ul>
        </section>
      </div>
      {result.evidence.length ? (
        <section className="rounded-xl border border-border bg-surface px-4">
          <h4 className="pt-3 text-sm font-semibold text-foreground">Evidence timeline</h4>
          <div className="divide-y divide-border">{result.evidence.map((finding, index) => <FindingRow key={index} finding={finding} />)}</div>
        </section>
      ) : null}
      {result.recommendations.length ? (
        <section className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground">Recommended tests</h4>
          {result.recommendations.map((recommendation, index) => <RecommendationCard key={index} recommendation={recommendation} index={index} />)}
        </section>
      ) : null}
      {notes.length ? (
        <section className="rounded-xl border border-border bg-background-secondary/40 p-4">
          <h4 className="text-sm font-semibold text-foreground">Data notes</h4>
          <ul className="mt-2 space-y-1 text-xs text-muted">{notes.map((note) => <li key={note}>• {note.replaceAll('_', ' ').toLowerCase()}</li>)}</ul>
        </section>
      ) : null}
    </div>
  );
}

function EmptyResult() {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 text-center">
      <Sparkles className="h-8 w-8 text-primary" />
      <p className="mt-3 font-semibold text-foreground">The analysis will appear here</p>
      <p className="mt-1 max-w-md text-sm text-muted">Every video is reviewed on the same six categories: hook, story and pacing, message and offer, product and proof, call to action, and performance. The lens depends on the creative’s status.</p>
    </div>
  );
}

type Props = {
  item: CreativeAiTarget | null;
  startDate: string;
  endDate: string;
  onClose: () => void;
};

export function CreativeAiAnalysisDialog({ item, startDate, endDate, onClose }: Props) {
  const analysis = useCreativeAiAnalysis({ item, open: Boolean(item), initialDateRange: { startDate, endDate } });
  const [tab, setTab] = useState<TabKey>('overview');
  const activeRun = analysis.activeRun;
  const result = activeRun?.result ?? null;
  const sectioned = isSectionedResult(result) ? result : null;

  useEffect(() => { setTab('overview'); }, [activeRun?.id]);

  const tabs = useMemo<DashboardTabItem<TabKey>[]>(() => {
    if (isAnalystResult(result)) return analystTabs(result);
    if (isReviewerResult(result)) return reviewerTabs(result);
    if (!sectioned) return [{ value: 'overview', label: 'Overview' }];
    const testCount = CREATIVE_AI_SECTION_KEYS.reduce((sum, key) => sum + sectioned.sections[key].recommendations.length, 0);
    return [
      { value: 'overview', label: 'Overview' },
      ...CREATIVE_AI_SECTION_KEYS.map((key) => ({ value: key, label: SECTION_LABELS[key], badge: `${sectioned.sections[key].score}/5` })),
      { value: 'tests', label: 'Tests', icon: <FlaskConical className="h-3.5 w-3.5" />, badge: testCount },
    ];
  }, [sectioned, result]);

  const showStatus = Boolean(activeRun && (activeRun.status !== 'COMPLETED' || !result));

  return (
    <Dialog open={Boolean(item)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="flex h-[95vh] w-[98vw] max-w-[1500px] flex-col overflow-hidden p-0 sm:w-[96vw] sm:max-w-[1500px]">
        {item ? (
          <>
            <div className="border-b border-border px-4 py-4 sm:px-6">
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-3 pr-8">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"><Sparkles className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <DialogTitle className="mb-0.5">{analysis.isStatic ? 'Image analysis' : 'Video analysis'}</DialogTitle>
                    <DialogDescription><code className="font-semibold text-primary">{item.code}</code> · {item.title}</DialogDescription>
                  </div>
                  {analysis.runs.length ? (
                    <label className="flex w-full items-center gap-2 text-xs text-muted sm:w-auto">
                      <span className="hidden sm:inline">Showing</span>
                      <select className="input h-9 w-full text-xs sm:w-[220px]" value={activeRun?.id ?? ''} onChange={(event) => analysis.selectRun(event.target.value)}>
                        {analysis.runs.map((run) => <option key={run.id} value={run.id}>{runLabel(run)}</option>)}
                      </select>
                    </label>
                  ) : null}
                </div>
              </DialogHeader>
            </div>

            {/* Below xl the setup column sits above the result and the whole
                dialog scrolls as one; from xl it becomes a fixed sidebar that
                scrolls independently of the report. */}
            <div className="grid min-h-0 flex-1 overflow-y-auto xl:grid-cols-[360px_minmax(0,1fr)] xl:overflow-hidden">
              <aside className="border-b border-border bg-background-secondary/30 p-4 sm:p-5 xl:min-h-0 xl:overflow-y-auto xl:border-b-0 xl:border-r">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                  <div>
                    <label className="form-label" htmlFor="creative-ai-video">{analysis.isStatic ? 'Image file' : 'Video file'}</label>
                    <label htmlFor="creative-ai-video" className="mt-2 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-surface p-3 transition hover:border-primary/50 hover:bg-primary-soft/40">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"><Upload className="h-4 w-4" /></span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-foreground">{analysis.video?.name ?? (analysis.isStatic ? 'Choose the original image' : 'Choose the original video')}</span>
                        <span className="mt-0.5 block text-xs text-muted">{analysis.video ? `${formatBytes(analysis.video.size)} · ready` : analysis.isStatic ? 'JPG, PNG, WebP · up to 250 MB' : 'MP4, MOV, M4V, WebM · up to 250 MB'}</span>
                      </span>
                    </label>
                    <input
                      id="creative-ai-video"
                      type="file"
                      accept={analysis.isStatic ? 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp' : 'video/mp4,video/quicktime,video/x-m4v,video/webm,.mp4,.mov,.m4v,.webm'}
                      className="sr-only"
                      onChange={(event) => { analysis.chooseVideo(event.target.files?.[0] ?? null); event.currentTarget.value = ''; }}
                    />
                  </div>

                  <div>
                    <label className="form-label">Performance period</label>
                    <div className="mt-2"><VideoRegistryDateRangePicker startDate={analysis.dateRange.startDate} endDate={analysis.dateRange.endDate} onChange={analysis.setDateRange} /></div>
                    <p className="mt-1.5 text-xs text-muted">Linked Meta and reconciled-order data inside this period.</p>
                  </div>

                  <div className="sm:col-span-2 xl:col-span-1">
                  <CreativeAiProviderControls
                    configLoaded={Boolean(analysis.config)}
                    provider={analysis.provider}
                    model={analysis.model}
                    effort={analysis.effort}
                    canOverride={Boolean(analysis.config?.permissions.canOverrideRuns)}
                    canConfigure={Boolean(analysis.config?.permissions.canConfigure)}
                    connected={Boolean(analysis.selectedProvider?.connected)}
                    providerMessage={analysis.selectedProvider?.message}
                    providers={analysis.config?.providers ?? []}
                    models={analysis.availableModels}
                    efforts={analysis.availableEfforts}
                    onProviderChange={analysis.chooseProvider}
                    onModelChange={analysis.chooseModel}
                    onEffortChange={analysis.setEffort}
                  />
                  </div>

                  {analysis.config ? (
                    <div className="sm:col-span-2 xl:col-span-1">
                      <CreativeAiPromptPanel />
                    </div>
                  ) : null}

                  {analysis.error ? (
                    <div className="flex gap-2 rounded-xl border border-destructive/30 bg-destructive-soft p-3 text-sm text-destructive sm:col-span-2 xl:col-span-1" role="alert">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{analysis.error}</span>
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-2 sm:col-span-2 xl:col-span-1">
                    <Button type="button" className="w-full" loading={analysis.isSubmitting} disabled={!analysis.canStart} iconLeft={<Film className="h-4 w-4" />} onClick={() => void analysis.start()}>
                      {analysis.isRunning ? 'Analysis in progress' : 'Start analysis'}
                    </Button>
                    {analysis.isRunning ? (
                      <Button type="button" variant="outline" className="w-full" loading={analysis.isCancelling} onClick={() => void analysis.cancel()}>Cancel analysis</Button>
                    ) : null}
                  </div>
                  <p className="text-xs leading-relaxed text-muted sm:col-span-2 xl:col-span-1">{analysis.isStatic ? 'The image is used only inside ERP and is removed after the analysis.' : 'The video is used only to extract frames inside ERP and is removed afterwards.'}</p>

                  {/* Once an analysis is finished it can be recorded in the
                      store's knowledge base, which is what future creatives get
                      judged against. */}
                  {activeRun && activeRun.status === 'COMPLETED' ? (
                    <CreativeAiPromotePanel
                      creativeId={item.id}
                      runId={activeRun.id}
                      canManage={Boolean(analysis.config?.permissions.canConfigure)}
                    />
                  ) : null}
                </div>
              </aside>

              <div className="flex flex-col xl:min-h-0">
                {showStatus && activeRun ? (
                  <div className="space-y-3 border-b border-border px-4 py-4 sm:px-6">
                    <AnalysisStatus run={activeRun} />
                    {activeRun.status === 'ANALYZING' && activeRun.responseText ? <LiveOutput text={activeRun.responseText} /> : null}
                    {activeRun.status === 'ANALYZING' && !activeRun.responseText ? (
                      <p className="text-xs text-muted">Reading the frames…</p>
                    ) : null}
                  </div>
                ) : null}
                {result ? (
                  <>
                    <div className="border-b border-border bg-surface px-4 py-3 sm:px-6 xl:sticky xl:top-0 xl:z-10">
                      <DashboardTabs value={tab} items={tabs} onValueChange={setTab} />
                    </div>
                    <div className="flex-1 px-4 py-5 sm:px-6 xl:min-h-0 xl:overflow-y-auto">
                      {isAnalystResult(result) ? (
                        <RunningAnalystView result={result} tab={tab} modeNote={activeRun?.analysisModeNote ?? null} warnings={activeRun?.warnings ?? []} />
                      ) : isReviewerResult(result) ? (
                        <NewReviewerView result={result} tab={tab} modeNote={activeRun?.analysisModeNote ?? null} warnings={activeRun?.warnings ?? []} />
                      ) : sectioned ? (
                        tab === 'overview' ? <OverviewView result={sectioned} warnings={activeRun?.warnings ?? []} />
                          : tab === 'tests' ? <TestsView result={sectioned} />
                            : isSectionKey(tab) ? <SectionView section={sectioned.sections[tab]} label={SECTION_LABELS[tab]} />
                              : <OverviewView result={sectioned} warnings={activeRun?.warnings ?? []} />
                      ) : (
                        <LegacyResultView result={result as CreativeAiResultV1} warnings={activeRun?.warnings ?? []} />
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 px-4 py-5 sm:px-6 xl:min-h-0 xl:overflow-y-auto">
                    {analysis.isLoadingRuns ? <p className="flex items-center gap-2 text-sm text-muted"><Spinner className="h-4 w-4" /> Loading previous analyses…</p> : <EmptyResult />}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
