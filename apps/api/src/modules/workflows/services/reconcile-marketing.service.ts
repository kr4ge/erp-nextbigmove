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
  cogs?: any;
  tracking?: string | null;
  mapping?: string | null;
}

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
    const posAgg: Record<
      string,
      {
        purchasesPos: number;
        processedPurchasesPos: number;
        codPos: number;
        cogsPos: number;
        cogsCanceledPos: number;
        cogsRestockingPos: number;
        cogsRtsPos: number;
        cogsDeliveredPos: number;
        confirmedCount: number;
        unconfirmedCount: number; // status 0
        printedCount: number; // status 13
        deletedCount: number; // status 7
        restockingCount: number; // status 11
        abandonedCount: number; // status 0 + ABANDONED tag
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
        orders: PosOrderLite[];
      }
    > = {};
    for (const order of posOrders) {
      const norm = normalizeAdId(order.pUtmContent || '');
      if (!norm) continue;
      if (!posAgg[norm]) {
        posAgg[norm] = {
          purchasesPos: 0,
          processedPurchasesPos: 0,
          codPos: 0,
          cogsPos: 0,
          cogsCanceledPos: 0,
          cogsRestockingPos: 0,
          cogsRtsPos: 0,
          confirmedCount: 0,
          unconfirmedCount: 0,
          printedCount: 0,
          deletedCount: 0,
          confirmedCodPos: 0,
          unconfirmedCodPos: 0,
          restockingCount: 0,
          abandonedCount: 0,
          abandonedCodPos: 0,
          waitingPickupCount: 0,
          shippedCount: 0,
          deliveredCount: 0,
          canceledCount: 0,
          rtsCount: 0,
          canceledCodPos: 0,
          restockingCodPos: 0,
          rtsCodPos: 0,
          deliveredCodPos: 0,
          shippedCodPos: 0,
          waitingPickupCodPos: 0,
          cogsDeliveredPos: 0,
          orders: [],
        };
      }
      const agg = posAgg[norm];
      const status = order.status ?? -1;
      const isVoidOrder = order.isVoid === true;
      const isDeleted = status === 7;
      const isPrinted = status === 13;

      if (isDeleted || (isPrinted && isVoidOrder)) {
        if (isDeleted) {
          agg.deletedCount += 1;
        }
        if (isPrinted) {
          agg.printedCount += 1;
        }
        agg.orders.push(order);
        continue;
      }

      agg.purchasesPos += 1;
      const codVal = parseFloat(order.cod ?? '0') || 0;
      const cogsVal = parseFloat(order.cogs ?? '0') || 0;
      const isAbandoned = order.isAbandoned === true;
      agg.codPos += codVal;
      agg.cogsPos += cogsVal;
      if (order.tracking && order.tracking !== '') {
        agg.processedPurchasesPos += 1;
      }
      if (status === 0) {
        agg.unconfirmedCount += 1;
        agg.unconfirmedCodPos += codVal;
      }
      if (isAbandoned) {
        agg.abandonedCount += 1;
        agg.abandonedCodPos += codVal;
      }
      if (status === 1) {
        agg.confirmedCount += 1;
        agg.confirmedCodPos += codVal;
      }
      if (status === 13) {
        agg.printedCount += 1;
      }
      if (status === 11) {
        agg.restockingCount += 1;
        agg.restockingCodPos += codVal;
        agg.cogsRestockingPos += cogsVal;
      }
      if (status === 9) {
        agg.waitingPickupCount += 1;
        agg.waitingPickupCodPos += codVal;
      }
      if (status === 2) {
        agg.shippedCount += 1;
        agg.shippedCodPos += codVal;
      }
      if (status === 3) {
        agg.deliveredCount += 1;
        agg.deliveredCodPos += codVal;
        agg.cogsDeliveredPos += cogsVal;
      }
      if (status === 6) {
        agg.canceledCount += 1;
        agg.canceledCodPos += codVal;
        agg.cogsCanceledPos += cogsVal;
      }
      if (status === 4 || status === 5) {
        agg.rtsCount += 1;
        agg.rtsCodPos += codVal;
        agg.cogsRtsPos += cogsVal;
      }

      agg.orders.push(order);
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
      const sf = nonCanceled * 60;
      const ff = nonCanceled * 25;
      const inf = nonCanceled * 5;
      const sdr = agg ? agg.shippedCount + agg.deliveredCount + agg.rtsCount : 0;
      const sfSdr = sdr * 60;
      const ffSdr = sdr * 25;
      const infSdr = sdr * 5;
      const eligibleCod = agg
        ? Math.max(agg.codPos - agg.rtsCodPos - agg.canceledCodPos, 0)
        : 0;
      const codFee = eligibleCod * 0.0224;
      const codFeeDelivered = (agg?.deliveredCodPos ?? 0) * 0.0224;
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
          cogsPos: agg?.cogsPos || 0,
          cogsCanceledPos: agg?.cogsCanceledPos || 0,
          cogsRestockingPos: agg?.cogsRestockingPos || 0,
          cogsRtsPos: agg?.cogsRtsPos || 0,
          cogsDeliveredPos: agg?.cogsDeliveredPos || 0,
          sfPos: sf,
          ffPos: ff,
          ifPos: inf,
          sfSdrPos: sfSdr,
          ffSdrPos: ffSdr,
          ifSdrPos: infSdr,
          codFeePos: codFee,
          codFeeDeliveredPos: codFeeDelivered,
          canceledCodPos: agg?.canceledCodPos || 0,
          rtsCodPos: agg?.rtsCodPos || 0,
          deliveredCodPos: agg?.deliveredCodPos || 0,
          shippedCodPos: agg?.shippedCodPos || 0,
          waitingPickupCodPos: agg?.waitingPickupCodPos || 0,
          restockingCodPos: agg?.restockingCodPos || 0,
          confirmedCodPos: agg?.confirmedCodPos || 0,
          unconfirmedCodPos: agg?.unconfirmedCodPos || 0,
          abandonedCodPos: agg?.abandonedCodPos || 0,
          confirmedCount: agg?.confirmedCount || 0,
          unconfirmedCount: agg?.unconfirmedCount || 0,
          printedCount: agg?.printedCount || 0,
          deletedCount: agg?.deletedCount || 0,
          abandonedCount: agg?.abandonedCount || 0,
          restockingCount: agg?.restockingCount || 0,
          waitingPickupCount: agg?.waitingPickupCount || 0,
          shippedCount: agg?.shippedCount || 0,
          deliveredCount: agg?.deliveredCount || 0,
          canceledCount: agg?.canceledCount || 0,
          rtsCount: agg?.rtsCount || 0,
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
          cogsPos: agg?.cogsPos || 0,
          cogsCanceledPos: agg?.cogsCanceledPos || 0,
          cogsRestockingPos: agg?.cogsRestockingPos || 0,
          cogsRtsPos: agg?.cogsRtsPos || 0,
          cogsDeliveredPos: agg?.cogsDeliveredPos || 0,
          sfPos: sf,
          ffPos: ff,
          ifPos: inf,
          sfSdrPos: sfSdr,
          ffSdrPos: ffSdr,
          ifSdrPos: infSdr,
          codFeePos: codFee,
          codFeeDeliveredPos: codFeeDelivered,
          canceledCodPos: agg?.canceledCodPos || 0,
          rtsCodPos: agg?.rtsCodPos || 0,
          deliveredCodPos: agg?.deliveredCodPos || 0,
          shippedCodPos: agg?.shippedCodPos || 0,
          waitingPickupCodPos: agg?.waitingPickupCodPos || 0,
          restockingCodPos: agg?.restockingCodPos || 0,
          confirmedCodPos: agg?.confirmedCodPos || 0,
          unconfirmedCodPos: agg?.unconfirmedCodPos || 0,
          abandonedCodPos: agg?.abandonedCodPos || 0,
          confirmedCount: agg?.confirmedCount || 0,
          unconfirmedCount: agg?.unconfirmedCount || 0,
          printedCount: agg?.printedCount || 0,
          deletedCount: agg?.deletedCount || 0,
          abandonedCount: agg?.abandonedCount || 0,
          restockingCount: agg?.restockingCount || 0,
          waitingPickupCount: agg?.waitingPickupCount || 0,
          shippedCount: agg?.shippedCount || 0,
          deliveredCount: agg?.deliveredCount || 0,
          canceledCount: agg?.canceledCount || 0,
          rtsCount: agg?.rtsCount || 0,
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
      const codVal = parseFloat(order.cod ?? '0') || 0;
      const cogsVal = parseFloat(order.cogs ?? '0') || 0;
      const statusNum = Number.isFinite(order.status as any) ? Number(order.status) : -1;
      const isUnconfirmed = statusNum === 0;
      const isAbandoned = order.isAbandoned === true;
      const isWaitingPickup = statusNum === 9;
      const isShipped = statusNum === 2;
      const isDelivered = statusNum === 3;
      const isCanceled = statusNum === 6;
      const isDeleted = statusNum === 7;
      const isRts = statusNum === 4 || statusNum === 5;
      const isSdr = isShipped || isDelivered || isRts;
      const isConfirmed = statusNum === 1;
      const isPrinted = statusNum === 13;
      const isVoidOrder = order.isVoid === true;
      const isCountOnly = isDeleted || (isPrinted && isVoidOrder);
      const codFee = !isRts && !isCanceled && !isCountOnly ? codVal * 0.0224 : 0;
      const codFeeDelivered = isDelivered ? codVal * 0.0224 : 0;
      const nonCanceled = isCanceled || isCountOnly ? 0 : 1;
      const includedOrderCount = isCountOnly ? 0 : 1;
      const includedCod = isCountOnly ? 0 : codVal;
      const includedCogs = isCountOnly ? 0 : cogsVal;
      const sf = nonCanceled * 60;
      const ff = nonCanceled * 25;
      const inf = nonCanceled * 5;
      const sfSdr = isSdr ? 60 : 0;
      const ffSdr = isSdr ? 25 : 0;
      const infSdr = isSdr ? 5 : 0;
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
          purchasesPos: includedOrderCount,
          codPos: includedCod,
          processedPurchasesPos: !isCountOnly && order.tracking ? 1 : 0,
          cogsPos: includedCogs,
          cogsCanceledPos: !isCountOnly && isCanceled ? cogsVal : 0,
          cogsRestockingPos: !isCountOnly && isWaitingPickup ? 0 : (!isCountOnly && statusNum === 11 ? cogsVal : 0),
          cogsRtsPos: !isCountOnly && isRts ? cogsVal : 0,
          cogsDeliveredPos: !isCountOnly && isDelivered ? cogsVal : 0,
          sfPos: sf,
          ffPos: ff,
          ifPos: inf,
          sfSdrPos: sfSdr,
          ffSdrPos: ffSdr,
          ifSdrPos: infSdr,
          codFeePos: codFee,
          codFeeDeliveredPos: codFeeDelivered,
          canceledCodPos: !isCountOnly && isCanceled ? codVal : 0,
          rtsCodPos: !isCountOnly && isRts ? codVal : 0,
          deliveredCodPos: !isCountOnly && isDelivered ? codVal : 0,
          shippedCodPos: !isCountOnly && isShipped ? codVal : 0,
          waitingPickupCodPos: !isCountOnly && isWaitingPickup ? codVal : 0,
          restockingCodPos: !isCountOnly && statusNum === 11 ? codVal : 0,
          confirmedCodPos: !isCountOnly && isConfirmed ? codVal : 0,
          unconfirmedCodPos: !isCountOnly && isUnconfirmed ? codVal : 0,
          abandonedCodPos: !isCountOnly && isAbandoned ? codVal : 0,
          confirmedCount: statusNum === 1 ? 1 : 0,
          unconfirmedCount: isUnconfirmed ? 1 : 0,
          printedCount: isPrinted ? 1 : 0,
          deletedCount: isDeleted ? 1 : 0,
          abandonedCount: isAbandoned ? 1 : 0,
          restockingCount: statusNum === 11 ? 1 : 0,
          waitingPickupCount: isWaitingPickup ? 1 : 0,
          shippedCount: isShipped ? 1 : 0,
          deliveredCount: isDelivered ? 1 : 0,
          canceledCount: isCanceled ? 1 : 0,
          rtsCount: isRts ? 1 : 0,
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
          purchasesPos: includedOrderCount,
          codPos: includedCod,
          processedPurchasesPos: !isCountOnly && order.tracking ? 1 : 0,
          cogsPos: includedCogs,
          cogsCanceledPos: !isCountOnly && isCanceled ? cogsVal : 0,
          cogsRestockingPos: !isCountOnly && statusNum === 11 ? cogsVal : 0,
          cogsRtsPos: !isCountOnly && isRts ? cogsVal : 0,
          cogsDeliveredPos: !isCountOnly && isDelivered ? cogsVal : 0,
          dateCreated: null,
          mapping: order.mapping ?? null,
          sfPos: sf,
          ffPos: ff,
          ifPos: inf,
          sfSdrPos: sfSdr,
          ffSdrPos: ffSdr,
          ifSdrPos: infSdr,
          codFeePos: codFee,
          codFeeDeliveredPos: codFeeDelivered,
          canceledCodPos: !isCountOnly && isCanceled ? codVal : 0,
          rtsCodPos: !isCountOnly && isRts ? codVal : 0,
          deliveredCodPos: !isCountOnly && isDelivered ? codVal : 0,
          shippedCodPos: !isCountOnly && isShipped ? codVal : 0,
          waitingPickupCodPos: !isCountOnly && isWaitingPickup ? codVal : 0,
          restockingCodPos: !isCountOnly && statusNum === 11 ? codVal : 0,
          confirmedCodPos: !isCountOnly && isConfirmed ? codVal : 0,
          unconfirmedCodPos: !isCountOnly && isUnconfirmed ? codVal : 0,
          abandonedCodPos: !isCountOnly && isAbandoned ? codVal : 0,
          confirmedCount: statusNum === 1 ? 1 : 0,
          unconfirmedCount: isUnconfirmed ? 1 : 0,
          printedCount: isPrinted ? 1 : 0,
          deletedCount: isDeleted ? 1 : 0,
          abandonedCount: isAbandoned ? 1 : 0,
          restockingCount: statusNum === 11 ? 1 : 0,
          waitingPickupCount: isWaitingPickup ? 1 : 0,
          shippedCount: isShipped ? 1 : 0,
          deliveredCount: isDelivered ? 1 : 0,
          canceledCount: isCanceled ? 1 : 0,
          rtsCount: isRts ? 1 : 0,
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
