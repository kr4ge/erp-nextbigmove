import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
    const incomingAdNames = Array.from(new Set(insights.map((insight) => insight.adName)));
    if (incomingAdNames.length === 0) return 0;

    const creatives = await this.prisma.creative.findMany({
      where: {
        tenantId,
        metaAdId: null,
        code: { in: incomingAdNames },
      },
      select: { id: true, code: true },
    });
    let linked = 0;

    for (const creative of creatives) {
      const candidates = await this.prisma.metaAdInsight.findMany({
        where: {
          tenantId,
          adName: creative.code,
        },
        select: { accountId: true, adId: true, adName: true },
      });
      const identities = new Map(
        candidates.map((candidate) => [
          `${candidate.accountId}:${candidate.adId}`,
          candidate,
        ]),
      );

      // A reused code is ambiguous and must be resolved manually.
      if (identities.size !== 1) continue;
      const match = identities.values().next().value as MetaInsightLinkIdentity;

      try {
        const didLink = await this.prisma.$transaction(async (tx) => {
          const result = await tx.creative.updateMany({
            where: { id: creative.id, tenantId, metaAdId: null },
            data: {
              metaAccountId: match.accountId,
              metaAdId: match.adId,
              metaAdNameSnapshot: match.adName,
              metaLinkSource: 'AUTO_CODE',
              metaLinkedAt: new Date(),
            },
          });
          if (result.count === 0) return false;
          await tx.auditLog.create({
            data: {
              tenantId,
              action: 'creative.metaLink.auto',
              resource: 'Creative',
              resourceId: creative.id,
              changes: {
                accountId: match.accountId,
                adId: match.adId,
                adName: match.adName,
              },
            },
          });
          return true;
        });
        if (didLink) linked += 1;
      } catch (error) {
        // Another sync may have linked either side first. The database unique
        // constraint is the final authority for the one-to-one relationship.
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
          throw error;
        }
      }
    }

    return linked;
  }
}
