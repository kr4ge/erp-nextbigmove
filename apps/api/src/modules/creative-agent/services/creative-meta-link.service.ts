import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

export type MetaInsightLinkIdentity = {
  accountId: string;
  adId: string;
  adName: string;
};

@Injectable()
export class CreativeMetaLinkService {
  constructor(private readonly prisma: PrismaService) {}

  async reconcileInsights(tenantId: string, insights: MetaInsightLinkIdentity[]): Promise<number> {
    const identities = new Map<string, MetaInsightLinkIdentity>();
    for (const insight of insights) {
      const adName = insight.adName.trim();
      if (!adName) continue;
      identities.set(`${insight.accountId}:${insight.adId}`, { ...insight, adName });
    }
    if (identities.size === 0) return 0;

    const names = [...new Set([...identities.values()].map((insight) => insight.adName))];
    const creatives = await this.prisma.creative.findMany({
      where: { tenantId, code: { in: names } },
      select: { id: true, code: true, metaAdId: true },
    });
    let linked = 0;

    for (const creative of creatives) {
      const matches = [...identities.values()]
        .filter((identity) => identity.adName === creative.code)
        .sort((left, right) => `${left.accountId}:${left.adId}`.localeCompare(`${right.accountId}:${right.adId}`));
      if (matches.length === 0) continue;

      const created = await this.prisma.$transaction(async (tx) => {
        const result = await tx.creativeMetaAdLink.createMany({
          data: matches.map((match) => ({
            tenantId,
            creativeId: creative.id,
            accountId: match.accountId,
            adId: match.adId,
            adNameSnapshot: match.adName,
            source: 'AUTO_CODE' as const,
          })),
          skipDuplicates: true,
        });
        if (!creative.metaAdId) {
          const primary = matches[0];
          await tx.creative.updateMany({
            where: { id: creative.id, tenantId, metaAdId: null },
            data: {
              metaAccountId: primary.accountId,
              metaAdId: primary.adId,
              metaAdNameSnapshot: primary.adName,
              metaLinkSource: 'AUTO_CODE',
              metaLinkedAt: new Date(),
            },
          });
        }
        if (result.count > 0) {
          await tx.auditLog.create({
            data: {
              tenantId,
              action: 'creative.metaLink.auto',
              resource: 'Creative',
              resourceId: creative.id,
              changes: {
                linkedAds: matches.map((match) => ({ accountId: match.accountId, adId: match.adId, adName: match.adName })),
                count: result.count,
              },
            },
          });
        }
        return result.count;
      });
      linked += created;
    }

    return linked;
  }
}
