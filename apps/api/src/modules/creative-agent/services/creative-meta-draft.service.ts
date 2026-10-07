import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { CreativeEnrollmentDecision, CreativeEnrollmentReviewOutcome, CreativeMetaDraftStatus, Prisma } from '@prisma/client';
import { Queue } from 'bull';
import sharp = require('sharp');
import { PrismaService } from '../../../common/prisma/prisma.service';
import { MediaAssetsService } from '../../../common/services/media-assets.service';
import { ObjectStorageService } from '../../../common/services/object-storage.service';
import { buildAdNameCreatorLabels } from '../../../common/utils/ad-name-creator';
import {
  CREATIVE_AGENT_PERMISSIONS,
  CREATIVE_META_DRAFT_BUILD_JOB,
  CREATIVE_META_DRAFT_QUEUE,
  CREATIVE_META_DRAFT_RELEASE_JOB,
  CREATIVE_META_DRAFT_UPLOAD_JOB,
  type CreativeMetaDraftBuildJobData,
  type CreativeMetaDraftReleaseJobData,
  type CreativeMetaDraftUploadJobData,
} from '../creative-agent.constants';
import { ListDraftBatchesQueryDto, PreflightMetaDraftDto, SendMetaDraftDto } from '../dto/creative-meta-draft.dto';
import type { CreativeActor } from '../types/creative-actor.type';
import {
  adsManagerUrl,
  buildAdName,
  buildAdSetName,
  buildCampaignName,
  buildUrlTags,
  duplicateAngleWarnings,
  learningBudget,
  localDateParts,
  nextMidnight,
  SOP_FIXED_SETTINGS,
  suggestAdCount,
  toMinorUnits,
  type AdCountSuggestion,
} from '../utils/creative-meta-draft-plan';
import { CreativeAccessService } from './creative-access.service';
import { CreativeMetaCredentialsService } from './creative-meta-credentials.service';
import { CreativeSourceMediaService } from './creative-source-media.service';
import { CreativeStorePublishingService } from './creative-store-publishing.service';
import {
  createAd,
  createAdCreative,
  createAdSet,
  createCampaign,
  MetaGraphError,
  uploadImageBytes,
  uploadVideoFromUrl,
  waitForVideoReady,
} from './meta-draft-client';

type Suggestion = AdCountSuggestion;

export type PreflightCreative = {
  id: string;
  code: string;
  title: string;
  kind: 'VIDEO' | 'STATIC';
  adName: string;
  primaryText: string;
  headline: string | null;
  gate: { decision: CreativeEnrollmentDecision | null; outcome: CreativeEnrollmentReviewOutcome; reviewId: string } | null;
  media: { held: boolean; expiresAt: string | null; reusable: boolean };
  blockers: string[];
};

export type PreflightResult = {
  ok: boolean;
  blockers: string[];
  warnings: string[];
  suggestion: Suggestion;
  campaignName: string;
  adSetName: string;
  dailyBudget: number;
  currency: string | null;
  learningBudget: number | null;
  startTime: string;
  timezone: string;
  profile: {
    adAccountId: string;
    pageName: string | null;
    instagramUsername: string | null;
    pixelId: string;
    landingPageUrl: string;
  } | null;
  missingProfile: string[];
  creatives: PreflightCreative[];
};

const ACTIVE_DRAFT = [CreativeMetaDraftStatus.QUEUED, CreativeMetaDraftStatus.RUNNING] as const;
const UPLOAD_ATTEMPTS = 5;
const BUILD_ATTEMPTS = 5;
const RETRY_BACKOFF_MS = 30_000;
const UPLOAD_TIMEOUT_MS = 25 * 60_000;
const BUILD_TIMEOUT_MS = 10 * 60_000;

/**
 * From "Send to Meta" to a paused campaign.
 *
 * The person picks one to three creatives from the handoff queue; this service
 * checks what the SOP and the gate require, records a batch, and hands the
 * work to the draft queue. The worker side is three idempotent steps: upload
 * each creative's media, build the campaign, release the held file. Every Meta
 * id is written the moment it exists, so a retry resumes rather than repeats.
 *
 * Nothing here publishes. The last thing the ERP does is a paused ad.
 */
@Injectable()
export class CreativeMetaDraftService {
  private readonly logger = new Logger(CreativeMetaDraftService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CreativeAccessService,
    private readonly publishing: CreativeStorePublishingService,
    private readonly credentials: CreativeMetaCredentialsService,
    private readonly sourceMedia: CreativeSourceMediaService,
    private readonly mediaAssets: MediaAssetsService,
    private readonly objectStorage: ObjectStorageService,
    @InjectQueue(CREATIVE_META_DRAFT_QUEUE) private readonly queue: Queue,
  ) {}

  // ---------------------------------------------------------------------------
  // Request side
  // ---------------------------------------------------------------------------

  /** Everything the send dialog shows before anyone commits: names, budget, warnings, refusals. */
  async preflight(actor: CreativeActor, dto: PreflightMetaDraftDto): Promise<PreflightResult> {
    const context = await this.access.resolve(actor);
    this.access.require(context, CREATIVE_AGENT_PERMISSIONS.REVIEW, CREATIVE_AGENT_PERMISSIONS.PERFORMANCE_MANAGE);
    return this.plan(context.tenantId, dto);
  }

  async send(actor: CreativeActor, dto: SendMetaDraftDto) {
    const context = await this.access.resolve(actor);
    this.access.require(context, CREATIVE_AGENT_PERMISSIONS.PERFORMANCE_MANAGE);

    const plan = await this.plan(context.tenantId, dto);
    if (!plan.ok || !plan.profile) {
      throw new BadRequestException(plan.blockers.join(' '));
    }

    const store = await this.prisma.creativeStoreConfig.findFirst({
      where: { id: dto.storeConfigId, tenantId: context.tenantId },
      select: { id: true },
    });
    if (!store) throw new NotFoundException('Store not found');

    // plan() already validated the launch profile; read it once more here so
    // the batch row carries every value the worker will send, frozen.
    const launch = await this.publishing.resolveLaunch(context.tenantId, store.id, await this.productOf(context.tenantId, dto.creativeIds[0]));
    if (!launch.profile) throw new BadRequestException(`Set the ${launch.missing.join(', ')} in the store's Meta publishing profile first.`);

    const batch = await this.prisma.$transaction(async (tx) => {
      const created = await tx.creativeMetaDraftBatch.create({
        data: {
          tenantId: context.tenantId,
          storeConfigId: store.id,
          status: CreativeMetaDraftStatus.QUEUED,
          metaAdAccountId: plan.profile!.adAccountId,
          currency: plan.currency,
          campaignName: plan.campaignName,
          adSetName: plan.adSetName,
          dailyBudget: plan.dailyBudget,
          startTime: new Date(plan.startTime),
          pixelId: launch.profile!.pixelId,
          landingPageUrl: launch.profile!.landingPageUrl,
          displayLink: launch.profile!.displayLink,
          facebookPageId: launch.profile!.pageId,
          instagramAccountId: launch.profile!.instagramAccountId,
          countries: launch.profile!.countries,
          settingsSnapshot: { ...SOP_FIXED_SETTINGS, suggestion: plan.suggestion, warnings: plan.warnings } as unknown as Prisma.InputJsonValue,
          requestedById: context.userId,
          drafts: {
            create: plan.creatives.map((creative) => ({
              tenantId: context.tenantId,
              creativeId: creative.id,
              adName: creative.adName,
              primaryText: creative.primaryText,
              headline: creative.headline,
            })),
          },
        },
        include: { drafts: true },
      });

      // Sending is the person's acceptance of an APPROVE the gate returned.
      // Recording it here is what calibrates the gate later.
      for (const creative of plan.creatives) {
        if (creative.gate?.decision === CreativeEnrollmentDecision.APPROVE && creative.gate.outcome === CreativeEnrollmentReviewOutcome.PENDING) {
          await tx.creativeEnrollmentReview.update({
            where: { id: creative.gate.reviewId },
            data: {
              outcome: CreativeEnrollmentReviewOutcome.ACCEPTED,
              decidedById: context.userId,
              decidedAt: new Date(),
              decisionNotes: 'Accepted by sending the creative to Meta from the handoff queue.',
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          tenantId: context.tenantId,
          userId: context.userId,
          action: 'creative.meta.draft.send',
          resource: 'CreativeMetaDraftBatch',
          resourceId: created.id,
          changes: {
            creativeIds: dto.creativeIds,
            campaignName: plan.campaignName,
            dailyBudget: plan.dailyBudget,
            adAccountId: plan.profile!.adAccountId,
          } as Prisma.InputJsonValue,
        },
      });
      return created;
    });

    for (const draft of batch.drafts) {
      await this.enqueueUpload(context.tenantId, draft.id);
    }
    this.logger.log(`Draft batch ${batch.id} queued: ${batch.drafts.length} ad(s) for campaign "${batch.campaignName}"`);
    return this.getBatch(actor, batch.id);
  }

  async listBatches(actor: CreativeActor, query: ListDraftBatchesQueryDto = {}) {
    const context = await this.access.resolve(actor);
    this.access.require(context, CREATIVE_AGENT_PERMISSIONS.REVIEW, CREATIVE_AGENT_PERMISSIONS.PERFORMANCE_MANAGE, CREATIVE_AGENT_PERMISSIONS.READ_ALL);
    const rows = await this.prisma.creativeMetaDraftBatch.findMany({
      where: {
        tenantId: context.tenantId,
        ...(query.storeId ? { storeConfigId: query.storeId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(query.take ?? 20, 1), 100),
      include: this.batchInclude(),
    });
    return rows.map((row) => this.presentBatch(row));
  }

  async getBatch(actor: CreativeActor, batchId: string) {
    const context = await this.access.resolve(actor);
    this.access.require(context, CREATIVE_AGENT_PERMISSIONS.REVIEW, CREATIVE_AGENT_PERMISSIONS.PERFORMANCE_MANAGE, CREATIVE_AGENT_PERMISSIONS.READ_ALL);
    const row = await this.prisma.creativeMetaDraftBatch.findFirst({
      where: { id: batchId, tenantId: context.tenantId },
      include: this.batchInclude(),
    });
    if (!row) throw new NotFoundException('Draft batch not found');
    return this.presentBatch(row);
  }

  /** Requeue a failed batch. Meta ids already recorded are kept, so only the missing steps run. */
  async retry(actor: CreativeActor, batchId: string) {
    const context = await this.access.resolve(actor);
    this.access.require(context, CREATIVE_AGENT_PERMISSIONS.PERFORMANCE_MANAGE);
    const batch = await this.prisma.creativeMetaDraftBatch.findFirst({
      where: { id: batchId, tenantId: context.tenantId },
      include: { drafts: { include: { creative: { select: { kind: true } } } } },
    });
    if (!batch) throw new NotFoundException('Draft batch not found');
    if (batch.status !== CreativeMetaDraftStatus.FAILED) {
      throw new BadRequestException('Only a failed batch can be retried.');
    }

    await this.prisma.$transaction([
      this.prisma.creativeMetaDraftBatch.update({
        where: { id: batch.id },
        data: { status: CreativeMetaDraftStatus.QUEUED, errorMessage: null, attempts: { increment: 1 }, completedAt: null },
      }),
      this.prisma.creativeMetaDraft.updateMany({
        where: { batchId: batch.id, status: CreativeMetaDraftStatus.FAILED },
        data: { status: CreativeMetaDraftStatus.QUEUED, errorMessage: null },
      }),
    ]);

    const pending = batch.drafts.filter((draft) => draft.status !== CreativeMetaDraftStatus.COMPLETED && !this.hasMedia(draft, draft.creative.kind));
    if (pending.length) {
      for (const draft of pending) await this.enqueueUpload(context.tenantId, draft.id);
    } else {
      await this.enqueueBuild(context.tenantId, batch.id, batch.attempts + 1);
    }
    return this.getBatch(actor, batch.id);
  }

  // ---------------------------------------------------------------------------
  // Worker side
  // ---------------------------------------------------------------------------

  /** Step 1 of 3: this creative's media into Meta, recorded by id. */
  async processUpload(tenantId: string, draftId: string, options: { finalAttempt: boolean }) {
    const draft = await this.prisma.creativeMetaDraft.findFirst({
      where: { id: draftId, tenantId },
      include: {
        batch: true,
        creative: {
          select: {
            id: true, code: true, kind: true, sourceAssetId: true,
            thumbnailAsset: { select: { objectKey: true } },
          },
        },
      },
    });
    if (!draft) throw new Error('Draft was not found in its tenant');
    if (draft.status === CreativeMetaDraftStatus.COMPLETED) return;
    if (draft.batch.status === CreativeMetaDraftStatus.COMPLETED) return;

    if (this.hasMedia(draft, draft.creative.kind)) {
      await this.maybeEnqueueBuild(tenantId, draft.batchId);
      return;
    }

    await this.prisma.$transaction([
      this.prisma.creativeMetaDraft.update({ where: { id: draft.id }, data: { status: CreativeMetaDraftStatus.RUNNING, attempts: { increment: 1 }, errorMessage: null } }),
      this.prisma.creativeMetaDraftBatch.updateMany({
        where: { id: draft.batchId, status: CreativeMetaDraftStatus.QUEUED },
        data: { status: CreativeMetaDraftStatus.RUNNING, startedAt: new Date() },
      }),
    ]);

    try {
      const { token } = await this.credentials.accessTokenFor(tenantId, draft.batch.metaAdAccountId);

      // Media already in this ad account from an earlier batch is reused; Meta
      // keeps it, and re-uploading a video it already holds is pure cost.
      const reusable = await this.prisma.creativeMetaDraft.findFirst({
        where: {
          tenantId, creativeId: draft.creativeId, id: { not: draft.id },
          batch: { metaAdAccountId: draft.batch.metaAdAccountId },
          OR: [{ metaVideoId: { not: null } }, { metaImageHash: { not: null } }],
        },
        orderBy: { createdAt: 'desc' },
        select: { metaVideoId: true, metaImageHash: true, metaThumbnailHash: true },
      });

      let media: { metaVideoId?: string; metaImageHash?: string; metaThumbnailHash?: string } = {};
      if (reusable && this.hasMedia(reusable, draft.creative.kind)) {
        media = { metaVideoId: reusable.metaVideoId ?? undefined, metaImageHash: reusable.metaImageHash ?? undefined, metaThumbnailHash: reusable.metaThumbnailHash ?? undefined };
        this.logger.log(`Draft ${draft.id} reuses media already in account ${draft.batch.metaAdAccountId} for ${draft.creative.code}`);
      } else if (draft.creative.kind === 'VIDEO') {
        const signed = await this.sourceMedia.signedSourceUrl(tenantId, draft.creativeId, 3600);
        if (!signed) throw new BadRequestException(`The file for ${draft.creative.code} is no longer held. Re-run its analysis to capture it, then send again.`);
        const videoId = await uploadVideoFromUrl(token, draft.batch.metaAdAccountId, { fileUrl: signed.url, name: draft.adName });
        await this.prisma.creativeMetaDraft.update({ where: { id: draft.id }, data: { metaVideoId: videoId } });
        await waitForVideoReady(token, videoId, { timeoutMs: UPLOAD_TIMEOUT_MS - 5 * 60_000 });
        const thumbnail = await this.thumbnailJpeg(tenantId, draft.creativeId, draft.creative.thumbnailAsset?.objectKey ?? null);
        if (!thumbnail) throw new BadRequestException(`${draft.creative.code} has no cover image for the video ad. Upload a thumbnail on the creative, then retry.`);
        const thumbnailHash = await uploadImageBytes(token, draft.batch.metaAdAccountId, { bytes: thumbnail, name: `${draft.creative.code}-cover.jpg` });
        media = { metaVideoId: videoId, metaThumbnailHash: thumbnailHash };
      } else {
        const source = await this.sourceMedia.downloadSource(tenantId, draft.creativeId);
        if (!source) throw new BadRequestException(`The file for ${draft.creative.code} is no longer held. Re-run its analysis to capture it, then send again.`);
        const bytes = await this.toUploadableImage(source.buffer);
        const imageHash = await uploadImageBytes(token, draft.batch.metaAdAccountId, { bytes, name: `${draft.creative.code}.jpg` });
        media = { metaImageHash: imageHash };
      }

      await this.prisma.creativeMetaDraft.update({
        where: { id: draft.id },
        data: { ...media, mediaUploadedAt: new Date(), status: CreativeMetaDraftStatus.QUEUED, errorMessage: null },
      });
      await this.maybeEnqueueBuild(tenantId, draft.batchId);
    } catch (error) {
      await this.recordFailure({ tenantId, batchId: draft.batchId, draftId: draft.id, error, finalAttempt: options.finalAttempt });
    }
  }

  /** Step 2 of 3: campaign, ad set, then one ad per creative, all paused. */
  async processBuild(tenantId: string, batchId: string, options: { finalAttempt: boolean }) {
    const batch = await this.prisma.creativeMetaDraftBatch.findFirst({
      where: { id: batchId, tenantId },
      include: { drafts: { include: { creative: { select: { id: true, code: true, kind: true } } }, orderBy: { createdAt: 'asc' } } },
    });
    if (!batch) throw new Error('Draft batch was not found in its tenant');
    if (batch.status === CreativeMetaDraftStatus.COMPLETED) return;

    const notReady = batch.drafts.filter((draft) => !this.hasMedia(draft, draft.creative.kind));
    if (notReady.length) {
      // An upload retry is still on its way; it will requeue the build when it lands.
      this.logger.log(`Build for batch ${batch.id} deferred: ${notReady.length} upload(s) pending`);
      return;
    }

    await this.prisma.creativeMetaDraftBatch.update({
      where: { id: batch.id },
      data: { status: CreativeMetaDraftStatus.RUNNING, startedAt: batch.startedAt ?? new Date(), errorMessage: null },
    });

    let currentDraftId: string | null = null;
    try {
      const { token } = await this.credentials.accessTokenFor(tenantId, batch.metaAdAccountId);
      const account = batch.metaAdAccountId;

      let campaignId = batch.metaCampaignId;
      if (!campaignId) {
        campaignId = await createCampaign(token, account, {
          name: batch.campaignName,
          dailyBudgetMinor: toMinorUnits(Number(batch.dailyBudget), batch.currency),
        });
        await this.prisma.creativeMetaDraftBatch.update({ where: { id: batch.id }, data: { metaCampaignId: campaignId } });
      }

      let adSetId = batch.metaAdSetId;
      if (!adSetId) {
        adSetId = await createAdSet(token, account, {
          name: batch.adSetName,
          campaignId,
          pixelId: batch.pixelId,
          countries: batch.countries.length ? batch.countries : ['PH'],
          startTime: batch.startTime,
        });
        await this.prisma.creativeMetaDraftBatch.update({ where: { id: batch.id }, data: { metaAdSetId: adSetId } });
      }

      const urlTags = buildUrlTags();
      for (const draft of batch.drafts) {
        if (draft.status === CreativeMetaDraftStatus.COMPLETED && draft.metaAdId) continue;
        currentDraftId = draft.id;
        await this.prisma.creativeMetaDraft.update({ where: { id: draft.id }, data: { status: CreativeMetaDraftStatus.RUNNING, errorMessage: null } });

        let creativeId = draft.metaCreativeId;
        if (!creativeId) {
          creativeId = await createAdCreative(token, account, {
            name: draft.adName,
            pageId: batch.facebookPageId,
            instagramUserId: batch.instagramAccountId,
            link: batch.landingPageUrl,
            displayLink: batch.displayLink,
            message: draft.primaryText || draft.adName,
            headline: draft.headline,
            urlTags,
            media: draft.creative.kind === 'VIDEO'
              ? { kind: 'VIDEO', videoId: draft.metaVideoId!, thumbnailHash: draft.metaThumbnailHash! }
              : { kind: 'IMAGE', imageHash: draft.metaImageHash! },
          });
          await this.prisma.creativeMetaDraft.update({ where: { id: draft.id }, data: { metaCreativeId: creativeId } });
        }

        let adId = draft.metaAdId;
        if (!adId) {
          adId = await createAd(token, account, { name: draft.adName, adSetId, creativeId });
        }
        await this.prisma.creativeMetaDraft.update({
          where: { id: draft.id },
          data: { metaAdId: adId, status: CreativeMetaDraftStatus.COMPLETED, completedAt: new Date(), errorMessage: null },
        });
      }
      currentDraftId = null;

      await this.prisma.creativeMetaDraftBatch.update({
        where: { id: batch.id },
        data: { status: CreativeMetaDraftStatus.COMPLETED, completedAt: new Date(), errorMessage: null },
      });
      this.logger.log(`Batch ${batch.id} drafted in Meta: campaign ${campaignId}, ${batch.drafts.length} paused ad(s)`);

      // Step 3 runs as its own job so a storage hiccup never fails a finished draft.
      for (const draft of batch.drafts) {
        await this.queue.add(CREATIVE_META_DRAFT_RELEASE_JOB, { tenantId, creativeId: draft.creativeId } satisfies CreativeMetaDraftReleaseJobData, {
          attempts: 3,
          backoff: { type: 'exponential', delay: RETRY_BACKOFF_MS },
          removeOnComplete: 200,
          removeOnFail: 500,
        });
      }
    } catch (error) {
      await this.recordFailure({ tenantId, batchId: batch.id, draftId: currentDraftId, error, finalAttempt: options.finalAttempt });
    }
  }

  /** Step 3 of 3: Meta has its copy, so ours goes. */
  async processRelease(tenantId: string, creativeId: string) {
    const active = await this.prisma.creativeMetaDraft.count({
      where: { tenantId, creativeId, status: { in: [...ACTIVE_DRAFT] } },
    });
    if (active > 0) {
      this.logger.log(`Release for creative ${creativeId} skipped: another draft is still sending it`);
      return;
    }
    await this.sourceMedia.release(tenantId, creativeId, 'HANDED_TO_META');
  }

  // ---------------------------------------------------------------------------
  // Planning
  // ---------------------------------------------------------------------------

  private async plan(tenantId: string, dto: PreflightMetaDraftDto): Promise<PreflightResult> {
    const blockers: string[] = [];
    const warnings: string[] = [];

    const store = await this.prisma.creativeStoreConfig.findFirst({
      where: { id: dto.storeConfigId, tenantId },
      select: { id: true, codePrefix: true, storeNameSnapshot: true, target: { select: { cpp: true } } },
    });
    if (!store) throw new NotFoundException('Store not found');

    const uniqueIds = Array.from(new Set(dto.creativeIds));
    const creatives = await this.prisma.creative.findMany({
      where: { id: { in: uniqueIds }, tenantId },
      select: {
        id: true, code: true, title: true, kind: true, angle: true, hookType: true, remixOfCode: true,
        storeConfigId: true, posCustomId: true, posProductName: true, revisionState: true, performanceStatus: true,
        sourceAssetId: true, mediaExpiresAt: true, mediaReleasedAt: true,
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    if (creatives.length !== uniqueIds.length) throw new NotFoundException('One or more creatives were not found in this tenant');
    // Keep the order the person chose.
    creatives.sort((a, b) => uniqueIds.indexOf(a.id) - uniqueIds.indexOf(b.id));

    if (creatives.length > SOP_FIXED_SETTINGS.maxAdsPerCampaign) {
      blockers.push(`A campaign holds at most ${SOP_FIXED_SETTINGS.maxAdsPerCampaign} ads. Split the rest into another batch.`);
    }
    if (creatives.some((creative) => creative.storeConfigId !== store.id)) {
      blockers.push('Every creative in a batch must belong to the same store.');
    }
    const products = new Set(creatives.map((creative) => creative.posCustomId ?? ''));
    if (products.size > 1) {
      blockers.push('One campaign is one product: it optimises on one pixel and sends to one landing page. Pick creatives for a single product.');
    }
    const posCustomId = creatives[0]?.posCustomId ?? null;

    const launch = await this.publishing.resolveLaunch(tenantId, store.id, posCustomId);
    if (launch.missing.length) {
      blockers.push(`Set the ${launch.missing.join(', ')} in the store's Meta publishing profile first.`);
    }

    const creatorLabels = buildAdNameCreatorLabels(
      await this.prisma.user.findMany({ where: { tenantId, status: 'ACTIVE' }, select: { id: true, firstName: true, lastName: true, email: true } }),
    );
    const reviews = await this.latestReviews(tenantId, creatives.map((creative) => creative.id));
    const activeDrafts = await this.prisma.creativeMetaDraft.findMany({
      where: { tenantId, creativeId: { in: creatives.map((creative) => creative.id) }, status: { in: [...ACTIVE_DRAFT] } },
      select: { creativeId: true },
    });
    const reusable = launch.profile
      ? await this.prisma.creativeMetaDraft.findMany({
          where: {
            tenantId, creativeId: { in: creatives.map((creative) => creative.id) },
            batch: { metaAdAccountId: launch.profile.adAccountId },
            OR: [{ metaVideoId: { not: null } }, { metaImageHash: { not: null } }],
          },
          select: { creativeId: true },
        })
      : [];
    const copyByCreative = new Map((dto.copy ?? []).map((entry) => [entry.creativeId, entry]));

    const planned: PreflightCreative[] = creatives.map((creative) => {
      const review = reviews.get(creative.id) ?? null;
      const own: string[] = [];
      if (!review) own.push('has not been through the enrollment gate. Run the gate first so the send is on record.');
      else if (review.decision === CreativeEnrollmentDecision.APPROVE && review.outcome === CreativeEnrollmentReviewOutcome.OVERRIDDEN) {
        own.push('was approved by the gate, but a person overrode that, so it will not be sent.');
      } else if (review.decision !== CreativeEnrollmentDecision.APPROVE && review.outcome !== CreativeEnrollmentReviewOutcome.OVERRIDDEN) {
        own.push(`came back ${review.decision ?? 'undecided'} from the gate. Override that with a note first if you disagree.`);
      }
      if (creative.revisionState === 'NEEDS_REVISION') own.push('has an open revision request.');
      if (creative.performanceStatus === 'RETIRED') own.push('is retired.');
      if (!creative.posCustomId) own.push('has no product registered, and the pixel and landing page are per product.');
      if (activeDrafts.some((row) => row.creativeId === creative.id)) own.push('is already being sent in another batch.');
      const held = Boolean(creative.sourceAssetId);
      const canReuse = reusable.some((row) => row.creativeId === creative.id);
      if (!held && !canReuse) own.push('is no longer held in storage. Re-run its analysis to capture the file, then send.');

      const copy = copyByCreative.get(creative.id);
      return {
        id: creative.id,
        code: creative.code,
        title: creative.title,
        kind: creative.kind,
        adName: buildAdName({
          code: creative.code,
          title: creative.title,
          creator: creatorLabels.get(creative.createdBy.id) ?? null,
          customId: creative.posCustomId,
        }),
        primaryText: copy?.primaryText?.trim() || creative.title,
        headline: copy?.headline?.trim() || null,
        gate: review ? { decision: review.decision, outcome: review.outcome, reviewId: review.id } : null,
        media: { held, expiresAt: creative.mediaExpiresAt?.toISOString() ?? null, reusable: canReuse },
        blockers: own.map((text) => `${creative.code} ${text}`),
      };
    });
    for (const creative of planned) blockers.push(...creative.blockers);

    // Suggestion and testing-rule warnings.
    const [storeEntryCount, productEntryCount, winnerMatches] = await Promise.all([
      this.prisma.creativeKnowledgeEntry.count({ where: { tenantId, storeConfigId: store.id, active: true } }),
      posCustomId
        ? this.prisma.creativeKnowledgeEntry.count({ where: { tenantId, storeConfigId: store.id, active: true, creative: { posCustomId } } })
        : Promise.resolve(0),
      this.prisma.creativeKnowledgeEntry.count({
        where: {
          tenantId, storeConfigId: store.id, active: true, label: 'WINNER',
          OR: [
            { creativeId: { in: creatives.map((creative) => creative.id) } },
            { creative: { code: { in: creatives.map((creative) => creative.remixOfCode).filter((code): code is string => Boolean(code)) } } },
          ],
        },
      }),
    ]);
    const suggestion = suggestAdCount({ hasProvenWinner: winnerMatches > 0, productEntryCount, storeEntryCount });
    if (creatives.length > suggestion.suggested) {
      warnings.push(`The SOP suggests ${suggestion.suggested} ad${suggestion.suggested === 1 ? '' : 's'} here: ${suggestion.reason}`);
    }
    warnings.push(...duplicateAngleWarnings(creatives));

    // Names, budget, start.
    const timezone = launch.profile?.timezone ?? 'Asia/Manila';
    const startTime = dto.startDate ? this.midnightOn(dto.startDate, timezone) : nextMidnight(timezone);
    if (startTime.getTime() < Date.now()) blockers.push('The start date is in the past. Pick tomorrow or later.');
    const dailyBudget = dto.dailyBudget ?? launch.profile?.dailyBudget ?? 1000;
    const campaignName = dto.campaignName?.trim() || buildCampaignName({
      codePrefix: store.codePrefix,
      product: creatives[0]?.posProductName ?? creatives[0]?.posCustomId ?? null,
      launchDate: startTime,
      timezone,
    });
    const adSetName = buildAdSetName(campaignName, launch.profile?.countries ?? ['PH']);
    const targetCpp = store.target?.cpp ? Number(store.target.cpp) : null;
    const learning = learningBudget(targetCpp);
    if (learning && dailyBudget < learning) {
      warnings.push(`At ${this.peso(dailyBudget)} a day the ad set is unlikely to leave learning; about ${this.peso(learning)} a day reaches 50 purchases in a week at the store's target CPP.`);
    }

    return {
      ok: blockers.length === 0,
      blockers,
      warnings,
      suggestion,
      campaignName,
      adSetName,
      dailyBudget,
      currency: launch.profile?.currency ?? null,
      learningBudget: learning,
      startTime: startTime.toISOString(),
      timezone,
      profile: launch.profile
        ? {
            adAccountId: launch.profile.adAccountId,
            pageName: launch.profile.pageName,
            instagramUsername: launch.profile.instagramUsername,
            pixelId: launch.profile.pixelId,
            landingPageUrl: launch.profile.landingPageUrl,
          }
        : null,
      missingProfile: launch.missing,
      creatives: planned,
    };
  }

  private async latestReviews(tenantId: string, creativeIds: string[]) {
    const rows = await this.prisma.creativeEnrollmentReview.findMany({
      where: { tenantId, creativeId: { in: creativeIds }, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, creativeId: true, decision: true, outcome: true },
    });
    const latest = new Map<string, (typeof rows)[number]>();
    for (const row of rows) if (!latest.has(row.creativeId)) latest.set(row.creativeId, row);
    return latest;
  }

  private async productOf(tenantId: string, creativeId: string) {
    const creative = await this.prisma.creative.findFirst({ where: { id: creativeId, tenantId }, select: { posCustomId: true } });
    return creative?.posCustomId ?? null;
  }

  private midnightOn(date: string, timezone: string): Date {
    const [year, month, day] = date.split('-').map(Number);
    // Midnight local = previous day's "nextMidnight" evaluated at local noon.
    const noonUtcGuess = new Date(Date.UTC(year, month - 1, day - 1, 12, 0, 0));
    const local = localDateParts(noonUtcGuess, timezone);
    const offsetMs = Math.round((Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second) - noonUtcGuess.getTime()) / 60_000) * 60_000;
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - offsetMs);
  }

  // ---------------------------------------------------------------------------
  // Queue plumbing
  // ---------------------------------------------------------------------------

  private async enqueueUpload(tenantId: string, draftId: string) {
    await this.queue.add(CREATIVE_META_DRAFT_UPLOAD_JOB, { tenantId, draftId } satisfies CreativeMetaDraftUploadJobData, {
      attempts: UPLOAD_ATTEMPTS,
      backoff: { type: 'exponential', delay: RETRY_BACKOFF_MS },
      timeout: UPLOAD_TIMEOUT_MS,
      removeOnComplete: 200,
      removeOnFail: 500,
    });
  }

  private async enqueueBuild(tenantId: string, batchId: string, attempt: number) {
    // One build per batch per attempt: three uploads finishing together must
    // not queue three builds. Bull ignores an add whose jobId already exists.
    await this.queue.add(CREATIVE_META_DRAFT_BUILD_JOB, { tenantId, batchId } satisfies CreativeMetaDraftBuildJobData, {
      jobId: `build:${batchId}:${attempt}`,
      attempts: BUILD_ATTEMPTS,
      backoff: { type: 'exponential', delay: RETRY_BACKOFF_MS },
      timeout: BUILD_TIMEOUT_MS,
      removeOnComplete: 200,
      removeOnFail: 500,
    });
  }

  private async maybeEnqueueBuild(tenantId: string, batchId: string) {
    const batch = await this.prisma.creativeMetaDraftBatch.findFirst({
      where: { id: batchId, tenantId },
      select: { attempts: true, status: true, drafts: { select: { metaVideoId: true, metaImageHash: true, metaThumbnailHash: true, creative: { select: { kind: true } } } } },
    });
    if (!batch || batch.status === CreativeMetaDraftStatus.COMPLETED || batch.status === CreativeMetaDraftStatus.FAILED) return;
    if (batch.drafts.every((draft) => this.hasMedia(draft, draft.creative.kind))) {
      await this.enqueueBuild(tenantId, batchId, batch.attempts);
    }
  }

  private hasMedia(
    draft: { metaVideoId: string | null; metaImageHash: string | null; metaThumbnailHash: string | null },
    kind: 'VIDEO' | 'STATIC',
  ) {
    return kind === 'VIDEO' ? Boolean(draft.metaVideoId && draft.metaThumbnailHash) : Boolean(draft.metaImageHash);
  }

  /**
   * A failure that Meta says is our fault (bad pixel, wrong page) will not
   * pass on retry, so it is recorded and the job ends. Throttles and server
   * faults are rethrown for Bull to retry; only the last attempt closes the
   * batch as FAILED.
   */
  private async recordFailure(input: { tenantId: string; batchId: string; draftId: string | null; error: unknown; finalAttempt: boolean }) {
    const message = input.error instanceof Error ? input.error.message : String(input.error);
    const permanent = (input.error instanceof MetaGraphError && !input.error.retryable)
      || input.error instanceof BadRequestException
      || input.error instanceof ForbiddenException
      || input.error instanceof NotFoundException;
    const close = permanent || input.finalAttempt;

    if (input.draftId) {
      await this.prisma.creativeMetaDraft.update({
        where: { id: input.draftId },
        data: { errorMessage: message, ...(close ? { status: CreativeMetaDraftStatus.FAILED } : {}) },
      }).catch(() => undefined);
    }
    await this.prisma.creativeMetaDraftBatch.update({
      where: { id: input.batchId },
      data: { errorMessage: message, ...(close ? { status: CreativeMetaDraftStatus.FAILED, completedAt: new Date() } : {}) },
    }).catch(() => undefined);

    this.logger.warn(`Draft batch ${input.batchId}${input.draftId ? ` draft ${input.draftId}` : ''} ${close ? 'failed' : 'will retry'}: ${message}`);
    if (!permanent) throw input.error;
  }

  // ---------------------------------------------------------------------------
  // Media helpers
  // ---------------------------------------------------------------------------

  /** The creative's cover as JPEG: its uploaded thumbnail, else the first analysed scene. */
  private async thumbnailJpeg(tenantId: string, creativeId: string, thumbnailKey: string | null): Promise<Buffer | null> {
    let key = thumbnailKey;
    if (!key) {
      const frame = await this.prisma.creativeAiRunFrame.findFirst({
        where: { tenantId, run: { creativeId, status: 'COMPLETED' } },
        orderBy: [{ run: { completedAt: 'desc' } }, { sceneIndex: 'asc' }],
        select: { asset: { select: { objectKey: true } } },
      });
      key = frame?.asset.objectKey ?? null;
    }
    if (!key || !this.objectStorage.isConfigured()) return null;
    const buffer = await this.objectStorage.downloadObjectBuffer(key);
    return this.toUploadableImage(buffer);
  }

  /** Meta takes JPEG and PNG; our cached images are WebP, so everything is re-encoded once. */
  private async toUploadableImage(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer, { failOn: 'error', limitInputPixels: 80_000_000 })
      .rotate()
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();
  }

  // ---------------------------------------------------------------------------
  // Presentation
  // ---------------------------------------------------------------------------

  private batchInclude() {
    return {
      storeConfig: { select: { storeNameSnapshot: true } },
      requestedBy: { select: { firstName: true, lastName: true } },
      drafts: {
        orderBy: { createdAt: 'asc' as const },
        include: { creative: { select: { id: true, code: true, title: true, kind: true } } },
      },
    };
  }

  private presentBatch(row: Prisma.CreativeMetaDraftBatchGetPayload<{ include: ReturnType<CreativeMetaDraftService['batchInclude']> }>) {
    return {
      id: row.id,
      status: row.status,
      storeConfigId: row.storeConfigId,
      storeName: row.storeConfig.storeNameSnapshot,
      campaignName: row.campaignName,
      adSetName: row.adSetName,
      dailyBudget: Number(row.dailyBudget),
      currency: row.currency,
      startTime: row.startTime.toISOString(),
      metaAdAccountId: row.metaAdAccountId,
      metaCampaignId: row.metaCampaignId,
      metaAdSetId: row.metaAdSetId,
      adsManagerUrl: adsManagerUrl(row.metaAdAccountId, row.metaCampaignId),
      errorMessage: row.errorMessage,
      attempts: row.attempts,
      requestedBy: row.requestedBy ? `${row.requestedBy.firstName ?? ''} ${row.requestedBy.lastName ?? ''}`.trim() || null : null,
      createdAt: row.createdAt.toISOString(),
      startedAt: row.startedAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
      drafts: row.drafts.map((draft) => ({
        id: draft.id,
        status: draft.status,
        creativeId: draft.creative.id,
        code: draft.creative.code,
        title: draft.creative.title,
        kind: draft.creative.kind,
        adName: draft.adName,
        metaVideoId: draft.metaVideoId,
        metaImageHash: draft.metaImageHash,
        metaAdId: draft.metaAdId,
        errorMessage: draft.errorMessage,
        mediaUploadedAt: draft.mediaUploadedAt?.toISOString() ?? null,
        completedAt: draft.completedAt?.toISOString() ?? null,
      })),
    };
  }

  private peso(value: number) {
    return `₱${Math.round(value).toLocaleString('en-PH')}`;
  }
}
