import { BadRequestException } from '@nestjs/common';
import { CreativeKnowledgeLabel } from '@prisma/client';
import { describe, expect, it, jest } from '@jest/globals';
import { CreativeKnowledgeService } from './creative-knowledge.service';
import {
  extractStructure,
  buildKnowledgeDigest,
  renderCorpus,
  type CreativeKnowledgeStructureV1,
  type CreativeKnowledgeStructureV2,
} from '../utils/creative-knowledge-structure';

const tenantId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const creativeId = '33333333-3333-4333-8333-333333333333';
const storeConfigId = '44444444-4444-4444-8444-444444444444';

const economics = (overrides: Partial<Record<string, number | null>> = {}) => ({
  spend: 0,
  impressions: 0,
  orders: 0,
  delivered: 0,
  netContribution: null,
  deliveredCostPerOrder: null,
  linkedAdCount: 0,
  ...overrides,
}) as any;

function setup(options: {
  run?: Record<string, unknown> | null;
  permissions?: string[];
} = {}) {
  const permissions = options.permissions ?? ['creative_agent.ai.manage', 'creative_agent.read'];
  const context = { tenantId, userId, isSuperAdmin: false, permissions: new Set(permissions) };
  const prisma: any = {
    creative: {
      findFirst: jest.fn(async () => ({
        id: creativeId,
        code: 'ABC-V0001',
        storeConfigId,
        format: 'UGC',
        hookType: 'QUESTION',
        angle: null,
        storeConfig: { id: storeConfigId, aiNiche: 'FRAGRANCE_BEAUTY', storeNameSnapshot: 'Dear Scent' },
        metaAdLinks: [],
      })),
    },
    creativeAiRun: {
      findFirst: jest.fn(async () => (options.run === undefined ? null : options.run)),
    },
    creativeKnowledgeEntry: { upsert: jest.fn(async (args: any) => ({ id: 'entry-1', ...args.create })) },
    reconcileMarketing: { aggregate: jest.fn(async () => ({ _sum: {} })) },
    metaAdInsight: { findMany: jest.fn(async () => []) },
    creativeMetaAdLink: { findMany: jest.fn(async () => []) },
  };
  const access = {
    resolve: jest.fn(async () => context),
    require: jest.fn((_ctx: any, ...required: string[]) => {
      if (!required.some((permission) => permissions.includes(permission))) {
        throw new Error('Insufficient permissions');
      }
    }),
  };
  const service = new CreativeKnowledgeService(prisma, access as any);
  return { service, prisma, access };
}

describe('CreativeKnowledgeService.deriveLabel', () => {
  const { service } = setup();

  it('treats an under-spent creative as inconclusive rather than a loser', () => {
    // A creative killed at ₱300 was never tested. Calling it a loser would
    // teach the gate that whatever it did fails, which is not what happened.
    expect(service.deriveLabel(economics({ spend: 300, netContribution: -300 })))
      .toBe(CreativeKnowledgeLabel.INCONCLUSIVE);
  });

  it('calls a profitable creative past the spend floor a winner', () => {
    expect(service.deriveLabel(economics({ spend: 5000, netContribution: 12000, delivered: 20 })))
      .toBe(CreativeKnowledgeLabel.WINNER);
  });

  it('calls an unprofitable creative past the spend floor a loser', () => {
    expect(service.deriveLabel(economics({ spend: 5000, netContribution: -2000, delivered: 3 })))
      .toBe(CreativeKnowledgeLabel.LOSER);
  });

  it('refuses a verdict when contribution was never reconciled', () => {
    // Spend alone is not an outcome; without revenue there is nothing to judge.
    expect(service.deriveLabel(economics({ spend: 9000, netContribution: null })))
      .toBe(CreativeKnowledgeLabel.INCONCLUSIVE);
  });

  it('treats exactly break-even as a loser, not a winner', () => {
    expect(service.deriveLabel(economics({ spend: 2000, netContribution: 0 })))
      .toBe(CreativeKnowledgeLabel.LOSER);
  });
});

describe('CreativeKnowledgeService.promote', () => {
  it('refuses a creative with no completed analysis', async () => {
    const { service } = setup({ run: null });
    await expect(service.promote({ userId, tenantId } as any, creativeId))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses an analysis whose result carries no structural sections', async () => {
    // The whole point of the library is how the video is built. A row without
    // that is a metrics record pretending to be knowledge.
    const { service } = setup({
      run: { id: 'run-1', status: 'COMPLETED', analysisResult: { summary: 'nice ad' } },
    });
    await expect(service.promote({ userId, tenantId } as any, creativeId))
      .rejects.toThrow(/no structural sections/i);
  });

  it('stores a frozen copy of the structure so re-analysis cannot rewrite history', async () => {
    const { service, prisma } = setup({
      run: {
        id: 'run-1',
        status: 'COMPLETED',
        analysisResult: {
          sections: {
            hook: {
              score: 2,
              verdict: 'Opens on a logo wall.',
              findings: [
                { observation: 'Static two-shot, logo fills top third.', evidenceType: 'OBSERVED', timestampSeconds: 0 },
              ],
            },
          },
        },
      },
    });
    await service.promote({ userId, tenantId } as any, creativeId);
    const written = prisma.creativeKnowledgeEntry.upsert.mock.calls[0][0] as any;
    expect(written.create.structure.sections.hook.observations).toHaveLength(1);
    expect(written.create.nicheSnapshot).toBe('FRAGRANCE_BEAUTY');
  });
});

describe('extractStructure', () => {
  const analysis = {
    overview: { summary: 'A 64s interview on a branded set.' },
    sections: {
      hook: {
        score: 2,
        verdict: 'Question never lands inside three seconds.',
        findings: [
          { observation: 'Logo fills the top third.', evidenceType: 'OBSERVED', timestampSeconds: 0 },
          { observation: 'Predicted weak 3s view rate.', evidenceType: 'HYPOTHESIS', timestampSeconds: 2.5 },
          { observation: 'CTR was 4.32%.', evidenceType: 'MEASURED', timestampSeconds: null },
        ],
      },
    },
  };

  it('keeps what was observed and measured', () => {
    const structure = (extractStructure(analysis) as CreativeKnowledgeStructureV1);
    const observations = structure.sections.hook!.observations;
    expect(observations.map((entry) => entry.what)).toEqual([
      'Logo fills the top third.',
      'CTR was 4.32%.',
    ]);
  });

  it('drops hypotheses so a guess never hardens into remembered fact', () => {
    const structure = (extractStructure(analysis) as CreativeKnowledgeStructureV1);
    const kept = structure.sections.hook!.observations.map((entry) => entry.what);
    expect(kept).not.toContain('Predicted weak 3s view rate.');
  });

  it('returns null when there are no sections at all', () => {
    expect(extractStructure({ summary: 'no sections here' })).toBeNull();
    expect(extractStructure(null)).toBeNull();
    expect(extractStructure('not an object')).toBeNull();
  });

  it('caps observations so one verbose analysis cannot dominate a prompt', () => {
    const many = {
      sections: {
        hook: {
          findings: Array.from({ length: 12 }, (_unused, index) => ({
            observation: `Observation ${index}`,
            evidenceType: 'OBSERVED',
            timestampSeconds: index,
          })),
        },
      },
    };
    expect((extractStructure(many) as CreativeKnowledgeStructureV1).sections.hook!.observations).toHaveLength(4);
  });
});

describe('extractStructure v2 (running analyst)', () => {
  const analyst = {
    verdict: 'KILL',
    verdictReason: 'AUDIENCE_QUALITY_FAILURE',
    confidence: 'HIGH',
    attributes: { angle: 'transformation', hookType: 'shock stat', format: 'talking head UGC', speaker: 'female 25-35', durationBucket: '30-60s', offerShown: 'discount', ctaType: 'order now', priceVisible: false, otherNote: null },
    lesson: 'Shock stat hook with hidden price gave cheap CPP but 41% RTS on 58 resolved orders.',
    diagnosis: { funnelReading: 'Good CTR, high RTS.', creativeElement: 'Price never shown; urgency banner at 12s.', notTheCreative: null },
    audienceQuality: { failed: true, suspectedElement: 'Hidden price plus fake urgency.' },
    evidence: [{ metric: 'RTS rate', value: '41%', versusTarget: 'max 20%' }],
    complianceFlags: [],
  };

  it('keeps the verdict, the classification and the lesson', () => {
    const structure = extractStructure(analyst) as CreativeKnowledgeStructureV2;
    expect(structure.schemaVersion).toBe(2);
    expect(structure.verdict).toBe('KILL');
    expect(structure.attributes.hookType).toBe('shock stat');
    expect(structure.lesson).toMatch(/41% RTS/);
    expect(structure.audienceQuality.failed).toBe(true);
  });

  it('writes a digest that leads with construction and names the audience failure', () => {
    const structure = extractStructure(analyst) as CreativeKnowledgeStructureV2;
    const digest = buildKnowledgeDigest({ code: 'OW-V0002', format: null, hookType: null }, structure, { spend: 16594, netContribution: 38188, delivered: 23 });
    expect(digest).toMatch(/^OW-V0002 — talking head UGC · shock stat · transformation/);
    expect(digest).toMatch(/Lesson: Shock stat hook/);
    expect(digest).toMatch(/Audience-quality failure: Hidden price/);
    expect(digest).toMatch(/Verdict: KILL \(AUDIENCE_QUALITY_FAILURE\)/);
  });

  it('does not mistake a reviewer decision for an analyst verdict', () => {
    // A new-creative review has no lesson or verdict, so it must not be
    // promotable as if it were evidence of what earned money.
    expect(extractStructure({ decision: 'APPROVE', qualityScore: 80, attributes: analyst.attributes })).toBeNull();
  });
});

describe('renderCorpus', () => {
  it('marks shared-campaign entries so the gate can discount them', () => {
    // Revenue attributes to a campaign, so a creative that shared one has only
    // a partial claim on the result. Hiding that would let the gate treat a
    // passenger as a proven winner.
    const rendered = renderCorpus([
      { label: 'WINNER', attribution: 'SHARED', digest: 'ABC-V0001 — UGC', creative: { code: 'ABC-V0001' } },
      { label: 'WINNER', attribution: 'SOLE', digest: 'ABC-V0002 — UGC', creative: { code: 'ABC-V0002' } },
    ]);
    expect(rendered).toContain('[shared campaign');
    expect(rendered.split('\n').find((line) => line.includes('ABC-V0002'))).not.toContain('[shared campaign');
  });

  it('says plainly when a store has no entries', () => {
    expect(renderCorpus([])).toMatch(/no knowledge entries/i);
  });

  it('reports both sides so the contrast is visible', () => {
    const rendered = renderCorpus([
      { label: 'WINNER', attribution: 'SOLE', digest: 'W1', creative: null },
      { label: 'LOSER', attribution: 'SOLE', digest: 'L1', creative: null },
    ]);
    expect(rendered).toContain('WINNER (1)');
    expect(rendered).toContain('LOSER (1)');
  });
});

describe('buildKnowledgeDigest', () => {
  it('leads with the opening beats, which is what the gate compares', () => {
    const digest = buildKnowledgeDigest(
      { code: 'ABC-V0001', format: 'UGC', hookType: 'QUESTION', angle: 'guilt' },
      {
        schemaVersion: 1,
        summary: null,
        sections: {
          hook: {
            score: 3,
            verdict: null,
            observations: [
              { at: 0, what: 'Close-up on a face.' },
              { at: 14, what: 'Late product reveal.' },
            ],
          },
        },
      },
      { spend: 5000, netContribution: 12000, delivered: 20 },
    );
    expect(digest).toContain('ABC-V0001 — UGC · QUESTION · guilt');
    expect(digest).toContain('Hook @0s: Close-up on a face.');
    // The 14s observation is outside the hook window and should not crowd it out.
    expect(digest).not.toContain('Late product reveal');
  });

  it('says so when contribution was never reconciled', () => {
    const digest = buildKnowledgeDigest(
      { code: 'ABC-V0002', format: null, hookType: null },
      { schemaVersion: 1, summary: null, sections: {} },
      { spend: 1200, netContribution: null, delivered: 0 },
    );
    expect(digest).toMatch(/contribution not reconciled/i);
  });
});
