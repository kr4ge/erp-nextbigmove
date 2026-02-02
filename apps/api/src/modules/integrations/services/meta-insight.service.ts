import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

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
  status?: string;
  dateCreated?: string;
  mapping?: string | null;
}

@Injectable()
export class MetaInsightService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Extract marketing associate from ad name pattern
   * Matches Laravel logic: EVIL EYE_UGC_1001_ALY_001 => ALY (4th token, index 3)
   */
  private extractMarketingAssociate(adName: string): string | null {
    if (!adName) return null;

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
      status: rawInsight.status,
      dateCreated: rawInsight.created_time,
      mapping: this.extractMappingFromCampaign(rawInsight.campaign_name),
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
          status: insight.status,
          teamId,
        },
      });

      upserted++;
    }

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
