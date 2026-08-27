import { Injectable } from '@nestjs/common';
import {
  deriveAssociateFromAdName,
  deriveMappingFromAdName,
} from '../../creative-agent/utils/ad-name-convention';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { CreativeMetaLinkService } from '../../creative-agent/services/creative-meta-link.service';
import type { MetaInsightLinkIdentity } from '../../creative-agent/services/creative-meta-link.service';

interface MetaInsightData {
  accountId: string;
  campaignId: string;
  campaignName: string;
  adsetId: string;
  adId: string;
  adName: string;
  date: string; // YYYY-MM-DD
  spend: number;
  clicks?: number;
  linkClicks?: number;
  impressions?: number;
  leads?: number;
  videoPlays3s?: number | null;
  thruPlays?: number | null;
  frequency?: number | null;
  videoAveragePlayTime?: number | null;
  videoPlays25?: number | null;
  videoPlays50?: number | null;
  videoPlays75?: number | null;
  videoPlays95?: number | null;
  videoPlays100?: number | null;
  status?: string;
  dateCreated?: string;
  mapping?: string | null;
}

@Injectable()
export class MetaInsightService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly creativeMetaLinks: CreativeMetaLinkService,
  ) {}

  /**
   * Extract marketing associate from ad name pattern
   * Matches Laravel logic: EVIL EYE_UGC_1001_ALY_001 => ALY (4th token, index 3)
   */
  private extractMarketingAssociate(adName: string): string | null {
    if (!adName) return null;

    // New-convention names declare the creator explicitly; only legacy names
    // fall through to the positional token guess below.
    const declared = deriveAssociateFromAdName(adName);
    if (declared) return declared;

    const parts = adName.split('_');
    // Match example: EVIL EYE_UGC_1001_ALY_001 => ALY (4th token, index 3)
    if (parts.length >= 4) {
      const candidate = parts[3].trim();
      return candidate !== '' ? candidate : null;
    }

    return null;
  }

  /**
   * Extract team code from ad name (token before marketing associate).
   * Example: EVIL EYE_UGC_1001_ALY_001 => team code = 1001 (3rd token, index 2)
   */
  private extractTeamCode(adName: string): string | null {
    if (!adName) return null;
    const parts = adName.split('_');
    if (parts.length >= 3) {
      const candidate = parts[2].trim();
      return candidate !== '' ? candidate : null;
    }
    return null;
  }

  /**
   * Parse Meta API insight data into our schema
   */
  private extractMappingFromCampaign(campaignName?: string | null): string | null {
    if (!campaignName) return null;
    const tokens = campaignName
      .split('_')
      .map((t: string) => t.trim())
      .filter((t: string) => t.length > 0);
    // Take 5th token (index 4) if present
    if (tokens.length >= 5) {
      const token = tokens[4];
      return token ? token.toLowerCase() : null;
    }
    return null;
  }

  private parseOptionalMetric(
    rawInsight: Record<string, unknown>,
    field: string,
    integer: boolean,
  ): number | null | undefined {
    if (!Object.prototype.hasOwnProperty.call(rawInsight, field)) return undefined;
    const rawValue = rawInsight[field];
    if (rawValue === null || rawValue === undefined || rawValue === '') return null;
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed < 0 || (integer && !Number.isInteger(parsed))) {
      return null;
    }
    return parsed;
  }

  private parseMetaInsight(rawInsight: any, accountId: string, multiplier = 1): MetaInsightData {
    // Extract leads from actions array (landing_page_view)
    let leads = 0;
    if (rawInsight.actions && Array.isArray(rawInsight.actions)) {
      const landingPageView = rawInsight.actions.find(
        (action: any) => action.action_type === 'landing_page_view',
      );
      if (landingPageView) {
        leads = parseInt(landingPageView.value || '0', 10);
      }
    }

    return {
      accountId,
      campaignId: rawInsight.campaign_id,
      campaignName: rawInsight.campaign_name || '',
      adsetId: rawInsight.adset_id,
      adId: rawInsight.ad_id,
      adName: rawInsight.ad_name || '',
      date: rawInsight.date_start,
      spend: parseFloat(rawInsight.spend || '0') * (Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1),
      clicks: parseInt(rawInsight.clicks || '0', 10),
      linkClicks: parseInt(rawInsight.inline_link_clicks || '0', 10),
      impressions: parseInt(rawInsight.impressions || '0', 10),
      leads,
      videoPlays3s: this.parseOptionalMetric(rawInsight, 'video_plays_3s', true),
      thruPlays: this.parseOptionalMetric(rawInsight, 'thru_plays', true),
      frequency: this.parseOptionalMetric(rawInsight, 'frequency', false),
      videoAveragePlayTime: this.parseOptionalMetric(rawInsight, 'video_average_play_time', false),
      videoPlays25: this.parseOptionalMetric(rawInsight, 'video_plays_25', true),
      videoPlays50: this.parseOptionalMetric(rawInsight, 'video_plays_50', true),
      videoPlays75: this.parseOptionalMetric(rawInsight, 'video_plays_75', true),
      videoPlays95: this.parseOptionalMetric(rawInsight, 'video_plays_95', true),
      videoPlays100: this.parseOptionalMetric(rawInsight, 'video_plays_100', true),
      status: rawInsight.status,
      dateCreated: rawInsight.created_time,
      // Campaign-name parsing is the legacy source; a new-convention ad name
      // declares its mapping directly and wins nothing by depending on how the
      // campaign happens to be named.
      mapping:
        deriveMappingFromAdName(rawInsight.ad_name)
        ?? this.extractMappingFromCampaign(rawInsight.campaign_name),
    };
  }

  /**
   * Upsert Meta ad insights to database
   * Uses upsert pattern to handle re-running workflows for same dates
   */
  async upsertMetaInsights(
    tenantId: string,
    accountId: string,
    rawInsights: any[],
    teamId: string | null,
    multiplier = 1,
  ): Promise<number> {
    let upserted = 0;
    const persistedInsights = new Map<string, MetaInsightLinkIdentity>();

    for (const rawInsight of rawInsights) {
      const insight = this.parseMetaInsight(rawInsight, accountId, multiplier);

      // Only persist insights with spend > 0
      if (!Number.isFinite(insight.spend) || insight.spend <= 0) {
        continue;
      }

      await this.prisma.metaAdInsight.upsert({
        where: {
          tenantId_accountId_adId_date: {
            tenantId,
            accountId: insight.accountId,
            adId: insight.adId,
            date: new Date(insight.date),
          },
        },
        create: {
          tenantId,
          teamId,
          accountId: insight.accountId,
          campaignId: insight.campaignId,
          campaignName: insight.campaignName,
          adsetId: insight.adsetId,
          adId: insight.adId,
          adName: insight.adName,
          teamCode: this.extractTeamCode(insight.adName),
          date: new Date(insight.date),
          dateCreated: insight.dateCreated,
          marketingAssociate: this.extractMarketingAssociate(insight.adName),
          mapping: insight.mapping || null,
          spend: new Decimal(insight.spend),
          clicks: insight.clicks || 0,
          linkClicks: insight.linkClicks || 0,
          impressions: insight.impressions || 0,
          leads: insight.leads || 0,
          videoPlays3s: insight.videoPlays3s ?? null,
          thruPlays: insight.thruPlays ?? null,
          frequency: insight.frequency === undefined || insight.frequency === null
            ? null
            : new Decimal(insight.frequency),
          videoAveragePlayTime: insight.videoAveragePlayTime === undefined || insight.videoAveragePlayTime === null
            ? null
            : new Decimal(insight.videoAveragePlayTime),
          videoPlays25: insight.videoPlays25 ?? null,
          videoPlays50: insight.videoPlays50 ?? null,
          videoPlays75: insight.videoPlays75 ?? null,
          videoPlays95: insight.videoPlays95 ?? null,
          videoPlays100: insight.videoPlays100 ?? null,
          status: insight.status,
        },
        update: {
          campaignName: insight.campaignName,
          adName: insight.adName,
          teamCode: this.extractTeamCode(insight.adName),
          marketingAssociate: this.extractMarketingAssociate(insight.adName),
          mapping: insight.mapping || null,
          spend: new Decimal(insight.spend),
          clicks: insight.clicks || 0,
          linkClicks: insight.linkClicks || 0,
          impressions: insight.impressions || 0,
          leads: insight.leads || 0,
          ...(insight.videoPlays3s !== undefined ? { videoPlays3s: insight.videoPlays3s } : {}),
          ...(insight.thruPlays !== undefined ? { thruPlays: insight.thruPlays } : {}),
          ...(insight.frequency !== undefined
            ? { frequency: insight.frequency === null ? null : new Decimal(insight.frequency) }
            : {}),
          ...(insight.videoAveragePlayTime !== undefined
            ? {
                videoAveragePlayTime: insight.videoAveragePlayTime === null
                  ? null
                  : new Decimal(insight.videoAveragePlayTime),
              }
            : {}),
          ...(insight.videoPlays25 !== undefined ? { videoPlays25: insight.videoPlays25 } : {}),
          ...(insight.videoPlays50 !== undefined ? { videoPlays50: insight.videoPlays50 } : {}),
          ...(insight.videoPlays75 !== undefined ? { videoPlays75: insight.videoPlays75 } : {}),
          ...(insight.videoPlays95 !== undefined ? { videoPlays95: insight.videoPlays95 } : {}),
          ...(insight.videoPlays100 !== undefined ? { videoPlays100: insight.videoPlays100 } : {}),
          status: insight.status,
          teamId,
        },
      });

      persistedInsights.set(`${insight.accountId}:${insight.adId}`, {
        accountId: insight.accountId,
        adId: insight.adId,
        adName: insight.adName,
      });
      upserted++;
    }

    await this.creativeMetaLinks.reconcileInsights(
      tenantId,
      Array.from(persistedInsights.values()),
    );

    return upserted;
  }

  /**
   * Update ad status for existing insights
   * Used for backfilling ad status from current state
   */
  async updateAdStatus(
    tenantId: string,
    adId: string,
    status: string,
  ): Promise<number> {
    const result = await this.prisma.metaAdInsight.updateMany({
      where: {
        tenantId,
        adId,
      },
      data: {
        status,
      },
    });

    return result.count;
  }

  /**
   * Backfill teamId for existing insights based on ad account assignments
   */
  async backfillTeamIdsForAccounts(
    accounts: { tenantId: string; accountId: string; teamId: string | null }[],
  ): Promise<void> {
    for (const account of accounts) {
      if (!account.teamId) continue;
      await this.prisma.metaAdInsight.updateMany({
        where: { tenantId: account.tenantId, accountId: account.accountId, teamId: null },
        data: { teamId: account.teamId },
      });
    }
  }

  /**
   * Get insights for a specific date range
   */
  async getInsights(
    tenantId: string,
    accountId?: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<any[]> {
    const where: any = { tenantId };

    if (accountId) {
      where.accountId = accountId;
    }

    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) where.date.lte = new Date(dateTo);
    }

    return this.prisma.metaAdInsight.findMany({
      where,
      orderBy: [{ date: 'desc' }, { spend: 'desc' }],
    });
  }
}
