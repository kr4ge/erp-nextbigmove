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

@Injectable()
export class ReconcileSalesService {
  private readonly logger = new Logger(ReconcileSalesService.name);
  private readonly redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
  ) {
    const host = process.env.REDIS_HOST || 'localhost';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);
    const keyPrefix = process.env.CACHE_PREFIX || 'erp:';
    const password = process.env.REDIS_PASSWORD || undefined;
    this.redis = new Redis({ host, port, keyPrefix, password });
  }

  private async bumpAnalyticsCacheVersion(tenantId: string): Promise<void> {
    await this.redis.incr(`analytics:${tenantId}:version`);
  }

  private toNumber(val: any): number {
    const n = typeof val === 'string' ? parseFloat(val) : Number(val);
    return Number.isFinite(n) ? n : 0;
  }

  /**
   * Aggregate reconcile_marketing rows to reconcile_sales at campaign level for a given day.
   * - campaignId null/empty falls back to adId (for unmatched POS rows).
   * - mapping is carried through as-is (already normalized in sources).
   */
  async aggregateDay(tenantId: string, date: string, teamId?: string | null): Promise<void> {
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const rows = await this.prisma.reconcileMarketing.findMany({
      where: {
        tenantId,
        ...(teamId ? { teamId } : {}),
        date: { gte: dayStart, lt: dayEnd },
      },
      select: {
        campaignId: true,
        campaignName: true,
        adId: true,
        adName: true,
        mapping: true,
        spend: true,
        clicks: true,
        linkClicks: true,
        impressions: true,
        leads: true,
        purchasesPos: true,
        processedPurchasesPos: true,
        confirmedCount: true,
        unconfirmedCount: true,
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

    const groups: Record<
      string,
      {
        campaignId: string;
        campaignName: string | null;
        mapping: string | null;
        isUnmatched: boolean;
        totals: NumericFields;
      }
    > = {};

    for (const row of rows) {
      const hasCampaign = !!row.campaignId && row.campaignId.trim() !== '';
      const key = hasCampaign ? row.campaignId! : row.adId || row.campaignId || '';
      const groupKey = key || '__unassigned__';
      if (!groups[groupKey]) {
        groups[groupKey] = {
          campaignId: key || '__unassigned__',
          campaignName: row.campaignName || row.adName || row.campaignId || row.adId || null,
          mapping: row.mapping || null,
          isUnmatched: !hasCampaign,
          totals: {
            spend: 0,
            clicks: 0,
            linkClicks: 0,
            impressions: 0,
            leads: 0,
            purchasesPos: 0,
            processedPurchasesPos: 0,
            confirmedCount: 0,
            unconfirmedCount: 0,
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
          },
        };
      }

      const g = groups[groupKey];
      const t = g.totals;
      t.spend += this.toNumber(row.spend);
      t.clicks += this.toNumber(row.clicks);
      t.linkClicks += this.toNumber(row.linkClicks);
      t.impressions += this.toNumber(row.impressions);
      t.leads += this.toNumber(row.leads);
      t.purchasesPos += this.toNumber(row.purchasesPos);
      t.processedPurchasesPos += this.toNumber(row.processedPurchasesPos);
      t.confirmedCount += this.toNumber(row.confirmedCount);
      t.unconfirmedCount += this.toNumber(row.unconfirmedCount);
      t.waitingPickupCount += this.toNumber(row.waitingPickupCount);
      t.shippedCount += this.toNumber(row.shippedCount);
      t.deliveredCount += this.toNumber(row.deliveredCount);
      t.canceledCount += this.toNumber(row.canceledCount);
      t.rtsCount += this.toNumber(row.rtsCount);
      t.restockingCount += this.toNumber(row.restockingCount);
      t.codPos += this.toNumber(row.codPos);
      t.deliveredCodPos += this.toNumber(row.deliveredCodPos);
      t.shippedCodPos += this.toNumber(row.shippedCodPos);
      t.waitingPickupCodPos += this.toNumber(row.waitingPickupCodPos);
      t.rtsCodPos += this.toNumber(row.rtsCodPos);
      t.canceledCodPos += this.toNumber(row.canceledCodPos);
      t.restockingCodPos += this.toNumber(row.restockingCodPos);
      t.cogsRtsPos += this.toNumber(row.cogsRtsPos);
      t.cogsDeliveredPos += this.toNumber(row.cogsDeliveredPos);
      t.confirmedCodPos += this.toNumber(row.confirmedCodPos);
      t.unconfirmedCodPos += this.toNumber(row.unconfirmedCodPos);
      t.cogsPos += this.toNumber(row.cogsPos);
      t.cogsCanceledPos += this.toNumber(row.cogsCanceledPos);
      t.cogsRestockingPos += this.toNumber(row.cogsRestockingPos);
      t.sfPos += this.toNumber(row.sfPos);
      t.ffPos += this.toNumber(row.ffPos);
      t.ifPos += this.toNumber(row.ifPos);
      t.sfSdrPos += this.toNumber(row.sfSdrPos);
      t.ffSdrPos += this.toNumber(row.ffSdrPos);
      t.ifSdrPos += this.toNumber(row.ifSdrPos);
      t.codFeePos += this.toNumber(row.codFeePos);
      t.codFeeDeliveredPos += this.toNumber(row.codFeeDeliveredPos);
    }

    for (const group of Object.values(groups)) {
      await this.prisma.reconcileSales.upsert({
        where: {
          tenantId_date_campaignId: {
            tenantId,
            date: dayStart,
            campaignId: group.campaignId,
          },
        },
        create: {
          tenantId,
          teamId: teamId ?? null,
          date: dayStart,
          campaignId: group.campaignId,
          campaignName: group.campaignName,
          mapping: group.mapping,
          isUnmatched: group.isUnmatched,
          ...group.totals,
        },
        update: {
          teamId: teamId ?? null,
          campaignName: group.campaignName,
          mapping: group.mapping,
          isUnmatched: group.isUnmatched,
          ...group.totals,
          updatedAt: new Date(),
        },
      });
    }

    await this.bumpAnalyticsCacheVersion(tenantId);
    this.logger.log(`Reconciled sales for tenant ${tenantId} on ${date} (rows: ${Object.keys(groups).length})`);
  }
}
