import { Injectable } from '@nestjs/common';
import { isCodeSegment } from '../utils/ad-name-convention';
import { preferCanonicalMetaAdIdentity } from '../utils/meta-ad-identity';
import { PrismaService } from '../../../common/prisma/prisma.service';

export type MetaInsightLinkIdentity = {
  accountId: string;
  adId: string;
  adName: string;
};

type ResolvedMetaInsightLink = MetaInsightLinkIdentity & {
  matchedBy: 'CODE' | 'ALIAS';
};

function normalizeMatchKey(value: string): string {
  return value.trim().toUpperCase();
}

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
      const candidate = { ...insight, adName };
      identities.set(
        insight.adId,
        preferCanonicalMetaAdIdentity(identities.get(insight.adId), candidate),
      );
    }
    if (identities.size === 0) return 0;

    // Canonical codes always win. A tenant-approved alias is only considered
    // when there is no canonical code match: full-name aliases match exactly,
    // while code-shaped aliases must occupy a safe underscore-delimited code
    // segment. This prevents a generic word such as "sale" from linking an ad
    // merely because it appeared somewhere in the name.
    const candidateCodes = new Set<string>();
    const candidateAliases = new Set<string>();
    for (const insight of identities.values()) {
      const candidates = codeCandidatesFor(insight.adName).map(normalizeMatchKey);
      for (const candidate of candidates) candidateCodes.add(candidate);
      candidateAliases.add(normalizeMatchKey(insight.adName));
      for (const candidate of candidates.filter(isCodeSegment)) candidateAliases.add(candidate);
    }
    const creatives = await this.prisma.creative.findMany({
      where: {
        tenantId,
        OR: [
          { code: { in: [...candidateCodes] } },
          { aliases: { some: { normalizedAlias: { in: [...candidateAliases] } } } },
        ],
      },
      select: {
        id: true,
        code: true,
        metaAdId: true,
        aliases: { select: { normalizedAlias: true } },
      },
    });
    const creativeByCode = new Map(
      creatives.map((creative) => [normalizeMatchKey(creative.code), creative]),
    );
    const creativeByExactAlias = new Map<string, (typeof creatives)[number]>();
    const creativeByCodeAlias = new Map<string, (typeof creatives)[number]>();
    for (const creative of creatives) {
      for (const alias of creative.aliases) {
        creativeByExactAlias.set(alias.normalizedAlias, creative);
        if (isCodeSegment(alias.normalizedAlias)) {
          creativeByCodeAlias.set(alias.normalizedAlias, creative);
        }
      }
    }

    const matchesByCreative = new Map<string, ResolvedMetaInsightLink[]>();
    for (const identity of identities.values()) {
      const candidates = codeCandidatesFor(identity.adName).map(normalizeMatchKey);
      const canonicalMatch = candidates
        .map((candidate) => creativeByCode.get(candidate))
        .find((creative) => Boolean(creative));
      const exactAliasMatch = creativeByExactAlias.get(normalizeMatchKey(identity.adName));
      const codeAliasMatch = candidates
        .filter(isCodeSegment)
        .map((candidate) => creativeByCodeAlias.get(candidate))
        .find((creative) => Boolean(creative));
      const creative = canonicalMatch ?? exactAliasMatch ?? codeAliasMatch;
      if (!creative) continue;
      const current = matchesByCreative.get(creative.id) ?? [];
      current.push({
        ...identity,
        matchedBy: canonicalMatch ? 'CODE' : 'ALIAS',
      });
      matchesByCreative.set(creative.id, current);
    }

    let linked = 0;

    for (const creative of creatives) {
      const matches = (matchesByCreative.get(creative.id) ?? [])
        .sort((left, right) => left.adId.localeCompare(right.adId));
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
        const ownedLinks = await tx.creativeMetaAdLink.findMany({
          where: {
            tenantId,
            creativeId: creative.id,
            adId: { in: matches.map((match) => match.adId) },
          },
          select: { accountId: true, adId: true, adNameSnapshot: true },
          orderBy: { adId: 'asc' },
        });
        if (!creative.metaAdId && ownedLinks.length > 0) {
          const primary = ownedLinks[0];
          await tx.creative.updateMany({
            where: { id: creative.id, tenantId, metaAdId: null },
            data: {
              metaAccountId: primary.accountId,
              metaAdId: primary.adId,
              metaAdNameSnapshot: primary.adNameSnapshot,
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
                linkedAds: matches.map((match) => ({
                  accountId: match.accountId,
                  adId: match.adId,
                  adName: match.adName,
                  matchedBy: match.matchedBy,
                })),
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
