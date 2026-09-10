'use client';

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Film,
  Lightbulb,
  Sparkles,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { useCreativeAiAnalysis } from '../_hooks/use-creative-ai-analysis';
import type { CreativeAiEvidenceType, CreativeAiRun, CreativeAiRunStatus, CreativeAiTarget } from '../_types/creative-ai';
import { VideoRegistryDateRangePicker } from './video-registry-date-range-picker';
import { CreativeAiProviderControls } from './creative-ai-provider-controls';

const STATUS_LABELS: Record<CreativeAiRunStatus, string> = {
  QUEUED: 'Queued',
  PREPROCESSING: 'Preparing video',
  CONTEXT_BUILDING: 'Loading performance',
  ANALYZING: 'Analyzing',
  COMPLETED: 'Complete',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
};

const EVIDENCE_TONES: Record<CreativeAiEvidenceType, string> = {
  OBSERVED: 'border-info/30 bg-info-soft text-info',
  MEASURED: 'border-success/30 bg-success-soft/40 text-success',
  HYPOTHESIS: 'border-warning/30 bg-warning-soft/60 text-warning',
};

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
  const date = new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(run.createdAt));
  return `${date} · ${STATUS_LABELS[run.status]}`;
}

function AnalysisStatus({ run }: { run: CreativeAiRun }) {
  const failed = run.status === 'FAILED';
  const complete = run.status === 'COMPLETED';
  const Icon = failed ? AlertCircle : complete ? CheckCircle2 : Clock3;
  return (
    <section className="rounded-xl border border-border bg-background-secondary/40 p-4" aria-live="polite">
      <div className="flex items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${failed ? 'bg-destructive-soft text-destructive' : complete ? 'bg-success-soft text-success' : 'bg-info-soft text-info'}`}>
          {complete || failed ? <Icon className="h-4 w-4" /> : <Spinner className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold text-foreground">{STATUS_LABELS[run.status]}</p>
            <span className="text-xs font-semibold tabular-nums text-muted">{run.progress}%</span>
          </div>
          <p className="mt-1 text-sm text-muted">{run.stage}</p>
          {run.ai ? (
            <p className="mt-1 text-xs text-muted">{run.ai.provider === 'CLAUDE' ? 'Claude' : 'Codex'} · {run.ai.model} · {run.ai.effort.toLowerCase()} thinking</p>
          ) : null}
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-background-secondary">
            <div
              className={`h-full rounded-full transition-all duration-300 ${failed ? 'bg-destructive' : complete ? 'bg-success' : 'bg-info'}`}
              style={{ width: `${Math.max(2, Math.min(run.progress, 100))}%` }}
            />
          </div>
        </div>
      </div>
      {run.errorMessage ? <p className="mt-3 text-sm text-destructive">{run.errorMessage}</p> : null}
    </section>
  );
}

function AnalysisResult({ run }: { run: CreativeAiRun | null }) {
  if (!run?.result) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 text-center">
        <Sparkles className="h-8 w-8 text-primary" />
        <p className="mt-3 font-semibold text-foreground">The analysis will appear here</p>
        <p className="mt-1 max-w-md text-sm text-muted">The worker examines visual frames and then compares the observations with linked Meta and reconciled-order performance.</p>
      </div>
    );
  }

  const result = run.result;
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-primary/30 bg-primary-soft p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="pill border-primary/30 bg-surface px-2 py-1 text-xs font-semibold text-primary-soft-foreground">{result.confidence} confidence</span>
          <span className="text-xs text-primary-soft-foreground">AI recommendations require human review</span>
        </div>
        <h3 className="mt-3 font-semibold text-foreground">{result.verdict}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">{result.summary}</p>
      </section>

      {result.strengths.length || result.risks.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <section className="rounded-xl border border-success/20 bg-success-soft/20 p-4">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground"><CheckCircle2 className="h-4 w-4 text-success" /> What works</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              {result.strengths.map((strength) => <li key={strength}>• {strength}</li>)}
              {!result.strengths.length ? <li>No confirmed strength was identified.</li> : null}
            </ul>
          </section>
          <section className="rounded-xl border border-warning/20 bg-warning-soft/30 p-4">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground"><AlertTriangle className="h-4 w-4 text-warning" /> Risks</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              {result.risks.map((risk) => <li key={risk}>• {risk}</li>)}
              {!result.risks.length ? <li>No material risk was identified.</li> : null}
            </ul>
          </section>
        </div>
      ) : null}

      {result.evidence.length ? (
        <section className="rounded-xl border border-border bg-surface">
          <div className="border-b border-border px-4 py-3">
            <h4 className="text-sm font-semibold text-foreground">Evidence timeline</h4>
          </div>
          <div className="divide-y divide-border">
            {result.evidence.map((evidence, index) => (
              <article key={`${evidence.timestampSeconds}-${index}`} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-foreground">{formatTimestamp(evidence.timestampSeconds)}</span>
                  <span className={`rounded-lg border px-2 py-0.5 text-xs font-semibold ${EVIDENCE_TONES[evidence.evidenceType]}`}>{evidence.evidenceType.toLowerCase()}</span>
                </div>
                <p className="mt-2 text-sm text-foreground">{evidence.observation}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{evidence.metricConnection}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {result.recommendations.length ? (
        <section className="space-y-3">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground"><Lightbulb className="h-4 w-4 text-primary" /> Recommended tests</h4>
          {result.recommendations.map((recommendation, index) => (
            <article key={`${recommendation.action}-${index}`} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-xs font-bold text-primary-soft-foreground">{index + 1}</span>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{recommendation.action}</p>
                  <p className="mt-1 text-sm text-muted">{recommendation.rationale}</p>
                  <dl className="mt-3 space-y-2 rounded-xl bg-background-secondary/60 p-3 text-xs">
                    <div><dt className="font-semibold text-foreground">Hypothesis</dt><dd className="mt-0.5 text-muted">{recommendation.hypothesis}</dd></div>
                    <div><dt className="font-semibold text-foreground">Test</dt><dd className="mt-0.5 text-muted">{recommendation.test}</dd></div>
                  </dl>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : null}

      {result.dataQuality.length || run.warnings.length ? (
        <section className="rounded-xl border border-border bg-background-secondary/40 p-4">
          <h4 className="text-sm font-semibold text-foreground">Data notes</h4>
          <ul className="mt-2 space-y-1 text-xs text-muted">
            {[...new Set([...result.dataQuality, ...run.warnings])].map((note) => <li key={note}>• {note.replaceAll('_', ' ').toLowerCase()}</li>)}
          </ul>
        </section>
      ) : null}
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
  const analysis = useCreativeAiAnalysis({
    item,
    open: Boolean(item),
    initialDateRange: { startDate, endDate },
  });

  return (
    <Dialog open={Boolean(item)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="flex max-h-[92vh] w-11/12 max-w-6xl flex-col overflow-hidden p-0 sm:max-w-6xl">
        {item ? (
          <>
            <div className="border-b border-border bg-background-secondary/30 px-6 py-5">
              <DialogHeader>
                <div className="flex items-center gap-3 pr-8">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"><Sparkles className="h-5 w-5" /></span>
                  <div className="min-w-0">
                    <DialogTitle className="mb-1">Analyze video creative</DialogTitle>
                    <DialogDescription><code className="font-semibold text-primary">{item.code}</code> · {item.title}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>
            </div>

            <div className="min-h-0 overflow-y-auto p-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-5">
                  <section className="panel overflow-hidden">
                    <div className="panel-header"><Film className="panel-icon" /><h3 className="panel-title">Analysis setup</h3></div>
                    <div className="space-y-4 p-4">
                      <div>
                        <label className="form-label" htmlFor="creative-ai-video">Local video file</label>
                        <label htmlFor="creative-ai-video" className="mt-2 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-background-secondary/30 p-4 transition hover:border-primary/50 hover:bg-primary-soft/40">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-primary shadow-sm"><Upload className="h-4 w-4" /></span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-foreground">{analysis.video?.name ?? 'Choose the original video'}</span>
                            <span className="mt-1 block text-xs text-muted">{analysis.video ? `${formatBytes(analysis.video.size)} · ready to upload` : 'MP4, MOV, M4V, or WebM · maximum 250 MB'}</span>
                          </span>
                        </label>
                        <input
                          id="creative-ai-video"
                          type="file"
                          accept="video/mp4,video/quicktime,video/x-m4v,video/webm,.mp4,.mov,.m4v,.webm"
                          className="sr-only"
                          onChange={(event) => {
                            analysis.chooseVideo(event.target.files?.[0] ?? null);
                            event.currentTarget.value = '';
                          }}
                        />
                      </div>

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

                      <div>
                        <label className="form-label">Performance period</label>
                        <div className="mt-2"><VideoRegistryDateRangePicker startDate={analysis.dateRange.startDate} endDate={analysis.dateRange.endDate} onChange={analysis.setDateRange} /></div>
                        <p className="mt-2 text-xs text-muted">Only linked Meta and reconciled-order aggregates inside this period are compared with the video.</p>
                      </div>

                      <div>
                        <label className="form-label" htmlFor="creative-ai-question">What should the AI investigate?</label>
                        <textarea
                          id="creative-ai-question"
                          value={analysis.question}
                          maxLength={2000}
                          rows={4}
                          className="input mt-2 w-full resize-y"
                          onChange={(event) => analysis.setQuestion(event.target.value)}
                        />
                      </div>

                      {analysis.error ? (
                        <div className="flex gap-2 rounded-xl border border-destructive/30 bg-destructive-soft p-3 text-sm text-destructive" role="alert">
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>{analysis.error}</span>
                        </div>
                      ) : null}

                      <Button
                        type="button"
                        className="w-full"
                        loading={analysis.isSubmitting}
                        disabled={!analysis.canStart}
                        iconLeft={<Sparkles className="h-4 w-4" />}
                        onClick={() => void analysis.start()}
                      >
                        {analysis.isRunning ? 'Analysis already running' : 'Start video analysis'}
                      </Button>
                      <p className="text-center text-xs text-muted">The video stays in your local ERP analysis workspace. Only tenant-scoped aggregate data is included.</p>
                    </div>
                  </section>

                  {analysis.runs.length ? (
                    <div>
                      <label className="form-label" htmlFor="creative-ai-history">Recent analyses</label>
                      <select id="creative-ai-history" className="input mt-2 w-full" value={analysis.activeRun?.id ?? ''} onChange={(event) => analysis.selectRun(event.target.value)}>
                        {analysis.runs.map((run) => <option key={run.id} value={run.id}>{runLabel(run)}</option>)}
                      </select>
                    </div>
                  ) : analysis.isLoadingRuns ? (
                    <p className="flex items-center gap-2 text-sm text-muted"><Spinner className="h-4 w-4" /> Loading previous analyses…</p>
                  ) : null}
                </div>

                <div className="min-w-0 space-y-4">
                  {analysis.activeRun ? <AnalysisStatus run={analysis.activeRun} /> : null}
                  <AnalysisResult run={analysis.activeRun} />
                </div>
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
