import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CreativeKnowledgeAttribution,
  CreativeKnowledgeLabel,
  CreativeKnowledgeLabelSource,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CREATIVE_AGENT_PERMISSIONS } from '../creative-agent.constants';
import type { CreativeActor } from '../types/creative-actor.type';
import { CreativeAccessService } from './creative-access.service';
import { CreativeAiFrameService } from './creative-ai-frame.service';
import { buildKnowledgeDigest, extractStructure, type CreativeKnowledgeStructure, type KnowledgeMediaHint } from '../utils/creative-knowledge-structure';

/**
 * The winning-ads knowledge base.
 *
 * A knowledge entry is one analyzed creative whose construction is recorded
 * alongside what it went on to earn. The corpus is always scoped to a single
 * (tenant, store): a fragrance store and a supplement store must never inform
 * each other's decisions, and the store is the narrowest scope an advertiser
 * actually curates.
 *
 * Two invariants are load-bearing:
 *
 *  1. Only a COMPLETED analysis can be promoted. The structural record is the
 *     point of the library; an entry without one would be a metrics row.
 *  2. The structure and metrics are snapshotted onto the entry. Re-running or
 *     purging an analysis must never silently change what the gate already
 *     learned from.
 */
@Injectable()
export class CreativeKnowledgeService {
  private readonly logger = new Logger(CreativeKnowledgeService.name);

  /**
   * Spend below which an outcome is not yet a verdict. A creative killed at
   * ₱300 did not fail; it was never really tested.
   */
  static readonly MIN_SPEND_FOR_VERDICT = 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CreativeAccessService,
    private readonly frames: CreativeAiFrameService,
  ) {}

  /**
   * Promote one analyzed creative into its own store's knowledge base.
   *
   * The label may be supplied by a human; when it is omitted it is computed
   * from reconciled economics. Promoting the same creative twice updates the
   * existing entry rather than creating a second one, so re-analysis can
   * refresh the structural record without duplicating history.
   */
  async promote(
    actor: CreativeActor,
    creativeId: string,
    input: {
      runId?: string;
      label?: CreativeKnowledgeLabel;
      labelRationale?: string;
      digest?: string;
    } = {},
  ) {
    const context = await this.access.resolve(actor);
    this.access.require(context, CREATIVE_AGENT_PERMISSIONS.AI_MANAGE);

    const creative = await this.prisma.creative.findFirst({
      where: { id: creativeId, tenantId: context.tenantId },
      include: {
        storeConfig: { select: { id: true, aiNiche: true, storeNameSnapshot: true } },
        metaAdLinks: { select: { adId: true } },
      },
    });
    if (!creative) throw new NotFoundException('Creative not found');

    const run = input.runId
      ? await this.prisma.creativeAiRun.findFirst({
          where: { id: input.runId, tenantId: context.tenantId, creativeId },
        })
      : await this.prisma.creativeAiRun.findFirst({
          where: { tenantId: context.tenantId, creativeId, status: 'COMPLETED' },
          orderBy: { completedAt: 'desc' },
        });

    if (!run) {
      throw new BadRequestException(
        'This creative has no completed AI analysis. Analyze it before adding it to the knowledge base.',
      );
    }
    if (run.status !== 'COMPLETED') {
      throw new BadRequestException(`That analysis is ${run.status.toLowerCase()}, not completed.`);
    }

    // The media manifest contributes the duration and the measured pacing,
    // so the record carries what code measured beside what the model read.
    const structure = extractStructure(run.analysisResult, run.mediaManifest as KnowledgeMediaHint);
    if (!structure) {
      throw new BadRequestException(
        'That analysis has no structural sections, so there is nothing for the knowledge base to learn from.',
      );
    }

    const adIds = creative.metaAdLinks.map((link) => link.adId);
    const economics = await this.economicsFor(context.tenantId, adIds);
    const attribution = await this.attributionFor(context.tenantId, adIds);

    const label = input.label ?? this.deriveLabel(economics);
    const labelSource = input.label
      ? CreativeKnowledgeLabelSource.MANUAL
      : CreativeKnowledgeLabelSource.AUTOMATIC;
    const rationale = input.labelRationale?.trim() || this.describeLabel(label, economics);

    const payload = {
      tenantId: context.tenantId,
      storeConfigId: creative.storeConfigId,
      creativeId: creative.id,
      runId: run.id,
      label,
      labelSource,
      attribution,
      labelRationale: rationale,
      nicheSnapshot: creative.storeConfig.aiNiche,
      structure: structure as unknown as Prisma.InputJsonValue,
      metrics: economics as unknown as Prisma.InputJsonValue,
      digest: input.digest?.trim() || buildKnowledgeDigest(creative, structure, economics),
      promotedById: context.userId,
      active: true,
    };

    const entry = await this.prisma.creativeKnowledgeEntry.upsert({
      where: { tenantId_creativeId: { tenantId: context.tenantId, creativeId: creative.id } },
      create: payload,
      update: {
        ...payload,
        promotedAt: new Date(),
      },
    });

    this.logger.log(
      `Knowledge entry ${entry.id} (${label}, ${attribution}) promoted for ${creative.code} in ${creative.storeConfig.storeNameSnapshot}`,
    );
    return this.present(entry);
  }

  /** Retire an entry without deleting it, so the history stays auditable. */
  async retire(actor: CreativeActor, entryId: string) {
    const context = await this.access.resolve(actor);
    this.access.require(context, CREATIVE_AGENT_PERMISSIONS.AI_MANAGE);
    const existing = await this.prisma.creativeKnowledgeEntry.findFirst({
      where: { id: entryId, tenantId: context.tenantId },
    });
    if (!existing) throw new NotFoundException('Knowledge entry not found');
    const entry = await this.prisma.creativeKnowledgeEntry.update({
      where: { id: entryId },
      data: { active: false },
    });
    return this.present(entry);
  }

  /** Re-activate a retired entry. */
  async restore(actor: CreativeActor, entryId: string) {
    const context = await this.access.resolve(actor);
    this.access.require(context, CREATIVE_AGENT_PERMISSIONS.AI_MANAGE);
    const existing = await this.prisma.creativeKnowledgeEntry.findFirst({
      where: { id: entryId, tenantId: context.tenantId },
    });
    if (!existing) throw new NotFoundException('Knowledge entry not found');
    const entry = await this.prisma.creativeKnowledgeEntry.update({
      where: { id: entryId },
      data: { active: true },
    });
    return this.present(entry);
  }

  /** Browse one store's knowledge base. */
  async list(
    actor: CreativeActor,
    query: {
      storeId?: string;
      label?: CreativeKnowledgeLabel;
      includeRetired?: boolean;
      take?: number;
      skip?: number;
    } = {},
  ) {
    const context = await this.access.resolve(actor);
    this.access.require(context, CREATIVE_AGENT_PERMISSIONS.READ);

    const where: Prisma.CreativeKnowledgeEntryWhereInput = {
      tenantId: context.tenantId,
      ...(query.storeId ? { storeConfigId: query.storeId } : {}),
      ...(query.label ? { label: query.label } : {}),
      ...(query.includeRetired ? {} : { active: true }),
    };
    const take = Math.min(Math.max(query.take ?? 50, 1), 200);
    const [rows, total] = await Promise.all([
      this.prisma.creativeKnowledgeEntry.findMany({
        where,
        orderBy: { promotedAt: 'desc' },
        take,
        skip: Math.max(query.skip ?? 0, 0),
        include: {
          creative: {
            select: { code: true, title: true, kind: true, format: true, hookType: true, angle: true, thumbnailAssetId: true, mediaUrl: true },
          },
          storeConfig: { select: { id: true, storeNameSnapshot: true, aiNiche: true } },
          promotedBy: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.creativeKnowledgeEntry.count({ where }),
    ]);

    return { total, items: rows.map((row) => this.present(row)) };
  }

  /** One entry in full, including the frozen structural record. */
  async detail(actor: CreativeActor, entryId: string) {
    const context = await this.access.resolve(actor);
    this.access.require(context, CREATIVE_AGENT_PERMISSIONS.READ);
    const entry = await this.prisma.creativeKnowledgeEntry.findFirst({
      where: { id: entryId, tenantId: context.tenantId },
      include: {
        creative: {
          select: { id: true, code: true, title: true, kind: true, format: true, hookType: true, angle: true, script: true, mediaUrl: true, thumbnailAssetId: true },
        },
        storeConfig: { select: { id: true, storeNameSnapshot: true, aiNiche: true } },
        promotedBy: { select: { firstName: true, lastName: true } },
      },
    });
    if (!entry) throw new NotFoundException('Knowledge entry not found');
    // Scene thumbnails live with the run the entry was promoted from.
    const frames = entry.runId ? await this.frames.listForRun(context.tenantId, entry.runId) : [];
    return { ...this.present(entry), structure: entry.structure, metrics: entry.metrics, frames };
  }

  /**
   * How ready a store's knowledge base is to inform decisions.
   *
   * The gate should not be trusted against a thin corpus, and the advertiser
   * needs to see that plainly rather than infer it.
   */
  async coverage(actor: CreativeActor, storeId?: string) {
    const context = await this.access.resolve(actor);
    this.access.require(context, CREATIVE_AGENT_PERMISSIONS.READ);

    const grouped = await this.prisma.creativeKnowledgeEntry.groupBy({
      by: ['storeConfigId', 'label'],
      where: {
        tenantId: context.tenantId,
        active: true,
        ...(storeId ? { storeConfigId: storeId } : {}),
      },
      _count: { _all: true },
    });

    const stores = await this.prisma.creativeStoreConfig.findMany({
      where: {
        tenantId: context.tenantId,
        ...(storeId ? { id: storeId } : { active: true }),
      },
      select: { id: true, storeNameSnapshot: true, aiNiche: true, aiStoreRules: true },
      orderBy: { storeNameSnapshot: 'asc' },
    });

    return stores.map((store) => {
      const counts = grouped.filter((row) => row.storeConfigId === store.id);
      const winners = counts.find((row) => row.label === 'WINNER')?._count._all ?? 0;
      const losers = counts.find((row) => row.label === 'LOSER')?._count._all ?? 0;
      const inconclusive = counts.find((row) => row.label === 'INCONCLUSIVE')?._count._all ?? 0;
      return {
        storeId: store.id,
        storeName: store.storeNameSnapshot,
        niche: store.aiNiche,
        hasStoreRules: Boolean(store.aiStoreRules?.trim()),
        winners,
        losers,
        inconclusive,
        total: winners + losers + inconclusive,
        readiness: this.readiness(winners, losers),
      };
    });
  }

  /**
   * The corpus the enrollment gate reads. Winners and losers only: an
   * inconclusive creative teaches nothing about what works.
   *
   * Entries whose result cannot be attributed to them alone are still included,
   * because their construction is real, but the caller is told which they are
   * so the prompt can weight them honestly.
   */
  async corpusForStore(tenantId: string, storeConfigId: string, limit = 24) {
    const entries = await this.prisma.creativeKnowledgeEntry.findMany({
      where: {
        tenantId,
        storeConfigId,
        active: true,
        label: { in: [CreativeKnowledgeLabel.WINNER, CreativeKnowledgeLabel.LOSER] },
      },
      orderBy: [{ attribution: 'asc' }, { promotedAt: 'desc' }],
      take: Math.min(Math.max(limit, 1), 60),
      include: {
        creative: { select: { code: true, title: true, format: true, hookType: true, angle: true } },
      },
    });
    return entries;
  }

  /**
   * Decide a label from reconciled economics.
   *
   * Deliberately conservative: anything under the spend floor is INCONCLUSIVE
   * rather than a loser, because a creative that was killed early never had the
   * chance to prove itself either way.
   */
  deriveLabel(economics: KnowledgeEconomics): CreativeKnowledgeLabel {
    if (economics.spend < CreativeKnowledgeService.MIN_SPEND_FOR_VERDICT) {
      return CreativeKnowledgeLabel.INCONCLUSIVE;
    }
    if (economics.netContribution === null) return CreativeKnowledgeLabel.INCONCLUSIVE;
    return economics.netContribution > 0
      ? CreativeKnowledgeLabel.WINNER
      : CreativeKnowledgeLabel.LOSER;
  }

  private describeLabel(label: CreativeKnowledgeLabel, economics: KnowledgeEconomics) {
    const money = (value: number) => `₱${Math.round(value).toLocaleString('en-PH')}`;
    if (label === CreativeKnowledgeLabel.INCONCLUSIVE) {
      return economics.spend < CreativeKnowledgeService.MIN_SPEND_FOR_VERDICT
        ? `Spent ${money(economics.spend)}, below the ${money(CreativeKnowledgeService.MIN_SPEND_FOR_VERDICT)} needed for a verdict.`
        : 'No reconciled contribution is available for this creative.';
    }
    return `Spent ${money(economics.spend)} for ${money(economics.netContribution ?? 0)} net contribution across ${economics.delivered} delivered orders.`;
  }

  /**
   * Reconciled economics for a creative's linked ads.
   *
   * Uses reconcile_marketing, the same source the advertising dashboard uses,
   * so a label never disagrees with what the rest of the ERP reports.
   */
  private async economicsFor(tenantId: string, adIds: string[]): Promise<KnowledgeEconomics> {
    if (adIds.length === 0) {
      return { spend: 0, impressions: 0, orders: 0, delivered: 0, netContribution: null, deliveredCostPerOrder: null, linkedAdCount: 0, hookRate: null, holdRate: null };
    }
    // The diagnostics come from Meta's own video counters, the same way the
    // analysis context computes them, so an entry's hook and hold rates can be
    // averaged by hook type later.
    const video = await this.prisma.metaAdInsight.aggregate({
      where: { tenantId, adId: { in: adIds }, videoPlays3s: { not: null } },
      _sum: { videoPlays3s: true, impressions: true, thruPlays: true },
    });
    const sum = await this.prisma.reconcileMarketing.aggregate({
      where: { tenantId, adId: { in: adIds } },
      _sum: {
        spend: true,
        impressions: true,
        purchasesPos: true,
        deliveredCount: true,
        deliveredCodPos: true,
        cogsDeliveredPos: true,
        sfSdrPos: true,
        ffSdrPos: true,
        ifSdrPos: true,
        codFeeDeliveredPos: true,
      },
    });
    const num = (value: Prisma.Decimal | number | null | undefined) => Number(value ?? 0);
    const spend = num(sum._sum.spend);
    const delivered = sum._sum.deliveredCount ?? 0;
    const deliveredRevenue = num(sum._sum.deliveredCodPos);
    const costs =
      num(sum._sum.cogsDeliveredPos) +
      num(sum._sum.sfSdrPos) +
      num(sum._sum.ffSdrPos) +
      num(sum._sum.ifSdrPos) +
      num(sum._sum.codFeeDeliveredPos);
    const hasRevenue = deliveredRevenue > 0 || delivered > 0;
    return {
      spend: Math.round(spend * 100) / 100,
      impressions: sum._sum.impressions ?? 0,
      orders: sum._sum.purchasesPos ?? 0,
      delivered,
      netContribution: hasRevenue ? Math.round((deliveredRevenue - costs - spend) * 100) / 100 : null,
      deliveredCostPerOrder: delivered > 0 ? Math.round((spend / delivered) * 100) / 100 : null,
      linkedAdCount: adIds.length,
      hookRate: (video._sum.impressions ?? 0) > 0 ? Math.round(((video._sum.videoPlays3s ?? 0) / (video._sum.impressions ?? 1)) * 1000) / 1000 : null,
      holdRate: (video._sum.videoPlays3s ?? 0) > 0 && video._sum.thruPlays != null
        ? Math.round(((video._sum.thruPlays ?? 0) / (video._sum.videoPlays3s ?? 1)) * 1000) / 1000
        : null,
    };
  }

  /**
   * Whether this creative's result is its own.
   *
   * Revenue in the ERP attributes to a Meta campaign, so a creative that shared
   * its campaign with others has only a partial claim on the outcome. Rather
   * than hide that, the entry records it and the gate is told.
   */
  private async attributionFor(tenantId: string, adIds: string[]): Promise<CreativeKnowledgeAttribution> {
    if (adIds.length === 0) return CreativeKnowledgeAttribution.UNKNOWN;
    const campaigns = await this.prisma.metaAdInsight.findMany({
      where: { tenantId, adId: { in: adIds } },
      select: { campaignId: true },
      distinct: ['campaignId'],
    });
    const campaignIds = campaigns.map((row) => row.campaignId).filter(Boolean);
    if (campaignIds.length === 0) return CreativeKnowledgeAttribution.UNKNOWN;

    // Every ad that billed inside those campaigns.
    const siblings = await this.prisma.metaAdInsight.findMany({
      where: { tenantId, campaignId: { in: campaignIds } },
      select: { adId: true },
      distinct: ['adId'],
    });
    const siblingAdIds = siblings.map((row) => row.adId);
    const linkedElsewhere = await this.prisma.creativeMetaAdLink.findMany({
      where: { tenantId, adId: { in: siblingAdIds } },
      select: { creativeId: true },
      distinct: ['creativeId'],
    });
    return linkedElsewhere.length <= 1
      ? CreativeKnowledgeAttribution.SOLE
      : CreativeKnowledgeAttribution.SHARED;
  }

  /**
   * How much weight this store's corpus can carry.
   *
   * These thresholds are judgement, not statistics. A craft library needs far
   * fewer examples than a statistical model because each entry is a detailed
   * structural record, but a handful of winners with no losers still cannot
   * tell you what separates them.
   */
  private readiness(winners: number, losers: number): KnowledgeReadiness {
    if (winners + losers === 0) return 'EMPTY';
    if (winners < 3 || losers < 2) return 'BUILDING';
    if (winners < 8 || losers < 4) return 'ADVISORY';
    return 'READY';
  }

  private present(entry: Record<string, any>) {
    return {
      id: entry.id,
      creativeId: entry.creativeId,
      storeId: entry.storeConfigId,
      storeName: entry.storeConfig?.storeNameSnapshot ?? null,
      niche: entry.nicheSnapshot,
      label: entry.label,
      labelSource: entry.labelSource,
      labelRationale: entry.labelRationale,
      attribution: entry.attribution,
      digest: entry.digest,
      active: entry.active,
      promotedAt: entry.promotedAt,
      promotedBy: entry.promotedBy
        ? `${entry.promotedBy.firstName} ${entry.promotedBy.lastName}`.trim()
        : null,
      creative: entry.creative
        ? {
            code: entry.creative.code,
            title: entry.creative.title,
            kind: entry.creative.kind,
            format: entry.creative.format,
            hookType: entry.creative.hookType,
            angle: entry.creative.angle,
            mediaUrl: entry.creative.mediaUrl ?? null,
            thumbnailAssetId: entry.creative.thumbnailAssetId ?? null,
          }
        : undefined,
    };
  }
}

export type KnowledgeReadiness = 'EMPTY' | 'BUILDING' | 'ADVISORY' | 'READY';

export type KnowledgeEconomics = {
  spend: number;
  impressions: number;
  orders: number;
  delivered: number;
  netContribution: number | null;
  deliveredCostPerOrder: number | null;
  linkedAdCount: number;
  /** Meta's 3-second plays over impressions; null when the export lacked video counters. */
  hookRate?: number | null;
  /** ThruPlays over 3-second plays. */
  holdRate?: number | null;
};
