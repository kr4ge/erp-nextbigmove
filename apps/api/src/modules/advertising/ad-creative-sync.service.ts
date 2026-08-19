import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TeamContextService } from '../../common/services/team-context.service';
import { IntegrationService } from '../integrations/integration.service';
import { fetchAdCreatives, type MetaAdCreative } from './meta-creative-client';

/**
 * Pulls the creative behind each ad from Meta.
 *
 * The spend still arrives by CSV — that path works and is not disturbed here.
 * This asks Meta only one question, about ads the CSV has already told us ran:
 * what did they look like?
 *
 * That makes the mapping exact. Meta knows which creative an ad carries, so the
 * link is id to id, and nothing depends on a code being typed correctly into an
 * ad name.
 */
@Injectable()
export class AdCreativeSyncService {
  private readonly logger = new Logger(AdCreativeSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly teamContext: TeamContextService,
    private readonly integrations: IntegrationService,
  ) {}

  /**
   * Sync creatives for every ad seen in the period.
   *
   * Returns what it found and what it could not, because a sync that quietly
   * covers 60% of the ads is worse than one that says so.
   */
  async sync(params: { startDate: string; endDate: string }) {
    const context = await this.teamContext.getContext();
    const { tenantId } = context;

    const integration = await this.prisma.integration.findFirst({
      where: { tenantId, provider: 'META_ADS', status: 'ACTIVE' },
      select: { id: true, config: true },
    });
    if (!integration) {
      throw new NotFoundException(
        'No active Meta integration. Connect one before syncing creatives.',
      );
    }

    // The ads the CSV already brought in for this period.
    const rows = await this.prisma.reconcileMarketing.findMany({
      where: {
        tenantId,
        date: { gte: new Date(params.startDate), lte: new Date(params.endDate) },
      },
      select: { adId: true },
      distinct: ['adId'],
    });

    const adIds = rows.map((row) => row.adId).filter(Boolean);
    if (!adIds.length) {
      return { adsConsidered: 0, creativesFound: 0, adsWithoutCreative: 0 };
    }

    let accessToken: string;
    try {
      const credentials = await this.integrations.getDecryptedCredentials(integration.id, tenantId);
      accessToken = String((credentials as any)?.accessToken || '').trim();
    } catch (error) {
      // An unreadable credential is a setup problem, not a server fault. Saying
      // so is the difference between reconnecting the integration and filing a
      // bug against this endpoint.
      this.logger.warn(`Meta credentials unreadable for tenant ${tenantId}: ${error.message}`);
      throw new BadRequestException(
        'The Meta integration credentials could not be read. Reconnect the integration and try again.',
      );
    }

    if (!accessToken) {
      throw new BadRequestException('This Meta integration has no access token.');
    }

    let byAd: Record<string, MetaAdCreative>;
    try {
      byAd = await fetchAdCreatives(accessToken, adIds, (message) => this.logger.warn(message));
    } catch (error) {
      // Meta refusing us is worth naming plainly — an expired token and a rate
      // limit call for different actions, and neither is fixed by retrying here.
      this.logger.warn(`Meta creative fetch failed for tenant ${tenantId}: ${error.message}`);
      throw new BadRequestException(`Meta refused the request: ${error.message}`);
    }

    // One creative usually runs in several ads, so collapse before writing.
    const grouped = new Map<string, { creative: MetaAdCreative; adIds: string[] }>();
    for (const [adId, creative] of Object.entries(byAd)) {
      const existing = grouped.get(creative.creativeId);
      if (existing) existing.adIds.push(adId);
      else grouped.set(creative.creativeId, { creative, adIds: [adId] });
    }

    for (const { creative, adIds: creativeAdIds } of grouped.values()) {
      const existing = await this.prisma.adCreative.findUnique({
        where: { tenantId_metaCreativeId: { tenantId, metaCreativeId: creative.creativeId } },
        select: { adIds: true },
      });

      // Ads accumulate: a creative that ran last month and again this month
      // should not lose the older ad when a narrow period is synced.
      const mergedAdIds = Array.from(new Set([...(existing?.adIds ?? []), ...creativeAdIds]));

      await this.prisma.adCreative.upsert({
        where: { tenantId_metaCreativeId: { tenantId, metaCreativeId: creative.creativeId } },
        create: {
          tenantId,
          metaCreativeId: creative.creativeId,
          name: creative.name,
          thumbnailUrl: creative.thumbnailUrl,
          imageUrl: creative.imageUrl,
          videoId: creative.videoId,
          title: creative.title,
          body: creative.body,
          adIds: mergedAdIds,
        },
        update: {
          name: creative.name,
          thumbnailUrl: creative.thumbnailUrl,
          imageUrl: creative.imageUrl,
          videoId: creative.videoId,
          title: creative.title,
          body: creative.body,
          adIds: mergedAdIds,
          lastSyncedAt: new Date(),
        },
      });
    }

    const found = Object.keys(byAd).length;
    this.logger.log(`Synced ${grouped.size} creatives across ${found} of ${adIds.length} ads`);

    return {
      adsConsidered: adIds.length,
      creativesFound: grouped.size,
      adsWithoutCreative: adIds.length - found,
    };
  }
}
