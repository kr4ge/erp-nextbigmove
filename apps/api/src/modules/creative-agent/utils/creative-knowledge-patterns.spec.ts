import { describe, expect, it } from '@jest/globals';
import {
  computeStorePatterns,
  evidenceLevel,
  rankCorpus,
  renderEvidenceLevel,
  renderStorePatterns,
  type PatternEntry,
} from './creative-knowledge-patterns';
import type { CreativeKnowledgeStructureV3 } from './creative-knowledge-structure';

const attributes = (overrides: Partial<CreativeKnowledgeStructureV3['attributes']> = {}): CreativeKnowledgeStructureV3['attributes'] => ({
  angle: 'pain point',
  hookType: 'pattern interrupt',
  format: 'talking head UGC',
  speaker: 'female 25-35',
  durationBucket: '15-30s',
  offerShown: 'discount',
  ctaType: 'order now',
  priceVisible: true,
  otherNote: null,
  ...overrides,
});

const v3 = (overrides: Partial<CreativeKnowledgeStructureV3> = {}): CreativeKnowledgeStructureV3 => ({
  schemaVersion: 3,
  verdict: 'SCALE',
  verdictReason: 'MEETS_ALL_TARGETS',
  confidence: 'HIGH',
  attributes: attributes(),
  lesson: 'Pattern interrupt with early price held attention and paid.',
  diagnosis: { funnelReading: null, creativeElement: null, notTheCreative: null },
  audienceQuality: { failed: false, suspectedElement: null },
  evidence: [],
  complianceFlags: [],
  durationSeconds: 30,
  timeline: [
    { startSeconds: 0, endSeconds: 2.8, role: 'HOOK', whatIsSeen: 'Jar to camera', onScreenText: null, spokenLine: 'Sobrang sakit', technique: 'callout', issue: null, keepOrFix: 'KEEP' },
    { startSeconds: 2.8, endSeconds: 30, role: 'PROOF', whatIsSeen: 'Before and after', onScreenText: '₱890', spokenLine: null, technique: 'split screen', issue: null, keepOrFix: 'KEEP' },
  ],
  beats: { hookEndsAt: 2.8, productFirstSeenAt: 4, priceFirstSeenAt: 9, ctaFirstSeenAt: 18, faceInFirst3s: true, speechInFirst3s: true, textInFirst3s: false },
  pacing: { sceneCount: 2, cutsPerMinute: 8, firstCutAt: 2.8, longestStaticRun: { startSeconds: 2.8, endSeconds: 30, seconds: 27.2 }, hasSpeech: true, speechStartsAt: 0.4, speechCoverage: 0.6, wordsPerMinute: 140 },
  ...overrides,
});

const entry = (code: string, label: 'WINNER' | 'LOSER', overrides: Partial<PatternEntry> = {}): PatternEntry => ({
  code,
  label,
  attribution: 'SOLE',
  posProductName: 'Cellular Defense',
  structure: v3(),
  metrics: { hookRate: 0.3, holdRate: 0.45 },
  digest: `${code} digest`,
  promotedAt: new Date(),
  ...overrides,
});

describe('computeStorePatterns', () => {
  it('counts wins and losses per attribute and averages the diagnostics', () => {
    const patterns = computeStorePatterns([
      entry('A', 'WINNER'),
      entry('B', 'WINNER', { metrics: { hookRate: 0.2, holdRate: 0.35 } }),
      entry('C', 'LOSER', { structure: v3({ attributes: attributes({ hookType: 'story', priceVisible: false }) }) }),
    ]);
    expect(patterns.total).toBe(3);
    const hook = patterns.dimensions.filter((row) => row.dimension === 'hook type');
    expect(hook).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: 'pattern interrupt', winners: 2, losers: 0, avgHookRate: 0.25 }),
      expect.objectContaining({ value: 'story', winners: 0, losers: 1 }),
    ]));
    expect(patterns.dimensions.find((row) => row.dimension === 'price shown' && row.value === 'no')).toMatchObject({ losers: 1 });
  });

  it('reports the beats of winners and losers separately, as medians', () => {
    const late = v3({ beats: { hookEndsAt: 5, productFirstSeenAt: 12, priceFirstSeenAt: 31, ctaFirstSeenAt: 34, faceInFirst3s: false, speechInFirst3s: true, textInFirst3s: false } });
    const patterns = computeStorePatterns([entry('A', 'WINNER'), entry('B', 'WINNER'), entry('C', 'LOSER', { structure: late })]);
    expect(patterns.winnerBeats).toMatchObject({ count: 2, priceFirstSeenAt: 9, faceInFirst3sShare: 1 });
    expect(patterns.loserBeats).toMatchObject({ count: 1, priceFirstSeenAt: 31, faceInFirst3sShare: 0 });
  });

  it('ignores borrowed entries when counting the store itself', () => {
    const patterns = computeStorePatterns([entry('A', 'WINNER'), entry('X', 'WINNER', { borrowedFrom: 'Other Store' })]);
    expect(patterns.total).toBe(1);
  });

  it('names the vocabulary the store has not tried', () => {
    const patterns = computeStorePatterns([entry('A', 'WINNER')]);
    const hooks = patterns.untested.find((group) => group.dimension === 'hook types');
    expect(hooks?.values).toContain('confession');
    expect(hooks?.values).not.toContain('pattern interrupt');
    expect(hooks?.values).not.toContain('OTHER');
  });

  it('falls back to registration fields for records without attributes', () => {
    const patterns = computeStorePatterns([entry('OLD', 'WINNER', { structure: null, format: 'skit', hookType: 'question' })]);
    expect(patterns.dimensions).toEqual(expect.arrayContaining([expect.objectContaining({ dimension: 'format', value: 'skit', winners: 1 })]));
  });
});

describe('renderStorePatterns', () => {
  it('says there is nothing when the store has no records', () => {
    expect(renderStorePatterns(computeStorePatterns([]))).toMatch(/no patterns to report/i);
  });

  it('renders counts, rates, beats and the untested list', () => {
    const text = renderStorePatterns(computeStorePatterns([entry('A', 'WINNER'), entry('B', 'LOSER')]));
    expect(text).toMatch(/By hook type: pattern interrupt 1W\/1L \(hook 30%, hold 45%\)/);
    expect(text).toMatch(/Winners' beats \(median of 1 with timelines\): hook ends 2.8s; product first seen 4s; price 9s/);
    expect(text).toMatch(/Not yet tested in this store/);
  });
});

describe('rankCorpus', () => {
  it('puts the closest records first and always includes a winner and a loser', () => {
    const entries = [
      entry('FAR-W', 'WINNER', { posProductName: 'Other', structure: v3({ attributes: attributes({ format: 'skit', hookType: 'story' }) }) }),
      entry('NEAR-L', 'LOSER'),
      entry('NEAR-W', 'WINNER'),
      entry('BORROWED', 'WINNER', { borrowedFrom: 'Other Store' }),
    ];
    const { exemplars, rest } = rankCorpus(entries, { format: 'talking head UGC', hookType: 'pattern interrupt', angle: 'pain point', posProductName: 'Cellular Defense' }, 2);
    expect(exemplars.map((e) => e.code)).toEqual(['NEAR-W', 'NEAR-L']);
    expect(rest.map((e) => e.code)).toEqual(['BORROWED', 'FAR-W']);
  });
});

describe('evidenceLevel', () => {
  it('moves weight continuously with the store\'s own count', () => {
    expect(evidenceLevel(0, 0)).toMatchObject({ level: 0, weight: 0 });
    expect(evidenceLevel(2, 12)).toMatchObject({ level: 1, weight: 0.2, borrowedCount: 12 });
    expect(evidenceLevel(8, 12)).toMatchObject({ level: 2, weight: 0.5, borrowedCount: 0 });
    expect(evidenceLevel(24, 0).weight).toBe(0.75);
  });

  it('tells the model what to lean on at each level', () => {
    expect(renderEvidenceLevel(evidenceLevel(0, 0), 'Ogimi', { winners: 0, losers: 0 })).toMatch(/Level 0 of 2.*craft rubric and the repeat check only/);
    expect(renderEvidenceLevel(evidenceLevel(3, 12), 'Ogimi', { winners: 2, losers: 1 })).toMatch(/Level 1 of 2.*12 record\(s\) borrowed.*own records at 27%/);
    expect(renderEvidenceLevel(evidenceLevel(10, 0), 'Ogimi', { winners: 6, losers: 4 })).toMatch(/Level 2 of 2.*own records at 56%/);
  });
});
