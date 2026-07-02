import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { normalizeAdId } from '../utils/normalize-ad-id';

interface PosOrderLite {
  pUtmContent?: string | null;
  shopId: string;
  posOrderId: string;
  cod?: any;
  teamId?: string | null;
  status?: number | null;
  isVoid?: boolean | null;
  isAbandoned?: boolean | null;
  isRepurchase?: boolean | null;
  cogs?: any;
  tracking?: string | null;
  mapping?: string | null;
}

type PosAggregateBucket = {
  purchasesPos: number;
  processedPurchasesPos: number;
  codPos: number;
  cogsPos: number;
  cogsCanceledPos: number;
  cogsRestockingPos: number;
  cogsRtsPos: number;
  cogsDeliveredPos: number;
  confirmedCount: number;
  unconfirmedCount: number;
  printedCount: number;
  deletedCount: number;
  restockingCount: number;
  abandonedCount: number;
  waitingPickupCount: number;
  shippedCount: number;
  deliveredCount: number;
  canceledCount: number;
  rtsCount: number;
  confirmedCodPos: number;
  unconfirmedCodPos: number;
  abandonedCodPos: number;
  canceledCodPos: number;
  restockingCodPos: number;
  rtsCodPos: number;
  deliveredCodPos: number;
  shippedCodPos: number;
  waitingPickupCodPos: number;
  repurchaseCount: number;
  repurchaseProcessedPurchasesPos: number;
  repurchaseCodPos: number;
  repurchaseCogsPos: number;
  repurchaseCogsCanceledPos: number;
  repurchaseCogsRestockingPos: number;
  repurchaseCogsRtsPos: number;
  repurchaseCogsDeliveredPos: number;
  repurchaseConfirmedCount: number;
  repurchaseUnconfirmedCount: number;
  repurchasePrintedCount: number;
  repurchaseDeletedCount: number;
  repurchaseRestockingCount: number;
  repurchaseAbandonedCount: number;
  repurchaseWaitingPickupCount: number;
  repurchaseShippedCount: number;
  repurchaseDeliveredCount: number;
  repurchaseCanceledCount: number;
  repurchaseRtsCount: number;
  repurchaseConfirmedCodPos: number;
  repurchaseUnconfirmedCodPos: number;
  repurchaseAbandonedCodPos: number;
  repurchaseCanceledCodPos: number;
  repurchaseRestockingCodPos: number;
  repurchaseRtsCodPos: number;
  repurchaseDeliveredCodPos: number;
  repurchaseShippedCodPos: number;
  repurchaseWaitingPickupCodPos: number;
  orders: PosOrderLite[];
};

@Injectable()
export class ReconcileMarketingService {
  private readonly logger = new Logger(ReconcileMarketingService.name);
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

  private createEmptyPosAggregateBucket(): PosAggregateBucket {
    return {
      purchasesPos: 0,
      processedPurchasesPos: 0,
      codPos: 0,
      cogsPos: 0,
      cogsCanceledPos: 0,
      cogsRestockingPos: 0,
      cogsRtsPos: 0,
      cogsDeliveredPos: 0,
      confirmedCount: 0,
      unconfirmedCount: 0,
      printedCount: 0,
      deletedCount: 0,
      restockingCount: 0,
      abandonedCount: 0,
      waitingPickupCount: 0,
      shippedCount: 0,
      deliveredCount: 0,
      canceledCount: 0,
      rtsCount: 0,
      confirmedCodPos: 0,
      unconfirmedCodPos: 0,
      abandonedCodPos: 0,
      canceledCodPos: 0,
      restockingCodPos: 0,
      rtsCodPos: 0,
      deliveredCodPos: 0,
      shippedCodPos: 0,
      waitingPickupCodPos: 0,
      repurchaseCount: 0,
      repurchaseProcessedPurchasesPos: 0,
      repurchaseCodPos: 0,
      repurchaseCogsPos: 0,
      repurchaseCogsCanceledPos: 0,
      repurchaseCogsRestockingPos: 0,
      repurchaseCogsRtsPos: 0,
      repurchaseCogsDeliveredPos: 0,
      repurchaseConfirmedCount: 0,
      repurchaseUnconfirmedCount: 0,
      repurchasePrintedCount: 0,
      repurchaseDeletedCount: 0,
      repurchaseRestockingCount: 0,
      repurchaseAbandonedCount: 0,
      repurchaseWaitingPickupCount: 0,
      repurchaseShippedCount: 0,
      repurchaseDeliveredCount: 0,
      repurchaseCanceledCount: 0,
      repurchaseRtsCount: 0,
      repurchaseConfirmedCodPos: 0,
      repurchaseUnconfirmedCodPos: 0,
      repurchaseAbandonedCodPos: 0,
      repurchaseCanceledCodPos: 0,
      repurchaseRestockingCodPos: 0,
      repurchaseRtsCodPos: 0,
      repurchaseDeliveredCodPos: 0,
      repurchaseShippedCodPos: 0,
      repurchaseWaitingPickupCodPos: 0,
      orders: [],
    };
  }

  private accumulatePosOrder(bucket: PosAggregateBucket, order: PosOrderLite): void {
    const status = order.status ?? -1;
    const codVal = parseFloat(order.cod ?? '0') || 0;
    const cogsVal = parseFloat(order.cogs ?? '0') || 0;
    const isRepurchase = order.isRepurchase === true;
    const isAbandoned = order.isAbandoned === true;
    const isVoidOrder = order.isVoid === true;
    const isDeleted = status === 7;
    const isPrinted = status === 13;

    if (isDeleted || (isPrinted && isVoidOrder)) {
      if (isDeleted) {
        bucket.deletedCount += 1;
        if (isRepurchase) bucket.repurchaseDeletedCount += 1;
      }
      if (isPrinted) {
        bucket.printedCount += 1;
        if (isRepurchase) bucket.repurchasePrintedCount += 1;
      }
      bucket.orders.push(order);
      return;
    }

    bucket.purchasesPos += 1;
    bucket.codPos += codVal;
    bucket.cogsPos += cogsVal;
    if (order.tracking && order.tracking !== '') {
      bucket.processedPurchasesPos += 1;
    }

    if (isRepurchase) {
      bucket.repurchaseCount += 1;
      bucket.repurchaseCodPos += codVal;
      bucket.repurchaseCogsPos += cogsVal;
      if (order.tracking && order.tracking !== '') {
        bucket.repurchaseProcessedPurchasesPos += 1;
      }
    }

    if (status === 0) {
      bucket.unconfirmedCount += 1;
      bucket.unconfirmedCodPos += codVal;
      if (isRepurchase) {
        bucket.repurchaseUnconfirmedCount += 1;
        bucket.repurchaseUnconfirmedCodPos += codVal;
      }
    }
    if (isAbandoned) {
      bucket.abandonedCount += 1;
      bucket.abandonedCodPos += codVal;
      if (isRepurchase) {
        bucket.repurchaseAbandonedCount += 1;
        bucket.repurchaseAbandonedCodPos += codVal;
      }
    }
    if (status === 1) {
      bucket.confirmedCount += 1;
      bucket.confirmedCodPos += codVal;
      if (isRepurchase) {
        bucket.repurchaseConfirmedCount += 1;
        bucket.repurchaseConfirmedCodPos += codVal;
      }
    }
    if (status === 13) {
      bucket.printedCount += 1;
      if (isRepurchase) {
        bucket.repurchasePrintedCount += 1;
      }
    }
    if (status === 11) {
      bucket.restockingCount += 1;
      bucket.restockingCodPos += codVal;
      bucket.cogsRestockingPos += cogsVal;
      if (isRepurchase) {
        bucket.repurchaseRestockingCount += 1;
        bucket.repurchaseRestockingCodPos += codVal;
        bucket.repurchaseCogsRestockingPos += cogsVal;
      }
    }
    if (status === 9) {
      bucket.waitingPickupCount += 1;
      bucket.waitingPickupCodPos += codVal;
      if (isRepurchase) {
        bucket.repurchaseWaitingPickupCount += 1;
        bucket.repurchaseWaitingPickupCodPos += codVal;
      }
    }
    if (status === 2) {
      bucket.shippedCount += 1;
      bucket.shippedCodPos += codVal;
      if (isRepurchase) {
        bucket.repurchaseShippedCount += 1;
        bucket.repurchaseShippedCodPos += codVal;
      }
    }
    if (status === 3) {
      bucket.deliveredCount += 1;
      bucket.deliveredCodPos += codVal;
      bucket.cogsDeliveredPos += cogsVal;
      if (isRepurchase) {
        bucket.repurchaseDeliveredCount += 1;
        bucket.repurchaseDeliveredCodPos += codVal;
        bucket.repurchaseCogsDeliveredPos += cogsVal;
      }
    }
    if (status === 6) {
      bucket.canceledCount += 1;
      bucket.canceledCodPos += codVal;
      bucket.cogsCanceledPos += cogsVal;
      if (isRepurchase) {
        bucket.repurchaseCanceledCount += 1;
        bucket.repurchaseCanceledCodPos += codVal;
        bucket.repurchaseCogsCanceledPos += cogsVal;
      }
    }
    if (status === 4 || status === 5) {
      bucket.rtsCount += 1;
      bucket.rtsCodPos += codVal;
      bucket.cogsRtsPos += cogsVal;
      if (isRepurchase) {
        bucket.repurchaseRtsCount += 1;
        bucket.repurchaseRtsCodPos += codVal;
        bucket.repurchaseCogsRtsPos += cogsVal;
      }
    }

    bucket.orders.push(order);
  }

  /**
   * Reconcile Meta ad insights with POS orders for a given date (YYYY-MM-DD) and tenant.
   * - Match by normalized ad id (from Meta ad_id and POS p_utm_content).
   * - Upsert into reconcile_marketing.
   * - Create synthetic rows for unmatched POS orders.
   */
  async reconcileDay(tenantId: string, date: string, teamId?: string | null): Promise<void> {
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    // Load Meta insights for the day
    const metaInsights = await this.prisma.metaAdInsight.findMany({
      where: {
        tenantId,
        ...(teamId ? { teamId } : {}),
        date: {
          gte: dayStart,
          lt: dayEnd,
        },
      },
    });

    // Load POS orders for the day
    const posOrders: PosOrderLite[] = await this.prisma.posOrder.findMany({
      where: {
        tenantId,
        ...(teamId ? { teamId } : {}),
        dateLocal: date,
        AND: [
          {
            OR: [
              { status: { not: 7 } },
              { status: null },
            ],
          },
        ],
        OR: [
          { isVoid: false },
          { status: 13 },
        ],
      },
      select: {
        pUtmContent: true,
        shopId: true,
        posOrderId: true,
        cod: true,
        teamId: true,
        status: true,
        isVoid: true,
        isAbandoned: true,
        isRepurchase: true,
        cogs: true,
        tracking: true,
        mapping: true,
      },
    });

    // Build normalized map for Meta insights
    const normToInsights: Record<string, typeof metaInsights> = {};
    for (const insight of metaInsights) {
      const norm = normalizeAdId(insight.adId);
      if (!norm) continue;
      if (!normToInsights[norm]) normToInsights[norm] = [];
      normToInsights[norm].push(insight);
    }

    // Aggregate POS by normalized ad id
    const posAgg: Record<string, PosAggregateBucket> = {};
    for (const order of posOrders) {
      const norm = normalizeAdId(order.pUtmContent || '');
      if (!norm) continue;
      if (!posAgg[norm]) {
        posAgg[norm] = this.createEmptyPosAggregateBucket();
      }
      this.accumulatePosOrder(posAgg[norm], order);
    }

    // Upsert reconciled rows for matched insights
    for (const insight of metaInsights) {
      const norm = normalizeAdId(insight.adId);
      const agg = norm ? posAgg[norm] : undefined;
      const matchedOrders = agg?.orders?.map((o) => ({
        shopId: o.shopId,
        posOrderId: o.posOrderId,
        cod: parseFloat(o.cod ?? '0') || 0,
      })) ?? [];
      const shops =
        matchedOrders.length > 0
          ? Array.from(new Set(matchedOrders.map((o) => o.shopId)))
          : [];

      const nonCanceled = agg ? Math.max(agg.purchasesPos - agg.canceledCount, 0) : 0;
      const repurchaseNonCanceled = agg ? Math.max(agg.repurchaseCount - agg.repurchaseCanceledCount, 0) : 0;
      const sf = nonCanceled * 60;
      const repurchaseSf = repurchaseNonCanceled * 60;
      const ff = nonCanceled * 25;
      const repurchaseFf = repurchaseNonCanceled * 25;
      const inf = nonCanceled * 5;
      const repurchaseIf = repurchaseNonCanceled * 5;
      const sdr = agg ? agg.shippedCount + agg.deliveredCount + agg.rtsCount : 0;
      const repurchaseSdr = agg ? agg.repurchaseShippedCount + agg.repurchaseDeliveredCount + agg.repurchaseRtsCount : 0;
      const sfSdr = sdr * 60;
      const repurchaseSfSdr = repurchaseSdr * 60;
      const ffSdr = sdr * 25;
      const repurchaseFfSdr = repurchaseSdr * 25;
      const infSdr = sdr * 5;
      const repurchaseIfSdr = repurchaseSdr * 5;
      const eligibleCod = agg
        ? Math.max(agg.codPos - agg.rtsCodPos - agg.canceledCodPos, 0)
        : 0;
      const repurchaseEligibleCod = agg
        ? Math.max(agg.repurchaseCodPos - agg.repurchaseRtsCodPos - agg.repurchaseCanceledCodPos, 0)
        : 0;
      const codFee = eligibleCod * 0.0224;
      const repurchaseCodFee = repurchaseEligibleCod * 0.0224;
      const codFeeDelivered = (agg?.deliveredCodPos ?? 0) * 0.0224;
      const repurchaseCodFeeDelivered = (agg?.repurchaseDeliveredCodPos ?? 0) * 0.0224;
      const metaDateCreated =
        insight.dateCreated && typeof insight.dateCreated === 'string'
          ? new Date(insight.dateCreated)
          : insight.dateCreated
          ? new Date(insight.dateCreated)
          : null;

      await this.prisma.reconcileMarketing.upsert({
        where: {
          tenantId_date_adId: {
            tenantId,
            date: dayStart,
            adId: insight.adId,
          },
        },
        create: {
          tenantId,
          teamId: insight.teamId ?? teamId ?? null,
          date: dayStart,
          adId: insight.adId,
          normalizedAdId: norm || null,
          accountId: insight.accountId,
          campaignId: insight.campaignId,
          campaignName: insight.campaignName,
          adsetId: insight.adsetId,
          adName: insight.adName,
          marketingAssociate: insight.marketingAssociate,
          mapping: insight.mapping || null,
          teamCode: insight.teamCode || null,
          dateCreated: metaDateCreated,
          spend: insight.spend,
          clicks: insight.clicks || 0,
          linkClicks: insight.linkClicks || 0,
          impressions: insight.impressions || 0,
          leads: insight.leads || 0,
          purchasesPos: agg?.purchasesPos || 0,
          codPos: agg?.codPos || 0,
          processedPurchasesPos: agg?.processedPurchasesPos || 0,
          repurchaseCount: agg?.repurchaseCount || 0,
          repurchaseProcessedPurchasesPos: agg?.repurchaseProcessedPurchasesPos || 0,
          cogsPos: agg?.cogsPos || 0,
          repurchaseCogsPos: agg?.repurchaseCogsPos || 0,
          cogsCanceledPos: agg?.cogsCanceledPos || 0,
          repurchaseCogsCanceledPos: agg?.repurchaseCogsCanceledPos || 0,
          cogsRestockingPos: agg?.cogsRestockingPos || 0,
          repurchaseCogsRestockingPos: agg?.repurchaseCogsRestockingPos || 0,
          cogsRtsPos: agg?.cogsRtsPos || 0,
          repurchaseCogsRtsPos: agg?.repurchaseCogsRtsPos || 0,
          cogsDeliveredPos: agg?.cogsDeliveredPos || 0,
          repurchaseCogsDeliveredPos: agg?.repurchaseCogsDeliveredPos || 0,
          sfPos: sf,
          repurchaseSfPos: repurchaseSf,
          ffPos: ff,
          repurchaseFfPos: repurchaseFf,
          ifPos: inf,
          repurchaseIfPos: repurchaseIf,
          sfSdrPos: sfSdr,
          repurchaseSfSdrPos: repurchaseSfSdr,
          ffSdrPos: ffSdr,
          repurchaseFfSdrPos: repurchaseFfSdr,
          ifSdrPos: infSdr,
          repurchaseIfSdrPos: repurchaseIfSdr,
          codFeePos: codFee,
          repurchaseCodFeePos: repurchaseCodFee,
          codFeeDeliveredPos: codFeeDelivered,
          repurchaseCodFeeDeliveredPos: repurchaseCodFeeDelivered,
          canceledCodPos: agg?.canceledCodPos || 0,
          repurchaseCanceledCodPos: agg?.repurchaseCanceledCodPos || 0,
          rtsCodPos: agg?.rtsCodPos || 0,
          repurchaseRtsCodPos: agg?.repurchaseRtsCodPos || 0,
          deliveredCodPos: agg?.deliveredCodPos || 0,
          repurchaseDeliveredCodPos: agg?.repurchaseDeliveredCodPos || 0,
          shippedCodPos: agg?.shippedCodPos || 0,
          repurchaseShippedCodPos: agg?.repurchaseShippedCodPos || 0,
          waitingPickupCodPos: agg?.waitingPickupCodPos || 0,
          repurchaseWaitingPickupCodPos: agg?.repurchaseWaitingPickupCodPos || 0,
          restockingCodPos: agg?.restockingCodPos || 0,
          repurchaseRestockingCodPos: agg?.repurchaseRestockingCodPos || 0,
          confirmedCodPos: agg?.confirmedCodPos || 0,
          repurchaseConfirmedCodPos: agg?.repurchaseConfirmedCodPos || 0,
          unconfirmedCodPos: agg?.unconfirmedCodPos || 0,
          repurchaseUnconfirmedCodPos: agg?.repurchaseUnconfirmedCodPos || 0,
          abandonedCodPos: agg?.abandonedCodPos || 0,
          repurchaseAbandonedCodPos: agg?.repurchaseAbandonedCodPos || 0,
          confirmedCount: agg?.confirmedCount || 0,
          repurchaseConfirmedCount: agg?.repurchaseConfirmedCount || 0,
          unconfirmedCount: agg?.unconfirmedCount || 0,
          repurchaseUnconfirmedCount: agg?.repurchaseUnconfirmedCount || 0,
          printedCount: agg?.printedCount || 0,
          repurchasePrintedCount: agg?.repurchasePrintedCount || 0,
          deletedCount: agg?.deletedCount || 0,
          repurchaseDeletedCount: agg?.repurchaseDeletedCount || 0,
          abandonedCount: agg?.abandonedCount || 0,
          repurchaseAbandonedCount: agg?.repurchaseAbandonedCount || 0,
          restockingCount: agg?.restockingCount || 0,
          repurchaseRestockingCount: agg?.repurchaseRestockingCount || 0,
          waitingPickupCount: agg?.waitingPickupCount || 0,
          repurchaseWaitingPickupCount: agg?.repurchaseWaitingPickupCount || 0,
          shippedCount: agg?.shippedCount || 0,
          repurchaseShippedCount: agg?.repurchaseShippedCount || 0,
          deliveredCount: agg?.deliveredCount || 0,
          repurchaseDeliveredCount: agg?.repurchaseDeliveredCount || 0,
          canceledCount: agg?.canceledCount || 0,
          repurchaseCanceledCount: agg?.repurchaseCanceledCount || 0,
          rtsCount: agg?.rtsCount || 0,
          repurchaseRtsCount: agg?.repurchaseRtsCount || 0,
          matchedOrders,
          shops,
        },
        update: {
          teamId: insight.teamId ?? teamId ?? null,
          normalizedAdId: norm || null,
          campaignName: insight.campaignName,
          adName: insight.adName,
          marketingAssociate: insight.marketingAssociate,
          mapping: insight.mapping || null,
          teamCode: insight.teamCode || null,
          dateCreated: metaDateCreated,
          spend: insight.spend,
          clicks: insight.clicks || 0,
          linkClicks: insight.linkClicks || 0,
          impressions: insight.impressions || 0,
          leads: insight.leads || 0,
          purchasesPos: agg?.purchasesPos || 0,
          codPos: agg?.codPos || 0,
          processedPurchasesPos: agg?.processedPurchasesPos || 0,
          repurchaseCount: agg?.repurchaseCount || 0,
          repurchaseProcessedPurchasesPos: agg?.repurchaseProcessedPurchasesPos || 0,
          cogsPos: agg?.cogsPos || 0,
          repurchaseCogsPos: agg?.repurchaseCogsPos || 0,
          cogsCanceledPos: agg?.cogsCanceledPos || 0,
          repurchaseCogsCanceledPos: agg?.repurchaseCogsCanceledPos || 0,
          cogsRestockingPos: agg?.cogsRestockingPos || 0,
          repurchaseCogsRestockingPos: agg?.repurchaseCogsRestockingPos || 0,
          cogsRtsPos: agg?.cogsRtsPos || 0,
          repurchaseCogsRtsPos: agg?.repurchaseCogsRtsPos || 0,
          cogsDeliveredPos: agg?.cogsDeliveredPos || 0,
          repurchaseCogsDeliveredPos: agg?.repurchaseCogsDeliveredPos || 0,
          sfPos: sf,
          repurchaseSfPos: repurchaseSf,
          ffPos: ff,
          repurchaseFfPos: repurchaseFf,
          ifPos: inf,
          repurchaseIfPos: repurchaseIf,
          sfSdrPos: sfSdr,
          repurchaseSfSdrPos: repurchaseSfSdr,
          ffSdrPos: ffSdr,
          repurchaseFfSdrPos: repurchaseFfSdr,
          ifSdrPos: infSdr,
          repurchaseIfSdrPos: repurchaseIfSdr,
          codFeePos: codFee,
          repurchaseCodFeePos: repurchaseCodFee,
          codFeeDeliveredPos: codFeeDelivered,
          repurchaseCodFeeDeliveredPos: repurchaseCodFeeDelivered,
          canceledCodPos: agg?.canceledCodPos || 0,
          repurchaseCanceledCodPos: agg?.repurchaseCanceledCodPos || 0,
          rtsCodPos: agg?.rtsCodPos || 0,
          repurchaseRtsCodPos: agg?.repurchaseRtsCodPos || 0,
          deliveredCodPos: agg?.deliveredCodPos || 0,
          repurchaseDeliveredCodPos: agg?.repurchaseDeliveredCodPos || 0,
          shippedCodPos: agg?.shippedCodPos || 0,
          repurchaseShippedCodPos: agg?.repurchaseShippedCodPos || 0,
          waitingPickupCodPos: agg?.waitingPickupCodPos || 0,
          repurchaseWaitingPickupCodPos: agg?.repurchaseWaitingPickupCodPos || 0,
          restockingCodPos: agg?.restockingCodPos || 0,
          repurchaseRestockingCodPos: agg?.repurchaseRestockingCodPos || 0,
          confirmedCodPos: agg?.confirmedCodPos || 0,
          repurchaseConfirmedCodPos: agg?.repurchaseConfirmedCodPos || 0,
          unconfirmedCodPos: agg?.unconfirmedCodPos || 0,
          repurchaseUnconfirmedCodPos: agg?.repurchaseUnconfirmedCodPos || 0,
          abandonedCodPos: agg?.abandonedCodPos || 0,
          repurchaseAbandonedCodPos: agg?.repurchaseAbandonedCodPos || 0,
          confirmedCount: agg?.confirmedCount || 0,
          repurchaseConfirmedCount: agg?.repurchaseConfirmedCount || 0,
          unconfirmedCount: agg?.unconfirmedCount || 0,
          repurchaseUnconfirmedCount: agg?.repurchaseUnconfirmedCount || 0,
          printedCount: agg?.printedCount || 0,
          repurchasePrintedCount: agg?.repurchasePrintedCount || 0,
          deletedCount: agg?.deletedCount || 0,
          repurchaseDeletedCount: agg?.repurchaseDeletedCount || 0,
          abandonedCount: agg?.abandonedCount || 0,
          repurchaseAbandonedCount: agg?.repurchaseAbandonedCount || 0,
          restockingCount: agg?.restockingCount || 0,
          repurchaseRestockingCount: agg?.repurchaseRestockingCount || 0,
          waitingPickupCount: agg?.waitingPickupCount || 0,
          repurchaseWaitingPickupCount: agg?.repurchaseWaitingPickupCount || 0,
          shippedCount: agg?.shippedCount || 0,
          repurchaseShippedCount: agg?.repurchaseShippedCount || 0,
          deliveredCount: agg?.deliveredCount || 0,
          repurchaseDeliveredCount: agg?.repurchaseDeliveredCount || 0,
          canceledCount: agg?.canceledCount || 0,
          repurchaseCanceledCount: agg?.repurchaseCanceledCount || 0,
          rtsCount: agg?.rtsCount || 0,
          repurchaseRtsCount: agg?.repurchaseRtsCount || 0,
          matchedOrders,
          shops,
          updatedAt: new Date(),
        },
      });
    }

    // Insert synthetic rows for unmatched POS orders (no matching Meta norm)
    const marketingNormSet = new Set(Object.keys(normToInsights));
    for (const order of posOrders) {
      const norm = normalizeAdId(order.pUtmContent || '');
      if (norm && marketingNormSet.has(norm)) {
        continue; // matched already
      }
      const syntheticAdId = `${order.shopId}-${order.posOrderId}`;
      const syntheticAgg = this.createEmptyPosAggregateBucket();
      this.accumulatePosOrder(syntheticAgg, order);
      const nonCanceled = Math.max(syntheticAgg.purchasesPos - syntheticAgg.canceledCount, 0);
      const repurchaseNonCanceled = Math.max(
        syntheticAgg.repurchaseCount - syntheticAgg.repurchaseCanceledCount,
        0,
      );
      const sf = nonCanceled * 60;
      const repurchaseSf = repurchaseNonCanceled * 60;
      const ff = nonCanceled * 25;
      const repurchaseFf = repurchaseNonCanceled * 25;
      const inf = nonCanceled * 5;
      const repurchaseIf = repurchaseNonCanceled * 5;
      const sdr =
        syntheticAgg.shippedCount + syntheticAgg.deliveredCount + syntheticAgg.rtsCount;
      const repurchaseSdr =
        syntheticAgg.repurchaseShippedCount +
        syntheticAgg.repurchaseDeliveredCount +
        syntheticAgg.repurchaseRtsCount;
      const sfSdr = sdr * 60;
      const repurchaseSfSdr = repurchaseSdr * 60;
      const ffSdr = sdr * 25;
      const repurchaseFfSdr = repurchaseSdr * 25;
      const infSdr = sdr * 5;
      const repurchaseIfSdr = repurchaseSdr * 5;
      const eligibleCod = Math.max(
        syntheticAgg.codPos - syntheticAgg.rtsCodPos - syntheticAgg.canceledCodPos,
        0,
      );
      const repurchaseEligibleCod = Math.max(
        syntheticAgg.repurchaseCodPos -
          syntheticAgg.repurchaseRtsCodPos -
          syntheticAgg.repurchaseCanceledCodPos,
        0,
      );
      const codFee = eligibleCod * 0.0224;
      const repurchaseCodFee = repurchaseEligibleCod * 0.0224;
      const codFeeDelivered = syntheticAgg.deliveredCodPos * 0.0224;
      const repurchaseCodFeeDelivered = syntheticAgg.repurchaseDeliveredCodPos * 0.0224;
      const codVal = parseFloat(order.cod ?? '0') || 0;
      await this.prisma.reconcileMarketing.upsert({
        where: {
          tenantId_date_adId: {
            tenantId,
            date: dayStart,
            adId: syntheticAdId,
          },
        },
        create: {
          tenantId,
          teamId: order.teamId ?? teamId ?? null,
          date: dayStart,
          adId: syntheticAdId,
          normalizedAdId: null,
          accountId: '',
          campaignId: '',
          campaignName: '',
          adsetId: '',
          adName: 'POS Unmatched Order',
          marketingAssociate: null,
          mapping: order.mapping ?? null,
          dateCreated: null,
          spend: 0,
          clicks: 0,
          linkClicks: 0,
          impressions: 0,
          leads: 0,
          purchasesPos: syntheticAgg.purchasesPos,
          codPos: syntheticAgg.codPos,
          processedPurchasesPos: syntheticAgg.processedPurchasesPos,
          repurchaseCount: syntheticAgg.repurchaseCount,
          repurchaseProcessedPurchasesPos: syntheticAgg.repurchaseProcessedPurchasesPos,
          cogsPos: syntheticAgg.cogsPos,
          repurchaseCogsPos: syntheticAgg.repurchaseCogsPos,
          cogsCanceledPos: syntheticAgg.cogsCanceledPos,
          repurchaseCogsCanceledPos: syntheticAgg.repurchaseCogsCanceledPos,
          cogsRestockingPos: syntheticAgg.cogsRestockingPos,
          repurchaseCogsRestockingPos: syntheticAgg.repurchaseCogsRestockingPos,
          cogsRtsPos: syntheticAgg.cogsRtsPos,
          repurchaseCogsRtsPos: syntheticAgg.repurchaseCogsRtsPos,
          cogsDeliveredPos: syntheticAgg.cogsDeliveredPos,
          repurchaseCogsDeliveredPos: syntheticAgg.repurchaseCogsDeliveredPos,
          sfPos: sf,
          repurchaseSfPos: repurchaseSf,
          ffPos: ff,
          repurchaseFfPos: repurchaseFf,
          ifPos: inf,
          repurchaseIfPos: repurchaseIf,
          sfSdrPos: sfSdr,
          repurchaseSfSdrPos: repurchaseSfSdr,
          ffSdrPos: ffSdr,
          repurchaseFfSdrPos: repurchaseFfSdr,
          ifSdrPos: infSdr,
          repurchaseIfSdrPos: repurchaseIfSdr,
          codFeePos: codFee,
          repurchaseCodFeePos: repurchaseCodFee,
          codFeeDeliveredPos: codFeeDelivered,
          repurchaseCodFeeDeliveredPos: repurchaseCodFeeDelivered,
          canceledCodPos: syntheticAgg.canceledCodPos,
          repurchaseCanceledCodPos: syntheticAgg.repurchaseCanceledCodPos,
          rtsCodPos: syntheticAgg.rtsCodPos,
          repurchaseRtsCodPos: syntheticAgg.repurchaseRtsCodPos,
          deliveredCodPos: syntheticAgg.deliveredCodPos,
          repurchaseDeliveredCodPos: syntheticAgg.repurchaseDeliveredCodPos,
          shippedCodPos: syntheticAgg.shippedCodPos,
          repurchaseShippedCodPos: syntheticAgg.repurchaseShippedCodPos,
          waitingPickupCodPos: syntheticAgg.waitingPickupCodPos,
          repurchaseWaitingPickupCodPos: syntheticAgg.repurchaseWaitingPickupCodPos,
          restockingCodPos: syntheticAgg.restockingCodPos,
          repurchaseRestockingCodPos: syntheticAgg.repurchaseRestockingCodPos,
          confirmedCodPos: syntheticAgg.confirmedCodPos,
          repurchaseConfirmedCodPos: syntheticAgg.repurchaseConfirmedCodPos,
          unconfirmedCodPos: syntheticAgg.unconfirmedCodPos,
          repurchaseUnconfirmedCodPos: syntheticAgg.repurchaseUnconfirmedCodPos,
          abandonedCodPos: syntheticAgg.abandonedCodPos,
          repurchaseAbandonedCodPos: syntheticAgg.repurchaseAbandonedCodPos,
          confirmedCount: syntheticAgg.confirmedCount,
          repurchaseConfirmedCount: syntheticAgg.repurchaseConfirmedCount,
          unconfirmedCount: syntheticAgg.unconfirmedCount,
          repurchaseUnconfirmedCount: syntheticAgg.repurchaseUnconfirmedCount,
          printedCount: syntheticAgg.printedCount,
          repurchasePrintedCount: syntheticAgg.repurchasePrintedCount,
          deletedCount: syntheticAgg.deletedCount,
          repurchaseDeletedCount: syntheticAgg.repurchaseDeletedCount,
          abandonedCount: syntheticAgg.abandonedCount,
          repurchaseAbandonedCount: syntheticAgg.repurchaseAbandonedCount,
          restockingCount: syntheticAgg.restockingCount,
          repurchaseRestockingCount: syntheticAgg.repurchaseRestockingCount,
          waitingPickupCount: syntheticAgg.waitingPickupCount,
          repurchaseWaitingPickupCount: syntheticAgg.repurchaseWaitingPickupCount,
          shippedCount: syntheticAgg.shippedCount,
          repurchaseShippedCount: syntheticAgg.repurchaseShippedCount,
          deliveredCount: syntheticAgg.deliveredCount,
          repurchaseDeliveredCount: syntheticAgg.repurchaseDeliveredCount,
          canceledCount: syntheticAgg.canceledCount,
          repurchaseCanceledCount: syntheticAgg.repurchaseCanceledCount,
          rtsCount: syntheticAgg.rtsCount,
          repurchaseRtsCount: syntheticAgg.repurchaseRtsCount,
          matchedOrders: [
            {
              shopId: order.shopId,
              posOrderId: order.posOrderId,
              cod: codVal,
            },
          ],
          shops: [order.shopId],
        },
        update: {
          teamId: order.teamId ?? teamId ?? null,
          purchasesPos: syntheticAgg.purchasesPos,
          codPos: syntheticAgg.codPos,
          processedPurchasesPos: syntheticAgg.processedPurchasesPos,
          repurchaseCount: syntheticAgg.repurchaseCount,
          repurchaseProcessedPurchasesPos: syntheticAgg.repurchaseProcessedPurchasesPos,
          cogsPos: syntheticAgg.cogsPos,
          repurchaseCogsPos: syntheticAgg.repurchaseCogsPos,
          cogsCanceledPos: syntheticAgg.cogsCanceledPos,
          repurchaseCogsCanceledPos: syntheticAgg.repurchaseCogsCanceledPos,
          cogsRestockingPos: syntheticAgg.cogsRestockingPos,
          repurchaseCogsRestockingPos: syntheticAgg.repurchaseCogsRestockingPos,
          cogsRtsPos: syntheticAgg.cogsRtsPos,
          repurchaseCogsRtsPos: syntheticAgg.repurchaseCogsRtsPos,
          cogsDeliveredPos: syntheticAgg.cogsDeliveredPos,
          repurchaseCogsDeliveredPos: syntheticAgg.repurchaseCogsDeliveredPos,
          dateCreated: null,
          mapping: order.mapping ?? null,
          sfPos: sf,
          repurchaseSfPos: repurchaseSf,
          ffPos: ff,
          repurchaseFfPos: repurchaseFf,
          ifPos: inf,
          repurchaseIfPos: repurchaseIf,
          sfSdrPos: sfSdr,
          repurchaseSfSdrPos: repurchaseSfSdr,
          ffSdrPos: ffSdr,
          repurchaseFfSdrPos: repurchaseFfSdr,
          ifSdrPos: infSdr,
          repurchaseIfSdrPos: repurchaseIfSdr,
          codFeePos: codFee,
          repurchaseCodFeePos: repurchaseCodFee,
          codFeeDeliveredPos: codFeeDelivered,
          repurchaseCodFeeDeliveredPos: repurchaseCodFeeDelivered,
          canceledCodPos: syntheticAgg.canceledCodPos,
          repurchaseCanceledCodPos: syntheticAgg.repurchaseCanceledCodPos,
          rtsCodPos: syntheticAgg.rtsCodPos,
          repurchaseRtsCodPos: syntheticAgg.repurchaseRtsCodPos,
          deliveredCodPos: syntheticAgg.deliveredCodPos,
          repurchaseDeliveredCodPos: syntheticAgg.repurchaseDeliveredCodPos,
          shippedCodPos: syntheticAgg.shippedCodPos,
          repurchaseShippedCodPos: syntheticAgg.repurchaseShippedCodPos,
          waitingPickupCodPos: syntheticAgg.waitingPickupCodPos,
          repurchaseWaitingPickupCodPos: syntheticAgg.repurchaseWaitingPickupCodPos,
          restockingCodPos: syntheticAgg.restockingCodPos,
          repurchaseRestockingCodPos: syntheticAgg.repurchaseRestockingCodPos,
          confirmedCodPos: syntheticAgg.confirmedCodPos,
          repurchaseConfirmedCodPos: syntheticAgg.repurchaseConfirmedCodPos,
          unconfirmedCodPos: syntheticAgg.unconfirmedCodPos,
          repurchaseUnconfirmedCodPos: syntheticAgg.repurchaseUnconfirmedCodPos,
          abandonedCodPos: syntheticAgg.abandonedCodPos,
          repurchaseAbandonedCodPos: syntheticAgg.repurchaseAbandonedCodPos,
          confirmedCount: syntheticAgg.confirmedCount,
          repurchaseConfirmedCount: syntheticAgg.repurchaseConfirmedCount,
          unconfirmedCount: syntheticAgg.unconfirmedCount,
          repurchaseUnconfirmedCount: syntheticAgg.repurchaseUnconfirmedCount,
          printedCount: syntheticAgg.printedCount,
          repurchasePrintedCount: syntheticAgg.repurchasePrintedCount,
          deletedCount: syntheticAgg.deletedCount,
          repurchaseDeletedCount: syntheticAgg.repurchaseDeletedCount,
          abandonedCount: syntheticAgg.abandonedCount,
          repurchaseAbandonedCount: syntheticAgg.repurchaseAbandonedCount,
          restockingCount: syntheticAgg.restockingCount,
          repurchaseRestockingCount: syntheticAgg.repurchaseRestockingCount,
          waitingPickupCount: syntheticAgg.waitingPickupCount,
          repurchaseWaitingPickupCount: syntheticAgg.repurchaseWaitingPickupCount,
          shippedCount: syntheticAgg.shippedCount,
          repurchaseShippedCount: syntheticAgg.repurchaseShippedCount,
          deliveredCount: syntheticAgg.deliveredCount,
          repurchaseDeliveredCount: syntheticAgg.repurchaseDeliveredCount,
          canceledCount: syntheticAgg.canceledCount,
          repurchaseCanceledCount: syntheticAgg.repurchaseCanceledCount,
          rtsCount: syntheticAgg.rtsCount,
          repurchaseRtsCount: syntheticAgg.repurchaseRtsCount,
          matchedOrders: [
            {
              shopId: order.shopId,
              posOrderId: order.posOrderId,
              cod: codVal,
            },
          ],
          shops: [order.shopId],
          updatedAt: new Date(),
        },
      });
    }

    await this.bumpAnalyticsCacheVersion(tenantId);
    this.logger.log(`Reconciled marketing for tenant ${tenantId} on ${date}`);
  }
}
