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
  repurchaseCount: number;
  repurchaseProcessedPurchasesPos: number;
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
  repurchaseConfirmedCount: number;
  repurchaseUnconfirmedCount: number;
  repurchasePrintedCount: number;
  repurchaseDeletedCount: number;
  repurchaseAbandonedCount: number;
  repurchaseWaitingPickupCount: number;
  repurchaseShippedCount: number;
  repurchaseDeliveredCount: number;
  repurchaseCanceledCount: number;
  repurchaseRtsCount: number;
  repurchaseRestockingCount: number;
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
  repurchaseCodPos: number;
  repurchaseDeliveredCodPos: number;
  repurchaseShippedCodPos: number;
  repurchaseWaitingPickupCodPos: number;
  repurchaseRtsCodPos: number;
  repurchaseCanceledCodPos: number;
  repurchaseRestockingCodPos: number;
  repurchaseConfirmedCodPos: number;
  repurchaseUnconfirmedCodPos: number;
  repurchaseAbandonedCodPos: number;
  cogsPos: number;
  cogsCanceledPos: number;
  cogsRestockingPos: number;
  repurchaseCogsPos: number;
  repurchaseCogsCanceledPos: number;
  repurchaseCogsRestockingPos: number;
  sfPos: number;
  ffPos: number;
  ifPos: number;
  sfSdrPos: number;
  ffSdrPos: number;
  ifSdrPos: number;
  codFeePos: number;
  codFeeDeliveredPos: number;
  repurchaseCogsRtsPos: number;
  repurchaseCogsDeliveredPos: number;
  repurchaseSfPos: number;
  repurchaseFfPos: number;
  repurchaseIfPos: number;
  repurchaseSfSdrPos: number;
  repurchaseFfSdrPos: number;
  repurchaseIfSdrPos: number;
  repurchaseCodFeePos: number;
  repurchaseCodFeeDeliveredPos: number;
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
        repurchaseCount: true,
        repurchaseProcessedPurchasesPos: true,
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
        repurchaseConfirmedCount: true,
        repurchaseUnconfirmedCount: true,
        repurchasePrintedCount: true,
        repurchaseDeletedCount: true,
        repurchaseAbandonedCount: true,
        repurchaseWaitingPickupCount: true,
        repurchaseShippedCount: true,
        repurchaseDeliveredCount: true,
        repurchaseCanceledCount: true,
        repurchaseRtsCount: true,
        repurchaseRestockingCount: true,
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
        repurchaseCodPos: true,
        repurchaseDeliveredCodPos: true,
        repurchaseShippedCodPos: true,
        repurchaseWaitingPickupCodPos: true,
        repurchaseRtsCodPos: true,
        repurchaseCanceledCodPos: true,
        repurchaseRestockingCodPos: true,
        repurchaseConfirmedCodPos: true,
        repurchaseUnconfirmedCodPos: true,
        repurchaseAbandonedCodPos: true,
        cogsPos: true,
        cogsCanceledPos: true,
        cogsRestockingPos: true,
        repurchaseCogsPos: true,
        repurchaseCogsCanceledPos: true,
        repurchaseCogsRestockingPos: true,
        sfPos: true,
        ffPos: true,
        ifPos: true,
        sfSdrPos: true,
        ffSdrPos: true,
        ifSdrPos: true,
        codFeePos: true,
        codFeeDeliveredPos: true,
        repurchaseCogsRtsPos: true,
        repurchaseCogsDeliveredPos: true,
        repurchaseSfPos: true,
        repurchaseFfPos: true,
        repurchaseIfPos: true,
        repurchaseSfSdrPos: true,
        repurchaseFfSdrPos: true,
        repurchaseIfSdrPos: true,
        repurchaseCodFeePos: true,
        repurchaseCodFeeDeliveredPos: true,
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
            repurchaseCount: 0,
            repurchaseProcessedPurchasesPos: 0,
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
            repurchaseConfirmedCount: 0,
            repurchaseUnconfirmedCount: 0,
            repurchasePrintedCount: 0,
            repurchaseDeletedCount: 0,
            repurchaseAbandonedCount: 0,
            repurchaseWaitingPickupCount: 0,
            repurchaseShippedCount: 0,
            repurchaseDeliveredCount: 0,
            repurchaseCanceledCount: 0,
            repurchaseRtsCount: 0,
            repurchaseRestockingCount: 0,
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
            repurchaseCodPos: 0,
            repurchaseDeliveredCodPos: 0,
            repurchaseShippedCodPos: 0,
            repurchaseWaitingPickupCodPos: 0,
            repurchaseRtsCodPos: 0,
            repurchaseCanceledCodPos: 0,
            repurchaseRestockingCodPos: 0,
            repurchaseConfirmedCodPos: 0,
            repurchaseUnconfirmedCodPos: 0,
            repurchaseAbandonedCodPos: 0,
            cogsPos: 0,
            cogsCanceledPos: 0,
            cogsRestockingPos: 0,
            repurchaseCogsPos: 0,
            repurchaseCogsCanceledPos: 0,
            repurchaseCogsRestockingPos: 0,
            sfPos: 0,
            ffPos: 0,
            ifPos: 0,
            sfSdrPos: 0,
            ffSdrPos: 0,
            ifSdrPos: 0,
            codFeePos: 0,
            codFeeDeliveredPos: 0,
            repurchaseCogsRtsPos: 0,
            repurchaseCogsDeliveredPos: 0,
            repurchaseSfPos: 0,
            repurchaseFfPos: 0,
            repurchaseIfPos: 0,
            repurchaseSfSdrPos: 0,
            repurchaseFfSdrPos: 0,
            repurchaseIfSdrPos: 0,
            repurchaseCodFeePos: 0,
            repurchaseCodFeeDeliveredPos: 0,
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
      t.repurchaseCount += this.toNumber(row.repurchaseCount);
      t.repurchaseProcessedPurchasesPos += this.toNumber(row.repurchaseProcessedPurchasesPos);
      t.confirmedCount += this.toNumber(row.confirmedCount);
      t.unconfirmedCount += this.toNumber(row.unconfirmedCount);
      t.printedCount += this.toNumber(row.printedCount);
      t.deletedCount += this.toNumber(row.deletedCount);
      t.abandonedCount += this.toNumber(row.abandonedCount);
      t.waitingPickupCount += this.toNumber(row.waitingPickupCount);
      t.shippedCount += this.toNumber(row.shippedCount);
      t.deliveredCount += this.toNumber(row.deliveredCount);
      t.canceledCount += this.toNumber(row.canceledCount);
      t.rtsCount += this.toNumber(row.rtsCount);
      t.restockingCount += this.toNumber(row.restockingCount);
      t.repurchaseConfirmedCount += this.toNumber(row.repurchaseConfirmedCount);
      t.repurchaseUnconfirmedCount += this.toNumber(row.repurchaseUnconfirmedCount);
      t.repurchasePrintedCount += this.toNumber(row.repurchasePrintedCount);
      t.repurchaseDeletedCount += this.toNumber(row.repurchaseDeletedCount);
      t.repurchaseAbandonedCount += this.toNumber(row.repurchaseAbandonedCount);
      t.repurchaseWaitingPickupCount += this.toNumber(row.repurchaseWaitingPickupCount);
      t.repurchaseShippedCount += this.toNumber(row.repurchaseShippedCount);
      t.repurchaseDeliveredCount += this.toNumber(row.repurchaseDeliveredCount);
      t.repurchaseCanceledCount += this.toNumber(row.repurchaseCanceledCount);
      t.repurchaseRtsCount += this.toNumber(row.repurchaseRtsCount);
      t.repurchaseRestockingCount += this.toNumber(row.repurchaseRestockingCount);
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
      t.abandonedCodPos += this.toNumber(row.abandonedCodPos);
      t.repurchaseCodPos += this.toNumber(row.repurchaseCodPos);
      t.repurchaseDeliveredCodPos += this.toNumber(row.repurchaseDeliveredCodPos);
      t.repurchaseShippedCodPos += this.toNumber(row.repurchaseShippedCodPos);
      t.repurchaseWaitingPickupCodPos += this.toNumber(row.repurchaseWaitingPickupCodPos);
      t.repurchaseRtsCodPos += this.toNumber(row.repurchaseRtsCodPos);
      t.repurchaseCanceledCodPos += this.toNumber(row.repurchaseCanceledCodPos);
      t.repurchaseRestockingCodPos += this.toNumber(row.repurchaseRestockingCodPos);
      t.repurchaseConfirmedCodPos += this.toNumber(row.repurchaseConfirmedCodPos);
      t.repurchaseUnconfirmedCodPos += this.toNumber(row.repurchaseUnconfirmedCodPos);
      t.repurchaseAbandonedCodPos += this.toNumber(row.repurchaseAbandonedCodPos);
      t.cogsPos += this.toNumber(row.cogsPos);
      t.cogsCanceledPos += this.toNumber(row.cogsCanceledPos);
      t.cogsRestockingPos += this.toNumber(row.cogsRestockingPos);
      t.repurchaseCogsPos += this.toNumber(row.repurchaseCogsPos);
      t.repurchaseCogsCanceledPos += this.toNumber(row.repurchaseCogsCanceledPos);
      t.repurchaseCogsRestockingPos += this.toNumber(row.repurchaseCogsRestockingPos);
      t.sfPos += this.toNumber(row.sfPos);
      t.ffPos += this.toNumber(row.ffPos);
      t.ifPos += this.toNumber(row.ifPos);
      t.sfSdrPos += this.toNumber(row.sfSdrPos);
      t.ffSdrPos += this.toNumber(row.ffSdrPos);
      t.ifSdrPos += this.toNumber(row.ifSdrPos);
      t.codFeePos += this.toNumber(row.codFeePos);
      t.codFeeDeliveredPos += this.toNumber(row.codFeeDeliveredPos);
      t.repurchaseCogsRtsPos += this.toNumber(row.repurchaseCogsRtsPos);
      t.repurchaseCogsDeliveredPos += this.toNumber(row.repurchaseCogsDeliveredPos);
      t.repurchaseSfPos += this.toNumber(row.repurchaseSfPos);
      t.repurchaseFfPos += this.toNumber(row.repurchaseFfPos);
      t.repurchaseIfPos += this.toNumber(row.repurchaseIfPos);
      t.repurchaseSfSdrPos += this.toNumber(row.repurchaseSfSdrPos);
      t.repurchaseFfSdrPos += this.toNumber(row.repurchaseFfSdrPos);
      t.repurchaseIfSdrPos += this.toNumber(row.repurchaseIfSdrPos);
      t.repurchaseCodFeePos += this.toNumber(row.repurchaseCodFeePos);
      t.repurchaseCodFeeDeliveredPos += this.toNumber(row.repurchaseCodFeeDeliveredPos);
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
