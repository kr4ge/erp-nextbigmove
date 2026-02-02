import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TeamContextService } from '../../common/services/team-context.service';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import * as customParseFormat from 'dayjs/plugin/customParseFormat';
import { AnalyticsCacheService } from './analytics-cache.service';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

const TIMEZONE = 'Asia/Manila';

type SalesKpis = {
  revenue: number;
  delivered: number;
  shipped: number;
  waiting_pickup: number;
  rts: number;
  ad_spend: number;
  confirmed: number;   // amount (COD) of confirmed orders
  unconfirmed: number; // amount (COD) of unconfirmed/pending orders
  canceled: number;    // amount (COD) of canceled orders
  aov: number;
  contribution_margin: number;
  net_margin: number;
  ar_pct: number;
  cpp: number;
  processed_cpp: number;
  conversion_rate: number;
  profit_efficiency: number;
  cogs: number;
  cogs_canceled: number;
  cogs_restocking: number;
  cogs_rts: number;
  cogs_delivered: number;
  cod_fee: number;
  cod_fee_delivered: number;
  sf_sdr_fees: number;
  ff_sdr_fees: number;
  if_sdr_fees: number;
  gross_cod: number;
  canceled_cod: number;
  restocking_cod: number;
  rts_cod: number;
  sf_fees: number;
  ff_fees: number;
  if_fees: number;
  cm_rts_forecast?: number;
};

type SalesCounts = {
  purchases: number;
  delivered: number;
  shipped: number;
  waiting_pickup: number;
  rts: number;
  confirmed: number;
  unconfirmed: number;
  canceled: number;
};

type ProductRow = {
  mapping: string | null;
  revenue: number;
  gross_sales: number;
  cogs: number;
  aov: number;
  cpp: number;
  processed_cpp: number;
  ad_spend: number;
  ar_pct: number;
  profit_efficiency: number;
  contribution_margin: number;
  net_margin: number;
  rts_count: number;
  delivered_count: number;
  cod_raw: number;
  purchases_raw: number;
  sf_raw: number;
  ff_raw: number;
  if_raw: number;
  cod_fee_delivered_raw: number;
  cogs_ec: number; // COGS excluding canceled
  cogs_rts: number;
  cogs_restocking: number;
  canceled_cod: number;
  restocking_cod: number;
  rts_cod: number;
};

@Injectable()
export class SalesAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teamContext: TeamContextService,
    private readonly analyticsCache: AnalyticsCacheService,
  ) {}

  private readonly logger = new Logger(SalesAnalyticsService.name);

  private parseDate(input?: string): Date {
    if (!input) return new Date();
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException('Invalid date');
    }
    return d;
  }

  private normalize(val?: string | null): string {
    return (val || '').trim().toLowerCase();
  }

  private toNumber(val: any): number {
    const n = typeof val === 'string' ? parseFloat(val) : Number(val);
    return Number.isFinite(n) ? n : 0;
  }

  private shiftDate(dateStr: string, days: number): string {
    return dayjs(dateStr, 'YYYY-MM-DD').add(days, 'day').format('YYYY-MM-DD');
  }

  private diffDays(startStr: string, endStr: string): number {
    const s = dayjs(startStr, 'YYYY-MM-DD');
    const e = dayjs(endStr, 'YYYY-MM-DD');
    return e.diff(s, 'day');
  }

  private computeKpis(sum: any, opts: { excludeCancel: boolean; excludeRestocking: boolean; excludeRts: boolean; includeTax12: boolean; includeTax1: boolean; rtsForecastPct?: number }): SalesKpis {
    const spendBase = this.toNumber(sum?._sum?.spend);
    const spendMultiplier = 1 + (opts.includeTax12 ? 0.12 : 0) + (opts.includeTax1 ? 0.01 : 0);
    const spend = spendBase * spendMultiplier;
    const cod = this.toNumber(sum?._sum?.codPos);
    const canceledCod = this.toNumber(sum?._sum?.canceledCodPos);
    const restockingCod = this.toNumber(sum?._sum?.restockingCodPos);
    const rtsCod = this.toNumber(sum?._sum?.rtsCodPos);
    const codFee = this.toNumber(sum?._sum?.codFeePos);

    // Revenue after optional exclusions
    const revenue =
      cod
      - (opts.excludeCancel ? canceledCod : 0)
      - (opts.excludeRestocking ? restockingCod : 0)
      - (opts.excludeRts ? rtsCod : 0);

    const cogs = this.toNumber(sum?._sum?.cogsPos);
    const cogsCanceled = this.toNumber(sum?._sum?.cogsCanceledPos);
    const cogsRestocking = this.toNumber(sum?._sum?.cogsRestockingPos);
    const cogsRts = this.toNumber(sum?._sum?.cogsRtsPos);
    const cogsDelivered = this.toNumber(sum?._sum?.cogsDeliveredPos);
    const sf = this.toNumber(sum?._sum?.sfPos);
    const ff = this.toNumber(sum?._sum?.ffPos);
    const inf = this.toNumber(sum?._sum?.ifPos);
    const sfSdr = this.toNumber(sum?._sum?.sfSdrPos);
    const ffSdr = this.toNumber(sum?._sum?.ffSdrPos);
    const ifSdr = this.toNumber(sum?._sum?.ifSdrPos);
    // COGS after optional exclusions (remove excluded portions from the total once)
    const cogsAdjusted =
      cogs
      - (opts.excludeCancel ? cogsCanceled : 0)
      - (opts.excludeRestocking ? cogsRestocking : 0)
      - (opts.excludeRts ? cogsRts : 0);
    const arPct = revenue > 0 ? (spend / revenue) * 100 : 0;

    const cm =
      revenue
      - cogsAdjusted
      - sf
      - ff
      - inf
      - spend
      - codFee;
    const delivered = this.toNumber(sum?._sum?.deliveredCodPos);
    const codFeeDelivered = this.toNumber(sum?._sum?.codFeeDeliveredPos);
    const net =
      delivered
      - sfSdr
      - ffSdr
      - ifSdr
      - codFeeDelivered
      - cogsDelivered
      - spend;

    // AOV uses adjusted purchases (respecting exclude flags for cancel/restocking/RTS)
    const purchasesRaw = this.toNumber(sum?._sum?.purchasesPos);
    const cancelAdjCount = opts.excludeCancel ? this.toNumber(sum?._sum?.canceledCount) : 0;
    const restockAdjCount = opts.excludeRestocking ? this.toNumber(sum?._sum?.restockingCount) : 0;
    const rtsAdjCount = opts.excludeRts ? this.toNumber(sum?._sum?.rtsCount) : 0;
    const purchasesAdj = Math.max(0, purchasesRaw - cancelAdjCount - restockAdjCount - rtsAdjCount);
    const processedPurchases = this.toNumber(sum?._sum?.processedPurchasesPos);
    const cpp = purchasesAdj > 0 ? spend / purchasesAdj : 0;
    const processedCpp = processedPurchases > 0 ? spend / processedPurchases : 0;
    const leads = this.toNumber(sum?._sum?.leads);
    const conversionRate = leads > 0 ? (purchasesAdj / leads) * 100 : 0;
    const profitEfficiency = spend > 0 ? (cm / spend) * 100 : 0;

    const grossCodAdjusted =
      cod
      - (opts.excludeCancel ? canceledCod : 0)
      - (opts.excludeRestocking ? restockingCod : 0);
    const cogsAdjustedForCmRts =
      cogs
      - (opts.excludeCancel ? cogsCanceled : 0)
      - (opts.excludeRestocking ? cogsRestocking : 0);
    const rtsForecast = typeof opts.rtsForecastPct === 'number' ? opts.rtsForecastPct : 20;
    const rtsFraction = rtsForecast / 100;
    const cmRtsForecast =
      (1 - rtsFraction) * grossCodAdjusted -
      spend -
      sf -
      ff -
      inf -
      this.toNumber(sum?._sum?.codFeeDeliveredPos) -
      cogsAdjustedForCmRts +
      cogsRts;

    return {
      revenue,
      delivered: this.toNumber(sum?._sum?.deliveredCodPos),
      shipped: this.toNumber(sum?._sum?.shippedCodPos),
      waiting_pickup: this.toNumber(sum?._sum?.waitingPickupCodPos),
      rts: this.toNumber(sum?._sum?.rtsCodPos),
      ad_spend: spend,
      aov: purchasesAdj > 0 ? revenue / purchasesAdj : 0,
      ar_pct: arPct,
      cpp,
      processed_cpp: processedCpp,
      conversion_rate: conversionRate,
      profit_efficiency: profitEfficiency,
      confirmed: this.toNumber(sum?._sum?.confirmedCodPos),
      unconfirmed: this.toNumber(sum?._sum?.unconfirmedCodPos),
      // Show canceled COD regardless of exclude_cancel toggle for KPI display
      canceled: this.toNumber(sum?._sum?.canceledCodPos),
      contribution_margin: cm,
      net_margin: net,
      cogs: cogs,
      cogs_canceled: cogsCanceled,
      cogs_restocking: cogsRestocking,
      cogs_rts: cogsRts,
      cogs_delivered: cogsDelivered,
      cod_fee: this.toNumber(sum?._sum?.codFeePos),
      cod_fee_delivered: this.toNumber(sum?._sum?.codFeeDeliveredPos),
      sf_sdr_fees: sfSdr,
      ff_sdr_fees: ffSdr,
      if_sdr_fees: ifSdr,
      gross_cod: cod,
      canceled_cod: canceledCod,
      restocking_cod: restockingCod,
      rts_cod: rtsCod,
      sf_fees: sf,
      ff_fees: ff,
      if_fees: inf,
      cm_rts_forecast: cmRtsForecast,
    };
  }

  private computeCounts(sum: any, opts: { excludeCancel: boolean; excludeRestocking: boolean; excludeRts: boolean }): SalesCounts {
    const purchasesRaw = this.toNumber(sum?._sum?.purchasesPos);
    const cancelAdj = opts.excludeCancel ? this.toNumber(sum?._sum?.canceledCount) : 0;
    const restockAdj = opts.excludeRestocking ? this.toNumber(sum?._sum?.restockingCount) : 0;
    const rtsAdj = opts.excludeRts ? this.toNumber(sum?._sum?.rtsCount) : 0;
    const adj = Math.min(purchasesRaw, cancelAdj + restockAdj + rtsAdj);
    const purchases = Math.max(0, purchasesRaw - adj);
    return {
      purchases,
      delivered: this.toNumber(sum?._sum?.deliveredCount),
      shipped: this.toNumber(sum?._sum?.shippedCount),
      waiting_pickup: this.toNumber(sum?._sum?.waitingPickupCount),
      // Keep RTS count constant regardless of excludeRts toggle so KPI remains comparable
      rts: this.toNumber(sum?._sum?.rtsCount),
      confirmed: this.toNumber(sum?._sum?.confirmedCount),
      unconfirmed: this.toNumber(sum?._sum?.unconfirmedCount),
      // Show canceled count regardless of exclude_cancel toggle for KPI display
      canceled: this.toNumber(sum?._sum?.canceledCount),
    };
  }

  private computeProductRow(sum: any, opts: { excludeCancel: boolean; excludeRestocking: boolean; excludeRts: boolean; includeTax12: boolean; includeTax1: boolean }): ProductRow {
    const spendBase = this.toNumber(sum?._sum?.spend);
    const spendMultiplier = 1 + (opts.includeTax12 ? 0.12 : 0) + (opts.includeTax1 ? 0.01 : 0);
    const spend = spendBase * spendMultiplier;
    const cod = this.toNumber(sum?._sum?.codPos);
    const canceledCod = this.toNumber(sum?._sum?.canceledCodPos);
    const restockingCod = this.toNumber(sum?._sum?.restockingCodPos);
    const rtsCod = this.toNumber(sum?._sum?.rtsCodPos);
    const revenue =
      cod
      - (opts.excludeCancel ? canceledCod : 0)
      - (opts.excludeRestocking ? restockingCod : 0)
      - (opts.excludeRts ? rtsCod : 0);

    const purchasesRaw = this.toNumber(sum?._sum?.purchasesPos);
    const cancelAdjCount = opts.excludeCancel ? this.toNumber(sum?._sum?.canceledCount) : 0;
    const restockAdjCount = opts.excludeRestocking ? this.toNumber(sum?._sum?.restockingCount) : 0;
    const rtsAdjCount = opts.excludeRts ? this.toNumber(sum?._sum?.rtsCount) : 0;
    const purchasesAdj = Math.max(0, purchasesRaw - cancelAdjCount - restockAdjCount - rtsAdjCount);
    const processedPurchases = this.toNumber(sum?._sum?.processedPurchasesPos);

    const cogs = this.toNumber(sum?._sum?.cogsPos);
    const cogsCanceled = this.toNumber(sum?._sum?.cogsCanceledPos);
    const cogsRestocking = this.toNumber(sum?._sum?.cogsRestockingPos);
    const cogsRts = this.toNumber(sum?._sum?.cogsRtsPos);
    const cogsAdjusted =
      cogs
      - (opts.excludeCancel ? cogsCanceled : 0)
      - (opts.excludeRestocking ? cogsRestocking : 0)
      - (opts.excludeRts ? cogsRts : 0);

    const sf = this.toNumber(sum?._sum?.sfPos);
    const ff = this.toNumber(sum?._sum?.ffPos);
    const inf = this.toNumber(sum?._sum?.ifPos);
    const codFee = this.toNumber(sum?._sum?.codFeePos);

    const cm =
      revenue
      - cogsAdjusted
      - sf
      - ff
      - inf
      - spend
      - codFee;

    const delivered = this.toNumber(sum?._sum?.deliveredCodPos);
    const sfSdr = this.toNumber(sum?._sum?.sfSdrPos);
    const ffSdr = this.toNumber(sum?._sum?.ffSdrPos);
    const ifSdr = this.toNumber(sum?._sum?.ifSdrPos);
    const codFeeDelivered = this.toNumber(sum?._sum?.codFeeDeliveredPos);
    const cogsDelivered = this.toNumber(sum?._sum?.cogsDeliveredPos);
    const net =
      delivered
      - sfSdr
      - ffSdr
      - ifSdr
      - codFeeDelivered
      - cogsDelivered
      - spend;

    const arPct = revenue > 0 ? (spend / revenue) * 100 : 0;
    const profitEfficiency = spend > 0 ? (cm / spend) * 100 : 0;
    const aov = purchasesAdj > 0 ? revenue / purchasesAdj : 0;
    const cpp = purchasesAdj > 0 ? spend / purchasesAdj : 0;
    const processedCpp = processedPurchases > 0 ? spend / processedPurchases : 0;

    return {
      mapping: sum.mapping ?? null,
      revenue,
      gross_sales: purchasesAdj,
      cogs: cogsAdjusted,
      aov,
      cpp,
      processed_cpp: processedCpp,
      ad_spend: spend,
      ar_pct: arPct,
      profit_efficiency: profitEfficiency,
      contribution_margin: cm,
      net_margin: net,
      rts_count: this.toNumber(sum?._sum?.rtsCount),
      delivered_count: this.toNumber(sum?._sum?.deliveredCount),
      cod_raw: cod,
      purchases_raw: purchasesRaw,
      sf_raw: sf,
      ff_raw: ff,
      if_raw: inf,
      cod_fee_delivered_raw: this.toNumber(sum?._sum?.codFeeDeliveredPos),
      cogs_ec: cogs - cogsCanceled, // exclude canceled only
      cogs_rts: cogsRts,
      cogs_restocking: this.toNumber(sum?._sum?.cogsRestockingPos),
      canceled_cod: canceledCod,
      restocking_cod: restockingCod,
      rts_cod: rtsCod,
    };
  }

  async getOverview(params: { startDate?: string; endDate?: string; mappings?: string[]; excludeCancel?: boolean; excludeRestocking?: boolean; excludeRts?: boolean; includeTax12?: boolean; includeTax1?: boolean }) {
    const { startDate, endDate, mappings = [], excludeCancel = true, excludeRestocking = true, excludeRts = true, includeTax12 = false, includeTax1 = false } = params;

    const startStr = (startDate && startDate.trim()) || dayjs().tz(TIMEZONE).format('YYYY-MM-DD');
    const endStr = (endDate && endDate.trim()) || startStr;

    // Validate date formats
    if (!dayjs(startStr, 'YYYY-MM-DD', true).isValid()) {
      throw new BadRequestException('Invalid start_date format. Expected YYYY-MM-DD');
    }
    if (!dayjs(endStr, 'YYYY-MM-DD', true).isValid()) {
      throw new BadRequestException('Invalid end_date format. Expected YYYY-MM-DD');
    }
    if (endStr < startStr) {
      throw new BadRequestException('start_date must be before or equal to end_date');
    }
    const rangeDays = this.diffDays(startStr, endStr) + 1;
    const prevEndStr = this.shiftDate(startStr, -1);
    const prevStartStr = this.shiftDate(startStr, -rangeDays);

    // Convert to Date objects for Prisma queries (date column stores calendar dates, no time component)
    const startDate_dt = new Date(`${startStr}T00:00:00.000Z`);
    const endDate_dt = new Date(`${endStr}T00:00:00.000Z`);
    const prevStartDate_dt = new Date(`${prevStartStr}T00:00:00.000Z`);
    const prevEndDate_dt = new Date(`${prevEndStr}T00:00:00.000Z`);

    const normalizedMappings = mappings.map((m) => this.normalize(m)).filter((v) => v.length > 0);
    const includeNull = normalizedMappings.includes(this.normalize('__null__'));

    const { tenantId, teamId } = await this.teamContext.getContext();
    const effectiveTeamIds = await this.teamContext.getAnalyticsTeamIds('sales');

    const mappingFilter =
      normalizedMappings.length > 0
        ? {
            OR: [
              ...normalizedMappings
                .filter((m) => m !== this.normalize('__null__'))
                .map((m) => ({
                  mapping: { equals: m, mode: 'insensitive' as const },
                })),
              ...(includeNull ? [{ mapping: null as any }] : []),
            ],
          }
        : {};

    const baseWhere = await this.teamContext.buildTeamWhereClause(
      {
        date: { gte: startDate_dt, lte: endDate_dt },
      },
      effectiveTeamIds || undefined,
    );

    const where = {
      ...baseWhere,
      ...mappingFilter,
    };

    const cacheVersion = await this.analyticsCache.getVersion(tenantId);
    const cacheTeamIds = effectiveTeamIds ? [...effectiveTeamIds].sort() : teamId ? [teamId] : [];
    const cacheKeyPayload = {
      tenantId,
      teamIds: cacheTeamIds,
      start: startStr,
      end: endStr,
      mappings: normalizedMappings.sort(),
      includeNull,
      flags: { excludeCancel, excludeRestocking, excludeRts, includeTax12, includeTax1 },
    };
    const cacheKey = `analytics:${tenantId}:${cacheVersion}:sales:${this.analyticsCache.hashObject(cacheKeyPayload)}`;
    const cached = await this.analyticsCache.get<any>(cacheKey);
    if (cached) {
      this.logger.log(`CACHE HIT ${cacheKey}`);
      return cached;
    }
    this.logger.log(`CACHE MISS ${cacheKey}`);

    const [agg, prevAgg, mappingRows, nullCount, productGroups, lastUpdatedAgg] = await Promise.all([
      this.prisma.reconcileSales.aggregate({
        where,
        _sum: {
          spend: true,
          codPos: true,
          purchasesPos: true,
          processedPurchasesPos: true,
          leads: true,
          deliveredCodPos: true,
          shippedCodPos: true,
          waitingPickupCodPos: true,
          rtsCodPos: true,
          canceledCodPos: true,
          restockingCodPos: true,
          deliveredCount: true,
          shippedCount: true,
          waitingPickupCount: true,
          rtsCount: true,
          canceledCount: true,
          restockingCount: true,
          confirmedCount: true,
          unconfirmedCount: true,
          confirmedCodPos: true,
          unconfirmedCodPos: true,
          cogsPos: true,
          cogsCanceledPos: true,
          cogsRestockingPos: true,
          cogsRtsPos: true,
          cogsDeliveredPos: true,
          codFeePos: true,
          codFeeDeliveredPos: true,
          sfPos: true,
          ffPos: true,
          ifPos: true,
          sfSdrPos: true,
          ffSdrPos: true,
          ifSdrPos: true,
        },
      }),
      this.prisma.reconcileSales.aggregate({
        where: {
          ...baseWhere,
          ...mappingFilter,
          date: { gte: prevStartDate_dt, lte: prevEndDate_dt },
        },
        _sum: {
          spend: true,
          codPos: true,
          purchasesPos: true,
          processedPurchasesPos: true,
          leads: true,
          deliveredCodPos: true,
          shippedCodPos: true,
          waitingPickupCodPos: true,
          rtsCodPos: true,
          canceledCodPos: true,
          restockingCodPos: true,
          deliveredCount: true,
          shippedCount: true,
          waitingPickupCount: true,
          rtsCount: true,
          canceledCount: true,
          restockingCount: true,
          confirmedCount: true,
          unconfirmedCount: true,
          confirmedCodPos: true,
          unconfirmedCodPos: true,
          cogsPos: true,
          cogsCanceledPos: true,
          cogsRestockingPos: true,
          cogsRtsPos: true,
          cogsDeliveredPos: true,
          codFeePos: true,
          codFeeDeliveredPos: true,
          sfPos: true,
          ffPos: true,
          ifPos: true,
          sfSdrPos: true,
          ffSdrPos: true,
          ifSdrPos: true,
        },
      }),
      this.prisma.reconcileSales.findMany({
        where: {
          ...baseWhere,
          mapping: { not: null },
        },
        distinct: ['mapping'],
        select: { mapping: true },
      }),
      this.prisma.reconcileSales.count({
        where: {
          ...baseWhere,
          mapping: null,
        },
      }),
      this.prisma.reconcileSales.groupBy({
        by: ['mapping'],
        where,
        _sum: {
          spend: true,
          codPos: true,
          purchasesPos: true,
          processedPurchasesPos: true,
          leads: true,
          deliveredCodPos: true,
          shippedCodPos: true,
          waitingPickupCodPos: true,
          rtsCodPos: true,
          canceledCodPos: true,
          restockingCodPos: true,
          deliveredCount: true,
          shippedCount: true,
          waitingPickupCount: true,
          rtsCount: true,
          canceledCount: true,
          restockingCount: true,
          confirmedCount: true,
          unconfirmedCount: true,
          confirmedCodPos: true,
          unconfirmedCodPos: true,
          cogsPos: true,
          cogsCanceledPos: true,
          cogsRestockingPos: true,
          cogsRtsPos: true,
          cogsDeliveredPos: true,
          codFeePos: true,
          codFeeDeliveredPos: true,
          sfPos: true,
          ffPos: true,
          ifPos: true,
          sfSdrPos: true,
          ffSdrPos: true,
          ifSdrPos: true,
        },
      }),
      this.prisma.reconcileSales.aggregate({
        where,
        _max: { updatedAt: true },
      }),
    ]);

    const mappingOptions: string[] = [];
    const mappingDisplayMap: Record<string, string> = {};
    mappingRows.forEach((r) => {
      if (!r.mapping) return;
      const norm = this.normalize(r.mapping);
      if (!mappingDisplayMap[norm]) {
        mappingDisplayMap[norm] = r.mapping;
        mappingOptions.push(norm);
      }
    });
    if (nullCount > 0) {
      const key = this.normalize('__null__');
      mappingDisplayMap[key] = `Unassigned (${nullCount})`;
      mappingOptions.push(key);
    }
    mappingOptions.sort((a, b) => (mappingDisplayMap[a] || a).localeCompare(mappingDisplayMap[b] || b));

    const products = productGroups.map((g) => {
      const row = this.computeProductRow({ _sum: g._sum, mapping: g.mapping }, { excludeCancel, excludeRestocking, excludeRts, includeTax12, includeTax1 });
      return {
        ...row,
        mapping: g.mapping,
      };
    });

    const rtsForecastPct = 20;
    const kpis = this.computeKpis(agg, { excludeCancel, excludeRestocking, excludeRts, includeTax12, includeTax1, rtsForecastPct });
    const prevKpis = this.computeKpis(prevAgg, { excludeCancel, excludeRestocking, excludeRts, includeTax12, includeTax1, rtsForecastPct });
    const counts = this.computeCounts(agg, { excludeCancel, excludeRestocking, excludeRts });
    const prevCounts = this.computeCounts(prevAgg, { excludeCancel, excludeRestocking, excludeRts });

    const response = {
      kpis,
      counts,
      prevCounts,
      prevKpis,
      filters: {
        mappings: mappingOptions,
        mappingsDisplayMap: mappingDisplayMap,
      },
      selected: {
        start_date: startStr,
        end_date: endStr,
        mappings: normalizedMappings,
      },
      rangeDays,
      lastUpdatedAt: lastUpdatedAgg?._max?.updatedAt || null,
      products,
    };

    this.logger.log(`CACHE SET ${cacheKey}`);
    await this.analyticsCache.set(cacheKey, response);
    return response;
  }
}
