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
import { CreativeThumbnailService } from './creative-thumbnail.service';

const CREATIVE_DETAIL_INCLUDE = {
  storeConfig: { select: { id: true, storeId: true, storeNameSnapshot: true, shopIdSnapshot: true, codePrefix: true, active: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
  aliases: { select: { id: true, alias: true, createdAt: true }, orderBy: { createdAt: 'asc' as const } },
  metaAdLinks: {
    select: { id: true, accountId: true, adId: true, adNameSnapshot: true, source: true, linkedAt: true },
    orderBy: { linkedAt: 'asc' as const },
  },
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
    private readonly thumbnails: CreativeThumbnailService,
  ) {}

  async enroll(actor: CreativeActor, dto: EnrollCreativeDto) {
    const context = await this.access.resolve(actor);
    this.access.require(context, CREATIVE_AGENT_PERMISSIONS.ENROLL);
    const config = await this.getActiveStoreConfig(context.tenantId, dto.storeId);
    const item = await this.resolveStoreItem(context.tenantId, dto.storeId, dto.variationId);

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
        return await this.createCreative(context.tenantId, context.userId, config, dto, codeNumber, undefined, undefined, item);
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

    // Refresh the cached cover after the write commits. Capture is best-effort
    // and never blocks the save: a creative without a thumbnail still works.
    if (dto.mediaUrl !== undefined) {
      if (dto.mediaUrl) {
        await this.thumbnails.captureForCreative(updated.id, context.tenantId, dto.mediaUrl);
      } else {
        await this.thumbnails.clearForCreative(updated.id, context.tenantId);
      }
      return this.serializeCreative(await this.prisma.creative.findFirstOrThrow({
        where: { id: updated.id, tenantId: context.tenantId },
        include: this.detailInclude(),
      }));
    }
    return this.serializeCreative(updated);
  }

  private async getActiveStoreConfig(tenantId: string, storeId: string) {
    return this.stores.getOrCreateActiveConfig(tenantId, storeId);
  }

  /**
   * The items a store sells, for the enrollment dropdown. The name is what the
   * user reads; the customId is what the generated ad name carries — it is the
   * partner's own Pancake identifier, set before the store was synced.
   */
  async listStoreItems(actor: CreativeActor, storeId: string) {
    const context = await this.access.resolve(actor);
    this.access.require(context, CREATIVE_AGENT_PERMISSIONS.ENROLL);
    const products = await this.prisma.posProduct.findMany({
      where: {
        // PosProduct has no tenant column; the boundary rides on the store.
        store: { is: { tenantId: context.tenantId } },
        storeId,
        variationId: { not: null },
        customId: { not: null },
      },
      select: { variationId: true, customId: true, name: true },
      orderBy: { name: 'asc' },
    });
    return {
      items: products
        .filter((product) => product.variationId && product.customId?.trim())
        .map((product) => ({
          variationId: product.variationId!,
          customId: product.customId!.trim(),
          name: product.name,
        })),
    };
  }

  private async resolveStoreItem(tenantId: string, storeId: string, variationId: string) {
    const product = await this.prisma.posProduct.findFirst({
      where: { store: { is: { tenantId } }, storeId, variationId },
      select: { variationId: true, customId: true, name: true },
    });
    if (!product) {
      throw new ConflictException('The selected item does not belong to this store');
    }
    if (!product.customId?.trim()) {
      throw new ConflictException(
        'This item has no custom ID in Pancake, so an ad name cannot be generated for it',
      );
    }
    return { variationId, customId: product.customId.trim(), name: product.name };
  }

  private async createCreative(
    tenantId: string,
    userId: string,
    config: { id: string; codePrefix: string },
    dto: EnrollCreativeDto,
    codeNumber: number,
    requestedCode?: string,
    metaLink?: CreativeMetaLinkInput,
    item?: { variationId: string; customId: string; name: string },
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
          posVariationId: item?.variationId ?? null,
          posCustomId: item?.customId ?? null,
          posProductName: item?.name ?? null,
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
                metaAdLinks: {
                  create: {
                    tenantId,
                    accountId: metaLink.accountId,
                    adId: metaLink.adId,
                    adNameSnapshot: metaLink.adName,
                    source: metaLink.source,
                    linkedById: metaLink.linkedById,
                    linkedAt: now,
                  },
                },
              }
            : {}),
        },
        include: this.detailInclude(),
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

    // Best-effort cover capture for a newly registered creative.
    if (dto.mediaUrl) {
      await this.thumbnails.captureForCreative(creative.id, tenantId, dto.mediaUrl);
      return this.serializeCreative(await this.prisma.creative.findFirstOrThrow({
        where: { id: creative.id, tenantId },
        include: this.detailInclude(),
      }));
    }
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
    const linked = await this.prisma.creativeMetaAdLink.findFirst({
      where: { tenantId, accountId, adId },
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
