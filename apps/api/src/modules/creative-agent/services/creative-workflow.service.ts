import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CreativePerformanceStatus,
  CreativeQcStatus,
  CreativeStatusDimension,
} from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  CREATIVE_AGENT_PERMISSIONS,
  PERFORMANCE_TRANSITIONS,
  QC_TRANSITIONS,
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

    if (dto.dimension === CreativeStatusDimension.QC) {
      return this.transitionQc(context, creative, dto);
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

  private async transitionQc(
    context: CreativeAccessContext,
    creative: { id: string; createdById: string; qcStatus: CreativeQcStatus; submittedAt: Date | null; approvedAt: Date | null },
    dto: TransitionCreativeStatusDto,
  ) {
    if (!Object.values(CreativeQcStatus).includes(dto.toStatus as CreativeQcStatus)) {
      throw new ConflictException('Invalid QC status');
    }
    const fromStatus = creative.qcStatus as string;
    if (!(QC_TRANSITIONS[fromStatus] ?? []).includes(dto.toStatus)) {
      throw new ConflictException(`QC transition ${fromStatus} → ${dto.toStatus} is not allowed`);
    }
    if (['FOR_REVISION', 'CANCELLED'].includes(dto.toStatus) && !dto.reason) {
      throw new BadRequestException('A reason is required for revision or cancellation');
    }

    const makerAction = (fromStatus === 'DRAFT' && dto.toStatus === 'FOR_APPROVAL')
      || (fromStatus === 'FOR_REVISION' && dto.toStatus === 'REVISED')
      || (creative.createdById === context.userId && dto.toStatus === 'CANCELLED');
    if (makerAction) {
      if (creative.createdById !== context.userId || !this.access.canEdit(context, creative.createdById)) {
        throw new ForbiddenException('Only the creative owner can submit this creative');
      }
    } else {
      if (creative.createdById === context.userId) {
        throw new ForbiddenException('A creative cannot review their own submission');
      }
      this.access.require(context, CREATIVE_AGENT_PERMISSIONS.REVIEW);
    }

    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.creative.updateMany({
        where: { id: creative.id, tenantId: context.tenantId, qcStatus: creative.qcStatus },
        data: {
          qcStatus: dto.toStatus as CreativeQcStatus,
          ...(dto.toStatus === 'FOR_POSTING' && !creative.approvedAt ? { approvedAt: now } : {}),
          ...(!creative.submittedAt ? { submittedAt: now } : {}),
        },
      });
      if (updateResult.count !== 1) throw new ConflictException('Creative status changed; refresh and retry');
      const event = await tx.creativeStatusEvent.create({
        data: {
          tenantId: context.tenantId,
          creativeId: creative.id,
          dimension: 'QC',
          fromStatus,
          toStatus: dto.toStatus,
          actorId: context.userId,
          reason: dto.reason || null,
        },
      });
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
      return { creativeId: creative.id, dimension: 'QC', fromStatus, toStatus: dto.toStatus, eventId: event.id };
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
