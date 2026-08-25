import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CreativePerformanceStatus,
  CreativeRevisionState,
  CreativeStatusDimension,
} from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  CREATIVE_AGENT_PERMISSIONS,
  PERFORMANCE_TRANSITIONS,
  REVISION_TRANSITIONS,
} from '../creative-agent.constants';
import { TransitionCreativeStatusDto } from '../dto/transition-creative-status.dto';
import type { CreativeActor } from '../types/creative-actor.type';
import type { CreativeAccessContext } from '../types/creative-actor.type';
import { CreativeAccessService } from './creative-access.service';

@Injectable()
export class CreativeWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CreativeAccessService,
  ) {}

  async transition(actor: CreativeActor, creativeId: string, dto: TransitionCreativeStatusDto) {
    const context = await this.access.resolve(actor);
    const creative = await this.prisma.creative.findFirst({
      where: { id: creativeId, tenantId: context.tenantId },
    });
    if (!creative) throw new NotFoundException('Creative not found');

    if (dto.dimension === CreativeStatusDimension.REVISION) {
      return this.transitionRevision(context, creative, dto);
    }
    return this.transitionPerformance(context, creative, dto);
  }

  async listEvents(actor: CreativeActor, creativeId: string) {
    const context = await this.access.resolve(actor);
    this.access.requireReadable(context);
    const creative = await this.prisma.creative.findFirst({
      where: { id: creativeId, tenantId: context.tenantId },
      select: { createdById: true },
    });
    if (!creative) throw new NotFoundException('Creative not found');
    if (!this.access.canReadAll(context) && creative.createdById !== context.userId) {
      throw new ForbiddenException('You can only view your own creative history');
    }
    return this.prisma.creativeStatusEvent.findMany({
      where: { tenantId: context.tenantId, creativeId },
      include: { actor: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Revision requests replace the old QC approval gate. There is no approval
   * to grant — a linked creative is already running — so this only records
   * that Advertising asked for changes, and that the creator addressed them.
   */
  private async transitionRevision(
    context: CreativeAccessContext,
    creative: { id: string; createdById: string; revisionState: CreativeRevisionState },
    dto: TransitionCreativeStatusDto,
  ) {
    if (!Object.values(CreativeRevisionState).includes(dto.toStatus as CreativeRevisionState)) {
      throw new ConflictException('Invalid revision state');
    }
    const fromStatus = creative.revisionState as string;
    if (!(REVISION_TRANSITIONS[fromStatus] ?? []).includes(dto.toStatus)) {
      throw new ConflictException(`Revision transition ${fromStatus} → ${dto.toStatus} is not allowed`);
    }
    // A request for changes without a reason is not actionable feedback.
    if (dto.toStatus === 'NEEDS_REVISION' && !dto.reason) {
      throw new BadRequestException('Describe the changes you are asking for');
    }

    if (dto.toStatus === 'NEEDS_REVISION') {
      // Only a reviewer asks for changes, and never on their own creative.
      if (creative.createdById === context.userId) {
        throw new ForbiddenException('You cannot request revisions on your own creative');
      }
      this.access.require(context, CREATIVE_AGENT_PERMISSIONS.REVIEW);
    } else if (
      creative.createdById !== context.userId
      && !this.access.has(context, CREATIVE_AGENT_PERMISSIONS.REVIEW)
    ) {
      // The owner resolves their own request; a reviewer may also close it out.
      throw new ForbiddenException('Only the creative owner or a reviewer can resolve this request');
    }

    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.creative.updateMany({
        where: { id: creative.id, tenantId: context.tenantId, revisionState: creative.revisionState },
        data: {
          revisionState: dto.toStatus as CreativeRevisionState,
          ...(dto.toStatus === 'NEEDS_REVISION'
            ? { revisionRequestedAt: now, revisionResolvedAt: null }
            : { revisionResolvedAt: now }),
        },
      });
      if (updateResult.count !== 1) throw new ConflictException('Creative status changed; refresh and retry');
      const event = await tx.creativeStatusEvent.create({
        data: {
          tenantId: context.tenantId,
          creativeId: creative.id,
          dimension: CreativeStatusDimension.REVISION,
          fromStatus,
          toStatus: dto.toStatus,
          actorId: context.userId,
          reason: dto.reason || null,
        },
      });
      // The reason becomes the opening message of the thread, so feedback and
      // history never drift apart.
      if (dto.reason) {
        await tx.creativeReviewComment.create({
          data: {
            tenantId: context.tenantId,
            creativeId: creative.id,
            authorId: context.userId,
            message: dto.reason,
          },
        });
      }
      return { creativeId: creative.id, dimension: 'REVISION', fromStatus, toStatus: dto.toStatus, eventId: event.id };
    });
  }

  private async transitionPerformance(
    context: CreativeAccessContext,
    creative: { id: string; performanceStatus: CreativePerformanceStatus },
    dto: TransitionCreativeStatusDto,
  ) {
    this.access.require(context, CREATIVE_AGENT_PERMISSIONS.PERFORMANCE_MANAGE);
    if (!Object.values(CreativePerformanceStatus).includes(dto.toStatus as CreativePerformanceStatus)) {
      throw new ConflictException('Invalid performance status');
    }
    const fromStatus = creative.performanceStatus as string;
    if (!(PERFORMANCE_TRANSITIONS[fromStatus] ?? []).includes(dto.toStatus)) {
      throw new ConflictException(`Performance transition ${fromStatus} → ${dto.toStatus} is not allowed`);
    }

    return this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.creative.updateMany({
        where: { id: creative.id, tenantId: context.tenantId, performanceStatus: creative.performanceStatus },
        data: { performanceStatus: dto.toStatus as CreativePerformanceStatus },
      });
      if (updateResult.count !== 1) throw new ConflictException('Creative status changed; refresh and retry');
      const event = await tx.creativeStatusEvent.create({
        data: {
          tenantId: context.tenantId,
          creativeId: creative.id,
          dimension: 'PERFORMANCE',
          fromStatus,
          toStatus: dto.toStatus,
          actorId: context.userId,
          reason: dto.reason || null,
        },
      });
      return { creativeId: creative.id, dimension: 'PERFORMANCE', fromStatus, toStatus: dto.toStatus, eventId: event.id };
    });
  }
}
