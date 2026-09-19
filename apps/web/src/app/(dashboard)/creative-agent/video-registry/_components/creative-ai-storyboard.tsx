'use client';

import { useMemo } from 'react';
import { AlertTriangle, Film, ImageOff, Mic, MicOff, Scissors, Type, User } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import type {
  CreativeAiBeats,
  CreativeAiMediaManifest,
  CreativeAiMetricsSnapshot,
  CreativeAiRunFrame,
  CreativeAiTimelineEntry,
} from '../_types/creative-ai';

/**
 * The creative scene by scene: a thumbnail per scene with what was seen,
 * shown and said, the moments that matter, and, for a creative that has run,
 * the delivery metrics pinned to the scenes they describe.
 *
 * Read left to right it is the diagnosis: a weak opening under the hook rate,
 * a static stretch where the hold rate bleeds, a price card that arrives too
 * late against the store's winners.
 */

export type StoryboardProps = {
  timeline: CreativeAiTimelineEntry[];
  beats?: CreativeAiBeats | null;
  frames: CreativeAiRunFrame[];
  loadingFrames?: boolean;
  manifest?: CreativeAiMediaManifest | null;
  metrics?: CreativeAiMetricsSnapshot | null;
  kind: 'VIDEO' | 'STATIC';
  /** Pins delivery metrics onto scenes; only meaningful for a creative that has run. */
  showMetrics?: boolean;
};

const ROLE_LABEL: Record<CreativeAiTimelineEntry['role'], string> = {
  HOOK: 'Hook',
  PROBLEM: 'Problem',
  PROOF: 'Proof',
  DEMO: 'Demo',
  OFFER: 'Offer',
  CTA: 'Call to action',
  OTHER: 'Other',
};

const stamp = (seconds: number | null | undefined) => (seconds == null ? null : `${seconds.toFixed(1)}s`);
const pct = (value: number | null | undefined) => (value == null ? null : `${Math.round(value * 100)}%`);

type Pin = { label: string; value: string; tone: 'neutral' | 'warn' };

export function CreativeAiStoryboard({ timeline, beats, frames, loadingFrames, manifest, metrics, kind, showMetrics }: StoryboardProps) {
  const duration = manifest?.durationSeconds ?? (timeline.length ? Math.max(...timeline.map((entry) => entry.endSeconds)) : null);
  const pacing = manifest?.pacing ?? null;
  const transcriptStatus = manifest?.transcript?.status ?? null;

  const pins = useMemo(() => buildPins(timeline, metrics ?? null, duration, Boolean(showMetrics)), [timeline, metrics, duration, showMetrics]);
  const frameFor = useMemo(() => frameResolver(frames, kind), [frames, kind]);

  return (
    <div className="space-y-4">
      {kind === 'VIDEO' ? (
        <section className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-border bg-surface px-4 py-3 text-xs text-muted">
          <span className="flex items-center gap-1.5"><Film className="h-3.5 w-3.5" /> {duration != null ? `${duration.toFixed(1)}s` : 'Duration unknown'} · {timeline.length} scene{timeline.length === 1 ? '' : 's'}</span>
          {pacing ? (
            <>
              <span className="flex items-center gap-1.5"><Scissors className="h-3.5 w-3.5" /> {pacing.cutsPerMinute} cuts/min{pacing.firstCutAt != null ? `, first at ${stamp(pacing.firstCutAt)}` : ''}</span>
              <span>Longest static run {pacing.longestStaticRun.seconds}s from {stamp(pacing.longestStaticRun.startSeconds)}</span>
              {pacing.hasSpeech ? (
                <span className="flex items-center gap-1.5"><Mic className="h-3.5 w-3.5" /> Speech from {stamp(pacing.speechStartsAt)}{pacing.speechCoverage != null ? `, ${pct(pacing.speechCoverage)} of the ad` : ''}{pacing.wordsPerMinute ? `, ${pacing.wordsPerMinute} wpm` : ''}</span>
              ) : (
                <span className="flex items-center gap-1.5"><MicOff className="h-3.5 w-3.5" /> {transcriptStatus === 'COMPLETED' ? 'No speech' : 'No transcript'}</span>
              )}
            </>
          ) : null}
        </section>
      ) : null}

      {beats ? <BeatsStrip beats={beats} kind={kind} /> : null}

      {showMetrics && metrics?.retention?.points?.length ? <RetentionStrip points={metrics.retention.points} /> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {timeline.map((entry, index) => {
          const frame = frameFor(entry);
          const entryPins = pins.get(index) ?? [];
          const fix = entry.keepOrFix === 'FIX';
          return (
            <article key={index} className={`flex flex-col overflow-hidden rounded-xl border bg-surface ${fix ? 'border-warning/40' : 'border-border'}`}>
              <div className="relative aspect-[4/3] bg-black/90">
                {frame?.url ? (
                  <img src={frame.url} alt={`Scene ${index + 1}`} className="h-full w-full object-contain" loading="lazy" />
                ) : loadingFrames ? (
                  <div className="flex h-full items-center justify-center"><Spinner className="h-4 w-4 text-white/60" /></div>
                ) : (
                  <div className="flex h-full items-center justify-center text-white/40"><ImageOff className="h-5 w-5" /></div>
                )}
                <span className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[11px] text-white">
                  {kind === 'STATIC' ? `Region ${index + 1}` : `${stamp(entry.startSeconds)} – ${stamp(entry.endSeconds)}`}
                </span>
                <span className={`absolute right-2 top-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${fix ? 'bg-warning text-white' : 'bg-white/90 text-foreground'}`}>
                  {ROLE_LABEL[entry.role] ?? entry.role}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-2 px-3.5 py-3 text-sm">
                <p className="leading-snug">{entry.whatIsSeen}</p>
                {entry.onScreenText ? (
                  <p className="flex items-start gap-1.5 text-xs text-muted"><Type className="mt-0.5 h-3 w-3 shrink-0" /><span className="font-mono">{entry.onScreenText}</span></p>
                ) : null}
                {entry.spokenLine ? (
                  <p className="flex items-start gap-1.5 text-xs italic text-muted"><Mic className="mt-0.5 h-3 w-3 shrink-0" /><span>&ldquo;{entry.spokenLine}&rdquo;</span></p>
                ) : null}
                {entry.technique ? <p className="text-xs text-muted">{entry.technique}</p> : null}
                {entry.issue ? (
                  <p className="flex items-start gap-1.5 rounded-lg bg-warning-soft/40 px-2.5 py-1.5 text-xs text-warning"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />{entry.issue}</p>
                ) : null}
                {entryPins.length ? (
                  <dl className="mt-auto flex flex-wrap gap-1.5 border-t border-dashed border-border pt-2">
                    {entryPins.map((pin) => (
                      <div key={pin.label} className={`rounded px-2 py-0.5 font-mono text-[11px] ${pin.tone === 'warn' ? 'bg-warning-soft/50 text-warning' : 'bg-muted-soft text-muted'}`}>
                        <dt className="inline">{pin.label} </dt>
                        <dd className="inline font-semibold">{pin.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function BeatsStrip({ beats, kind }: { beats: CreativeAiBeats; kind: 'VIDEO' | 'STATIC' }) {
  const moments: Array<[string, number | null]> = kind === 'VIDEO'
    ? [
        ['Hook ends', beats.hookEndsAt],
        ['Product', beats.productFirstSeenAt],
        ['Price', beats.priceFirstSeenAt],
        ['CTA', beats.ctaFirstSeenAt],
      ]
    : [];
  const flags: Array<[string, boolean, React.ReactNode]> = [
    ['face', beats.faceInFirst3s, <User key="f" className="h-3 w-3" />],
    ['speech', beats.speechInFirst3s, <Mic key="s" className="h-3 w-3" />],
    ['text', beats.textInFirst3s, <Type key="t" className="h-3 w-3" />],
  ];
  return (
    <section className="flex flex-wrap items-center gap-2 text-xs">
      {moments.map(([label, at]) => (
        <span key={label} className={`rounded-full border px-2.5 py-1 ${at == null ? 'border-warning/40 text-warning' : 'border-border text-foreground'}`}>
          {label} <span className="font-mono font-semibold">{at == null ? 'never' : stamp(at)}</span>
        </span>
      ))}
      <span className="ml-1 text-muted">{kind === 'VIDEO' ? 'First 3 seconds:' : 'Present:'}</span>
      {flags.map(([label, present, icon]) => (
        <span key={label} className={`flex items-center gap-1 rounded-full border px-2 py-1 ${present ? 'border-border text-foreground' : 'border-dashed border-border text-muted line-through'}`}>
          {icon} {label}
        </span>
      ))}
    </section>
  );
}

function RetentionStrip({ points }: { points: NonNullable<CreativeAiMetricsSnapshot['retention']>['points'] }) {
  return (
    <section className="rounded-xl border border-border bg-surface px-4 py-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Who was still watching</h4>
      <div className="mt-2 grid gap-2 sm:grid-cols-5">
        {points.map((point) => (
          <div key={point.label} className="rounded-lg bg-muted-soft px-2.5 py-2 text-xs">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-muted">{point.label}{point.atSeconds != null ? ` · ${stamp(point.atSeconds)}` : ''}</span>
              {point.sceneIndex != null ? <span className="text-[10px] text-muted">scene {point.sceneIndex + 1}</span> : null}
            </div>
            <div className="mt-1 text-sm font-semibold tabular-nums">{pct(point.of3sViewers) ?? '—'} <span className="text-[11px] font-normal text-muted">of 3s viewers</span></div>
            {point.lostSincePrevious != null && point.lostSincePrevious > 0 ? (
              <div className={`text-[11px] ${point.lostSincePrevious >= 0.3 ? 'text-warning' : 'text-muted'}`}>−{pct(point.lostSincePrevious)} since previous</div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

/** Which stored thumbnail shows a scene: the frame at or just before its start. */
function frameResolver(frames: CreativeAiRunFrame[], kind: 'VIDEO' | 'STATIC') {
  const sorted = [...frames].filter((frame) => frame.url).sort((a, b) => (a.timestampSeconds ?? 0) - (b.timestampSeconds ?? 0));
  return (entry: CreativeAiTimelineEntry): CreativeAiRunFrame | null => {
    if (sorted.length === 0) return null;
    if (kind === 'STATIC') return sorted[0];
    let best: CreativeAiRunFrame | null = null;
    for (const frame of sorted) {
      const at = frame.timestampSeconds ?? 0;
      if (at <= entry.startSeconds + 0.6) best = frame;
      else break;
    }
    return best ?? sorted[0];
  };
}

/**
 * Pin each delivery metric to the scene it measures: the hook rate under the
 * opening, the hold rate at the 15-second mark, completion at the end, and
 * every retention point at the scene containing its moment.
 */
function buildPins(timeline: CreativeAiTimelineEntry[], metrics: CreativeAiMetricsSnapshot | null, duration: number | null, enabled: boolean): Map<number, Pin[]> {
  const pins = new Map<number, Pin[]>();
  if (!enabled || !metrics || timeline.length === 0) return pins;
  const add = (index: number, pin: Pin) => pins.set(index, [...(pins.get(index) ?? []), pin]);
  const indexAt = (seconds: number) => {
    let found = 0;
    timeline.forEach((entry, index) => { if (entry.startSeconds <= seconds) found = index; });
    return found;
  };
  const rates = metrics.metrics ?? null;
  if (rates?.hookRate != null) add(0, { label: 'hook rate', value: pct(rates.hookRate)!, tone: rates.hookRate < 0.25 ? 'warn' : 'neutral' });
  if (rates?.holdRate != null) {
    const at = duration != null && duration < 15 ? timeline.length - 1 : indexAt(15);
    add(at, { label: 'hold rate', value: pct(rates.holdRate)!, tone: rates.holdRate < 0.4 ? 'warn' : 'neutral' });
  }
  if (rates?.completionRate != null) add(timeline.length - 1, { label: 'completion', value: pct(rates.completionRate)!, tone: 'neutral' });
  for (const point of metrics.retention?.points ?? []) {
    if (point.atSeconds == null || point.of3sViewers == null) continue;
    add(indexAt(point.atSeconds), {
      label: `${point.label} mark`,
      value: `${pct(point.of3sViewers)} watching`,
      tone: point.lostSincePrevious != null && point.lostSincePrevious >= 0.3 ? 'warn' : 'neutral',
    });
  }
  return pins;
}
