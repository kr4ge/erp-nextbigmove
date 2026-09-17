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
import { renderCorpus } from '../utils/creative-knowledge-structure';
import { CreativePromptTemplateService } from './creative-prompt-template.service';

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
  ) {}

  async build(input: {
    tenantId: string;
    creativeId: string;
    kind: 'VIDEO' | 'STATIC';
    signals: PromptRoutingSignals;
    /** The analysed window, for the running analyst's {{PERIOD}}. */
    period?: string;
  }): Promise<BuiltPrompt & { modeNote: string; promptTemplateId: string | null; promptVersion: number }> {
    const mode = resolveAnalysisMode(input.signals);
    const modeNote = describeAnalysisMode(mode, input.signals);

    const creative = await this.prisma.creative.findFirstOrThrow({
      where: { id: input.creativeId, tenantId: input.tenantId },
      select: {
        id: true,
        code: true,
        posProductName: true,
        storeConfigId: true,
        storeConfig: { select: { storeNameSnapshot: true } },
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

    if (mode === 'NEW_REVIEWER') {
      // The corpus is the whole store, every product in it. How a creative is
      // built travels across a store; what it cost to get an order does not,
      // and the prompt text says which is which.
      const [corpus, library] = await Promise.all([
        this.corpusFor(input.tenantId, creative.storeConfigId),
        this.libraryFor(input.tenantId, creative.storeConfigId, creative.id),
      ]);
      variables.KNOWLEDGE_BASE = renderCorpus(corpus);
      variables.LIBRARY = library;
      variables.WINNER_COUNT = String(corpus.filter((entry) => entry.label === CreativeKnowledgeLabel.WINNER).length);
      variables.LOSER_COUNT = String(corpus.filter((entry) => entry.label === CreativeKnowledgeLabel.LOSER).length);
    }

    const built = buildAnalysisPrompt({ mode, kind: input.kind, body: template.body, variables, vocabularyOverrides });
    return { ...built, modeNote, promptTemplateId: template.templateId, promptVersion: template.version };
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
      take: 24,
      include: { creative: { select: { code: true, posProductName: true } } },
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
