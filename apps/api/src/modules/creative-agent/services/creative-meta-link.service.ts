import { Injectable } from '@nestjs/common';
import { isCodeSegment } from '../utils/ad-name-convention';
import { PrismaService } from '../../../common/prisma/prisma.service';

export type MetaInsightLinkIdentity = {
  accountId: string;
  adId: string;
  adName: string;
};

/**
 * The code forms an ad name may legitimately carry.
 *
 * Three shapes link: the whole trimmed name (bare code), the final segment
 * (legacy copy format `title_creator_CODE`), and any underscore-delimited
 * segment that IS a code — which is how the new
 * `customId_title_CODE_creator` convention carries it mid-name. Matching
 * stays segment-exact: a code mentioned in prose has no underscore boundary
 * around it, so `promo NRO-V0041 retest` still never links.
 */
export function codeCandidatesFor(adName: string): string[] {
  const trimmed = adName.trim();
  if (!trimmed) return [];
  const candidates = new Set<string>([trimmed]);
  const segments = trimmed.split('_').map((segment) => segment.trim());
  const last = segments[segments.length - 1];
  if (last && last !== trimmed) candidates.add(last);
  for (const segment of segments) {
    if (segment && isCodeSegment(segment)) candidates.add(segment);
  }
  return Array.from(candidates);
}

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

    // An ad name is either the bare code, or the paste-ready form the Assets
    // copy button produces: `title_creator_CODE`. The code is always the LAST
    // underscore-delimited segment, so only that segment is ever treated as a
    // code — the readable parts in front are free text and never matched on.
    const candidateCodes = new Set<string>();
    for (const insight of identities.values()) {
      for (const candidate of codeCandidatesFor(insight.adName)) candidateCodes.add(candidate);
    }
    const creatives = await this.prisma.creative.findMany({
      where: { tenantId, code: { in: [...candidateCodes] } },
      select: { id: true, code: true, metaAdId: true },
    });
    let linked = 0;

    for (const creative of creatives) {
      const matches = [...identities.values()]
        .filter((identity) => codeCandidatesFor(identity.adName).includes(creative.code))
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
