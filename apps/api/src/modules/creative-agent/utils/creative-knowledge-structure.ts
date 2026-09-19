import { CREATIVE_AI_SECTION_KEYS, type CreativeAiSectionKey } from '../prompts/creative-ai-shared';

/**
 * Turning an analysis into a knowledge record.
 *
 * The analysis is written for a person reading one creative. The knowledge
 * base needs something smaller: how the creative is built and what that
 * construction earned, compact enough that a store's whole library fits in one
 * prompt. So this keeps classification and observation, and drops advice.
 *
 * Three formats exist. Version 1 is the six-section report older runs
 * produced. Version 2 is the running analyst's verdict record, with the fixed
 * attribute classification and the one-line lesson. Version 3 adds the scene
 * timeline, the beats and the measured pacing, which is what turns the
 * library from "what won" into "how winners are built".
 */

export type KnowledgeObservation = { at: number | null; what: string };
export type KnowledgeSection = { score: number | null; verdict: string | null; observations: KnowledgeObservation[] };

export type KnowledgeAttributes = {
  angle: string;
  hookType: string;
  format: string;
  speaker: string;
  durationBucket: string;
  offerShown: string;
  ctaType: string;
  priceVisible: boolean;
  otherNote: string | null;
};

export type KnowledgeTimelineEntry = {
  startSeconds: number;
  endSeconds: number;
  role: string;
  whatIsSeen: string;
  onScreenText: string | null;
  spokenLine: string | null;
  technique: string | null;
  issue: string | null;
  keepOrFix: 'KEEP' | 'FIX';
};

export type KnowledgeBeats = {
  hookEndsAt: number | null;
  productFirstSeenAt: number | null;
  priceFirstSeenAt: number | null;
  ctaFirstSeenAt: number | null;
  faceInFirst3s: boolean;
  speechInFirst3s: boolean;
  textInFirst3s: boolean;
};

export type KnowledgePacing = {
  sceneCount: number;
  cutsPerMinute: number;
  firstCutAt: number | null;
  longestStaticRun: { startSeconds: number; endSeconds: number; seconds: number };
  hasSpeech: boolean;
  speechStartsAt: number | null;
  speechCoverage: number | null;
  wordsPerMinute: number | null;
};

export type CreativeKnowledgeStructureV1 = {
  schemaVersion: 1;
  summary: string | null;
  sections: Partial<Record<CreativeAiSectionKey, KnowledgeSection>>;
};

export type CreativeKnowledgeStructureV2 = {
  schemaVersion: 2;
  verdict: string;
  verdictReason: string | null;
  confidence: string | null;
  attributes: KnowledgeAttributes;
  lesson: string;
  diagnosis: { funnelReading: string | null; creativeElement: string | null; notTheCreative: string | null };
  audienceQuality: { failed: boolean; suspectedElement: string | null };
  evidence: Array<{ metric: string; value: string; versusTarget: string }>;
  complianceFlags: string[];
};

export type CreativeKnowledgeStructureV3 = Omit<CreativeKnowledgeStructureV2, 'schemaVersion'> & {
  schemaVersion: 3;
  durationSeconds: number | null;
  timeline: KnowledgeTimelineEntry[];
  beats: KnowledgeBeats | null;
  pacing: KnowledgePacing | null;
};

export type CreativeKnowledgeStructure = CreativeKnowledgeStructureV1 | CreativeKnowledgeStructureV2 | CreativeKnowledgeStructureV3;

/** What the run's media manifest contributes to the record: duration and measured pacing. */
export type KnowledgeMediaHint = {
  durationSeconds?: number | null;
  pacing?: {
    sceneCount?: number;
    cutsPerMinute?: number;
    firstCutAt?: number | null;
    longestStaticRun?: { startSeconds?: number; endSeconds?: number; seconds?: number };
    hasSpeech?: boolean;
    speechStartsAt?: number | null;
    speechCoverage?: number | null;
    wordsPerMinute?: number | null;
  } | null;
} | null;

const MAX_OBSERVATIONS_PER_SECTION = 4;
const MAX_OBSERVATION_CHARS = 400;
const MAX_TIMELINE_ENTRIES = 48;
const MAX_TIMELINE_LINES_IN_CORPUS = 10;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
const asString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};
const asNumber = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const truncate = (value: string, max = MAX_OBSERVATION_CHARS) =>
  value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;

/** Pull the structural record out of a completed analysis, whichever format it used. */
export function extractStructure(analysisResult: unknown, media: KnowledgeMediaHint = null): CreativeKnowledgeStructure | null {
  const result = asRecord(analysisResult);
  if (!result) return null;
  const verdict = extractV2(result);
  if (verdict) {
    const timeline = extractTimeline(result.timeline);
    if (timeline.length > 0) {
      return {
        ...verdict,
        schemaVersion: 3,
        durationSeconds: asNumber(media?.durationSeconds) ?? null,
        timeline,
        beats: extractBeats(result.beats),
        pacing: extractPacing(media?.pacing),
      };
    }
    return verdict;
  }
  return extractV1(result);
}

function extractV2(result: Record<string, unknown>): CreativeKnowledgeStructureV2 | null {
  const attributes = asRecord(result.attributes);
  const lesson = asString(result.lesson);
  const verdict = asString(result.verdict);
  // Only the running analyst produces a verdict plus attributes plus a lesson;
  // that triple is what makes a record worth keeping.
  if (!attributes || !lesson || !verdict) return null;
  const diagnosis = asRecord(result.diagnosis) ?? {};
  const audience = asRecord(result.audienceQuality) ?? {};
  const evidence = Array.isArray(result.evidence) ? result.evidence : [];
  const flags = Array.isArray(result.complianceFlags) ? result.complianceFlags : [];
  const text = (value: unknown, max: number) => {
    const s = asString(value);
    return s ? truncate(s, max) : null;
  };
  return {
    schemaVersion: 2,
    verdict,
    verdictReason: asString(result.verdictReason),
    confidence: asString(result.confidence),
    attributes: {
      angle: asString(attributes.angle) ?? 'OTHER',
      hookType: asString(attributes.hookType) ?? 'OTHER',
      format: asString(attributes.format) ?? 'OTHER',
      speaker: asString(attributes.speaker) ?? 'OTHER',
      durationBucket: asString(attributes.durationBucket) ?? 'OTHER',
      offerShown: asString(attributes.offerShown) ?? 'OTHER',
      ctaType: asString(attributes.ctaType) ?? 'none',
      priceVisible: attributes.priceVisible === true,
      otherNote: asString(attributes.otherNote),
    },
    lesson: truncate(lesson, 300),
    diagnosis: {
      funnelReading: text(diagnosis.funnelReading, 600),
      creativeElement: text(diagnosis.creativeElement, 600),
      notTheCreative: asString(diagnosis.notTheCreative),
    },
    audienceQuality: { failed: audience.failed === true, suspectedElement: asString(audience.suspectedElement) },
    evidence: evidence
      .map((row) => asRecord(row))
      .filter((row): row is Record<string, unknown> => Boolean(row))
      .slice(0, 8)
      .map((row) => ({
        metric: asString(row.metric) ?? '',
        value: asString(row.value) ?? '',
        versusTarget: asString(row.versusTarget) ?? '',
      })),
    complianceFlags: flags.map((flag) => asString(flag)).filter((flag): flag is string => Boolean(flag)).slice(0, 5),
  };
}

function extractTimeline(value: unknown): KnowledgeTimelineEntry[] {
  if (!Array.isArray(value)) return [];
  const entries: KnowledgeTimelineEntry[] = [];
  for (const raw of value) {
    const entry = asRecord(raw);
    if (!entry) continue;
    const start = asNumber(entry.startSeconds);
    const end = asNumber(entry.endSeconds);
    const seen = asString(entry.whatIsSeen);
    if (start === null || end === null || !seen) continue;
    entries.push({
      startSeconds: start,
      endSeconds: end,
      role: asString(entry.role) ?? 'OTHER',
      whatIsSeen: truncate(seen, 240),
      onScreenText: asString(entry.onScreenText) ? truncate(asString(entry.onScreenText)!, 240) : null,
      spokenLine: asString(entry.spokenLine) ? truncate(asString(entry.spokenLine)!, 300) : null,
      technique: asString(entry.technique) ? truncate(asString(entry.technique)!, 160) : null,
      issue: asString(entry.issue) ? truncate(asString(entry.issue)!, 240) : null,
      keepOrFix: asString(entry.keepOrFix) === 'FIX' ? 'FIX' : 'KEEP',
    });
    if (entries.length >= MAX_TIMELINE_ENTRIES) break;
  }
  return entries;
}

function extractBeats(value: unknown): KnowledgeBeats | null {
  const beats = asRecord(value);
  if (!beats) return null;
  return {
    hookEndsAt: asNumber(beats.hookEndsAt),
    productFirstSeenAt: asNumber(beats.productFirstSeenAt),
    priceFirstSeenAt: asNumber(beats.priceFirstSeenAt),
    ctaFirstSeenAt: asNumber(beats.ctaFirstSeenAt),
    faceInFirst3s: beats.faceInFirst3s === true,
    speechInFirst3s: beats.speechInFirst3s === true,
    textInFirst3s: beats.textInFirst3s === true,
  };
}

function extractPacing(value: NonNullable<KnowledgeMediaHint>['pacing'] | undefined): KnowledgePacing | null {
  if (!value || typeof value.cutsPerMinute !== 'number') return null;
  return {
    sceneCount: value.sceneCount ?? 0,
    cutsPerMinute: value.cutsPerMinute,
    firstCutAt: value.firstCutAt ?? null,
    longestStaticRun: {
      startSeconds: value.longestStaticRun?.startSeconds ?? 0,
      endSeconds: value.longestStaticRun?.endSeconds ?? 0,
      seconds: value.longestStaticRun?.seconds ?? 0,
    },
    hasSpeech: value.hasSpeech === true,
    speechStartsAt: value.speechStartsAt ?? null,
    speechCoverage: value.speechCoverage ?? null,
    wordsPerMinute: value.wordsPerMinute ?? null,
  };
}

function extractV1(result: Record<string, unknown>): CreativeKnowledgeStructureV1 | null {
  const sectionsRaw = asRecord(result.sections);
  if (!sectionsRaw) return null;
  const sections: Partial<Record<CreativeAiSectionKey, KnowledgeSection>> = {};
  for (const key of CREATIVE_AI_SECTION_KEYS) {
    const section = asRecord(sectionsRaw[key]);
    if (!section) continue;
    const findings = Array.isArray(section.findings) ? section.findings : [];
    const observations: KnowledgeObservation[] = [];
    for (const raw of findings) {
      const finding = asRecord(raw);
      if (!finding) continue;
      // Keep what was seen or measured; a hypothesis is the model's guess and
      // must not harden into remembered fact.
      if (asString(finding.evidenceType) === 'HYPOTHESIS') continue;
      const what = asString(finding.observation);
      if (!what) continue;
      observations.push({ at: asNumber(finding.timestampSeconds), what: truncate(what) });
      if (observations.length >= MAX_OBSERVATIONS_PER_SECTION) break;
    }
    if (observations.length === 0 && !asString(section.verdict)) continue;
    sections[key] = {
      score: asNumber(section.score),
      verdict: asString(section.verdict) ? truncate(asString(section.verdict)!, 300) : null,
      observations,
    };
  }
  if (Object.keys(sections).length === 0) return null;
  const overview = asRecord(result.overview);
  const summary = asString(overview?.summary) ?? asString(result.summary);
  return { schemaVersion: 1, summary: summary ? truncate(summary, 900) : null, sections };
}

const at = (value: number | null) => (value == null ? 'never' : `${value}s`);

/**
 * A few lines describing how this creative is put together and what it earned.
 * Written at promotion time so a gate prompt can cite entries compactly.
 */
export function buildKnowledgeDigest(
  creative: { code: string; format: string | null; hookType: string | null; angle?: string | null },
  structure: CreativeKnowledgeStructure,
  economics: { spend: number; netContribution: number | null; delivered: number },
): string {
  const lines: string[] = [];
  const money = (value: number) => `₱${Math.round(value).toLocaleString('en-PH')}`;

  if (structure.schemaVersion !== 1) {
    const a = structure.attributes;
    const shape = [a.format, a.hookType, a.angle].filter((part) => part && part !== 'OTHER').join(' · ');
    lines.push(`${creative.code} — ${shape || 'unclassified'}`);
    lines.push(`Built: ${a.speaker}, ${a.durationBucket}, offer ${a.offerShown}, CTA ${a.ctaType}, price ${a.priceVisible ? 'shown' : 'not shown'}${a.otherNote ? ` (${a.otherNote})` : ''}`);
    if (structure.schemaVersion === 3) {
      const b = structure.beats;
      const p = structure.pacing;
      if (b) {
        const opening = [b.faceInFirst3s ? 'face' : null, b.speechInFirst3s ? 'speech' : null, b.textInFirst3s ? 'text' : null].filter(Boolean).join(', ');
        lines.push(`Beats: hook ends ${at(b.hookEndsAt)} · product ${at(b.productFirstSeenAt)} · price ${at(b.priceFirstSeenAt)} · CTA ${at(b.ctaFirstSeenAt)} · first 3s: ${opening || 'no face, speech or text'}`);
      }
      if (p) {
        lines.push(`Edit: ${p.sceneCount} scenes, ${p.cutsPerMinute} cuts/min, longest static ${p.longestStaticRun.seconds}s${p.speechStartsAt != null ? `, speech from ${p.speechStartsAt}s` : p.hasSpeech ? '' : ', no speech'}`);
      }
      lines.push(`Scenes: ${structure.timeline.map((entry) => entry.role).join(' → ')}`);
    }
    lines.push(`Lesson: ${structure.lesson}`);
    if (structure.audienceQuality.failed && structure.audienceQuality.suspectedElement) {
      lines.push(`Audience-quality failure: ${truncate(structure.audienceQuality.suspectedElement, 200)}`);
    }
    lines.push(`Verdict: ${structure.verdict}${structure.verdictReason ? ` (${structure.verdictReason})` : ''}`);
  } else {
    const shape = [creative.format, creative.hookType, creative.angle].filter(Boolean).join(' · ');
    lines.push(`${creative.code}${shape ? ` — ${shape}` : ''}`);
    const hook = structure.sections.hook;
    if (hook?.observations.length) {
      const opening = hook.observations.filter((o) => o.at !== null && o.at <= 3).slice(0, 2);
      for (const o of opening.length > 0 ? opening : hook.observations.slice(0, 1)) {
        lines.push(`Hook${o.at !== null ? ` @${o.at}s` : ''}: ${truncate(o.what, 180)}`);
      }
    }
    for (const key of ['messageOffer', 'productProof', 'callToAction'] as const) {
      const first = structure.sections[key]?.observations[0];
      if (first) lines.push(`${labelFor(key)}${first.at !== null ? ` @${first.at}s` : ''}: ${truncate(first.what, 160)}`);
    }
  }

  lines.push(
    economics.netContribution === null
      ? `Outcome: ${money(economics.spend)} spent, contribution not reconciled.`
      : `Outcome: ${money(economics.spend)} spent, ${money(economics.netContribution)} net across ${economics.delivered} delivered.`,
  );
  return lines.join('\n');
}

function labelFor(key: CreativeAiSectionKey): string {
  const labels: Record<CreativeAiSectionKey, string> = {
    hook: 'Hook',
    storyPacing: 'Pacing',
    messageOffer: 'Offer',
    productProof: 'Proof',
    callToAction: 'CTA',
    performance: 'Performance',
  };
  return labels[key] ?? key;
}

export type CorpusEntry = {
  label: string;
  attribution: string;
  digest: string | null;
  creative?: { code: string; posProductName?: string | null } | null;
  /** The store this record was borrowed from, when it is not the store's own. */
  borrowedFrom?: string | null;
  structure?: CreativeKnowledgeStructure | null;
};

/** One scene as a corpus line: what was seen, shown and said, and whether it needed fixing. */
function renderTimelineLine(entry: KnowledgeTimelineEntry): string {
  const parts = [`${entry.startSeconds}–${entry.endSeconds}s ${entry.role}: ${truncate(entry.whatIsSeen, 120)}`];
  if (entry.onScreenText) parts.push(`text "${truncate(entry.onScreenText, 60)}"`);
  if (entry.spokenLine) parts.push(`says "${truncate(entry.spokenLine, 80)}"`);
  if (entry.keepOrFix === 'FIX' && entry.issue) parts.push(`FIX: ${truncate(entry.issue, 80)}`);
  return `    ${parts.join(' · ')}`;
}

/**
 * Render a corpus for the reviewer prompt. Winners and losers are separated
 * because the contrast is the lesson. Entries whose result was shared with
 * other creatives in the same campaign are marked so the model can discount
 * them, each names its product so a cross-product lesson stays honest, and a
 * borrowed record names the store it came from. Exemplars, chosen by the
 * caller for their closeness to the creative under review, carry their scene
 * timeline; everything else is one entry.
 */
export function renderCorpus(entries: CorpusEntry[], options: { exemplarCodes?: Set<string> } = {}): string {
  if (entries.length === 0) return 'No knowledge entries exist for this store yet.';
  const render = (label: string) => {
    const group = entries.filter((entry) => entry.label === label);
    if (group.length === 0) return `${label}: none recorded.`;
    const body = group
      .map((entry) => {
        const caveat = entry.attribution === 'SHARED' ? ' [shared campaign: result not attributable to this creative alone]' : '';
        const product = entry.creative?.posProductName ? ` [product: ${entry.creative.posProductName}]` : '';
        const borrowed = entry.borrowedFrom ? ` [borrowed from ${entry.borrowedFrom}]` : '';
        const lines = [`- ${entry.digest ?? entry.creative?.code ?? 'entry'}${product}${caveat}${borrowed}`];
        const code = entry.creative?.code;
        if (code && options.exemplarCodes?.has(code) && entry.structure?.schemaVersion === 3) {
          lines.push('  Scene by scene:');
          for (const scene of entry.structure.timeline.slice(0, MAX_TIMELINE_LINES_IN_CORPUS)) lines.push(renderTimelineLine(scene));
          if (entry.structure.timeline.length > MAX_TIMELINE_LINES_IN_CORPUS) {
            lines.push(`    … ${entry.structure.timeline.length - MAX_TIMELINE_LINES_IN_CORPUS} more scene(s)`);
          }
        }
        return lines.join('\n');
      })
      .join('\n');
    return `${label} (${group.length}):\n${body}`;
  };
  return [render('WINNER'), '', render('LOSER')].join('\n');
}
