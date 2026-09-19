import { CREATIVE_ATTRIBUTE_VOCABULARY } from '../prompts/creative-ai-shared';
import type { CreativeKnowledgeStructure, KnowledgeAttributes } from './creative-knowledge-structure';

/**
 * What a store's knowledge base says in aggregate, computed in code.
 *
 * Handing a language model twenty digests and asking it to spot patterns is
 * the wrong job for it, and it gets worse as the corpus grows. So the
 * counting happens here: win rates by hook type, format, angle and offer,
 * the typical beats of winners against losers, and which parts of the
 * vocabulary the store has never tried. The model receives conclusions and
 * a handful of worked examples, not a pile to sift.
 *
 * Everything here is pure so it can be tested without a database.
 */

export type PatternEntry = {
  code: string;
  label: 'WINNER' | 'LOSER';
  attribution: 'SOLE' | 'SHARED' | 'UNKNOWN';
  posProductName?: string | null;
  /** Registration-time classification, the fallback when the record has no attributes. */
  format?: string | null;
  hookType?: string | null;
  angle?: string | null;
  /** Set when the entry comes from another store of the same niche. */
  borrowedFrom?: string | null;
  structure: CreativeKnowledgeStructure | null;
  metrics: { hookRate?: number | null; holdRate?: number | null; deliveredCostPerOrder?: number | null } | null;
  digest: string | null;
  promotedAt?: Date | string | null;
};

export type DimensionStat = {
  dimension: string;
  value: string;
  winners: number;
  losers: number;
  avgHookRate: number | null;
  avgHoldRate: number | null;
};

export type BeatStats = {
  count: number;
  hookEndsAt: number | null;
  productFirstSeenAt: number | null;
  priceFirstSeenAt: number | null;
  ctaFirstSeenAt: number | null;
  faceInFirst3sShare: number | null;
  speechInFirst3sShare: number | null;
  textInFirst3sShare: number | null;
  cutsPerMinute: number | null;
};

export type StorePatterns = {
  total: number;
  winners: number;
  losers: number;
  dimensions: DimensionStat[];
  winnerBeats: BeatStats | null;
  loserBeats: BeatStats | null;
  untested: Array<{ dimension: string; values: string[] }>;
};

const DIMENSIONS: Array<{ key: keyof KnowledgeAttributes; label: string }> = [
  { key: 'hookType', label: 'hook type' },
  { key: 'format', label: 'format' },
  { key: 'angle', label: 'angle' },
  { key: 'offerShown', label: 'offer' },
  { key: 'speaker', label: 'speaker' },
  { key: 'ctaType', label: 'CTA' },
  { key: 'priceVisible', label: 'price shown' },
];
const MAX_VALUES_PER_DIMENSION = 6;
/** How many of the store's own records it takes before its record outweighs the rubric. */
export const EVIDENCE_PRIOR_STRENGTH = 8;

const round = (value: number, places = 2) => Number(value.toFixed(places));
const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return round(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2, 1);
};
const share = (hits: number, total: number) => (total > 0 ? round(hits / total) : null);
const mean = (values: number[]) => (values.length ? round(values.reduce((a, b) => a + b, 0) / values.length, 3) : null);

/** The attributes an entry can be grouped by, from its record or its registration. */
export function attributesOf(entry: PatternEntry): Partial<KnowledgeAttributes> {
  const structure = entry.structure;
  if (structure && structure.schemaVersion >= 2) return (structure as { attributes: KnowledgeAttributes }).attributes;
  return { format: entry.format ?? undefined, hookType: entry.hookType ?? undefined, angle: entry.angle ?? undefined };
}

export function computeStorePatterns(entries: PatternEntry[]): StorePatterns {
  const own = entries.filter((entry) => !entry.borrowedFrom);
  const winners = own.filter((entry) => entry.label === 'WINNER');
  const losers = own.filter((entry) => entry.label === 'LOSER');

  const dimensions: DimensionStat[] = [];
  for (const dimension of DIMENSIONS) {
    const buckets = new Map<string, { winners: number; losers: number; hook: number[]; hold: number[] }>();
    for (const entry of own) {
      const raw = attributesOf(entry)[dimension.key];
      if (raw === undefined || raw === null || raw === '') continue;
      const value = typeof raw === 'boolean' ? (raw ? 'yes' : 'no') : String(raw);
      const bucket = buckets.get(value) ?? { winners: 0, losers: 0, hook: [], hold: [] };
      if (entry.label === 'WINNER') bucket.winners += 1;
      else bucket.losers += 1;
      if (typeof entry.metrics?.hookRate === 'number') bucket.hook.push(entry.metrics.hookRate);
      if (typeof entry.metrics?.holdRate === 'number') bucket.hold.push(entry.metrics.holdRate);
      buckets.set(value, bucket);
    }
    const rows = [...buckets.entries()]
      .map(([value, bucket]) => ({
        dimension: dimension.label,
        value,
        winners: bucket.winners,
        losers: bucket.losers,
        avgHookRate: mean(bucket.hook),
        avgHoldRate: mean(bucket.hold),
      }))
      .sort((a, b) => b.winners + b.losers - (a.winners + a.losers) || b.winners - a.winners || a.value.localeCompare(b.value))
      .slice(0, MAX_VALUES_PER_DIMENSION);
    dimensions.push(...rows);
  }

  const untested: StorePatterns['untested'] = [];
  const tried = (key: keyof KnowledgeAttributes) => new Set(own.map((entry) => String(attributesOf(entry)[key] ?? '')).filter(Boolean));
  for (const [key, label, vocabulary] of [
    ['hookType', 'hook types', CREATIVE_ATTRIBUTE_VOCABULARY.hookType],
    ['format', 'formats', CREATIVE_ATTRIBUTE_VOCABULARY.format],
    ['angle', 'angles', CREATIVE_ATTRIBUTE_VOCABULARY.angle],
  ] as const) {
    if (own.length === 0) break;
    const seen = tried(key);
    const values = vocabulary.filter((value) => value !== 'OTHER' && !seen.has(value));
    if (values.length > 0 && values.length < vocabulary.length - 1) untested.push({ dimension: label, values: [...values] });
  }

  return {
    total: own.length,
    winners: winners.length,
    losers: losers.length,
    dimensions,
    winnerBeats: beatStats(winners),
    loserBeats: beatStats(losers),
    untested,
  };
}

function beatStats(entries: PatternEntry[]): BeatStats | null {
  const withTimeline = entries
    .map((entry) => entry.structure)
    .filter((structure): structure is Extract<CreativeKnowledgeStructure, { schemaVersion: 3 }> => Boolean(structure && structure.schemaVersion === 3));
  if (withTimeline.length === 0) return null;
  const beats = withTimeline.map((structure) => structure.beats).filter((value): value is NonNullable<typeof value> => Boolean(value));
  const pick = (key: 'hookEndsAt' | 'productFirstSeenAt' | 'priceFirstSeenAt' | 'ctaFirstSeenAt') =>
    median(beats.map((beat) => beat[key]).filter((value): value is number => typeof value === 'number'));
  const flag = (key: 'faceInFirst3s' | 'speechInFirst3s' | 'textInFirst3s') => share(beats.filter((beat) => beat[key]).length, beats.length);
  return {
    count: withTimeline.length,
    hookEndsAt: pick('hookEndsAt'),
    productFirstSeenAt: pick('productFirstSeenAt'),
    priceFirstSeenAt: pick('priceFirstSeenAt'),
    ctaFirstSeenAt: pick('ctaFirstSeenAt'),
    faceInFirst3sShare: flag('faceInFirst3s'),
    speechInFirst3sShare: flag('speechInFirst3s'),
    textInFirst3sShare: flag('textInFirst3s'),
    cutsPerMinute: median(withTimeline.map((structure) => structure.pacing?.cutsPerMinute).filter((value): value is number => typeof value === 'number')),
  };
}

/** The patterns as prompt text. Says nothing where there is nothing to say. */
export function renderStorePatterns(patterns: StorePatterns): string {
  if (patterns.total === 0) return 'No recorded creatives with results for this store yet, so there are no patterns to report.';
  const pct = (value: number | null) => (value == null ? null : `${Math.round(value * 100)}%`);
  const lines: string[] = [
    `Computed by the ERP from ${patterns.total} recorded creative(s) with results: ${patterns.winners} winner(s), ${patterns.losers} loser(s). A pattern needs at least 3 records pointing the same way; below that it is an early signal.`,
  ];
  const byDimension = new Map<string, DimensionStat[]>();
  for (const row of patterns.dimensions) byDimension.set(row.dimension, [...(byDimension.get(row.dimension) ?? []), row]);
  for (const [dimension, rows] of byDimension) {
    const parts = rows.map((row) => {
      const rates = [row.avgHookRate != null ? `hook ${pct(row.avgHookRate)}` : null, row.avgHoldRate != null ? `hold ${pct(row.avgHoldRate)}` : null].filter(Boolean);
      return `${row.value} ${row.winners}W/${row.losers}L${rates.length ? ` (${rates.join(', ')})` : ''}`;
    });
    lines.push(`By ${dimension}: ${parts.join('; ')}`);
  }
  const beats = (label: string, stats: BeatStats | null) => {
    if (!stats) return;
    const s = (value: number | null) => (value == null ? 'n/a' : `${value}s`);
    lines.push(
      `${label} (median of ${stats.count} with timelines): hook ends ${s(stats.hookEndsAt)}; product first seen ${s(stats.productFirstSeenAt)}; price ${stats.priceFirstSeenAt == null ? 'not shown' : s(stats.priceFirstSeenAt)}; CTA ${s(stats.ctaFirstSeenAt)}; face in first 3s ${pct(stats.faceInFirst3sShare) ?? 'n/a'}; speech in first 3s ${pct(stats.speechInFirst3sShare) ?? 'n/a'}; on-screen text in first 3s ${pct(stats.textInFirst3sShare) ?? 'n/a'}${stats.cutsPerMinute != null ? `; ${stats.cutsPerMinute} cuts/min` : ''}`,
    );
  };
  beats("Winners' beats", patterns.winnerBeats);
  beats("Losers' beats", patterns.loserBeats);
  if (patterns.untested.length) {
    lines.push(`Not yet tested in this store: ${patterns.untested.map((group) => `${group.dimension} ${group.values.join(', ')}`).join('; ')}. A new angle here is wanted, not penalised.`);
  }
  return lines.join('\n');
}

/**
 * Which records to show in full. The new creative's registration says what it
 * is; the closest records by product and construction become worked examples,
 * with at least one winner and one loser when the corpus has both.
 */
export function rankCorpus(
  entries: PatternEntry[],
  creative: { format?: string | null; hookType?: string | null; angle?: string | null; posProductName?: string | null },
  exemplarCount = 6,
): { exemplars: PatternEntry[]; rest: PatternEntry[] } {
  const now = Date.now();
  const norm = (value: string | null | undefined) => (value ?? '').trim().toLowerCase();
  const scored = entries.map((entry) => {
    const attributes = attributesOf(entry);
    let score = 0;
    if (creative.posProductName && norm(entry.posProductName) === norm(creative.posProductName)) score += 3;
    if (creative.format && norm(attributes.format) === norm(creative.format)) score += 2;
    if (creative.hookType && norm(attributes.hookType) === norm(creative.hookType)) score += 2;
    if (creative.angle && norm(attributes.angle) === norm(creative.angle)) score += 1;
    if (entry.attribution === 'SOLE') score += 1;
    if (entry.structure?.schemaVersion === 3) score += 1;
    if (entry.borrowedFrom) score -= 1;
    const promoted = entry.promotedAt ? new Date(entry.promotedAt).getTime() : 0;
    if (promoted && now - promoted < 90 * 24 * 60 * 60 * 1000) score += 0.5;
    return { entry, score };
  });
  scored.sort((a, b) => b.score - a.score || a.entry.code.localeCompare(b.entry.code));

  const exemplars: PatternEntry[] = [];
  const take = (predicate: (entry: PatternEntry) => boolean) => {
    const found = scored.find(({ entry }) => predicate(entry) && !exemplars.includes(entry));
    if (found) exemplars.push(found.entry);
  };
  take((entry) => entry.label === 'WINNER');
  take((entry) => entry.label === 'LOSER');
  for (const { entry } of scored) {
    if (exemplars.length >= exemplarCount) break;
    if (!exemplars.includes(entry)) exemplars.push(entry);
  }
  const chosen = new Set(exemplars);
  return { exemplars, rest: scored.map(({ entry }) => entry).filter((entry) => !chosen.has(entry)) };
}

export type EvidenceLevel = { level: 0 | 1 | 2; ownCount: number; borrowedCount: number; weight: number };

/**
 * How much the store's own record can carry. Sparse stores lean on the craft
 * rubric and on borrowed records, and the weight moves continuously with
 * their own count rather than flipping at a threshold.
 */
export function evidenceLevel(ownCount: number, borrowedCount: number): EvidenceLevel {
  const weight = round(ownCount / (ownCount + EVIDENCE_PRIOR_STRENGTH));
  if (ownCount >= EVIDENCE_PRIOR_STRENGTH) return { level: 2, ownCount, borrowedCount: 0, weight };
  if (borrowedCount > 0) return { level: 1, ownCount, borrowedCount, weight };
  return { level: 0, ownCount, borrowedCount: 0, weight };
}

export function renderEvidenceLevel(level: EvidenceLevel, storeName: string, counts: { winners: number; losers: number }): string {
  const pct = Math.round(level.weight * 100);
  const own = `${storeName} has ${level.ownCount} recorded creative(s) with results (${counts.winners} winner(s), ${counts.losers} loser(s))`;
  if (level.level === 2) {
    return `Level 2 of 2. ${own}, enough to lean on its own record. Weight the store's own records at ${pct}% and the craft rubric at ${100 - pct}%. No borrowed records are included.`;
  }
  if (level.level === 1) {
    return `Level 1 of 2. ${own}, fewer than the ${EVIDENCE_PRIOR_STRENGTH} needed to lean on its own record. ${level.borrowedCount} record(s) borrowed from other stores in the same niche are included below, marked [borrowed]: they show how creatives are built for this kind of buyer, but never carry a cost, a price or a verdict across stores. Weight the store's own records at ${pct}%, the craft rubric and borrowed records at ${100 - pct}%, report confidence accordingly, and say in dataBasis.note which level you leaned on.`;
  }
  return `Level 0 of 2. ${own} and nothing could be borrowed from its niche. Judge on the craft rubric and the repeat check only; every data claim is "no data yet", which is a reason to test, not to reject. Say so in dataBasis.note.`;
}
