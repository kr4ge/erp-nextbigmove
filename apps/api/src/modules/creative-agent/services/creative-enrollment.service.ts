import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreativeMetaLinkSource, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  CREATIVE_AGENT_PERMISSIONS,
  CREATIVE_CODE_MINT_RETRIES,
} from '../creative-agent.constants';
import { EnrollCreativeDto, EnrollUnregisteredCreativeDto } from '../dto/enroll-creative.dto';
import { UpdateCreativeDto } from '../dto/update-creative.dto';
import type { CreativeActor } from '../types/creative-actor.type';
import { CreativeAccessService } from './creative-access.service';
import { CreativeStoreService } from './creative-store.service';

const CREATIVE_DETAIL_INCLUDE = {
  storeConfig: { select: { id: true, storeId: true, storeNameSnapshot: true, shopIdSnapshot: true, codePrefix: true, active: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
  aliases: { select: { id: true, alias: true, createdAt: true }, orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.CreativeInclude;

type CreativeDetail = Prisma.CreativeGetPayload<{ include: typeof CREATIVE_DETAIL_INCLUDE }>;
type CreativeMetaLinkInput = {
  accountId: string;
  adId: string;
  adName: string;
  linkedById: string;
  source: CreativeMetaLinkSource;
};

@Injectable()
export class CreativeEnrollmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CreativeAccessService,
    private readonly stores: CreativeStoreService,
  ) {}

  async enroll(actor: CreativeActor, dto: EnrollCreativeDto) {
    const context = await this.access.resolve(actor);
    this.access.require(context, CREATIVE_AGENT_PERMISSIONS.ENROLL);
    const config = await this.getActiveStoreConfig(context.tenantId, dto.storeId);

    for (let attempt = 1; attempt <= CREATIVE_CODE_MINT_RETRIES; attempt += 1) {
      try {
        const latest = await this.prisma.creative.findFirst({
          where: { tenantId: context.tenantId, storeConfigId: config.id },
          select: { codeNumber: true },
          orderBy: { codeNumber: 'desc' },
        });
        const codeNumber = (latest?.codeNumber ?? 0) + 1;
        if (codeNumber > 999999) {
          throw new ConflictException(`The ${config.codePrefix} creative code range is exhausted`);
        }
        return await this.createCreative(context.tenantId, context.userId, config, dto, codeNumber);
      } catch (error) {
        const isUniqueCollision = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
        if (!isUniqueCollision || attempt === CREATIVE_CODE_MINT_RETRIES) {
          if (isUniqueCollision) throw new ConflictException('Could not reserve the next creative code; please retry');
          throw error;
        }
      }
    }
    throw new ConflictException('Could not reserve the next creative code');
  }

  async enrollUnregistered(actor: CreativeActor, dto: EnrollUnregisteredCreativeDto) {
    const context = await this.access.resolve(actor);
    this.access.require(context, CREATIVE_AGENT_PERMISSIONS.ENROLL);
    const config = await this.getActiveStoreConfig(context.tenantId, dto.storeId);
    const metaInsight = await this.findMetaInsight(
      context.tenantId,
      dto.accountId,
      dto.adId,
    );
    const metaLink = {
      ...metaInsight,
      linkedById: context.userId,
      source: dto.requestedCode ? CreativeMetaLinkSource.AUTO_CODE : CreativeMetaLinkSource.MANUAL,
    };

    if (dto.requestedCode) {
      if (metaInsight.adName !== dto.requestedCode) {
        throw new ConflictException('The requested creative code must exactly match the Meta ad name');
      }
      const prefix = dto.requestedCode.split('-V')[0];
      if (prefix !== config.codePrefix) {
        throw new ConflictException(`Code ${dto.requestedCode} belongs to the ${prefix} store prefix`);
      }
      await this.assertCodeAvailable(context.tenantId, dto.requestedCode);
      const codeNumber = Number(dto.requestedCode.split('-V')[1]);

      try {
        return await this.createCreative(
          context.tenantId,
          context.userId,
          config,
          dto,
          codeNumber,
          dto.requestedCode,
          metaLink,
        );
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException(`${dto.requestedCode} or its Meta ad is already registered`);
        }
        throw error;
      }
    }

    for (let attempt = 1; attempt <= CREATIVE_CODE_MINT_RETRIES; attempt += 1) {
      try {
        const latest = await this.prisma.creative.findFirst({
          where: { tenantId: context.tenantId, storeConfigId: config.id },
          select: { codeNumber: true },
          orderBy: { codeNumber: 'desc' },
        });
        const codeNumber = (latest?.codeNumber ?? 0) + 1;
        if (codeNumber > 999999) {
          throw new ConflictException(`The ${config.codePrefix} creative code range is exhausted`);
        }
        return await this.createCreative(
          context.tenantId,
          context.userId,
          config,
          dto,
          codeNumber,
          undefined,
          metaLink,
        );
      } catch (error) {
        const isUniqueCollision = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
        if (!isUniqueCollision || attempt === CREATIVE_CODE_MINT_RETRIES) {
          if (isUniqueCollision) {
            throw new ConflictException('Could not reserve the creative code or the Meta ad is already linked');
          }
          throw error;
        }
      }
    }
    throw new ConflictException('Could not reserve the next creative code');
  }

  async getById(actor: CreativeActor, creativeId: string) {
    const context = await this.access.resolve(actor);
    this.access.requireReadable(context);
    const creative = await this.prisma.creative.findFirst({
      where: { id: creativeId, tenantId: context.tenantId },
      include: this.detailInclude(),
    });
    if (!creative) throw new NotFoundException('Creative not found');
    if (!this.access.canReadAll(context) && creative.createdById !== context.userId) {
      throw new ForbiddenException('You can only view your own creatives');
    }
    return this.serializeCreative(creative);
  }

  async update(actor: CreativeActor, creativeId: string, dto: UpdateCreativeDto) {
    const context = await this.access.resolve(actor);
    const existing = await this.prisma.creative.findFirst({
      where: { id: creativeId, tenantId: context.tenantId },
    });
    if (!existing) throw new NotFoundException('Creative not found');
    if (!this.access.canEdit(context, existing.createdById)) {
      throw new ForbiddenException('You cannot edit this creative');
    }

    const data = {
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.mediaUrl !== undefined ? { mediaUrl: dto.mediaUrl || null } : {}),
      ...(dto.format !== undefined ? { format: dto.format || null } : {}),
      ...(dto.hookType !== undefined ? { hookType: dto.hookType || null } : {}),
      ...(dto.script !== undefined ? { script: dto.script.trim() || null } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes.trim() || null } : {}),
    };

    const updated = await this.prisma.$transaction(async (tx) => {
      const creative = await tx.creative.update({
        where: { id: existing.id },
        data,
        include: this.detailInclude(),
      });
      await tx.auditLog.create({
        data: {
          tenantId: context.tenantId,
          userId: context.userId,
          action: 'creative.update',
          resource: 'Creative',
          resourceId: creative.id,
          changes: data,
        },
      });
      return creative;
    });
    return this.serializeCreative(updated);
  }

  private async getActiveStoreConfig(tenantId: string, storeId: string) {
    return this.stores.getOrCreateActiveConfig(tenantId, storeId);
  }

  private async createCreative(
    tenantId: string,
    userId: string,
    config: { id: string; codePrefix: string },
    dto: EnrollCreativeDto,
    codeNumber: number,
    requestedCode?: string,
    metaLink?: CreativeMetaLinkInput,
  ) {
    const code = requestedCode ?? `${config.codePrefix}-V${String(codeNumber).padStart(4, '0')}`;
    const now = new Date();
    const creative = await this.prisma.$transaction(async (tx) => {
      const created = await tx.creative.create({
        data: {
          tenantId,
          storeConfigId: config.id,
          code,
          codeNumber,
          kind: dto.kind,
          title: dto.title,
          mediaUrl: dto.mediaUrl || null,
          format: dto.format || null,
          hookType: dto.hookType || null,
          script: dto.script?.trim() || null,
          notes: dto.notes?.trim() || null,
          createdById: userId,
          submittedAt: now,
          ...(metaLink
            ? {
                metaAccountId: metaLink.accountId,
                metaAdId: metaLink.adId,
                metaAdNameSnapshot: metaLink.adName,
                metaLinkSource: metaLink.source,
                metaLinkedAt: now,
                metaLinkedById: metaLink.linkedById,
              }
            : {}),
        },
        include: this.detailInclude(),
      });
      await tx.creativeStatusEvent.create({
        data: {
          tenantId,
          creativeId: created.id,
          dimension: 'QC',
          fromStatus: 'NONE',
          toStatus: 'FOR_APPROVAL',
          actorId: userId,
          reason: 'Creative enrolled',
        },
      });
      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'creative.enroll',
          resource: 'Creative',
          resourceId: created.id,
          changes: {
            code,
            storeConfigId: config.id,
            kind: dto.kind,
            ...(metaLink
              ? {
                  metaAccountId: metaLink.accountId,
                  metaAdId: metaLink.adId,
                  metaLinkSource: metaLink.source,
                }
              : {}),
          },
        },
      });
      return created;
    });
    return this.serializeCreative(creative);
  }

  private async assertCodeAvailable(tenantId: string, code: string) {
    const [creative, alias] = await Promise.all([
      this.prisma.creative.findFirst({ where: { tenantId, code }, select: { id: true } }),
      this.prisma.creativeAlias.findFirst({ where: { tenantId, normalizedAlias: code }, select: { id: true } }),
    ]);
    if (creative || alias) throw new ConflictException(`${code} is already assigned`);
  }

  private async findMetaInsight(
    tenantId: string,
    accountId: string,
    adId: string,
  ): Promise<Pick<CreativeMetaLinkInput, 'accountId' | 'adId' | 'adName'>> {
    const insight = await this.prisma.metaAdInsight.findFirst({
      where: {
        tenantId,
        accountId,
        adId,
      },
      select: { accountId: true, adId: true, adName: true },
      orderBy: { date: 'desc' },
    });
    if (!insight) throw new NotFoundException('The selected Meta ad was not found in this tenant');
    const linked = await this.prisma.creative.findFirst({
      where: { tenantId, metaAccountId: accountId, metaAdId: adId },
      select: { id: true },
    });
    if (linked) throw new ConflictException('This Meta ad is already linked to a creative');
    return insight;
  }

  private detailInclude() {
    return CREATIVE_DETAIL_INCLUDE;
  }

  private serializeCreative(creative: CreativeDetail) {
    return {
      ...creative,
      store: {
        id: creative.storeConfig.storeId,
        configId: creative.storeConfig.id,
        name: creative.storeConfig.storeNameSnapshot,
        shopId: creative.storeConfig.shopIdSnapshot,
        codePrefix: creative.storeConfig.codePrefix,
        active: creative.storeConfig.active,
      },
      creator: {
        id: creative.createdBy.id,
        name: [creative.createdBy.firstName, creative.createdBy.lastName].filter(Boolean).join(' ') || creative.createdBy.email,
        avatar: creative.createdBy.avatar,
      },
      aliases: creative.aliases.map((alias) => alias.alias),
      aliasRecords: creative.aliases,
      storeConfig: undefined,
      createdBy: undefined,
    };
  }
}
