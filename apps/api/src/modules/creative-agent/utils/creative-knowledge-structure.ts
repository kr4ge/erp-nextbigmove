import { CREATIVE_AI_SECTION_KEYS, type CreativeAiSectionKey } from '../prompts/creative-ai-shared';

/**
 * Turning an analysis into a knowledge record.
 *
 * The analysis is written for a person reading one creative. The knowledge
 * base needs something smaller: how the creative is built and what that
 * construction earned, compact enough that a store's whole library fits in one
 * prompt. So this keeps classification and observation, and drops advice.
 *
 * Two formats exist. Version 1 is the six-section report older runs produced.
 * Version 2 is the running analyst's verdict record, which carries the fixed
 * attribute classification and the one-line lesson the knowledge base is built
 * around.
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

export type CreativeKnowledgeStructure = CreativeKnowledgeStructureV1 | CreativeKnowledgeStructureV2;

const MAX_OBSERVATIONS_PER_SECTION = 4;
const MAX_OBSERVATION_CHARS = 400;

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
export function extractStructure(analysisResult: unknown): CreativeKnowledgeStructure | null {
  const result = asRecord(analysisResult);
  if (!result) return null;
  return extractV2(result) ?? extractV1(result);
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

  if (structure.schemaVersion === 2) {
    const a = structure.attributes;
    const shape = [a.format, a.hookType, a.angle].filter((part) => part && part !== 'OTHER').join(' · ');
    lines.push(`${creative.code} — ${shape || 'unclassified'}`);
    lines.push(`Built: ${a.speaker}, ${a.durationBucket}, offer ${a.offerShown}, CTA ${a.ctaType}, price ${a.priceVisible ? 'shown' : 'not shown'}${a.otherNote ? ` (${a.otherNote})` : ''}`);
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

/**
 * Render a corpus for the reviewer prompt. Winners and losers are separated
 * because the contrast is the lesson. Entries whose result was shared with
 * other creatives in the same campaign are marked so the model can discount
 * them, and each names its product so a cross-product lesson stays honest.
 */
export function renderCorpus(
  entries: Array<{ label: string; attribution: string; digest: string | null; creative?: { code: string; posProductName?: string | null } | null }>,
): string {
  if (entries.length === 0) return 'No knowledge entries exist for this store yet.';
  const render = (label: string) => {
    const group = entries.filter((entry) => entry.label === label);
    if (group.length === 0) return `${label}: none recorded.`;
    const body = group
      .map((entry) => {
        const caveat = entry.attribution === 'SHARED' ? ' [shared campaign: result not attributable to this creative alone]' : '';
        const product = entry.creative?.posProductName ? ` [product: ${entry.creative.posProductName}]` : '';
        return `- ${entry.digest ?? entry.creative?.code ?? 'entry'}${product}${caveat}`;
      })
      .join('\n');
    return `${label} (${group.length}):\n${body}`;
  };
  return [render('WINNER'), '', render('LOSER')].join('\n');
}
