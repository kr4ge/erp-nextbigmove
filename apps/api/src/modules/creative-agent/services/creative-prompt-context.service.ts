import { Injectable } from '@nestjs/common';
import { CreativeKnowledgeLabel } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  buildAnalysisPrompt,
  describeAnalysisMode,
  resolveAnalysisMode,
  type BuiltPrompt,
  type PromptRoutingSignals,
} from '../prompts/creative-prompt-router';
import { renderCorpus, type CreativeKnowledgeStructure } from '../utils/creative-knowledge-structure';
import {
  EVIDENCE_PRIOR_STRENGTH,
  computeStorePatterns,
  evidenceLevel,
  rankCorpus,
  renderEvidenceLevel,
  renderStorePatterns,
  type PatternEntry,
} from '../utils/creative-knowledge-patterns';
import { CreativePromptTemplateService } from './creative-prompt-template.service';
import { CreativeStoreTargetService, renderStoreTargets, storeTargetVariables } from './creative-store-target.service';

/**
 * Assembles the prompt a run receives.
 *
 * Picks the mode from the creative's own delivery data, fetches whichever
 * prompt version the advertiser has active (or the default), fills its
 * variables, and hands back the text and the fixed output schema. The analyzer
 * asks for a prompt and gets one; it never has to know how the pieces fit.
 */
@Injectable()
export class CreativePromptContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templates: CreativePromptTemplateService,
    private readonly storeTargets: CreativeStoreTargetService,
  ) {}

  async build(input: {
    tenantId: string;
    creativeId: string;
    kind: 'VIDEO' | 'STATIC';
    signals: PromptRoutingSignals;
    /** The analysed window, for the running analyst's {{PERIOD}}. */
    period?: string;
  }): Promise<BuiltPrompt & { modeNote: string; promptTemplateId: string | null; promptVersion: number; variables: Record<string, string> }> {
    const mode = resolveAnalysisMode(input.signals);
    const modeNote = describeAnalysisMode(mode, input.signals);

    const creative = await this.prisma.creative.findFirstOrThrow({
      where: { id: input.creativeId, tenantId: input.tenantId },
      select: {
        id: true,
        code: true,
        posProductName: true,
        format: true,
        hookType: true,
        angle: true,
        storeConfigId: true,
        storeConfig: { select: { storeNameSnapshot: true, aiNiche: true } },
      },
    });

    const [template, vocabularyOverrides] = await Promise.all([
      this.templates.resolve(input.tenantId, mode),
      this.vocabularyOverrides(input.tenantId),
    ]);

    const variables: Record<string, string> = {
      STORE_NAME: creative.storeConfig.storeNameSnapshot,
      PRODUCT_NAME: creative.posProductName ?? '(no product registered)',
      CREATIVE_CODE: creative.code,
      PERIOD: input.period ?? 'not applicable',
    };

    if (mode === 'RUNNING_ANALYST') {
      // The store's definition of a winner, written down once and handed to
      // every analysis of its creatives. A store with nothing set is told so
      // in words, which is what makes the prompt return NO_THRESHOLDS.
      const targets = await this.storeTargets.forStore(input.tenantId, creative.storeConfigId);
      variables.STORE_TARGETS = renderStoreTargets(creative.storeConfig.storeNameSnapshot, targets);
      Object.assign(variables, storeTargetVariables(targets));
    }

    if (mode === 'NEW_REVIEWER') {
      // The corpus is the whole store, every product in it. How a creative is
      // built travels across a store; what it cost to get an order does not,
      // and the prompt text says which is which. A thin store borrows records
      // from its niche, marked as such; the patterns are counted here rather
      // than left for the model to infer from a pile of digests.
      const [own, library] = await Promise.all([
        this.corpusFor(input.tenantId, creative.storeConfigId),
        this.libraryFor(input.tenantId, creative.storeConfigId, creative.id),
      ]);
      const winners = own.filter((entry) => entry.label === CreativeKnowledgeLabel.WINNER).length;
      const losers = own.filter((entry) => entry.label === CreativeKnowledgeLabel.LOSER).length;
      const borrowed = own.length < EVIDENCE_PRIOR_STRENGTH
        ? await this.borrowedFor(input.tenantId, creative.storeConfigId, creative.storeConfig.aiNiche)
        : [];
      const entries: PatternEntry[] = [
        ...own.map((row) => this.toPatternEntry(row, null)),
        ...borrowed.map((row) => this.toPatternEntry(row, row.storeConfig.storeNameSnapshot)),
      ];
      const ranked = rankCorpus(entries, {
        format: creative.format,
        hookType: creative.hookType,
        angle: creative.angle,
        posProductName: creative.posProductName,
      });
      const ordered = [...ranked.exemplars, ...ranked.rest];
      variables.KNOWLEDGE_BASE = renderCorpus(
        ordered.map((entry) => ({
          label: entry.label,
          attribution: entry.attribution,
          digest: entry.digest,
          creative: { code: entry.code, posProductName: entry.posProductName },
          borrowedFrom: entry.borrowedFrom,
          structure: entry.structure,
        })),
        { exemplarCodes: new Set(ranked.exemplars.map((entry) => entry.code)) },
      );
      variables.STORE_PATTERNS = renderStorePatterns(computeStorePatterns(entries));
      variables.EVIDENCE_LEVEL = renderEvidenceLevel(
        evidenceLevel(own.length, borrowed.length),
        creative.storeConfig.storeNameSnapshot,
        { winners, losers },
      );
      variables.LIBRARY = library;
      variables.WINNER_COUNT = String(winners);
      variables.LOSER_COUNT = String(losers);
    }

    const built = buildAnalysisPrompt({ mode, kind: input.kind, body: template.body, variables, vocabularyOverrides });
    return { ...built, modeNote, promptTemplateId: template.templateId, promptVersion: template.version, variables };
  }

  private toPatternEntry(
    row: {
      label: CreativeKnowledgeLabel;
      attribution: string;
      digest: string | null;
      structure: unknown;
      metrics: unknown;
      promotedAt: Date;
      creative: { code: string; posProductName: string | null; format: string | null; hookType: string | null; angle: string | null };
    },
    borrowedFrom: string | null,
  ): PatternEntry {
    const metrics = row.metrics && typeof row.metrics === 'object' ? (row.metrics as PatternEntry['metrics']) : null;
    return {
      code: row.creative.code,
      label: row.label === CreativeKnowledgeLabel.WINNER ? 'WINNER' : 'LOSER',
      attribution: row.attribution as PatternEntry['attribution'],
      posProductName: row.creative.posProductName,
      format: row.creative.format,
      hookType: row.creative.hookType,
      angle: row.creative.angle,
      borrowedFrom,
      structure: (row.structure ?? null) as CreativeKnowledgeStructure | null,
      metrics,
      digest: row.digest,
      promotedAt: row.promotedAt,
    };
  }

  /** Recorded results to compare a new creative against: every promoted creative in the store. */
  private async corpusFor(tenantId: string, storeConfigId: string) {
    return this.prisma.creativeKnowledgeEntry.findMany({
      where: {
        tenantId,
        storeConfigId,
        active: true,
        label: { in: [CreativeKnowledgeLabel.WINNER, CreativeKnowledgeLabel.LOSER] },
      },
      orderBy: [{ attribution: 'asc' }, { promotedAt: 'desc' }],
      take: 60,
      include: { creative: { select: { code: true, posProductName: true, format: true, hookType: true, angle: true } } },
    });
  }

  /**
   * Records from other stores in the same niche, for a store too thin to
   * lean on its own. Construction travels across stores of a kind; money and
   * verdicts do not, and the corpus marks each borrowed record so the model
   * treats it that way.
   */
  private async borrowedFor(tenantId: string, storeConfigId: string, niche: string, limit = 12) {
    return this.prisma.creativeKnowledgeEntry.findMany({
      where: {
        tenantId,
        storeConfigId: { not: storeConfigId },
        nicheSnapshot: niche,
        active: true,
        label: { in: [CreativeKnowledgeLabel.WINNER, CreativeKnowledgeLabel.LOSER] },
      },
      orderBy: [{ attribution: 'asc' }, { promotedAt: 'desc' }],
      take: limit,
      include: {
        creative: { select: { code: true, posProductName: true, format: true, hookType: true, angle: true } },
        storeConfig: { select: { storeNameSnapshot: true } },
      },
    });
  }

  /**
   * What already exists for this store, so the reviewer can spot a repeat.
   * The whole registered library, not only creatives with results: a duplicate
   * of something that never ran is still a duplicate.
   */
  private async libraryFor(tenantId: string, storeConfigId: string, excludeCreativeId: string): Promise<string> {
    const rows = await this.prisma.creative.findMany({
      where: { tenantId, storeConfigId, id: { not: excludeCreativeId } },
      select: { code: true, format: true, hookType: true, angle: true, title: true, posProductName: true },
      orderBy: { createdAt: 'desc' },
      take: 60,
    });
    if (rows.length === 0) return 'No other creatives are registered for this store yet.';
    const lines = rows.map((row) => {
      const shape = [row.format, row.hookType, row.angle].filter(Boolean).join(' · ');
      const product = row.posProductName ? ` (${row.posProductName})` : '';
      return `- ${row.code}${product}${shape ? ` — ${shape}` : ` — ${row.title}`}`;
    });
    return [`${rows.length} creative(s) already registered for this store:`, ...lines].join('\n');
  }

  /** Hook types and formats this tenant actually uses, merged into the fixed vocabulary. */
  private async vocabularyOverrides(tenantId: string) {
    const options = await this.prisma.creativeFieldOption.findMany({
      where: { tenantId },
      select: { field: true, label: true },
    });
    const pick = (field: string) => options.filter((option) => option.field === field).map((option) => option.label);
    return { hookType: pick('HOOK_TYPE'), format: [...pick('VIDEO_FORMAT'), ...pick('STATIC_FORMAT')] };
  }
}
