import { Injectable } from '@nestjs/common';
import { CreativeEnrollmentDecision, CreativeEnrollmentReviewOutcome, CreativeMetaDraftStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { MediaAssetsService } from '../../../common/services/media-assets.service';
import { CREATIVE_AGENT_PERMISSIONS } from '../creative-agent.constants';
import { HandoffQueryDto } from '../dto/creative-meta-draft.dto';
import type { CreativeActor } from '../types/creative-actor.type';
import { CreativeAccessService } from './creative-access.service';

export type HandoffTag = 'APPROVE' | 'REVISE' | 'REJECT' | 'UNREVIEWED';

export type HandoffRow = {
  id: string;
  code: string;
  title: string;
  kind: 'VIDEO' | 'STATIC';
  thumbnailUrl: string | null;
  thumbnailIsVideo: boolean;
  mediaUrl: string | null;
  driveUrl: string | null;
  angle: string | null;
  hookType: string | null;
  store: { id: string; name: string };
  product: { customId: string | null; name: string | null };
  creator: string;
  revisionState: string;
  performanceStatus: string;
  tag: HandoffTag;
  gate: {
    reviewId: string;
    decision: CreativeEnrollmentDecision | null;
    outcome: CreativeEnrollmentReviewOutcome;
    confidence: number | null;
    shadow: boolean;
    completedAt: string | null;
    decisionNotes: string | null;
  } | null;
  analysis: { runId: string; completedAt: string | null } | null;
  /** A gate review is queued or running; the tag will change when it lands. */
  gateInProgress: boolean;
  media: { held: boolean; capturedAt: string | null; expiresAt: string | null; releasedAt: string | null };
  draft: {
    batchId: string;
    status: CreativeMetaDraftStatus;
    campaignName: string;
    metaAdId: string | null;
    metaCampaignId: string | null;
    adAccountId: string;
    completedAt: string | null;
    errorMessage: string | null;
  } | null;
  /** Whether Send is possible without a human override first. */
  sendable: boolean;
};

export type HandoffResponse = {
  items: HandoffRow[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<HandoffTag, number>;
  filters: { stores: Array<{ value: string; label: string }> };
  permissions: { canSend: boolean; canOverride: boolean; canRunGate: boolean };
};

/**
 * The handoff queue: every analysed creative, tagged with what the gate said.
 *
 * APPROVE, REVISE and REJECT land in the same list on purpose. The gate's
 * verdict is a recommendation; a person decides what goes to Meta, and they
 * should see everything the review produced in one place, not hunt for the
 * rejections somewhere else. Sending is a separate action with its own rules.
 */
@Injectable()
export class CreativeHandoffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CreativeAccessService,
    private readonly mediaAssets: MediaAssetsService,
  ) {}

  async list(actor: CreativeActor, query: HandoffQueryDto = {}): Promise<HandoffResponse> {
    const context = await this.access.resolve(actor);
    this.access.require(context, CREATIVE_AGENT_PERMISSIONS.REVIEW, CREATIVE_AGENT_PERMISSIONS.PERFORMANCE_MANAGE, CREATIVE_AGENT_PERMISSIONS.READ_ALL);

    const page = Math.max(query.page ?? 1, 1);
    const pageSize = Math.min(Math.max(query.pageSize ?? 25, 1), 100);
    const search = query.query?.trim();

    const where: Prisma.CreativeWhereInput = {
      tenantId: context.tenantId,
      // "Analysed" means at least one finished analysis or a finished gate review.
      OR: [
        { aiRuns: { some: { status: 'COMPLETED' } } },
        { enrollmentReviews: { some: { status: 'COMPLETED' } } },
      ],
      ...(query.storeId ? { storeConfigId: query.storeId } : {}),
      ...(search
        ? {
            AND: [{
              OR: [
                { code: { contains: search, mode: 'insensitive' } },
                { title: { contains: search, mode: 'insensitive' } },
                { posProductName: { contains: search, mode: 'insensitive' } },
              ],
            }],
          }
        : {}),
    };

    const creatives = await this.prisma.creative.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true, code: true, title: true, kind: true, angle: true, hookType: true, mediaUrl: true, driveUrl: true,
        thumbnailIsVideo: true, thumbnailAsset: { select: { objectKey: true } },
        storeConfig: { select: { id: true, storeNameSnapshot: true } },
        posCustomId: true, posProductName: true,
        createdBy: { select: { firstName: true, lastName: true, email: true } },
        revisionState: true, performanceStatus: true,
        sourceAssetId: true, mediaCapturedAt: true, mediaExpiresAt: true, mediaReleasedAt: true,
        enrollmentReviews: {
          where: { status: 'COMPLETED' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, decision: true, outcome: true, confidence: true, shadow: true, completedAt: true, decisionNotes: true },
        },
        aiRuns: { where: { status: 'COMPLETED' }, orderBy: { completedAt: 'desc' }, take: 1, select: { id: true, completedAt: true } },
        _count: { select: { enrollmentReviews: { where: { status: { in: ['QUEUED', 'RUNNING'] } } } } },
        metaDrafts: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            status: true, metaAdId: true, completedAt: true, errorMessage: true,
            batch: { select: { id: true, campaignName: true, metaCampaignId: true, metaAdAccountId: true } },
          },
        },
      },
    });

    const rows: HandoffRow[] = [];
    for (const creative of creatives) {
      const review = creative.enrollmentReviews[0] ?? null;
      const tag: HandoffTag = review?.decision ?? 'UNREVIEWED';
      const draft = creative.metaDrafts[0] ?? null;
      const sent = Boolean(draft && draft.status !== CreativeMetaDraftStatus.FAILED);
      if (query.tag && tag !== query.tag) continue;
      if ((query.sent ?? 'PENDING') === 'PENDING' && sent) continue;
      if (query.sent === 'SENT' && !sent) continue;

      const sendable = Boolean(review) && (
        (review!.decision === CreativeEnrollmentDecision.APPROVE && review!.outcome !== CreativeEnrollmentReviewOutcome.OVERRIDDEN)
        || (review!.decision !== CreativeEnrollmentDecision.APPROVE && review!.outcome === CreativeEnrollmentReviewOutcome.OVERRIDDEN)
      ) && creative.revisionState !== 'NEEDS_REVISION' && creative.performanceStatus !== 'RETIRED';

      rows.push({
        id: creative.id,
        code: creative.code,
        title: creative.title,
        kind: creative.kind,
        thumbnailUrl: await this.mediaAssets.createSignedAssetUrl(creative.thumbnailAsset),
        thumbnailIsVideo: creative.thumbnailIsVideo,
        mediaUrl: creative.mediaUrl,
        driveUrl: creative.driveUrl,
        angle: creative.angle,
        hookType: creative.hookType,
        store: { id: creative.storeConfig.id, name: creative.storeConfig.storeNameSnapshot },
        product: { customId: creative.posCustomId, name: creative.posProductName },
        creator: `${creative.createdBy.firstName ?? ''} ${creative.createdBy.lastName ?? ''}`.trim() || creative.createdBy.email,
        revisionState: creative.revisionState,
        performanceStatus: creative.performanceStatus,
        tag,
        gate: review
          ? {
              reviewId: review.id,
              decision: review.decision,
              outcome: review.outcome,
              confidence: review.confidence,
              shadow: review.shadow,
              completedAt: review.completedAt?.toISOString() ?? null,
              decisionNotes: review.decisionNotes,
            }
          : null,
        analysis: creative.aiRuns[0] ? { runId: creative.aiRuns[0].id, completedAt: creative.aiRuns[0].completedAt?.toISOString() ?? null } : null,
        gateInProgress: creative._count.enrollmentReviews > 0,
        media: {
          held: Boolean(creative.sourceAssetId),
          capturedAt: creative.mediaCapturedAt?.toISOString() ?? null,
          expiresAt: creative.mediaExpiresAt?.toISOString() ?? null,
          releasedAt: creative.mediaReleasedAt?.toISOString() ?? null,
        },
        draft: draft
          ? {
              batchId: draft.batch.id,
              status: draft.status,
              campaignName: draft.batch.campaignName,
              metaAdId: draft.metaAdId,
              metaCampaignId: draft.batch.metaCampaignId,
              adAccountId: draft.batch.metaAdAccountId,
              completedAt: draft.completedAt?.toISOString() ?? null,
              errorMessage: draft.errorMessage,
            }
          : null,
        sendable,
      });
    }

    // Tag counts describe the unfiltered-by-tag queue for the chosen store and sent state.
    const counts: Record<HandoffTag, number> = { APPROVE: 0, REVISE: 0, REJECT: 0, UNREVIEWED: 0 };
    for (const creative of creatives) {
      const draft = creative.metaDrafts[0] ?? null;
      const sent = Boolean(draft && draft.status !== CreativeMetaDraftStatus.FAILED);
      if ((query.sent ?? 'PENDING') === 'PENDING' && sent) continue;
      if (query.sent === 'SENT' && !sent) continue;
      counts[(creative.enrollmentReviews[0]?.decision ?? 'UNREVIEWED') as HandoffTag] += 1;
    }

    const stores = await this.prisma.creativeStoreConfig.findMany({
      where: { tenantId: context.tenantId, active: true },
      select: { id: true, storeNameSnapshot: true },
      orderBy: { storeNameSnapshot: 'asc' },
    });

    const start = (page - 1) * pageSize;
    return {
      items: rows.slice(start, start + pageSize),
      total: rows.length,
      page,
      pageSize,
      counts,
      filters: { stores: stores.map((store) => ({ value: store.id, label: store.storeNameSnapshot })) },
      permissions: {
        canSend: this.access.has(context, CREATIVE_AGENT_PERMISSIONS.PERFORMANCE_MANAGE),
        canOverride: this.access.has(context, CREATIVE_AGENT_PERMISSIONS.REVIEW),
        canRunGate: this.access.has(context, CREATIVE_AGENT_PERMISSIONS.AI_USE),
      },
    };
  }
}
