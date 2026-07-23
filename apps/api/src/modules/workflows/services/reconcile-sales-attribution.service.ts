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

  private netOfRepurchase(value: unknown, repurchaseValue: unknown): number {
    return Math.max(0, this.toNumber(value) - this.toNumber(repurchaseValue));
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
        repurchaseCount: true,
        processedPurchasesPos: true,
        repurchaseProcessedPurchasesPos: true,
        confirmedCount: true,
        repurchaseConfirmedCount: true,
        unconfirmedCount: true,
        repurchaseUnconfirmedCount: true,
        printedCount: true,
        repurchasePrintedCount: true,
        deletedCount: true,
        repurchaseDeletedCount: true,
        abandonedCount: true,
        repurchaseAbandonedCount: true,
        waitingPickupCount: true,
        repurchaseWaitingPickupCount: true,
        shippedCount: true,
        repurchaseShippedCount: true,
        deliveredCount: true,
        repurchaseDeliveredCount: true,
        canceledCount: true,
        repurchaseCanceledCount: true,
        rtsCount: true,
        repurchaseRtsCount: true,
        restockingCount: true,
        repurchaseRestockingCount: true,
        codPos: true,
        repurchaseCodPos: true,
        deliveredCodPos: true,
        repurchaseDeliveredCodPos: true,
        shippedCodPos: true,
        repurchaseShippedCodPos: true,
        waitingPickupCodPos: true,
        repurchaseWaitingPickupCodPos: true,
        rtsCodPos: true,
        repurchaseRtsCodPos: true,
        canceledCodPos: true,
        repurchaseCanceledCodPos: true,
        restockingCodPos: true,
        repurchaseRestockingCodPos: true,
        cogsRtsPos: true,
        repurchaseCogsRtsPos: true,
        cogsDeliveredPos: true,
        repurchaseCogsDeliveredPos: true,
        confirmedCodPos: true,
        repurchaseConfirmedCodPos: true,
        unconfirmedCodPos: true,
        repurchaseUnconfirmedCodPos: true,
        abandonedCodPos: true,
        repurchaseAbandonedCodPos: true,
        cogsPos: true,
        repurchaseCogsPos: true,
        cogsCanceledPos: true,
        repurchaseCogsCanceledPos: true,
        cogsRestockingPos: true,
        repurchaseCogsRestockingPos: true,
        sfPos: true,
        repurchaseSfPos: true,
        ffPos: true,
        repurchaseFfPos: true,
        ifPos: true,
        repurchaseIfPos: true,
        sfSdrPos: true,
        repurchaseSfSdrPos: true,
        ffSdrPos: true,
        repurchaseFfSdrPos: true,
        ifSdrPos: true,
        repurchaseIfSdrPos: true,
        codFeePos: true,
        repurchaseCodFeePos: true,
        codFeeDeliveredPos: true,
        repurchaseCodFeeDeliveredPos: true,
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
      totals.purchasesPos += this.netOfRepurchase(row.purchasesPos, row.repurchaseCount);
      totals.processedPurchasesPos += this.netOfRepurchase(
        row.processedPurchasesPos,
        row.repurchaseProcessedPurchasesPos,
      );
      totals.confirmedCount += this.netOfRepurchase(
        row.confirmedCount,
        row.repurchaseConfirmedCount,
      );
      totals.unconfirmedCount += this.netOfRepurchase(
        row.unconfirmedCount,
        row.repurchaseUnconfirmedCount,
      );
      totals.printedCount += this.netOfRepurchase(
        row.printedCount,
        row.repurchasePrintedCount,
      );
      totals.deletedCount += this.netOfRepurchase(
        row.deletedCount,
        row.repurchaseDeletedCount,
      );
      totals.abandonedCount += this.netOfRepurchase(
        row.abandonedCount,
        row.repurchaseAbandonedCount,
      );
      totals.waitingPickupCount += this.netOfRepurchase(
        row.waitingPickupCount,
        row.repurchaseWaitingPickupCount,
      );
      totals.shippedCount += this.netOfRepurchase(
        row.shippedCount,
        row.repurchaseShippedCount,
      );
      totals.deliveredCount += this.netOfRepurchase(
        row.deliveredCount,
        row.repurchaseDeliveredCount,
      );
      totals.canceledCount += this.netOfRepurchase(
        row.canceledCount,
        row.repurchaseCanceledCount,
      );
      totals.rtsCount += this.netOfRepurchase(row.rtsCount, row.repurchaseRtsCount);
      totals.restockingCount += this.netOfRepurchase(
        row.restockingCount,
        row.repurchaseRestockingCount,
      );
      totals.codPos += this.netOfRepurchase(row.codPos, row.repurchaseCodPos);
      totals.deliveredCodPos += this.netOfRepurchase(
        row.deliveredCodPos,
        row.repurchaseDeliveredCodPos,
      );
      totals.shippedCodPos += this.netOfRepurchase(
        row.shippedCodPos,
        row.repurchaseShippedCodPos,
      );
      totals.waitingPickupCodPos += this.netOfRepurchase(
        row.waitingPickupCodPos,
        row.repurchaseWaitingPickupCodPos,
      );
      totals.rtsCodPos += this.netOfRepurchase(row.rtsCodPos, row.repurchaseRtsCodPos);
      totals.canceledCodPos += this.netOfRepurchase(
        row.canceledCodPos,
        row.repurchaseCanceledCodPos,
      );
      totals.restockingCodPos += this.netOfRepurchase(
        row.restockingCodPos,
        row.repurchaseRestockingCodPos,
      );
      totals.cogsRtsPos += this.netOfRepurchase(
        row.cogsRtsPos,
        row.repurchaseCogsRtsPos,
      );
      totals.cogsDeliveredPos += this.netOfRepurchase(
        row.cogsDeliveredPos,
        row.repurchaseCogsDeliveredPos,
      );
      totals.confirmedCodPos += this.netOfRepurchase(
        row.confirmedCodPos,
        row.repurchaseConfirmedCodPos,
      );
      totals.unconfirmedCodPos += this.netOfRepurchase(
        row.unconfirmedCodPos,
        row.repurchaseUnconfirmedCodPos,
      );
      totals.abandonedCodPos += this.netOfRepurchase(
        row.abandonedCodPos,
        row.repurchaseAbandonedCodPos,
      );
      totals.cogsPos += this.netOfRepurchase(row.cogsPos, row.repurchaseCogsPos);
      totals.cogsCanceledPos += this.netOfRepurchase(
        row.cogsCanceledPos,
        row.repurchaseCogsCanceledPos,
      );
      totals.cogsRestockingPos += this.netOfRepurchase(
        row.cogsRestockingPos,
        row.repurchaseCogsRestockingPos,
      );
      totals.sfPos += this.netOfRepurchase(row.sfPos, row.repurchaseSfPos);
      totals.ffPos += this.netOfRepurchase(row.ffPos, row.repurchaseFfPos);
      totals.ifPos += this.netOfRepurchase(row.ifPos, row.repurchaseIfPos);
      totals.sfSdrPos += this.netOfRepurchase(row.sfSdrPos, row.repurchaseSfSdrPos);
      totals.ffSdrPos += this.netOfRepurchase(row.ffSdrPos, row.repurchaseFfSdrPos);
      totals.ifSdrPos += this.netOfRepurchase(row.ifSdrPos, row.repurchaseIfSdrPos);
      totals.codFeePos += this.netOfRepurchase(
        row.codFeePos,
        row.repurchaseCodFeePos,
      );
      totals.codFeeDeliveredPos += this.netOfRepurchase(
        row.codFeeDeliveredPos,
        row.repurchaseCodFeeDeliveredPos,
      );
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
