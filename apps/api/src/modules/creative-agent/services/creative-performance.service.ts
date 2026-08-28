import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CREATIVE_AGENT_PERMISSIONS } from '../creative-agent.constants';
import {
  ListAdvertisingPerformanceQueryDto,
  type AdvertisingPerformanceGroup,
  type AdvertisingPerformanceSortKey,
} from '../dto/list-advertising-performance-query.dto';
import type { CreativeActor } from '../types/creative-actor.type';
import {
  ADVERTISING_PROVISIONAL_DEFAULTS,
  adSpendRatio,
  clickThroughRate,
  codCeiling,
  completionRate,
  conversionRate,
  costPerClick,
  costPerOrder,
  deliveredCostPerOrder,
  holdRate,
  hookRate,
  landingPageRate,
  netContribution,
  resolvedRates,
  type CeilingResult,
} from '../utils/advertising-metrics';
import { advertisingVerdict, type AdvertisingVerdict } from '../utils/advertising-verdict';
import { guardedRatio, round, safeRatio } from '../utils/creative-metrics';
import { loadCreativeStoreOptions } from './creative-store-options';
import { CreativeAccessService } from './creative-access.service';

dayjs.extend(utc);
dayjs.extend(timezone);

const MANILA_TZ = 'Asia/Manila';
/** Synthetic reconcile rows created for POS orders no ad claimed. */
const UNMATCHED_AD_NAME = 'POS Unmatched Order';

export type AdvertisingScope = {
  totals: {
    spend: number; linkClicks: number; impressions: number; leads: number;
    orders: number; grossSales: number; adjustedSales: number;
    delivered: number; cancelled: number; rts: number;
    deliveredSales: number; deliveredCosts: number;
  };
  ceiling: CeilingResult;
  attributionCoverage: number | null;
  linkedSpendCoverage: number | null;
  linkedSpend: number;
  unlinkedSpend: number;
  totalPosOrders: number;
  attributedPosOrders: number;
  verdictsSuppressed: boolean;
  benchmarks: {
    benchmarkCtr: number;
    maxCancellationRate: number;
    minAttributionCoverage: number;
    safetyMargin: number;
    provisional: true;
  };
};

export type AdvertisingDateRange = {
  start: Date; end: Date; startKey: string; endKey: string; days: number;
  today: Date; yesterday: Date; todayKey: string;
};

type RawRow = {
  key: string;
  ad_id: string | null;
  account_id: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  ad_name: string | null;
  status: string | null;
  first_spend_date: Date | null;
  last_spend_date: Date | null;
  spend: number | null;
  link_clicks: number | null;
  clicks: number | null;
  impressions: number | null;
  leads: number | null;
  orders: number | null;
  gross_sales: number | null;
  delivered_sales: number | null;
  delivered_costs: number | null;
  delivered: number | null;
  cancelled: number | null;
  rts: number | null;
  spend_today: number | null;
  orders_today: number | null;
  spend_yesterday: number | null;
  plays3s: number | null;
  video_impressions: number | null;
  thru_plays_h: number | null;
  plays3s_h: number | null;
  thru_plays: number | null;
  thru_impressions: number | null;
  watch_num: number | null;
  watch_den: number | null;
  ret25: number | null; ret25_den: number | null;
  ret50: number | null; ret50_den: number | null;
  ret75: number | null; ret75_den: number | null;
  ret95: number | null; ret95_den: number | null;
  ret100: number | null; ret100_den: number | null;
  creative_id: string | null;
  code: string | null;
  title: string | null;
  kind: string | null;
  media_url: string | null;
  performance_status: string | null;
  store_id: string | null;
  store_name: string | null;
  creator_first: string | null;
  creator_last: string | null;
  creator_email: string | null;
  ad_count: number | null;
  total_rows: number;
};

/**
 * Sort keys map to FIXED SQL fragments. These expressions exist only for
 * ORDER BY / filtering; every value the API returns is recomputed in
 * TypeScript through utils/advertising-metrics so formulas stay single-sourced.
 */
const SORT_FRAGMENTS: Record<AdvertisingPerformanceSortKey, string> = {
  name: `COALESCE(b.title, b.ad_name, b.campaign_name, b.key)`,
  spend: `b.spend`,
  ordersToday: `b.orders_today`,
  spendToday: `b.spend_today`,
  spendYesterday: `b.spend_yesterday`,
  orders: `b.orders`,
  cpp: `CASE WHEN b.orders > 0 THEN b.spend / b.orders END`,
  cpc: `CASE WHEN b.link_clicks > 0 THEN b.spend / b.link_clicks END`,
  deliveredCpp: `CASE WHEN b.delivered > 0 THEN b.spend / b.delivered END`,
  grossSales: `b.gross_sales`,
  deliveredSales: `b.delivered_sales`,
  netContribution: `(b.delivered_sales - b.delivered_costs - b.spend)`,
  adSpendRatio: `CASE WHEN b.gross_sales > 0 THEN b.spend / b.gross_sales END`,
  trueRoas: `CASE WHEN b.spend > 0 THEN b.delivered_sales / b.spend END`,
  impressions: `b.impressions`,
  linkClicks: `b.link_clicks`,
  landingPageViews: `b.leads`,
  hookRate: `CASE WHEN b.video_impressions > 0 THEN b.plays3s / b.video_impressions END`,
  holdRate: `CASE WHEN b.plays3s_h > 0 THEN b.thru_plays_h / b.plays3s_h END`,
  completionRate: `CASE WHEN b.thru_impressions > 0 THEN b.thru_plays / b.thru_impressions END`,
  ctr: `CASE WHEN b.impressions > 0 THEN b.link_clicks / b.impressions END`,
  cvr: `CASE WHEN b.leads > 0 THEN b.orders / b.leads END`,
  delivered: `b.delivered`,
  cancelled: `b.cancelled`,
  rts: `b.rts`,
  deliveryRate: `CASE WHEN (b.delivered + b.cancelled + b.rts) > 0 THEN b.delivered / (b.delivered + b.cancelled + b.rts) END`,
  cancellationRate: `CASE WHEN (b.delivered + b.cancelled + b.rts) > 0 THEN b.cancelled / (b.delivered + b.cancelled + b.rts) END`,
  rtsRate: `CASE WHEN (b.delivered + b.cancelled + b.rts) > 0 THEN b.rts / (b.delivered + b.cancelled + b.rts) END`,
  firstSpendDate: `b.first_spend_date`,
  lastSpendDate: `b.last_spend_date`,
};

@Injectable()
export class CreativePerformanceService {
  constructor(private readonly prisma: PrismaService, private readonly access: CreativeAccessService) {}

  async list(actor: CreativeActor, query: ListAdvertisingPerformanceQueryDto) {
    const context = await this.access.resolve(actor);
    this.access.require(context, CREATIVE_AGENT_PERMISSIONS.READ_ALL);
    const range = this.resolveDateRange(query.startDate, query.endDate);
    const storeOptions = await loadCreativeStoreOptions(this.prisma, context.tenantId);
    // One usable store means there is nothing to choose between: pin it.
    const requestedStoreId = query.storeId ?? storeOptions.defaultStoreId ?? undefined;
    let storeAdIds = await this.resolveScopedAdIds(context.tenantId, requestedStoreId, query.creatorId);
    // An auto-PINNED store (no explicit query.storeId) that has no linked ads
    // would otherwise blank the whole page. Fall through to tenant-wide so the
    // unlinked spend is still visible; an EXPLICIT store choice is respected.
    let effectiveStoreId = requestedStoreId;
    if (!query.storeId && storeAdIds !== null && storeAdIds.length === 0) {
      effectiveStoreId = undefined;
      storeAdIds = query.creatorId
        ? await this.resolveScopedAdIds(context.tenantId, undefined, query.creatorId)
        : null;
    }
    const scope = await this.computeScope(context.tenantId, range, {
      accountId: query.accountId, storeAdIds,
    });

    const [accounts, page] = await Promise.all([
      this.loadAccountOptions(context.tenantId),
      this.queryRows(context.tenantId, range, scope, query, storeAdIds, effectiveStoreId),
    ]);
    const filters = { stores: storeOptions.stores, accounts };

    return {
      selected: {
        startDate: range.startKey, endDate: range.endKey,
        query: query.query ?? '', storeId: effectiveStoreId ?? '', accountId: query.accountId ?? '',
        adId: query.adId ?? '', campaignId: query.campaignId ?? '', creativeId: query.creativeId ?? '', creatorId: query.creatorId ?? '',
        group: query.group, verdict: query.verdict, linkStatus: query.linkStatus,
        hideNoOrders: query.hideNoOrders ?? false, minSpend: query.minSpend ?? null,
        showInactive: query.showInactive ?? false,
        page: page.page, pageSize: query.pageSize,
        sortKey: query.sortKey, sortDirection: query.sortDirection,
      },
      permissions: {
        canManageLinks: this.access.has(context, CREATIVE_AGENT_PERMISSIONS.ALIAS_MANAGE),
        canManagePerformance: this.access.has(context, CREATIVE_AGENT_PERMISSIONS.PERFORMANCE_MANAGE),
        canReview: this.access.has(context, CREATIVE_AGENT_PERMISSIONS.REVIEW),
      },
      filters,
      scope: {
        ceiling: scope.ceiling,
        benchmarks: scope.benchmarks,
        attributionCoverage: scope.attributionCoverage,
        linkedSpendCoverage: scope.linkedSpendCoverage,
        verdictsSuppressed: scope.verdictsSuppressed,
      },
      items: page.items,
      pagination: { page: page.page, pageSize: query.pageSize, total: page.total, totalPages: page.totalPages },
      warnings: [
        ...(scope.verdictsSuppressed ? [{
          code: 'LOW_ATTRIBUTION_COVERAGE', severity: 'warning' as const,
          message: `Order attribution coverage is ${scope.attributionCoverage === null ? 'unknown' : `${(scope.attributionCoverage * 100).toFixed(1)}%`} — per-row verdicts are suppressed below ${(scope.benchmarks.minAttributionCoverage * 100).toFixed(0)}%.`,
        }] : []),
        ...(scope.ceiling.workingCeiling !== null && scope.ceiling.provisional ? [{
          code: 'PROVISIONAL_CEILING', severity: 'info' as const,
          message: 'No target CPP is configured; the working ceiling is derived from the reconciled break-even with a provisional safety margin.',
        }] : []),
      ],
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Scope-level economics shared by Performance and the Advertising dashboard:
   * period totals, the COD ceiling, and both coverage figures. Order
   * attribution coverage counts synthetic "POS Unmatched Order" rows in its
   * denominator; linked-spend coverage compares spend on linked ad ids against
   * all spend. The two intentionally have different denominators.
   */
  async computeScope(
    tenantId: string,
    range: AdvertisingDateRange,
    filter: { accountId?: string; storeAdIds: string[] | null },
  ): Promise<AdvertisingScope> {
    const date = { gte: range.start, lte: range.end };
    const baseWhere: Prisma.ReconcileMarketingWhereInput = {
      tenantId, date,
      ...(filter.accountId ? { accountId: filter.accountId } : {}),
      ...(filter.storeAdIds ? { adId: { in: filter.storeAdIds } } : {}),
    };
    const attributedWhere: Prisma.ReconcileMarketingWhereInput = {
      ...baseWhere,
      // Null-safe exclusion of synthetic unmatched rows: a NULL adName row is
      // still an attributed ad row (matches the SQL IS DISTINCT FROM filter).
      OR: [{ adName: null }, { adName: { not: UNMATCHED_AD_NAME } }],
    };
    const [attributed, allRows, linkRows] = await Promise.all([
      this.prisma.reconcileMarketing.aggregate({
        where: attributedWhere,
        _sum: {
          spend: true, linkClicks: true, impressions: true, leads: true, purchasesPos: true,
          codPos: true, canceledCodPos: true, rtsCodPos: true, restockingCodPos: true, abandonedCodPos: true,
          deliveredCount: true, canceledCount: true, rtsCount: true,
          deliveredCodPos: true, cogsDeliveredPos: true,
          sfSdrPos: true, ffSdrPos: true, ifSdrPos: true, codFeeDeliveredPos: true,
        },
      }),
      this.prisma.reconcileMarketing.aggregate({ where: baseWhere, _sum: { purchasesPos: true } }),
      this.prisma.creativeMetaAdLink.findMany({ where: { tenantId }, select: { adId: true } }),
    ]);
    const sums = attributed._sum;
    const toNum = (value: Prisma.Decimal | number | null) => Number(value ?? 0);
    const spend = toNum(sums.spend);
    const grossSales = toNum(sums.codPos);
    // AR% denominator follows the Marketing KPI exclusion policy
    // (DEFAULT_KPI_EXCLUSION_OPTIONS): cancel, RTS, restocking, and abandoned
    // values are excluded from revenue; no tax uplift is applied.
    const adjustedSales = Math.max(0, grossSales
      - toNum(sums.canceledCodPos) - toNum(sums.rtsCodPos)
      - toNum(sums.restockingCodPos) - toNum(sums.abandonedCodPos));
    const delivered = sums.deliveredCount ?? 0;
    const cancelled = sums.canceledCount ?? 0;
    const rts = sums.rtsCount ?? 0;
    const deliveredSales = toNum(sums.deliveredCodPos);
    const deliveredCosts = toNum(sums.cogsDeliveredPos) + toNum(sums.sfSdrPos)
      + toNum(sums.ffSdrPos) + toNum(sums.ifSdrPos) + toNum(sums.codFeeDeliveredPos);
    const rates = resolvedRates(delivered, cancelled, rts);
    const ceiling = codCeiling({
      deliveredRevenue: deliveredSales,
      deliveredCogs: toNum(sums.cogsDeliveredPos),
      fulfillmentCosts: deliveredCosts - toNum(sums.cogsDeliveredPos),
      deliveredCount: delivered,
      deliveryRate: rates.deliveryRate,
      rtsRate: rates.rtsRate,
      // No RTS-cost source exists in the ERP; the term is dropped and the
      // ceiling flagged provisional rather than inventing a peso figure.
      rtsCostPerRtsOrder: null,
      // No configured target CPP source exists (MarketingKpiTarget has no CPP
      // metric); fall back to break-even × (1 − safety margin), provisional.
      configuredTargetCpp: null,
      safetyMargin: ADVERTISING_PROVISIONAL_DEFAULTS.safetyMargin,
    });
    const attributedPosOrders = sums.purchasesPos ?? 0;
    const totalPosOrders = allRows._sum.purchasesPos ?? 0;
    const attributionCoverage = totalPosOrders > 0 ? round(attributedPosOrders / totalPosOrders) : null;

    // The linked-spend numerator must stay inside the same ad-id scope as the
    // denominator, or a store/creator filter would inflate coverage past 100%.
    const linkedAdIdSet = new Set(linkRows.map((row) => row.adId));
    const linkedAdIds = filter.storeAdIds
      ? filter.storeAdIds.filter((adId) => linkedAdIdSet.has(adId))
      : [...linkedAdIdSet];
    let linkedSpend = 0;
    if (linkedAdIds.length > 0) {
      const linkedAgg = await this.prisma.reconcileMarketing.aggregate({
        where: { ...attributedWhere, adId: { in: linkedAdIds } },
        _sum: { spend: true },
      });
      linkedSpend = toNum(linkedAgg._sum.spend);
    }
    const linkedSpendCoverage = spend > 0 ? round(linkedSpend / spend) : null;

    return {
      totals: {
        spend, linkClicks: sums.linkClicks ?? 0, impressions: sums.impressions ?? 0,
        leads: sums.leads ?? 0, orders: attributedPosOrders, grossSales, adjustedSales,
        delivered, cancelled, rts, deliveredSales, deliveredCosts,
      },
      ceiling,
      attributionCoverage,
      linkedSpendCoverage,
      linkedSpend,
      unlinkedSpend: round(Math.max(0, spend - linkedSpend), 2),
      totalPosOrders,
      attributedPosOrders,
      verdictsSuppressed: attributionCoverage !== null
        && attributionCoverage < ADVERTISING_PROVISIONAL_DEFAULTS.minAttributionCoverage,
      benchmarks: {
        benchmarkCtr: ADVERTISING_PROVISIONAL_DEFAULTS.benchmarkCtr,
        maxCancellationRate: ADVERTISING_PROVISIONAL_DEFAULTS.maxCancellationRate,
        minAttributionCoverage: ADVERTISING_PROVISIONAL_DEFAULTS.minAttributionCoverage,
        safetyMargin: ADVERTISING_PROVISIONAL_DEFAULTS.safetyMargin,
        provisional: true,
      },
    };
  }

  async loadAccountOptions(tenantId: string) {
    const accounts = await this.prisma.metaAdAccount.findMany({
      where: { tenantId },
      select: { accountId: true, name: true },
      orderBy: { name: 'asc' },
    });
    return accounts.map((account) => ({ value: account.accountId, label: account.name }));
  }

  resolveDateRange(startDate?: string, endDate?: string): AdvertisingDateRange {
    const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
    for (const value of [startDate, endDate]) {
      if (value !== undefined && !DAY_KEY.test(value)) {
        throw new BadRequestException('Dates must be plain YYYY-MM-DD values');
      }
    }
    const todayKey = dayjs().tz(MANILA_TZ).format('YYYY-MM-DD');
    const defaultEnd = todayKey;
    const defaultStart = dayjs(defaultEnd).subtract(29, 'day').format('YYYY-MM-DD');
    const startKey = startDate ?? defaultStart;
    const endKey = endDate ?? defaultEnd;
    const start = new Date(`${startKey}T00:00:00.000Z`);
    const end = new Date(`${endKey}T23:59:59.999Z`);
    if (start > end) throw new BadRequestException('startDate must be on or before endDate');
    if ((end.getTime() - start.getTime()) / 86_400_000 > 366) {
      throw new BadRequestException('Advertising views support a maximum date range of 366 days');
    }
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));
    const yesterdayKey = dayjs(todayKey).subtract(1, 'day').format('YYYY-MM-DD');
    return {
      start, end, startKey, endKey, days,
      today: new Date(`${todayKey}T00:00:00.000Z`),
      yesterday: new Date(`${yesterdayKey}T00:00:00.000Z`),
      todayKey,
    };
  }

  /** Ad ids linked to creatives of one store and/or creator; null = unscoped. */
  async resolveScopedAdIds(tenantId: string, storeId?: string, creatorId?: string): Promise<string[] | null> {
    if (!storeId && !creatorId) return null;
    const links = await this.prisma.creativeMetaAdLink.findMany({
      where: {
        tenantId,
        creative: {
          ...(storeId ? { storeConfig: { storeId } } : {}),
          ...(creatorId ? { createdById: creatorId } : {}),
        },
      },
      select: { adId: true },
    });
    return [...new Set(links.map((link) => link.adId))];
  }

  private async queryRows(
    tenantId: string,
    range: AdvertisingDateRange,
    scope: AdvertisingScope,
    query: ListAdvertisingPerformanceQueryDto,
    storeAdIds: string[] | null,
    storeId: string | undefined,
  ) {
    if (storeAdIds !== null && storeAdIds.length === 0) {
      return { items: [], total: 0, totalPages: 1, page: 1 };
    }
    const sql = this.buildSql(tenantId, range, scope, query, storeAdIds, storeId);
    let rows = await this.prisma.$queryRaw<RawRow[]>(sql);
    if (rows.length === 0 && query.page > 1) {
      // Past-the-end page (e.g. the result set shrank under the client):
      // re-serve page 1 so the total and rows stay truthful.
      const firstPage = { ...query, page: 1 } as ListAdvertisingPerformanceQueryDto;
      Object.setPrototypeOf(firstPage, Object.getPrototypeOf(query));
      rows = await this.prisma.$queryRaw<RawRow[]>(this.buildSql(tenantId, range, scope, firstPage, storeAdIds, storeId));
      query = firstPage;
    }
    const total = rows.length > 0 ? Number(rows[0].total_rows) : 0;
    const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
    const page = Math.min(query.page, totalPages);
    const rangeIncludesToday = range.today >= range.start && range.today <= range.end;
    const items = rows.map((row) => this.serializeRow(row, scope, query.group, rangeIncludesToday));
    return { items, total, totalPages, page };
  }

  private serializeRow(
    row: RawRow,
    scope: AdvertisingScope,
    group: AdvertisingPerformanceGroup,
    rangeIncludesToday: boolean,
  ) {
    const num = (value: number | null) => value ?? 0;
    const spend = num(row.spend);
    const orders = num(row.orders);
    const delivered = num(row.delivered);
    const cancelled = num(row.cancelled);
    const rts = num(row.rts);
    const rates = resolvedRates(delivered, cancelled, rts);
    const deliveredSales = num(row.delivered_sales);
    const deliveredCosts = num(row.delivered_costs);
    const cpp = costPerOrder(spend, orders);
    const net = netContribution({
      deliveredRevenue: deliveredSales, deliveredCogs: 0,
      fulfillmentCosts: deliveredCosts, spend,
    });
    const ctr = clickThroughRate(num(row.link_clicks), num(row.impressions));
    const verdict: AdvertisingVerdict = advertisingVerdict({
      spend,
      orders,
      cpp,
      ceiling: scope.ceiling.workingCeiling,
      ctr,
      benchmarkCtr: scope.benchmarks.benchmarkCtr,
      cancellationRate: rates.cancellationRate,
      maxCancellationRate: scope.benchmarks.maxCancellationRate,
      netContribution: net,
      attributionCoverage: scope.attributionCoverage,
      minAttributionCoverage: scope.benchmarks.minAttributionCoverage,
    });
    const spendToday = row.spend_today === null ? null : round(row.spend_today, 2);
    const ordersToday = row.orders_today === null ? null : row.orders_today;
    return {
      key: row.key,
      group,
      adId: row.ad_id,
      accountId: row.account_id,
      campaignId: row.campaign_id,
      campaignName: row.campaign_name,
      adName: row.ad_name,
      adCount: row.ad_count ?? (row.ad_id ? 1 : null),
      status: row.status,
      firstSpendDate: row.first_spend_date ? row.first_spend_date.toISOString().slice(0, 10) : null,
      lastSpendDate: row.last_spend_date ? row.last_spend_date.toISOString().slice(0, 10) : null,
      creative: row.creative_id ? {
        id: row.creative_id,
        code: row.code,
        title: row.title,
        kind: row.kind,
        mediaUrl: row.media_url,
        performanceStatus: row.performance_status,
        storeId: row.store_id,
        storeName: row.store_name,
        creatorName: [row.creator_first, row.creator_last].filter(Boolean).join(' ') || row.creator_email || null,
      } : null,
      today: {
        available: rangeIncludesToday,
        orders: rangeIncludesToday ? (ordersToday ?? 0) : null,
        spend: rangeIncludesToday ? (spendToday ?? 0) : null,
        cpp: rangeIncludesToday ? costPerOrder(spendToday ?? 0, ordersToday ?? 0) : null,
        spendYesterday: row.spend_yesterday === null ? null : round(row.spend_yesterday, 2),
      },
      metrics: {
        impressions: num(row.impressions),
        linkClicks: num(row.link_clicks),
        landingPageViews: num(row.leads),
        orders,
        delivered,
        cancelled,
        rts,
        inProcess: Math.max(0, orders - (delivered + cancelled + rts)),
        deliveryRate: rates.deliveryRate,
        cancellationRate: rates.cancellationRate,
        rtsRate: rates.rtsRate,
        spend: round(spend, 2),
        grossSales: round(num(row.gross_sales), 2),
        deliveredSales: round(deliveredSales, 2),
        netContribution: net,
        cpc: costPerClick(spend, num(row.link_clicks)),
        cpp,
        deliveredCpp: deliveredCostPerOrder(spend, delivered),
        adSpendRatio: adSpendRatio(spend, num(row.gross_sales)),
        trueRoas: safeRatio(deliveredSales, spend),
        hookRate: hookRate(num(row.plays3s), num(row.video_impressions)),
        holdRate: holdRate(num(row.thru_plays_h), num(row.plays3s_h)),
        completionRate: completionRate(num(row.thru_plays), num(row.thru_impressions)),
        ctr,
        lpRate: landingPageRate(num(row.leads), num(row.link_clicks)),
        cvr: conversionRate(orders, num(row.leads)),
        avgWatchSeconds: row.watch_num !== null && row.watch_den ? round(row.watch_num / row.watch_den, 2) : null,
        retention25: guardedRatio(num(row.ret25), num(row.ret25_den)),
        retention50: guardedRatio(num(row.ret50), num(row.ret50_den)),
        retention75: guardedRatio(num(row.ret75), num(row.ret75_den)),
        retention95: guardedRatio(num(row.ret95), num(row.ret95_den)),
        retention100: guardedRatio(num(row.ret100), num(row.ret100_den)),
      },
      verdict: scope.verdictsSuppressed
        ? { ...verdict, verdict: null, decided: false, needsAction: false, suppressed: true }
        : verdict,
    };
  }

  private buildSql(
    tenantId: string,
    range: AdvertisingDateRange,
    scope: AdvertisingScope,
    query: ListAdvertisingPerformanceQueryDto,
    storeAdIds: string[] | null,
    storeId: string | undefined,
  ): Prisma.Sql {
    const group = query.group;
    const groupKeyRecon = group === 'CAMPAIGNS'
      ? Prisma.raw(`COALESCE(rm."campaignId", '—')`)
      : Prisma.raw(`rm."adId"`);
    const groupKeyVideo = group === 'CAMPAIGNS'
      ? Prisma.raw(`COALESCE(mi."campaignId", '—')`)
      : Prisma.raw(`mi."adId"`);

    const reconFilters: Prisma.Sql[] = [
      Prisma.sql`rm."tenantId" = ${tenantId}::uuid`,
      Prisma.sql`rm."date" >= ${range.start}`,
      Prisma.sql`rm."date" <= ${range.end}`,
      Prisma.sql`rm."adName" IS DISTINCT FROM ${UNMATCHED_AD_NAME}`,
    ];
    if (query.accountId) reconFilters.push(Prisma.sql`rm."accountId" = ${query.accountId}`);
    if (storeAdIds) reconFilters.push(Prisma.sql`rm."adId" IN (${Prisma.join(storeAdIds)})`);
    const reconWhere = Prisma.join(reconFilters, ' AND ');

    const videoFilters: Prisma.Sql[] = [
      Prisma.sql`mi."tenantId" = ${tenantId}::uuid`,
      Prisma.sql`mi."date" >= ${range.start}`,
      Prisma.sql`mi."date" <= ${range.end}`,
    ];
    if (query.accountId) videoFilters.push(Prisma.sql`mi."accountId" = ${query.accountId}`);
    const videoWhere = Prisma.join(videoFilters, ' AND ');

    // Aggregated raw sums per group key. Casts to float8 keep JS numbers.
    const reconCte = group === 'CREATIVES'
      ? Prisma.sql`
        recon AS (
          SELECT l."creativeId"::text AS key,
            NULL::text AS ad_id,
            MAX(rm."accountId") AS account_id,
            NULL::text AS campaign_id,
            NULL::text AS campaign_name,
            NULL::text AS ad_name,
            COUNT(DISTINCT rm."adId")::float8 AS ad_count,
            MIN(rm."date") AS first_spend_date,
            MAX(rm."date") AS last_spend_date,
            SUM(rm."spend")::float8 AS spend,
            SUM(rm."linkClicks")::float8 AS link_clicks,
            SUM(rm."impressions")::float8 AS impressions,
            SUM(rm."leads")::float8 AS leads,
            SUM(rm."purchasesPos")::float8 AS orders,
            SUM(rm."codPos")::float8 AS gross_sales,
            SUM(rm."deliveredCodPos")::float8 AS delivered_sales,
            SUM(rm."cogsDeliveredPos" + rm."sfSdrPos" + rm."ffSdrPos" + rm."ifSdrPos" + rm."codFeeDeliveredPos")::float8 AS delivered_costs,
            SUM(rm."deliveredCount")::float8 AS delivered,
            SUM(rm."canceledCount")::float8 AS cancelled,
            SUM(rm."rtsCount")::float8 AS rts,
            SUM(rm."spend") FILTER (WHERE rm."date" = ${range.today})::float8 AS spend_today,
            SUM(rm."purchasesPos") FILTER (WHERE rm."date" = ${range.today})::float8 AS orders_today,
            SUM(rm."spend") FILTER (WHERE rm."date" = ${range.yesterday})::float8 AS spend_yesterday
          FROM "reconcile_marketing" rm
          JOIN "creative_meta_ad_links" l
            ON l."tenantId" = rm."tenantId" AND l."adId" = rm."adId"
          WHERE ${reconWhere}
          GROUP BY l."creativeId"
        )`
      : Prisma.sql`
        recon AS (
          SELECT ${groupKeyRecon}::text AS key,
            ${group === 'ADS' ? Prisma.raw(`rm."adId"`) : Prisma.raw('NULL::text')} AS ad_id,
            MAX(rm."accountId") AS account_id,
            MAX(rm."campaignId") AS campaign_id,
            MAX(rm."campaignName") AS campaign_name,
            MAX(rm."adName") AS ad_name,
            ${group === 'CAMPAIGNS' ? Prisma.raw(`COUNT(DISTINCT rm."adId")::float8`) : Prisma.raw('NULL::float8')} AS ad_count,
            MIN(rm."date") AS first_spend_date,
            MAX(rm."date") AS last_spend_date,
            SUM(rm."spend")::float8 AS spend,
            SUM(rm."linkClicks")::float8 AS link_clicks,
            SUM(rm."impressions")::float8 AS impressions,
            SUM(rm."leads")::float8 AS leads,
            SUM(rm."purchasesPos")::float8 AS orders,
            SUM(rm."codPos")::float8 AS gross_sales,
            SUM(rm."deliveredCodPos")::float8 AS delivered_sales,
            SUM(rm."cogsDeliveredPos" + rm."sfSdrPos" + rm."ffSdrPos" + rm."ifSdrPos" + rm."codFeeDeliveredPos")::float8 AS delivered_costs,
            SUM(rm."deliveredCount")::float8 AS delivered,
            SUM(rm."canceledCount")::float8 AS cancelled,
            SUM(rm."rtsCount")::float8 AS rts,
            SUM(rm."spend") FILTER (WHERE rm."date" = ${range.today})::float8 AS spend_today,
            SUM(rm."purchasesPos") FILTER (WHERE rm."date" = ${range.today})::float8 AS orders_today,
            SUM(rm."spend") FILTER (WHERE rm."date" = ${range.yesterday})::float8 AS spend_yesterday
          FROM "reconcile_marketing" rm
          WHERE ${reconWhere}
          GROUP BY ${groupKeyRecon}
        )`;

    const videoCte = group === 'CREATIVES'
      ? Prisma.sql`
        video AS (
          SELECT vl."creativeId"::text AS key,
            SUM(mi."videoPlays3s") FILTER (WHERE mi."videoPlays3s" IS NOT NULL)::float8 AS plays3s,
            SUM(mi."impressions") FILTER (WHERE mi."videoPlays3s" IS NOT NULL)::float8 AS video_impressions,
            SUM(mi."thruPlays") FILTER (WHERE mi."videoPlays3s" IS NOT NULL AND mi."thruPlays" IS NOT NULL)::float8 AS thru_plays_h,
            SUM(mi."videoPlays3s") FILTER (WHERE mi."videoPlays3s" IS NOT NULL AND mi."thruPlays" IS NOT NULL)::float8 AS plays3s_h,
            SUM(mi."thruPlays") FILTER (WHERE mi."thruPlays" IS NOT NULL)::float8 AS thru_plays,
            SUM(mi."impressions") FILTER (WHERE mi."thruPlays" IS NOT NULL)::float8 AS thru_impressions,
            SUM(mi."videoAveragePlayTime" * mi."impressions") FILTER (WHERE mi."videoAveragePlayTime" IS NOT NULL)::float8 AS watch_num,
            SUM(mi."impressions") FILTER (WHERE mi."videoAveragePlayTime" IS NOT NULL)::float8 AS watch_den,
            SUM(mi."videoPlays25") FILTER (WHERE mi."videoPlays25" IS NOT NULL)::float8 AS ret25,
            SUM(mi."impressions") FILTER (WHERE mi."videoPlays25" IS NOT NULL)::float8 AS ret25_den,
            SUM(mi."videoPlays50") FILTER (WHERE mi."videoPlays50" IS NOT NULL)::float8 AS ret50,
            SUM(mi."impressions") FILTER (WHERE mi."videoPlays50" IS NOT NULL)::float8 AS ret50_den,
            SUM(mi."videoPlays75") FILTER (WHERE mi."videoPlays75" IS NOT NULL)::float8 AS ret75,
            SUM(mi."impressions") FILTER (WHERE mi."videoPlays75" IS NOT NULL)::float8 AS ret75_den,
            SUM(mi."videoPlays95") FILTER (WHERE mi."videoPlays95" IS NOT NULL)::float8 AS ret95,
            SUM(mi."impressions") FILTER (WHERE mi."videoPlays95" IS NOT NULL)::float8 AS ret95_den,
            SUM(mi."videoPlays100") FILTER (WHERE mi."videoPlays100" IS NOT NULL)::float8 AS ret100,
            SUM(mi."impressions") FILTER (WHERE mi."videoPlays100" IS NOT NULL)::float8 AS ret100_den
          FROM "meta_ad_insights" mi
          JOIN "creative_meta_ad_links" vl
            ON vl."tenantId" = mi."tenantId" AND vl."adId" = mi."adId"
          WHERE ${videoWhere}
          GROUP BY vl."creativeId"
        )`
      : Prisma.sql`
        video AS (
          SELECT ${groupKeyVideo}::text AS key,
            SUM(mi."videoPlays3s") FILTER (WHERE mi."videoPlays3s" IS NOT NULL)::float8 AS plays3s,
            SUM(mi."impressions") FILTER (WHERE mi."videoPlays3s" IS NOT NULL)::float8 AS video_impressions,
            SUM(mi."thruPlays") FILTER (WHERE mi."videoPlays3s" IS NOT NULL AND mi."thruPlays" IS NOT NULL)::float8 AS thru_plays_h,
            SUM(mi."videoPlays3s") FILTER (WHERE mi."videoPlays3s" IS NOT NULL AND mi."thruPlays" IS NOT NULL)::float8 AS plays3s_h,
            SUM(mi."thruPlays") FILTER (WHERE mi."thruPlays" IS NOT NULL)::float8 AS thru_plays,
            SUM(mi."impressions") FILTER (WHERE mi."thruPlays" IS NOT NULL)::float8 AS thru_impressions,
            SUM(mi."videoAveragePlayTime" * mi."impressions") FILTER (WHERE mi."videoAveragePlayTime" IS NOT NULL)::float8 AS watch_num,
            SUM(mi."impressions") FILTER (WHERE mi."videoAveragePlayTime" IS NOT NULL)::float8 AS watch_den,
            SUM(mi."videoPlays25") FILTER (WHERE mi."videoPlays25" IS NOT NULL)::float8 AS ret25,
            SUM(mi."impressions") FILTER (WHERE mi."videoPlays25" IS NOT NULL)::float8 AS ret25_den,
            SUM(mi."videoPlays50") FILTER (WHERE mi."videoPlays50" IS NOT NULL)::float8 AS ret50,
            SUM(mi."impressions") FILTER (WHERE mi."videoPlays50" IS NOT NULL)::float8 AS ret50_den,
            SUM(mi."videoPlays75") FILTER (WHERE mi."videoPlays75" IS NOT NULL)::float8 AS ret75,
            SUM(mi."impressions") FILTER (WHERE mi."videoPlays75" IS NOT NULL)::float8 AS ret75_den,
            SUM(mi."videoPlays95") FILTER (WHERE mi."videoPlays95" IS NOT NULL)::float8 AS ret95,
            SUM(mi."impressions") FILTER (WHERE mi."videoPlays95" IS NOT NULL)::float8 AS ret95_den,
            SUM(mi."videoPlays100") FILTER (WHERE mi."videoPlays100" IS NOT NULL)::float8 AS ret100,
            SUM(mi."impressions") FILTER (WHERE mi."videoPlays100" IS NOT NULL)::float8 AS ret100_den
          FROM "meta_ad_insights" mi
          WHERE ${videoWhere}
          GROUP BY ${groupKeyVideo}
        )`;

    const statusCte = group === 'ADS'
      ? Prisma.sql`
        latest_status AS (
          SELECT DISTINCT ON (mi."adId") mi."adId"::text AS key, mi."status" AS status
          FROM "meta_ad_insights" mi
          WHERE mi."tenantId" = ${tenantId}::uuid
          ORDER BY mi."adId", mi."date" DESC
        )`
      : Prisma.sql`latest_status AS (SELECT NULL::text AS key, NULL::text AS status WHERE FALSE)`;

    const linkCte = group === 'ADS'
      ? Prisma.sql`
        link AS (
          SELECT DISTINCT ON (l."adId") l."adId"::text AS key,
            l."creativeId" AS creative_id,
            c."code" AS code, c."title" AS title, c."kind"::text AS kind, c."mediaUrl" AS media_url,
            c."performanceStatus"::text AS performance_status,
            sc."storeId" AS store_id, sc."storeNameSnapshot" AS store_name,
            u."firstName" AS creator_first, u."lastName" AS creator_last, u."email" AS creator_email
          FROM "creative_meta_ad_links" l
          JOIN "creatives" c ON c."id" = l."creativeId"
          JOIN "creative_store_configs" sc ON sc."id" = c."storeConfigId"
          JOIN "users" u ON u."id" = c."createdById"
          WHERE l."tenantId" = ${tenantId}::uuid
          ORDER BY l."adId", l."linkedAt" ASC
        )`
      : group === 'CREATIVES'
        ? Prisma.sql`
        link AS (
          SELECT c."id"::text AS key,
            c."id" AS creative_id,
            c."code" AS code, c."title" AS title, c."kind"::text AS kind, c."mediaUrl" AS media_url,
            c."performanceStatus"::text AS performance_status,
            sc."storeId" AS store_id, sc."storeNameSnapshot" AS store_name,
            u."firstName" AS creator_first, u."lastName" AS creator_last, u."email" AS creator_email
          FROM "creatives" c
          JOIN "creative_store_configs" sc ON sc."id" = c."storeConfigId"
          JOIN "users" u ON u."id" = c."createdById"
          WHERE c."tenantId" = ${tenantId}::uuid
        )`
        : Prisma.sql`link AS (SELECT NULL::text AS key, NULL::uuid AS creative_id, NULL::text AS code, NULL::text AS title, NULL::text AS kind, NULL::text AS media_url, NULL::text AS performance_status, NULL::uuid AS store_id, NULL::text AS store_name, NULL::text AS creator_first, NULL::text AS creator_last, NULL::text AS creator_email WHERE FALSE)`;

    const outerFilters: Prisma.Sql[] = [];
    if (query.hideNoOrders) outerFilters.push(Prisma.sql`b.orders > 0`);
    if (query.minSpend !== undefined) outerFilters.push(Prisma.sql`b.spend >= ${query.minSpend}`);
    if (!query.showInactive && group === 'ADS') {
      outerFilters.push(Prisma.sql`(b.status IS NULL OR b.status = 'ACTIVE')`);
    }
    if (group === 'ADS' && query.linkStatus === 'LINKED') outerFilters.push(Prisma.sql`b.creative_id IS NOT NULL`);
    if (group === 'ADS' && query.linkStatus === 'UNLINKED') outerFilters.push(Prisma.sql`b.creative_id IS NULL`);
    if (query.adId) outerFilters.push(Prisma.sql`b.ad_id = ${query.adId}`);
    if (query.campaignId) outerFilters.push(Prisma.sql`b.campaign_id = ${query.campaignId}`);
    if (query.creativeId) outerFilters.push(Prisma.sql`b.creative_id = ${query.creativeId}::uuid`);
    // Campaigns mode with a store filter is already narrowed inside recon
    // via storeAdIds; ads/creatives modes additionally pin the decorated store.
    if (storeId && group !== 'CAMPAIGNS') {
      outerFilters.push(Prisma.sql`b.store_id = ${storeId}::uuid`);
    }
    if (query.query) {
      const like = `%${query.query}%`;
      outerFilters.push(Prisma.sql`(
        COALESCE(b.ad_name, '') ILIKE ${like}
        OR COALESCE(b.campaign_name, '') ILIKE ${like}
        OR COALESCE(b.code, '') ILIKE ${like}
        OR COALESCE(b.title, '') ILIKE ${like}
        OR COALESCE(b.ad_id, '') ILIKE ${like}
      )`);
    }
    if (query.verdict !== 'ALL' && !scope.verdictsSuppressed) {
      outerFilters.push(this.verdictFilterSql(query.verdict, scope));
    }
    const outerWhere = outerFilters.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(outerFilters, ' AND ')}`
      : Prisma.empty;

    const direction = query.sortDirection === 'asc' ? Prisma.raw('ASC') : Prisma.raw('DESC');
    // 'name' sorts by the name the row actually displays for the active group.
    const nameFragment = group === 'CAMPAIGNS'
      ? `COALESCE(b.campaign_name, b.key)`
      : group === 'CREATIVES'
        ? `COALESCE(b.title, b.code, b.key)`
        : `COALESCE(b.ad_name, b.key)`;
    const sortFragment = Prisma.raw(query.sortKey === 'name' ? nameFragment : SORT_FRAGMENTS[query.sortKey]);
    const offset = (query.page - 1) * query.pageSize;

    return Prisma.sql`
      WITH ${reconCte},
      ${videoCte},
      ${statusCte},
      ${linkCte},
      base AS (
        SELECT recon.*, video.plays3s, video.video_impressions, video.thru_plays_h, video.plays3s_h,
          video.thru_plays, video.thru_impressions, video.watch_num, video.watch_den,
          video.ret25, video.ret25_den, video.ret50, video.ret50_den, video.ret75, video.ret75_den,
          video.ret95, video.ret95_den, video.ret100, video.ret100_den,
          latest_status.status, link.creative_id, link.code, link.title, link.kind, link.media_url, link.performance_status,
          link.store_id, link.store_name, link.creator_first, link.creator_last, link.creator_email
        FROM recon
        LEFT JOIN video ON video.key = recon.key
        LEFT JOIN latest_status ON latest_status.key = recon.key
        LEFT JOIN link ON link.key = recon.key
      )
      SELECT b.*, COUNT(*) OVER()::float8 AS total_rows
      FROM base b
      ${outerWhere}
      ORDER BY ${sortFragment} ${direction} NULLS LAST, b.key ASC
      LIMIT ${query.pageSize} OFFSET ${offset}
    `;
  }

  /**
   * SQL mirror of utils/advertising-verdict.ts, used ONLY to filter rows
   * database-side. The verdict shown on every returned row always comes from
   * the pure function; keep the two in sync when the ladder changes.
   */
  private verdictFilterSql(verdict: 'NEEDS_ACTION' | 'SCALE' | 'WATCH' | 'KILL', scope: AdvertisingScope): Prisma.Sql {
    const ceiling = scope.ceiling.workingCeiling;
    const benchmarkCtr = scope.benchmarks.benchmarkCtr;
    const maxCancel = scope.benchmarks.maxCancellationRate;
    const verdictExpr = Prisma.sql`(
      CASE WHEN b.orders = 0 THEN
        CASE
          WHEN ${ceiling}::float8 IS NULL THEN 'WATCH'
          WHEN b.spend >= ${ceiling}::float8 * 2 THEN 'KILL'
          WHEN b.spend < ${ceiling}::float8 THEN 'WATCH'
          WHEN b.impressions > 0 AND b.link_clicks <= b.impressions
            AND (b.link_clicks / b.impressions) >= ${benchmarkCtr}::float8 THEN 'WATCH'
          ELSE 'KILL'
        END
      ELSE
        CASE
          WHEN ${ceiling}::float8 IS NULL THEN 'WATCH'
          WHEN (b.spend / b.orders) > ${ceiling}::float8 * 1.5 THEN 'KILL'
          WHEN (b.delivered + b.cancelled + b.rts) > 0
            AND (b.cancelled / (b.delivered + b.cancelled + b.rts)) > ${maxCancel}::float8 THEN 'WATCH'
          WHEN (b.spend / b.orders) > ${ceiling}::float8 THEN 'WATCH'
          WHEN (b.delivered_sales - b.delivered_costs - b.spend) < 0 THEN 'WATCH'
          ELSE 'SCALE'
        END
      END
    )`;
    const needsActionExpr = Prisma.sql`(
      CASE WHEN b.orders = 0 THEN
        CASE
          WHEN ${ceiling}::float8 IS NULL THEN FALSE
          WHEN b.spend >= ${ceiling}::float8 * 2 THEN TRUE
          WHEN b.spend < ${ceiling}::float8 THEN FALSE
          ELSE TRUE
        END
      ELSE
        CASE
          WHEN ${ceiling}::float8 IS NULL THEN FALSE
          WHEN (b.spend / b.orders) > ${ceiling}::float8 * 1.5 THEN TRUE
          WHEN (b.delivered + b.cancelled + b.rts) > 0
            AND (b.cancelled / (b.delivered + b.cancelled + b.rts)) > ${maxCancel}::float8 THEN TRUE
          WHEN (b.spend / b.orders) > ${ceiling}::float8 THEN TRUE
          WHEN (b.delivered_sales - b.delivered_costs - b.spend) < 0 THEN TRUE
          ELSE FALSE
        END
      END
    )`;
    if (verdict === 'NEEDS_ACTION') return Prisma.sql`${needsActionExpr} = TRUE`;
    return Prisma.sql`${verdictExpr} = ${verdict}`;
  }
}
