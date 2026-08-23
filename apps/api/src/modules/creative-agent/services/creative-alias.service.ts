import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CREATIVE_AGENT_PERMISSIONS, CREATIVE_CODE_REGEX } from '../creative-agent.constants';
import { CreateCreativeAliasDto, LinkUnregisteredCreativeDto } from '../dto/creative-alias.dto';
import type { CreativeActor } from '../types/creative-actor.type';
import { CreativeAccessService } from './creative-access.service';

@Injectable()
export class CreativeAliasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CreativeAccessService,
  ) {}

  async create(actor: CreativeActor, creativeId: string, dto: CreateCreativeAliasDto) {
    const context = await this.access.resolve(actor);
    this.access.require(context, CREATIVE_AGENT_PERMISSIONS.ALIAS_MANAGE);
    return this.createAlias(context.tenantId, context.userId, creativeId, dto.alias);
  }

  async linkUnregistered(actor: CreativeActor, dto: LinkUnregisteredCreativeDto) {
    const context = await this.access.resolve(actor);
    this.access.require(context, CREATIVE_AGENT_PERMISSIONS.ALIAS_MANAGE);
    const metaInsight = await this.prisma.metaAdInsight.findFirst({
      where: {
        tenantId: context.tenantId,
        accountId: dto.accountId,
        adId: dto.adId,
      },
      select: { accountId: true, adId: true, adName: true },
      orderBy: { date: 'desc' },
    });
    if (!metaInsight) throw new NotFoundException('The selected Meta ad is not present in this tenant');

    const normalizedAlias = dto.alias.trim().toUpperCase();
    const isCode = /^[A-Z]{2,6}-V\d{3,6}$/.test(normalizedAlias);
    const metaMatchesAlias = isCode
      ? Array.from(metaInsight.adName.toUpperCase().matchAll(new RegExp(CREATIVE_CODE_REGEX.source, 'gi')))
        .some((match) => match[1]?.toUpperCase() === normalizedAlias)
      : metaInsight.adName.trim().toUpperCase() === normalizedAlias;
    if (!metaMatchesAlias) {
      throw new NotFoundException('The alias is not present in the selected Meta ad name');
    }

    return this.createManualMetaLink(
      context.tenantId,
      context.userId,
      dto.creativeId,
      dto.alias,
      metaInsight,
    );
  }

  async remove(actor: CreativeActor, creativeId: string, aliasId: string) {
    const context = await this.access.resolve(actor);
    this.access.require(context, CREATIVE_AGENT_PERMISSIONS.ALIAS_MANAGE);
    const alias = await this.prisma.creativeAlias.findFirst({
      where: { id: aliasId, creativeId, tenantId: context.tenantId },
      include: {
        creative: {
          select: {
            metaLinkSource: true,
            metaAdNameSnapshot: true,
          },
        },
      },
    });
    if (!alias) throw new NotFoundException('Creative alias not found');
    const aliasCodes = Array.from(alias.normalizedAlias.matchAll(new RegExp(CREATIVE_CODE_REGEX.source, 'gi')))
      .map((match) => match[1]?.toUpperCase())
      .filter((value): value is string => Boolean(value));
    const linkedNameCodes = alias.creative.metaAdNameSnapshot
      ? Array.from(alias.creative.metaAdNameSnapshot.toUpperCase().matchAll(new RegExp(CREATIVE_CODE_REGEX.source, 'gi')))
        .map((match) => match[1]?.toUpperCase())
        .filter((value): value is string => Boolean(value))
      : [];
    const aliasMatchesSnapshot = alias.creative.metaAdNameSnapshot?.trim().toUpperCase()
      === alias.normalizedAlias;
    const clearsManualLink = alias.creative.metaLinkSource === 'MANUAL'
      && (
        aliasMatchesSnapshot
        || aliasCodes.some((code) => linkedNameCodes.includes(code))
      );

    await this.prisma.$transaction(async (tx) => {
      await tx.creativeAlias.delete({ where: { id: alias.id } });
      if (clearsManualLink) {
        await tx.creative.update({
          where: { id: creativeId },
          data: {
            metaAccountId: null,
            metaAdId: null,
            metaAdNameSnapshot: null,
            metaLinkSource: null,
            metaLinkedAt: null,
            metaLinkedById: null,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          tenantId: context.tenantId,
          userId: context.userId,
          action: 'creativeAlias.remove',
          resource: 'CreativeAlias',
          resourceId: alias.id,
          changes: { creativeId, alias: alias.alias, clearedMetaLink: clearsManualLink },
        },
      });
    });
    return { removed: true, id: alias.id };
  }

  private async createManualMetaLink(
    tenantId: string,
    userId: string,
    creativeId: string,
    rawAlias: string,
    metaInsight: { accountId: string; adId: string; adName: string },
  ) {
    const alias = rawAlias.trim();
    const normalizedAlias = alias.toUpperCase();
    const creative = await this.prisma.creative.findFirst({
      where: { id: creativeId, tenantId },
    });
    if (!creative) throw new NotFoundException('Creative not found');
    if (creative.metaAdId) {
      throw new ConflictException('This registry video is already linked to a Meta ad');
    }
    if (creative.code === normalizedAlias) {
      throw new ConflictException('The alias is already the canonical creative code');
    }

    const canonicalConflict = await this.prisma.creative.findFirst({
      where: { tenantId, code: normalizedAlias },
      select: { id: true },
    });
    if (canonicalConflict) throw new ConflictException(`${normalizedAlias} is already a canonical creative code`);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const linked = await tx.creative.updateMany({
          where: { id: creative.id, tenantId, metaAdId: null },
          data: {
            metaAccountId: metaInsight.accountId,
            metaAdId: metaInsight.adId,
            metaAdNameSnapshot: metaInsight.adName,
            metaLinkSource: 'MANUAL',
            metaLinkedAt: new Date(),
            metaLinkedById: userId,
          },
        });
        if (linked.count === 0) {
          throw new ConflictException('This registry video is already linked to a Meta ad');
        }
        const created = await tx.creativeAlias.create({
          data: { tenantId, creativeId, alias, normalizedAlias, createdById: userId },
        });
        await tx.auditLog.create({
          data: {
            tenantId,
            userId,
            action: 'creative.metaLink.manual',
            resource: 'Creative',
            resourceId: creativeId,
            changes: {
              accountId: metaInsight.accountId,
              adId: metaInsight.adId,
              adName: metaInsight.adName,
              alias,
            },
          },
        });
        return created;
      });
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('This Meta ad or alias is already linked to a creative');
      }
      throw error;
    }
  }

  private async createAlias(tenantId: string, userId: string, creativeId: string, rawAlias: string) {
    const alias = rawAlias.trim();
    const normalizedAlias = alias.toUpperCase();
    const creative = await this.prisma.creative.findFirst({
      where: { id: creativeId, tenantId },
      include: { storeConfig: { select: { codePrefix: true } } },
    });
    if (!creative) throw new NotFoundException('Creative not found');
    if (creative.code === normalizedAlias) throw new ConflictException('The alias is already the canonical creative code');

    const detectedCodes = Array.from(normalizedAlias.matchAll(new RegExp(CREATIVE_CODE_REGEX.source, 'gi')))
      .map((match) => match[1]?.toUpperCase())
      .filter((value): value is string => Boolean(value));
    if (detectedCodes.some((code) => !code.startsWith(`${creative.storeConfig.codePrefix}-V`))) {
      throw new ConflictException('A code-shaped alias must use the creative store prefix');
    }

    const canonicalConflict = await this.prisma.creative.findFirst({
      where: { tenantId, code: normalizedAlias },
      select: { id: true },
    });
    if (canonicalConflict) throw new ConflictException(`${normalizedAlias} is already a canonical creative code`);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.creativeAlias.create({
          data: { tenantId, creativeId, alias, normalizedAlias, createdById: userId },
        });
        await tx.auditLog.create({
          data: {
            tenantId,
            userId,
            action: 'creativeAlias.create',
            resource: 'CreativeAlias',
            resourceId: created.id,
            changes: { creativeId, alias },
          },
        });
        return created;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`${normalizedAlias} is already linked to a creative`);
      }
      throw error;
    }
  }
}
