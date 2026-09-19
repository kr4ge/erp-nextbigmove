import type { CreativeAnalysisMode } from '../prompts/creative-prompt-router';
import type { MediaManifest } from '../services/creative-ai-media.service';

/**
 * Deterministic checks on a finished analysis.
 *
 * The model is asked to cite scenes, quote the transcript and respect the
 * store's thresholds. Whether it did is checkable in code, and a check that
 * never drifts is the cheapest defence against a confident verdict built on
 * a claim nothing supports. Failures do not reject the result; they are
 * recorded on the run as warnings so a reader sees them beside the verdict,
 * and so prompt versions can be compared by how often each check fires.
 */

export type AnalysisCheck = { code: string; detail: string };

type TimelineEntry = { startSeconds: number; endSeconds: number; spokenLine?: string | null };

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const number = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const words = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((word) => word.length >= 4);

export function verifyAnalysis(input: {
  result: Record<string, unknown>;
  mode: CreativeAnalysisMode;
  manifest: MediaManifest | null;
  variables: Record<string, string>;
}): AnalysisCheck[] {
  const checks: AnalysisCheck[] = [];
  const { result, manifest } = input;
  const isVideo = manifest?.kind === 'VIDEO';
  const duration = isVideo ? manifest?.durationSeconds ?? null : null;

  // The timeline: present, ordered, inside the video, covering most of it.
  const timeline = Array.isArray(result.timeline)
    ? (result.timeline.filter(isRecord) as unknown as TimelineEntry[]).filter((entry) => number(entry.startSeconds) !== null && number(entry.endSeconds) !== null)
    : [];
  if (timeline.length === 0) {
    checks.push({ code: 'TIMELINE_MISSING', detail: 'The result has no scene timeline.' });
  } else if (isVideo && duration) {
    const outOfRange = timeline.filter((entry) => entry.endSeconds > duration + 1 || entry.startSeconds < 0);
    if (outOfRange.length) {
      checks.push({ code: 'TIMELINE_OUT_OF_RANGE', detail: `${outOfRange.length} scene(s) end after the ${duration}s video ends.` });
    }
    const unordered = timeline.some((entry, index) => entry.endSeconds < entry.startSeconds || (index > 0 && entry.startSeconds < timeline[index - 1].startSeconds));
    if (unordered) checks.push({ code: 'TIMELINE_UNORDERED', detail: 'Scenes are not in time order or a scene ends before it starts.' });
    const covered = timeline.reduce((sum, entry) => sum + Math.max(0, Math.min(entry.endSeconds, duration) - Math.max(0, entry.startSeconds)), 0);
    if (covered < duration * 0.8) {
      checks.push({ code: 'TIMELINE_COVERAGE_LOW', detail: `The timeline covers ${Math.round((covered / duration) * 100)}% of the video.` });
    }
  }

  // Beats must sit inside the video.
  if (isVideo && duration && isRecord(result.beats)) {
    const late = ['hookEndsAt', 'productFirstSeenAt', 'priceFirstSeenAt', 'ctaFirstSeenAt']
      .map((key) => number(result.beats && (result.beats as Record<string, unknown>)[key]))
      .filter((value): value is number => value !== null && value > duration + 1);
    if (late.length) checks.push({ code: 'BEATS_BEYOND_DURATION', detail: `${late.length} beat(s) fall after the video ends.` });
  }

  // Quotes must come from the transcript when there is one.
  if (isVideo && manifest?.transcript?.status === 'COMPLETED' && manifest.transcript.text) {
    const vocabulary = new Set(words(manifest.transcript.text));
    const quoted: string[] = timeline.map((entry) => entry.spokenLine ?? '').filter(Boolean);
    const opening = typeof result.openingQuote === 'string' ? result.openingQuote : '';
    if (opening) quoted.push(opening);
    const unsupported = quoted.filter((quote) => {
      const tokens = words(quote);
      if (tokens.length === 0) return false;
      const hits = tokens.filter((token) => vocabulary.has(token)).length;
      return hits / tokens.length < 0.5;
    });
    if (unsupported.length) {
      checks.push({ code: 'QUOTE_NOT_IN_TRANSCRIPT', detail: `${unsupported.length} quoted line(s) do not match the transcript, e.g. "${unsupported[0].slice(0, 80)}".` });
    }
  }

  if (input.mode === 'RUNNING_ANALYST') {
    const verdict = typeof result.verdict === 'string' ? result.verdict : '';
    const noTargets = input.variables.TARGET_CPP === 'not set' || input.variables.TARGET_AR_PCT === 'not set';
    if ((verdict === 'SCALE' || verdict === 'KILL') && noTargets) {
      checks.push({ code: 'VERDICT_WITHOUT_TARGETS', detail: `${verdict} was returned although Target CPP or Target AR% is not set for the store.` });
    }
    if (!Array.isArray(result.evidence) || result.evidence.length === 0) {
      checks.push({ code: 'EVIDENCE_EMPTY', detail: 'The verdict cites no evidence rows.' });
    }
  }

  if (input.mode === 'NEW_REVIEWER') {
    if (result.decision === 'REJECT' && !(typeof result.unfixableReason === 'string' && result.unfixableReason.trim())) {
      checks.push({ code: 'REJECT_WITHOUT_REASON', detail: 'REJECT was returned without saying why a re-edit cannot solve it.' });
    }
    if (result.noveltyLabel === 'ITERATION' && !(typeof result.iteratesOn === 'string' && result.iteratesOn.trim())) {
      checks.push({ code: 'ITERATION_WITHOUT_SOURCE', detail: 'ITERATION was returned without naming the creative it iterates on.' });
    }
  }

  return checks;
}
