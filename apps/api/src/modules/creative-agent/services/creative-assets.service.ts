import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreativeQcStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CREATIVE_AGENT_PERMISSIONS } from '../creative-agent.constants';
import { CreateCreativeReviewCommentDto } from '../dto/create-creative-review-comment.dto';
import { ListCreativeAssetsQueryDto } from '../dto/list-creative-assets-query.dto';
import type { CreativeActor } from '../types/creative-actor.type';
import { CreativeAccessService } from './creative-access.service';

const ASSET_QUEUE_STATUSES: CreativeQcStatus[] = [
  CreativeQcStatus.DRAFT,
  CreativeQcStatus.FOR_APPROVAL,
  CreativeQcStatus.FOR_REVISION,
  CreativeQcStatus.REVISED,
  CreativeQcStatus.FOR_POSTING,
  CreativeQcStatus.POSTED,
  CreativeQcStatus.CANCELLED,
];

/** The advertising approval queue: every state waiting on a reviewer decision. */
const REVIEW_QUEUE_STATUSES: CreativeQcStatus[] = [
  CreativeQcStatus.FOR_APPROVAL,
  CreativeQcStatus.REVISED,
  CreativeQcStatus.FOR_POSTING,
];

@Injectable()
export class CreativeAssetsService {
  constructor(private readonly prisma: PrismaService, private readonly access: CreativeAccessService) {}

  async list(actor: CreativeActor, query: ListCreativeAssetsQueryDto) {
    const context = await this.access.resolve(actor);
    // READ_ALL admits the Advertising reviewer persona (read_all + review),
    // which owns the tenant-wide approval queue but holds neither read nor edit.
    this.access.require(context, CREATIVE_AGENT_PERMISSIONS.READ, CREATIVE_AGENT_PERMISSIONS.READ_ALL, CREATIVE_AGENT_PERMISSIONS.EDIT);
    const canReadAll = this.access.canReadAll(context);
    const ownershipWhere: Prisma.CreativeWhereInput = canReadAll
      ? (query.creatorId ? { createdById: query.creatorId } : {})
      : { createdById: context.userId };
    const queueStatuses = query.queue === 'REVIEW' ? REVIEW_QUEUE_STATUSES : ASSET_QUEUE_STATUSES;
    const where: Prisma.CreativeWhereInput = {
      tenantId: context.tenantId,
      ...ownershipWhere,
      ...(query.creativeId ? { id: query.creativeId } : {}),
      qcStatus: query.creativeId ? undefined : (query.qcStatus ?? { in: queueStatuses }),
      ...(query.storeId ? { storeConfig: { storeId: query.storeId } } : {}),
      ...(query.query ? { OR: [
        { code: { contains: query.query, mode: 'insensitive' } },
        { title: { contains: query.query, mode: 'insensitive' } },
        { createdBy: { OR: [
          { firstName: { contains: query.query, mode: 'insensitive' } },
          { lastName: { contains: query.query, mode: 'insensitive' } },
          { email: { contains: query.query, mode: 'insensitive' } },
        ] } },
      ] } : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    // The review queue reads oldest-waiting first. Tenant-wide readers browsing
    // everything get actionable states first (the QC enum is declared in
    // workflow order, so Postgres enum ASC sorts POSTED and CANCELLED last),
    // oldest submission first within a state. Personal views keep the original
    // recency ordering so the Creative workspace behaves exactly as before.
    const orderBy: Prisma.CreativeOrderByWithRelationInput[] = query.queue === 'REVIEW'
      ? [{ submittedAt: 'asc' }, { code: 'asc' }]
      : canReadAll && !query.qcStatus
        ? [{ qcStatus: 'asc' }, { submittedAt: 'asc' }, { code: 'asc' }]
        : [{ updatedAt: 'desc' }, { code: 'asc' }];
    const [items, total, stores, creators, statusCounts] = await Promise.all([
      this.prisma.creative.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy,
        select: {
          id: true, code: true, title: true, kind: true, mediaUrl: true, format: true, hookType: true,
          script: true, notes: true, qcStatus: true, performanceStatus: true, createdById: true,
          submittedAt: true, approvedAt: true, createdAt: true, updatedAt: true, metaAdId: true,
          storeConfig: { select: { storeId: true, storeNameSnapshot: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
          reviewComments: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
          metaAdLinks: { select: { adId: true }, orderBy: { linkedAt: 'asc' } },
          _count: { select: { reviewComments: true } },
        },
      }),
      this.prisma.creative.count({ where }),
      this.prisma.creativeStoreConfig.findMany({
        where: { tenantId: context.tenantId, active: true, storeId: { not: null } },
        select: { storeId: true, storeNameSnapshot: true }, orderBy: { storeNameSnapshot: 'asc' },
      }),
      this.prisma.creative.findMany({
        where: { tenantId: context.tenantId, ...(!canReadAll ? { createdById: context.userId } : {}) }, distinct: ['createdById'],
        select: { createdBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
      }),
      this.prisma.creative.groupBy({
        by: ['qcStatus'], where: { tenantId: context.tenantId, ...ownershipWhere, qcStatus: { in: ASSET_QUEUE_STATUSES } },
        _count: { _all: true },
      }),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
    return {
      permissions: { canReadAll },
      selected: { query: query.query ?? '', storeId: query.storeId ?? '', creatorId: query.creatorId ?? '', qcStatus: query.qcStatus ?? '', queue: query.queue ?? '', page: query.page, pageSize: query.pageSize },
      filters: {
        stores: stores.map((store) => ({ value: store.storeId as string, label: store.storeNameSnapshot })),
        creators: creators.map(({ createdBy }) => ({ value: createdBy.id, label: this.personName(createdBy) })).sort((a, b) => a.label.localeCompare(b.label)),
        statuses: ASSET_QUEUE_STATUSES.map((status) => ({ value: status, label: this.humanize(status) })),
      },
      summary: Object.fromEntries(ASSET_QUEUE_STATUSES.map((status) => [status, statusCounts.find((row) => row.qcStatus === status)?._count._all ?? 0])),
      items: items.map((item) => {
        const linkedAdIds = item.metaAdLinks.map((link) => link.adId);
        if (linkedAdIds.length === 0 && item.metaAdId) linkedAdIds.push(item.metaAdId);
        return {
          id: item.id, code: item.code, title: item.title, kind: item.kind, mediaUrl: item.mediaUrl,
          format: item.format, hookType: item.hookType, script: item.script, notes: item.notes,
          qcStatus: item.qcStatus, performanceStatus: item.performanceStatus,
          creator: { id: item.createdBy.id, name: this.personName(item.createdBy), avatar: item.createdBy.avatar },
          store: { id: item.storeConfig.storeId, name: item.storeConfig.storeNameSnapshot },
          isOwnSubmission: item.createdById === context.userId,
          commentCount: item._count.reviewComments,
          lastCommentAt: item.reviewComments[0]?.createdAt ?? null,
          linked: linkedAdIds.length > 0,
          metaAdIds: [...new Set(linkedAdIds)],
          submittedAt: item.submittedAt, approvedAt: item.approvedAt, createdAt: item.createdAt, updatedAt: item.updatedAt,
        };
      }),
      pagination: { page: Math.min(query.page, totalPages), pageSize: query.pageSize, total, totalPages },
      generatedAt: new Date().toISOString(),
    };
  }

  async comments(actor: CreativeActor, creativeId: string) {
    const { context } = await this.assertCommentAccess(actor, creativeId);
    return this.prisma.creativeReviewComment.findMany({
      where: { tenantId: context.tenantId, creativeId },
      select: {
        id: true, message: true, createdAt: true, updatedAt: true,
        author: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
      },
      orderBy: { createdAt: 'asc' },
    }).then((comments) => comments.map((comment) => ({
      ...comment,
      author: { id: comment.author.id, name: this.personName(comment.author), avatar: comment.author.avatar },
    })));
  }

  async addComment(actor: CreativeActor, creativeId: string, dto: CreateCreativeReviewCommentDto) {
    const { context } = await this.assertCommentAccess(actor, creativeId);
    const comment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.creativeReviewComment.create({
        data: { tenantId: context.tenantId, creativeId, authorId: context.userId, message: dto.message },
        select: {
          id: true, message: true, createdAt: true, updatedAt: true,
          author: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
        },
      });
      await tx.auditLog.create({
        data: { tenantId: context.tenantId, userId: context.userId, action: 'creative.review.comment', resource: 'Creative', resourceId: creativeId, changes: { commentId: created.id } },
      });
      return created;
    });
    return { ...comment, author: { id: comment.author.id, name: this.personName(comment.author), avatar: comment.author.avatar } };
  }

  private async assertCommentAccess(actor: CreativeActor, creativeId: string) {
    const context = await this.access.resolve(actor);
    const creative = await this.prisma.creative.findFirst({
      where: { id: creativeId, tenantId: context.tenantId }, select: { createdById: true },
    });
    if (!creative) throw new NotFoundException('Creative not found');
    const canReview = this.access.has(context, CREATIVE_AGENT_PERMISSIONS.REVIEW);
    const canCommentOwn = creative.createdById === context.userId
      && (this.access.has(context, CREATIVE_AGENT_PERMISSIONS.READ) || this.access.has(context, CREATIVE_AGENT_PERMISSIONS.EDIT));
    if (!canReview && !canCommentOwn) throw new ForbiddenException('You cannot access this creative feedback');
    return { context, creative };
  }

  private personName(person: { firstName: string | null; lastName: string | null; email: string }) {
    return [person.firstName, person.lastName].filter(Boolean).join(' ') || person.email;
  }

  private humanize(value: string) { return value.toLowerCase().replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase()); }
}
