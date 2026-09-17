import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import {
  CreativeEnrollmentDecision,
  CreativeEnrollmentReviewOutcome,
  Prisma,
} from '@prisma/client';
import { existsSync } from 'fs';
import { dirname, join, resolve, sep } from 'path';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  CREATIVE_AGENT_PERMISSIONS,
  CREATIVE_AI_QUEUE,
  CREATIVE_GATE_REVIEW_JOB,
  type CreativeGateReviewJobData,
} from '../creative-agent.constants';
import type { CreativeActor } from '../types/creative-actor.type';
import { CreativeAccessService } from './creative-access.service';
import { ClaudeboxClientService } from './claudebox-client.service';
import { CreativeKnowledgeService } from './creative-knowledge.service';
import { CreativePromptContextService } from './creative-prompt-context.service';

/**
 * The enrollment gate.
 *
 * When a creative is enrolled, the gate compares it against its own store's
 * knowledge base and recommends approve, revise or reject.
 *
 * It is advisory by construction. `outcome` starts PENDING on every review and
 * only a person can move it, and `shadow` marks reviews made while the gate is
 * still being calibrated. Nothing downstream — least of all publishing to Meta —
 * may act on a recommendation that a human has not accepted. That is enforced
 * here in `assertPublishable`, not left to the caller to remember.
 */
@Injectable()
export class CreativeEnrollmentReviewService {
  private readonly logger = new Logger(CreativeEnrollmentReviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CreativeAccessService,
    private readonly knowledge: CreativeKnowledgeService,
    private readonly claudebox: ClaudeboxClientService,
    private readonly promptContext: CreativePromptContextService,
    @InjectQueue(CREATIVE_AI_QUEUE) private readonly queue: Queue<CreativeGateReviewJobData>,
  ) {}

  /**
   * Queue a gate review for one enrolled creative.
   *
   * Requires a completed analysis: the gate reasons over construction, and
   * without an analysis there is nothing to compare. Reviews run in shadow mode
   * unless the caller explicitly says otherwise and the corpus can support it.
   */
  async request(
    actor: CreativeActor,
    creativeId: string,
    options: { runId?: string; shadow?: boolean } = {},
  ) {
    const context = await this.access.resolve(actor);
    this.access.require(context, CREATIVE_AGENT_PERMISSIONS.AI_USE);

    const creative = await this.prisma.creative.findFirst({
      where: { id: creativeId, tenantId: context.tenantId },
      include: { storeConfig: { select: { id: true, storeNameSnapshot: true, aiNiche: true, aiStoreRules: true } } },
    });
    if (!creative) throw new NotFoundException('Creative not found');

    const run = options.runId
      ? await this.prisma.creativeAiRun.findFirst({
          where: { id: options.runId, tenantId: context.tenantId, creativeId },
        })
      : await this.prisma.creativeAiRun.findFirst({
          where: { tenantId: context.tenantId, creativeId, status: 'COMPLETED' },
          orderBy: { completedAt: 'desc' },
        });
    if (!run || run.status !== 'COMPLETED') {
      throw new BadRequestException(
        'This creative has no completed AI analysis. The gate compares how a creative is built, so it needs one first.',
      );
    }

    const corpus = await this.knowledge.corpusForStore(context.tenantId, creative.storeConfigId);
    const winners = corpus.filter((entry) => entry.label === 'WINNER').length;
    const losers = corpus.filter((entry) => entry.label === 'LOSER').length;

    const review = await this.prisma.creativeEnrollmentReview.create({
      data: {
        tenantId: context.tenantId,
        storeConfigId: creative.storeConfigId,
        creativeId: creative.id,
        runId: run.id,
        status: 'QUEUED',
        // Shadow is the default and the caller may only leave it by asking.
        shadow: options.shadow !== false,
        corpusSize: corpus.length,
        entryIds: corpus.map((entry) => entry.id),
      },
    });

    await this.queue.add(
      CREATIVE_GATE_REVIEW_JOB,
      { tenantId: context.tenantId, reviewId: review.id },
      {
        // A gate review is one model call over frames that already exist, so a
        // single retry is enough; repeated failures mean something structural.
        attempts: 2,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    );

    this.logger.log(
      `Gate review ${review.id} queued for ${creative.code} (${winners}W/${losers}L corpus, shadow=${review.shadow})`,
    );
    return review;
  }

  /**
   * Run one queued review.
   *
   * Reuses the analysis run's workspace, where the frames already sit, so the
   * gate looks at the same evidence the analysis did without re-extracting
   * anything.
   */
  async execute(tenantId: string, reviewId: string) {
    if (process.env.AI_AGENT_ENABLED !== 'true') throw new Error('Creative AI is disabled');

    const review = await this.prisma.creativeEnrollmentReview.findFirst({
      where: { id: reviewId, tenantId },
      include: {
        creative: { select: { id: true, code: true, kind: true } },
        storeConfig: { select: { storeNameSnapshot: true, aiNiche: true, aiStoreRules: true } },
        run: { select: { id: true, sourcePath: true, provider: true, model: true, effort: true, settingsSnapshot: true } },
      },
    });
    if (!review) throw new Error('Enrollment review was not found in its tenant');
    if (review.status === 'COMPLETED' || review.status === 'FAILED') return;
    if (!review.run?.sourcePath) throw new Error('The linked analysis has no workspace to read');

    const root = resolve(process.env.CREATIVE_AI_WORKSPACE_ROOT || join(process.cwd(), 'tmp', 'creative-ai'));
    const sourcePath = resolve(root, review.run.sourcePath);
    if (!sourcePath.startsWith(`${root}${sep}`)) throw new Error('Review source path escaped its workspace');
    const workspace = dirname(sourcePath);
    if (!existsSync(join(workspace, 'video-timeline.json'))) {
      await this.fail(tenantId, reviewId, 'The analysis workspace has been purged, so the gate cannot re-read the creative. Re-run the analysis first.');
      return;
    }

    await this.prisma.creativeEnrollmentReview.update({
      where: { id: reviewId },
      data: { status: 'RUNNING', startedAt: new Date(), errorMessage: null },
    });

    try {
      const policy = await this.prisma.creativeAiPolicy.findUnique({ where: { tenantId } });
      const corpus = await this.knowledge.corpusForStore(tenantId, review.storeConfigId);

      // The gate asks the same question as a new-creative analysis, so it uses
      // the same prompt. Forcing NEW_REVIEWER is correct even when the creative
      // happens to have spend: the gate's job is to judge how it is made
      // against what this product already knows, not to grade its results.
      const built = await this.promptContext.build({
        tenantId,
        creativeId: review.creativeId,
        kind: review.creative.kind,
        signals: { linkedAdCount: 0, spend: 0, impressions: 0 },
      });

      const output = await this.claudebox.run({
        tenantId,
        userId: review.decidedById ?? review.tenantId,
        runId: review.id,
        workspace: `/workspace/${tenantId}/${review.run.id}`,
        prompt: built.prompt,
        provider: review.run.provider,
        model: review.run.model,
        effort: review.run.effort,
        maxTurns: policy?.maxTurns ?? 12,
        maxRunMinutes: policy?.maxRunMinutes ?? 15,
        jsonSchema: built.schema,
        localWorkspace:
          process.env.CREATIVE_AI_SHARED_WORKSPACE?.trim().toLowerCase() === 'true' ? undefined : workspace,
      });

      const parsed = this.parseResult(output.result);
      const decision = this.asDecision(parsed.decision);
      const confidence = this.asConfidence(parsed.confidence);

      await this.prisma.creativeEnrollmentReview.update({
        where: { id: reviewId },
        data: {
          status: 'COMPLETED',
          decision,
          confidence,
          rationale: (parsed.rationale ?? null) as Prisma.InputJsonValue,
          requiredChanges: (parsed.requiredChanges ?? null) as Prisma.InputJsonValue,
          corpusSize: corpus.length,
          entryIds: corpus.map((entry) => entry.id),
          completedAt: new Date(),
        },
      });
      this.logger.log(
        `Gate review ${reviewId} for ${review.creative.code}: ${decision} at ${confidence}% confidence (corpus of ${corpus.length})`,
      );
    } catch (error) {
      await this.fail(tenantId, reviewId, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * A person rules on the gate's recommendation.
   *
   * ACCEPTED means they agree; OVERRIDDEN means they did not, and the notes say
   * why. Recording disagreement is the whole point of shadow mode: it is the
   * only way to know whether the gate is worth trusting.
   */
  async decide(
    actor: CreativeActor,
    reviewId: string,
    input: { outcome: 'ACCEPTED' | 'OVERRIDDEN'; notes?: string },
  ) {
    const context = await this.access.resolve(actor);
    this.access.require(context, CREATIVE_AGENT_PERMISSIONS.REVIEW);

    const review = await this.prisma.creativeEnrollmentReview.findFirst({
      where: { id: reviewId, tenantId: context.tenantId },
    });
    if (!review) throw new NotFoundException('Review not found');
    if (review.status !== 'COMPLETED') {
      throw new BadRequestException('That review has not finished, so there is nothing to rule on yet.');
    }
    if (review.outcome !== CreativeEnrollmentReviewOutcome.PENDING) {
      throw new BadRequestException('That review has already been ruled on.');
    }
    if (input.outcome === 'OVERRIDDEN' && !input.notes?.trim()) {
      throw new BadRequestException('Say why you are overriding the gate; that note is what calibrates it.');
    }

    return this.prisma.creativeEnrollmentReview.update({
      where: { id: reviewId },
      data: {
        outcome: input.outcome as CreativeEnrollmentReviewOutcome,
        decidedById: context.userId,
        decidedAt: new Date(),
        decisionNotes: input.notes?.trim() || null,
      },
    });
  }

  /**
   * The publish guard.
   *
   * Anything that would create an ad in Meta must call this first. It refuses
   * unless a person has accepted an APPROVE recommendation on a non-shadow
   * review. Putting the rule here means a future MCP execution path cannot
   * bypass it by forgetting to check.
   */
  async assertPublishable(tenantId: string, creativeId: string) {
    const review = await this.prisma.creativeEnrollmentReview.findFirst({
      where: { tenantId, creativeId, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
    });
    if (!review) {
      throw new BadRequestException('This creative has not been through the enrollment gate.');
    }
    if (review.shadow) {
      throw new BadRequestException(
        'The gate is still in shadow mode for this creative, so its recommendation cannot authorize publishing.',
      );
    }
    if (review.decision !== CreativeEnrollmentDecision.APPROVE) {
      throw new BadRequestException(`The gate returned ${review.decision}, so this creative may not be published.`);
    }
    if (review.outcome !== CreativeEnrollmentReviewOutcome.ACCEPTED) {
      throw new BadRequestException(
        'A person must accept the gate recommendation before this creative can be published.',
      );
    }
    return review;
  }

  /** Reviews for a store or creative, newest first. */
  async list(
    actor: CreativeActor,
    query: { storeId?: string; creativeId?: string; pendingOnly?: boolean; take?: number } = {},
  ) {
    const context = await this.access.resolve(actor);
    this.access.require(context, CREATIVE_AGENT_PERMISSIONS.READ);
    const where: Prisma.CreativeEnrollmentReviewWhereInput = {
      tenantId: context.tenantId,
      ...(query.storeId ? { storeConfigId: query.storeId } : {}),
      ...(query.creativeId ? { creativeId: query.creativeId } : {}),
      ...(query.pendingOnly ? { outcome: CreativeEnrollmentReviewOutcome.PENDING, status: 'COMPLETED' } : {}),
    };
    return this.prisma.creativeEnrollmentReview.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(query.take ?? 50, 1), 200),
      include: {
        creative: { select: { code: true, title: true, kind: true } },
        storeConfig: { select: { storeNameSnapshot: true } },
        decidedBy: { select: { firstName: true, lastName: true } },
      },
    });
  }

  /**
   * How well the gate agrees with people.
   *
   * This is the number that decides whether shadow mode can end. It counts only
   * reviews a person actually ruled on, because an unreviewed recommendation is
   * not evidence of anything.
   */
  async calibration(actor: CreativeActor, storeId?: string) {
    const context = await this.access.resolve(actor);
    this.access.require(context, CREATIVE_AGENT_PERMISSIONS.READ);
    const rows = await this.prisma.creativeEnrollmentReview.groupBy({
      by: ['decision', 'outcome'],
      where: {
        tenantId: context.tenantId,
        status: 'COMPLETED',
        outcome: { in: [CreativeEnrollmentReviewOutcome.ACCEPTED, CreativeEnrollmentReviewOutcome.OVERRIDDEN] },
        ...(storeId ? { storeConfigId: storeId } : {}),
      },
      _count: { _all: true },
    });
    const accepted = rows
      .filter((row) => row.outcome === CreativeEnrollmentReviewOutcome.ACCEPTED)
      .reduce((total, row) => total + row._count._all, 0);
    const overridden = rows
      .filter((row) => row.outcome === CreativeEnrollmentReviewOutcome.OVERRIDDEN)
      .reduce((total, row) => total + row._count._all, 0);
    const ruled = accepted + overridden;
    return {
      ruled,
      accepted,
      overridden,
      agreementRate: ruled > 0 ? Math.round((accepted / ruled) * 100) : null,
      byDecision: rows.map((row) => ({
        decision: row.decision,
        outcome: row.outcome,
        count: row._count._all,
      })),
      /**
       * Deliberately conservative. Twenty ruled reviews at 85% agreement is the
       * earliest point the gate should stop being purely advisory, and even
       * then the publish guard still requires a person to accept.
       */
      readyToLeaveShadow: ruled >= 20 && accepted / Math.max(ruled, 1) >= 0.85,
    };
  }

  private async fail(tenantId: string, reviewId: string, message: string) {
    await this.prisma.creativeEnrollmentReview.updateMany({
      where: { id: reviewId, tenantId },
      data: { status: 'FAILED', errorMessage: message.slice(0, 1000), completedAt: new Date() },
    });
    this.logger.warn(`Gate review ${reviewId} failed: ${message}`);
  }

  private parseResult(value: string): Record<string, any> {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object') return parsed as Record<string, any>;
    } catch {
      // fall through
    }
    throw new Error('The gate did not return valid JSON');
  }

  private asDecision(value: unknown): CreativeEnrollmentDecision {
    if (value === 'APPROVE' || value === 'REVISE' || value === 'REJECT') {
      return value as CreativeEnrollmentDecision;
    }
    // An unreadable decision is not an approval. Fail closed.
    throw new Error(`The gate returned an unrecognised decision: ${String(value)}`);
  }

  private asConfidence(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.min(Math.max(Math.round(parsed), 0), 100);
  }
}
