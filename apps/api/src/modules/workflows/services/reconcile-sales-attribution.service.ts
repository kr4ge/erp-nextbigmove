import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../../../common/prisma/prisma.service';

type NumericFields = {
  spend: number;
  clicks: number;
  linkClicks: number;
  impressions: number;
  leads: number;
  purchasesPos: number;
  processedPurchasesPos: number;
  confirmedCount: number;
  unconfirmedCount: number;
  printedCount: number;
  deletedCount: number;
  abandonedCount: number;
  waitingPickupCount: number;
  shippedCount: number;
  deliveredCount: number;
  canceledCount: number;
  rtsCount: number;
  restockingCount: number;
  codPos: number;
  deliveredCodPos: number;
  shippedCodPos: number;
  waitingPickupCodPos: number;
  rtsCodPos: number;
  canceledCodPos: number;
  restockingCodPos: number;
  cogsRtsPos: number;
  cogsDeliveredPos: number;
  confirmedCodPos: number;
  unconfirmedCodPos: number;
  abandonedCodPos: number;
  cogsPos: number;
  cogsCanceledPos: number;
  cogsRestockingPos: number;
  sfPos: number;
  ffPos: number;
  ifPos: number;
  sfSdrPos: number;
  ffSdrPos: number;
  ifSdrPos: number;
  codFeePos: number;
  codFeeDeliveredPos: number;
};

type SalesAttributionGroup = {
  campaignId: string | null;
  campaignName: string | null;
  campaignKey: string;
  mapping: string | null;
  mappingKey: string;
  teamCode: string | null;
  teamCodeKey: string;
  isUnmatched: boolean;
  totals: NumericFields;
};

const UNASSIGNED_MAPPING_KEY = '__unassigned_mapping__';
const UNASSIGNED_TEAM_CODE_KEY = '__unassigned_team_code__';
const UNASSIGNED_CAMPAIGN_KEY = '__unassigned_campaign__';

@Injectable()
export class ReconcileSalesAttributionService {
  private readonly logger = new Logger(ReconcileSalesAttributionService.name);
  private readonly redis: Redis;

  constructor(private readonly prisma: PrismaService) {
    const host = process.env.REDIS_HOST || 'localhost';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);
    const keyPrefix = process.env.CACHE_PREFIX || 'erp:';
    const password = process.env.REDIS_PASSWORD || undefined;
    this.redis = new Redis({ host, port, keyPrefix, password });
  }

  private async bumpAnalyticsCacheVersion(tenantId: string): Promise<void> {
    await this.redis.incr(`analytics:${tenantId}:version`);
  }

  private toNumber(value: unknown): number {
    const numeric = typeof value === 'string' ? parseFloat(value) : Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  private normalize(value?: string | null): string {
    return (value || '').trim().toLowerCase();
  }

  private buildCampaignKey(params: {
    campaignId?: string | null;
    adId?: string | null;
  }): string {
    const normalizedCampaignId = this.normalize(params.campaignId);
    if (normalizedCampaignId) {
      return normalizedCampaignId;
    }

    const normalizedAdId = this.normalize(params.adId);
    if (normalizedAdId) {
      return `ad:${normalizedAdId}`;
    }

    return UNASSIGNED_CAMPAIGN_KEY;
  }

  private createEmptyTotals(): NumericFields {
    return {
      spend: 0,
      clicks: 0,
      linkClicks: 0,
      impressions: 0,
      leads: 0,
      purchasesPos: 0,
      processedPurchasesPos: 0,
      confirmedCount: 0,
      unconfirmedCount: 0,
      printedCount: 0,
      deletedCount: 0,
      abandonedCount: 0,
      waitingPickupCount: 0,
      shippedCount: 0,
      deliveredCount: 0,
      canceledCount: 0,
      rtsCount: 0,
      restockingCount: 0,
      codPos: 0,
      deliveredCodPos: 0,
      shippedCodPos: 0,
      waitingPickupCodPos: 0,
      rtsCodPos: 0,
      canceledCodPos: 0,
      restockingCodPos: 0,
      cogsRtsPos: 0,
      cogsDeliveredPos: 0,
      confirmedCodPos: 0,
      unconfirmedCodPos: 0,
      abandonedCodPos: 0,
      cogsPos: 0,
      cogsCanceledPos: 0,
      cogsRestockingPos: 0,
      sfPos: 0,
      ffPos: 0,
      ifPos: 0,
      sfSdrPos: 0,
      ffSdrPos: 0,
      ifSdrPos: 0,
      codFeePos: 0,
      codFeeDeliveredPos: 0,
    };
  }

  async aggregateDay(tenantId: string, date: string): Promise<void> {
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const rows = await this.prisma.reconcileMarketing.findMany({
      where: {
        tenantId,
        date: { gte: dayStart, lt: dayEnd },
      },
      select: {
        campaignId: true,
        campaignName: true,
        adId: true,
        adName: true,
        mapping: true,
        teamCode: true,
        spend: true,
        clicks: true,
        linkClicks: true,
        impressions: true,
        leads: true,
        purchasesPos: true,
        processedPurchasesPos: true,
        confirmedCount: true,
        unconfirmedCount: true,
        printedCount: true,
        deletedCount: true,
        abandonedCount: true,
        waitingPickupCount: true,
        shippedCount: true,
        deliveredCount: true,
        canceledCount: true,
        rtsCount: true,
        restockingCount: true,
        codPos: true,
        deliveredCodPos: true,
        shippedCodPos: true,
        waitingPickupCodPos: true,
        rtsCodPos: true,
        canceledCodPos: true,
        restockingCodPos: true,
        cogsRtsPos: true,
        cogsDeliveredPos: true,
        confirmedCodPos: true,
        unconfirmedCodPos: true,
        abandonedCodPos: true,
        cogsPos: true,
        cogsCanceledPos: true,
        cogsRestockingPos: true,
        sfPos: true,
        ffPos: true,
        ifPos: true,
        sfSdrPos: true,
        ffSdrPos: true,
        ifSdrPos: true,
        codFeePos: true,
        codFeeDeliveredPos: true,
      },
    });

    const groups = new Map<string, SalesAttributionGroup>();

    for (const row of rows) {
      const campaignId = row.campaignId?.trim() || null;
      const campaignKey = this.buildCampaignKey({
        campaignId: row.campaignId,
        adId: row.adId,
      });
      const mapping = row.mapping?.trim() || null;
      const mappingKey = this.normalize(row.mapping) || UNASSIGNED_MAPPING_KEY;
      const teamCode = row.teamCode?.trim() || null;
      const teamCodeKey = this.normalize(row.teamCode) || UNASSIGNED_TEAM_CODE_KEY;
      const isUnmatched = !campaignId;
      const groupKey = `${campaignKey}::${mappingKey}::${teamCodeKey}`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          campaignId,
          campaignName: row.campaignName || row.adName || campaignId || row.adId || null,
          campaignKey,
          mapping,
          mappingKey,
          teamCode,
          teamCodeKey,
          isUnmatched,
          totals: this.createEmptyTotals(),
        });
      }

      const group = groups.get(groupKey)!;
      const totals = group.totals;
      totals.spend += this.toNumber(row.spend);
      totals.clicks += this.toNumber(row.clicks);
      totals.linkClicks += this.toNumber(row.linkClicks);
      totals.impressions += this.toNumber(row.impressions);
      totals.leads += this.toNumber(row.leads);
      totals.purchasesPos += this.toNumber(row.purchasesPos);
      totals.processedPurchasesPos += this.toNumber(row.processedPurchasesPos);
      totals.confirmedCount += this.toNumber(row.confirmedCount);
      totals.unconfirmedCount += this.toNumber(row.unconfirmedCount);
      totals.printedCount += this.toNumber(row.printedCount);
      totals.deletedCount += this.toNumber(row.deletedCount);
      totals.abandonedCount += this.toNumber(row.abandonedCount);
      totals.waitingPickupCount += this.toNumber(row.waitingPickupCount);
      totals.shippedCount += this.toNumber(row.shippedCount);
      totals.deliveredCount += this.toNumber(row.deliveredCount);
      totals.canceledCount += this.toNumber(row.canceledCount);
      totals.rtsCount += this.toNumber(row.rtsCount);
      totals.restockingCount += this.toNumber(row.restockingCount);
      totals.codPos += this.toNumber(row.codPos);
      totals.deliveredCodPos += this.toNumber(row.deliveredCodPos);
      totals.shippedCodPos += this.toNumber(row.shippedCodPos);
      totals.waitingPickupCodPos += this.toNumber(row.waitingPickupCodPos);
      totals.rtsCodPos += this.toNumber(row.rtsCodPos);
      totals.canceledCodPos += this.toNumber(row.canceledCodPos);
      totals.restockingCodPos += this.toNumber(row.restockingCodPos);
      totals.cogsRtsPos += this.toNumber(row.cogsRtsPos);
      totals.cogsDeliveredPos += this.toNumber(row.cogsDeliveredPos);
      totals.confirmedCodPos += this.toNumber(row.confirmedCodPos);
      totals.unconfirmedCodPos += this.toNumber(row.unconfirmedCodPos);
      totals.abandonedCodPos += this.toNumber(row.abandonedCodPos);
      totals.cogsPos += this.toNumber(row.cogsPos);
      totals.cogsCanceledPos += this.toNumber(row.cogsCanceledPos);
      totals.cogsRestockingPos += this.toNumber(row.cogsRestockingPos);
      totals.sfPos += this.toNumber(row.sfPos);
      totals.ffPos += this.toNumber(row.ffPos);
      totals.ifPos += this.toNumber(row.ifPos);
      totals.sfSdrPos += this.toNumber(row.sfSdrPos);
      totals.ffSdrPos += this.toNumber(row.ffSdrPos);
      totals.ifSdrPos += this.toNumber(row.ifSdrPos);
      totals.codFeePos += this.toNumber(row.codFeePos);
      totals.codFeeDeliveredPos += this.toNumber(row.codFeeDeliveredPos);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.reconcileSalesAttribution.deleteMany({
        where: {
          tenantId,
          date: {
            gte: dayStart,
            lt: dayEnd,
          },
        },
      });

      if (groups.size > 0) {
        await tx.reconcileSalesAttribution.createMany({
          data: Array.from(groups.values()).map((group) => ({
            tenantId,
            date: dayStart,
            campaignId: group.campaignId,
            campaignName: group.campaignName,
            campaignKey: group.campaignKey,
            mapping: group.mapping,
            mappingKey: group.mappingKey,
            teamCode: group.teamCode,
            teamCodeKey: group.teamCodeKey,
            isUnmatched: group.isUnmatched,
            ...group.totals,
          })),
        });
      }
    });

    await this.bumpAnalyticsCacheVersion(tenantId);
    this.logger.log(
      `Reconciled sales attribution for tenant ${tenantId} on ${date} (rows: ${groups.size})`,
    );
  }
}
