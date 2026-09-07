import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { deriveLegacyEmployeeIdFromAdName } from '../utils/ad-name-convention';

export type CreativeCreatorIdentity = {
  id: string;
  employeeId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
};

export type LegacyCreativeAttribution = {
  adId: string;
  accountId: string | null;
  adName: string | null;
  campaignName: string | null;
  creator: CreativeCreatorIdentity;
};

type ResolveLegacyAdsInput = {
  tenantId: string;
  creatorIds: string[];
  start: Date;
  end: Date;
  storeIds?: string[];
};

const normalizeIdentity = (value: string | null | undefined) =>
  (value ?? '').trim().toLowerCase();

/**
 * Resolves pre-registry Meta ads to their original creator without changing
 * the registry link model. Explicit CreativeMetaAdLink ownership always wins;
 * employee-ID attribution is only a fallback for otherwise-unlinked ad IDs.
 */
@Injectable()
export class CreativeLegacyAttributionService {
  constructor(private readonly prisma: PrismaService) {}

  async listCreatorIdentities(tenantId: string): Promise<CreativeCreatorIdentity[]> {
    return this.prisma.user.findMany({
      where: {
        OR: [
          { creativesCreated: { some: { tenantId } } },
          {
            userRoleAssignments: {
              some: {
                tenantId,
                workspace: 'ERP',
                role: { key: 'CREATIVE_MAKER' },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        email: true,
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }, { email: 'asc' }],
    });
  }

  async resolveLegacyAds(input: ResolveLegacyAdsInput): Promise<LegacyCreativeAttribution[]> {
    if (input.creatorIds.length === 0) return [];

    const creators = await this.prisma.user.findMany({
      where: {
        id: { in: input.creatorIds },
        employeeId: { not: null },
        OR: [
          { tenantId: input.tenantId },
          { tenantMemberships: { some: { tenantId: input.tenantId, status: 'ACTIVE' } } },
        ],
      },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    });
    const creatorsByEmployeeId = new Map<string, CreativeCreatorIdentity>();
    for (const creator of creators) {
      const key = normalizeIdentity(creator.employeeId);
      if (key && !creatorsByEmployeeId.has(key)) creatorsByEmployeeId.set(key, creator);
    }
    if (creatorsByEmployeeId.size === 0) return [];

    const storeShopIds = input.storeIds?.length
      ? new Set((await this.prisma.posStore.findMany({
          where: { tenantId: input.tenantId, id: { in: input.storeIds } },
          select: { shopId: true },
        })).map((store) => store.shopId))
      : null;
    if (storeShopIds && storeShopIds.size === 0) return [];

    const rows = await this.prisma.reconcileMarketing.findMany({
      where: {
        tenantId: input.tenantId,
        date: { gte: input.start, lte: input.end },
        OR: [...creatorsByEmployeeId.keys()].flatMap((employeeId) => [
          { marketingAssociate: { equals: employeeId, mode: 'insensitive' as const } },
          // Historical reconciliations may predate marketingAssociate storage.
          // The broad DB predicate is verified by exact positional parsing
          // below before an ad can be attributed.
          { adName: { contains: `_${employeeId}_`, mode: 'insensitive' as const } },
        ]),
      },
      select: {
        adId: true,
        accountId: true,
        adName: true,
        campaignName: true,
        marketingAssociate: true,
        shops: true,
      },
    });

    const candidates = new Map<string, LegacyCreativeAttribution>();
    for (const row of rows) {
      const employeeId = row.marketingAssociate
        || deriveLegacyEmployeeIdFromAdName(row.adName);
      const creator = creatorsByEmployeeId.get(normalizeIdentity(employeeId));
      if (!creator || !row.adId) continue;
      if (storeShopIds && !this.intersectsShops(row.shops, storeShopIds)) continue;
      if (!candidates.has(row.adId)) {
        candidates.set(row.adId, {
          adId: row.adId,
          accountId: row.accountId,
          adName: row.adName,
          campaignName: row.campaignName,
          creator,
        });
      }
    }
    if (candidates.size === 0) return [];

    const [explicitLinks, legacySingleLinks] = await Promise.all([
      this.prisma.creativeMetaAdLink.findMany({
        where: { tenantId: input.tenantId, adId: { in: [...candidates.keys()] } },
        select: { adId: true },
      }),
      this.prisma.creative.findMany({
        where: { tenantId: input.tenantId, metaAdId: { in: [...candidates.keys()] } },
        select: { metaAdId: true },
      }),
    ]);
    for (const link of explicitLinks) candidates.delete(link.adId);
    for (const link of legacySingleLinks) {
      if (link.metaAdId) candidates.delete(link.metaAdId);
    }

    return [...candidates.values()];
  }

  private intersectsShops(value: Prisma.JsonValue, allowedShopIds: Set<string>): boolean {
    if (!Array.isArray(value)) return false;
    return value.some((shopId) => typeof shopId === 'string' && allowedShopIds.has(shopId));
  }
}
