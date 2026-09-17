'use client';

import { useEffect, useState } from 'react';
import { X, AlertTriangle, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { fetchKnowledgeEntry } from '../_services/creative-knowledge.service';
import type { KnowledgeEntry, KnowledgeEntryDetail, KnowledgeStructureV1, KnowledgeStructureV2 } from '../_types/creative-knowledge';

const SECTION_LABELS: Record<string, string> = {
  hook: 'Hook',
  storyPacing: 'Story & pacing',
  messageOffer: 'Message & offer',
  productProof: 'Product & proof',
  callToAction: 'Call to action',
  performance: 'Performance',
};

const peso = (value: number | null | undefined) => (value == null ? '—' : `₱${Math.round(value).toLocaleString('en-PH')}`);
const timestamp = (seconds: number | null) => (seconds == null ? null : `${seconds.toFixed(seconds % 1 === 0 ? 0 : 1)}s`);

/**
 * One knowledge entry in full: the creative itself, how it is built, and what
 * it earned. The structural record is the point; the metrics underneath
 * explain the label.
 */
export function KnowledgeEntryDialog({ entry, onClose }: { entry: KnowledgeEntry; onClose: () => void }) {
  const [detail, setDetail] = useState<KnowledgeEntryDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchKnowledgeEntry(entry.id)
      .then((data) => { if (!cancelled) setDetail(data); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load that entry.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [entry.id]);

  const creative = detail?.creative ?? entry.creative;
  const structure = detail?.structure ?? null;
  const metrics = detail?.metrics ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-card shadow-xl">
        <header className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold">{creative?.code ?? 'Knowledge entry'}</h2>
              <LabelPill label={entry.label} />
              {entry.attribution === 'SHARED' ? <SharedWarning /> : null}
            </div>
            <p className="mt-0.5 truncate text-sm text-muted">
              {creative?.title ?? ''}
              {entry.storeName ? ` · ${entry.storeName}` : ''}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></Button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Spinner /></div>
          ) : error ? (
            <p className="rounded-lg bg-destructive-soft px-4 py-3 text-sm text-destructive">{error}</p>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
              <div className="space-y-4">
                {creative?.mediaUrl ? (
                  creative.kind === 'VIDEO'
                    ? <video src={creative.mediaUrl} controls playsInline className="w-full rounded-lg border border-border bg-black" />
                    : <img src={creative.mediaUrl} alt={creative.title} className="w-full rounded-lg border border-border" />
                ) : (
                  <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
                    The media for this creative is not stored in the ERP.
                  </div>
                )}

                {metrics ? (
                  <dl className="space-y-2 rounded-lg border border-border px-4 py-3 text-sm">
                    <Row label="Spend" value={peso(metrics.spend)} />
                    <Row label="Delivered orders" value={String(metrics.delivered)} />
                    <Row label="Net contribution" value={peso(metrics.netContribution)} tone={metrics.netContribution == null ? undefined : metrics.netContribution > 0 ? 'good' : 'bad'} />
                    <Row label="Cost per delivered" value={peso(metrics.deliveredCostPerOrder)} />
                  </dl>
                ) : null}

                {entry.labelRationale ? (
                  <p className="rounded-lg bg-muted-soft px-4 py-3 text-xs leading-relaxed text-muted">{entry.labelRationale}</p>
                ) : null}
              </div>

              <div className="space-y-5">
                {!structure ? (
                  <p className="text-sm text-muted">This entry has no structural record, so there is nothing to study here.</p>
                ) : structure.schemaVersion === 2 ? (
                  <VerdictRecord structure={structure} />
                ) : (
                  <SectionRecord structure={structure} creative={creative} niche={entry.niche} />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** The running analyst's record: classification, lesson, why. */
function VerdictRecord({ structure }: { structure: KnowledgeStructureV2 }) {
  const a = structure.attributes;
  const rows: Array<[string, string]> = [
    ['Angle', a.angle], ['Hook', a.hookType], ['Format', a.format], ['Speaker', a.speaker],
    ['Length', a.durationBucket], ['Offer', a.offerShown], ['CTA', a.ctaType], ['Price shown', a.priceVisible ? 'yes' : 'no'],
  ];
  return (
    <>
      <section className="rounded-lg border border-primary/30 bg-primary-soft/40 px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Target className="h-4 w-4 text-primary" /> Lesson</h3>
        <p className="mt-1.5 text-sm leading-relaxed">{structure.lesson}</p>
        <p className="mt-2 text-xs text-muted">
          Verdict {structure.verdict}{structure.verdictReason ? ` · ${structure.verdictReason.replaceAll('_', ' ').toLowerCase()}` : ''}{structure.confidence ? ` · ${structure.confidence.toLowerCase()} confidence` : ''}
        </p>
      </section>

      <section className="rounded-lg border border-border px-4 py-3">
        <h4 className="text-sm font-semibold">How it is built</h4>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          {rows.map(([label, value]) => (
            <div key={label}><dt className="text-xs text-muted">{label}</dt><dd className="font-medium">{value}</dd></div>
          ))}
        </dl>
        {a.otherNote ? <p className="mt-2 text-xs text-muted">{a.otherNote}</p> : null}
      </section>

      {structure.audienceQuality.failed ? (
        <section className="rounded-lg border border-destructive/30 bg-destructive-soft px-4 py-3 text-destructive">
          <h4 className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="h-4 w-4" /> Audience-quality failure</h4>
          <p className="mt-1.5 text-sm leading-relaxed">{structure.audienceQuality.suspectedElement ?? 'The buyers this creative attracted did not pay.'}</p>
        </section>
      ) : null}

      {(structure.diagnosis.funnelReading || structure.diagnosis.creativeElement) ? (
        <section className="rounded-lg border border-border px-4 py-3">
          <h4 className="text-sm font-semibold">Why</h4>
          {structure.diagnosis.funnelReading ? <p className="mt-1.5 text-sm leading-relaxed text-muted">{structure.diagnosis.funnelReading}</p> : null}
          {structure.diagnosis.creativeElement ? <p className="mt-1.5 text-sm leading-relaxed">{structure.diagnosis.creativeElement}</p> : null}
          {structure.diagnosis.notTheCreative ? <p className="mt-2 text-xs text-muted">Not the creative&apos;s fault: {structure.diagnosis.notTheCreative}</p> : null}
        </section>
      ) : null}

      {structure.evidence.length ? (
        <section className="rounded-lg border border-border">
          <h4 className="px-4 pt-3 text-sm font-semibold">Evidence</h4>
          <div className="divide-y divide-border">
            {structure.evidence.map((row, index) => (
              <div key={index} className="grid grid-cols-[1fr_auto] gap-3 px-4 py-2 text-sm">
                <span className="text-muted">{row.metric}</span>
                <span className="text-right"><span className="font-medium tabular-nums">{row.value}</span><span className="ml-2 text-xs text-muted">{row.versusTarget}</span></span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

/** The older six-section record. */
function SectionRecord({ structure, creative, niche }: { structure: KnowledgeStructureV1; creative: KnowledgeEntry['creative'] | undefined; niche: string }) {
  return (
    <>
      <dl className="space-y-2 rounded-lg border border-border px-4 py-3 text-sm">
        <Row label="Format" value={creative?.format ?? '—'} />
        <Row label="Hook type" value={creative?.hookType ?? '—'} />
        {creative?.angle ? <Row label="Angle" value={creative.angle} /> : null}
        <Row label="Category" value={niche.replace(/_/g, ' ').toLowerCase()} />
      </dl>
      {structure.summary ? (
        <section><h3 className="mb-1.5 text-sm font-semibold">How it is built</h3><p className="text-sm leading-relaxed text-muted">{structure.summary}</p></section>
      ) : null}
      {Object.entries(structure.sections).map(([key, section]) => {
        if (!section) return null;
        return (
          <section key={key} className="rounded-lg border border-border px-4 py-3">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h4 className="text-sm font-semibold">{SECTION_LABELS[key] ?? key}</h4>
              {section.score != null ? <span className="text-xs tabular-nums text-muted">{section.score}/5</span> : null}
            </div>
            {section.verdict ? <p className="mb-2 text-sm leading-relaxed">{section.verdict}</p> : null}
            {section.observations.length > 0 ? (
              <ul className="space-y-1.5">
                {section.observations.map((observation, index) => (
                  <li key={index} className="flex gap-2 text-sm text-muted">
                    {observation.at != null ? <span className="shrink-0 tabular-nums text-xs font-medium text-primary">{timestamp(observation.at)}</span> : null}
                    <span className="leading-relaxed">{observation.what}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        );
      })}
    </>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`text-sm tabular-nums ${tone === 'good' ? 'text-success' : tone === 'bad' ? 'text-destructive' : ''}`}>{value}</dd>
    </div>
  );
}

export function LabelPill({ label }: { label: KnowledgeEntry['label'] }) {
  const styles: Record<string, string> = {
    WINNER: 'bg-success-soft/50 text-success',
    LOSER: 'bg-destructive-soft text-destructive',
    INCONCLUSIVE: 'bg-muted-soft text-muted',
  };
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${styles[label] ?? styles.INCONCLUSIVE}`}>{label.toLowerCase()}</span>;
}

/**
 * Revenue attributes to a Meta campaign, not to one ad. When a creative shared
 * its campaign, its label is weaker evidence and the reader should know before
 * drawing a lesson from it.
 */
export function SharedWarning() {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-warning-soft px-2 py-0.5 text-xs text-warning" title="This creative shared its campaign with others, so the result cannot be attributed to it alone.">
      <AlertTriangle className="h-3 w-3" />
      shared campaign
    </span>
  );
}
