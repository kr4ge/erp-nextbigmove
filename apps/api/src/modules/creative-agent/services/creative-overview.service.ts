import { BadRequestException, Injectable } from '@nestjs/common';
import { CreativeKind, CreativePerformanceStatus, CreativeStatusDimension, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { GetCreativeOverviewQueryDto, type CreativeOverviewSortKey } from '../dto/get-creative-overview-query.dto';
import type { CreativeActor } from '../types/creative-actor.type';
import {
  bandScore,
  craftVerdict,
  CREATIVE_CRAFT_FLOORS,
  CREATIVE_FLOORS_PROVISIONAL,
  invertedBandScore,
  isImpossibleRate,
  SCORECARD_KPI_TARGETS,
  SCORECARD_KPI_WEIGHTS,
  SCORECARD_OUTPUT_TARGETS_PROVISIONAL,
  C_SCORE_TARGETS,
  creativeCScore,
  creativeVerdict,
  creativeOutputScore,
  median,
  round,
  safeRatio,
  SCORECARD_BAND_WEIGHTS,
  scorecardVerdict,
  weightedBandScore,
} from '../utils/creative-metrics';
import { ADVERTISING_PROVISIONAL_DEFAULTS } from '../utils/advertising-metrics';
import { loadCreativeStoreOptions } from './creative-store-options';
import { CreativeAccessService } from './creative-access.service';
import { CreativeLegacyAttributionService } from './creative-legacy-attribution.service';

type MetricTotals = {
  spend: number; impressions: number; linkClicks: number; landingPageViews: number;
  orders: number; delivered: number; cancelled: number; rts: number;
  revenue: number; deliveredRevenue: number; costs: number;
  /** AR% denominator, kept as two additive terms so sums stay associative. */
  grossSales: number; excludedSales: number;
  hookNumerator: number; hookDenominator: number; holdNumerator: number; holdDenominator: number;
  completionNumerator: number; completionDenominator: number;
  frequencyNumerator: number; frequencyDenominator: number;
};
type AdDescriptor = { adId: string; adName: string; campaignName: string; adsetId: string; spend: number };
const emptyMetrics = (): MetricTotals => ({
  spend: 0, impressions: 0, linkClicks: 0, landingPageViews: 0, orders: 0, delivered: 0,
  cancelled: 0, rts: 0, revenue: 0, deliveredRevenue: 0, costs: 0, grossSales: 0, excludedSales: 0,
  hookNumerator: 0, hookDenominator: 0, holdNumerator: 0, holdDenominator: 0,
  completionNumerator: 0, completionDenominator: 0, frequencyNumerator: 0, frequencyDenominator: 0,
});

/**
 * A creative "wins" on the owner's rule: at least this many orders, at an ad
 * spend ratio at or under the ceiling. Deliberately no minimum spend — the
 * owner chose order count as the only evidence gate, so a small-budget creative
 * that sells efficiently still counts.
 */
const WINNER_MIN_ORDERS = 10;

/** spend ÷ adjusted sales, or null when nothing was sold to divide by. */
const arPercent = (spend: number, grossSales: number, excludedSales: number) => {
  const adjusted = Math.max(0, grossSales - excludedSales);
  return adjusted > 0 ? spend / adjusted : null;
};
const METRIC_KEYS = Object.keys(emptyMetrics()) as Array<keyof MetricTotals>;
const money = (value: number) => round(value, 2);
const toNumber = (value: Prisma.Decimal | number | null | undefined) => Number(value ?? 0);

/** Collects rates withheld by the impossible-rate guard so one warning can name every broken stage. */
class RateGuard {
  readonly stages = new Map<string, number>();
  rate(stage: string, numerator: number, denominator: number): number | null {
    if (isImpossibleRate(numerator, denominator)) {
      this.stages.set(stage, (this.stages.get(stage) ?? 0) + 1);
      return null;
    }
    return safeRatio(numerator, denominator);
  }
  get count() { return [...this.stages.values()].reduce((sum, value) => sum + value, 0); }
}

@Injectable()
export class CreativeOverviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CreativeAccessService,
    private readonly legacyAttribution: CreativeLegacyAttributionService,
  ) {}

  async getOverview(actor: CreativeActor, query: GetCreativeOverviewQueryDto) {
    const context = await this.access.resolve(actor);
    this.access.requireReadable(context);
    const range = this.resolveDateRange(query.startDate, query.endDate);
    const canReadAll = this.access.canReadAll(context);
    const canViewMoney = context.isSuperAdmin || context.permissions.has('analytics.sales');
    const selectedLens = query.lens === 'BUSINESS' && canViewMoney ? 'BUSINESS' : 'CREATIVE';
    const defaultSortKey: CreativeOverviewSortKey = selectedLens === 'BUSINESS' ? 'netMargin' : 'creativeScore';
    const requestedSortKey = query.sortKey === 'creativeScore' && selectedLens === 'BUSINESS' ? defaultSortKey : query.sortKey;
    const guard = new RateGuard();
    const creatorRows = canReadAll
      ? await this.legacyAttribution.listCreatorIdentities(context.tenantId)
      : [];
    const creatorScopeIds = canReadAll
      ? (query.creatorId ? [query.creatorId] : creatorRows.map((creator) => creator.id))
      : [context.userId];
    const storeOptions = await loadCreativeStoreOptions(
      this.prisma,
      context.tenantId,
      canReadAll ? (query.creatorId ?? null) : context.userId,
    );
    const effectiveStoreId = query.storeId ?? storeOptions.defaultStoreId ?? undefined;
    const where: Prisma.CreativeWhereInput = {
      tenantId: context.tenantId,
      ...(!canReadAll ? { createdById: context.userId } : query.creatorId ? { createdById: query.creatorId } : {}),
      ...(effectiveStoreId ? { storeConfig: { storeId: effectiveStoreId } } : {}),
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.query ? { OR: [
        { code: { contains: query.query, mode: 'insensitive' } },
        { title: { contains: query.query, mode: 'insensitive' } },
        { createdBy: { OR: [
          { firstName: { contains: query.query, mode: 'insensitive' } },
          { lastName: { contains: query.query, mode: 'insensitive' } },
          { email: { contains: query.query, mode: 'insensitive' } },
        ] } },
      ] } : {}),
    };
    const [creatives, stores, resolvedLegacyAds] = await Promise.all([
      this.prisma.creative.findMany({ where, select: {
        id: true, code: true, title: true, kind: true, mediaUrl: true, revisionState: true,
        performanceStatus: true, createdAt: true, submittedAt: true, approvedAt: true,
        metaAdId: true, metaAdLinks: { select: { adId: true }, orderBy: { linkedAt: 'asc' } },
        storeConfig: { select: { storeId: true, storeNameSnapshot: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      } }),
      Promise.resolve(storeOptions),
      this.legacyAttribution.resolveLegacyAds({
        tenantId: context.tenantId,
        creatorIds: creatorScopeIds,
        start: range.start,
        end: range.end,
        storeIds: effectiveStoreId ? [effectiveStoreId] : [],
      }),
    ]);
    const legacySearch = query.query?.trim().toLowerCase() ?? '';
    // The pre-registry convention does not encode VIDEO versus STATIC, so a
    // type filter must not guess. Search can still narrow these rows by their
    // real Meta names, campaigns, creator names, or employee IDs.
    const legacyAds = query.kind
      ? []
      : resolvedLegacyAds.filter((ad) => {
          if (!legacySearch) return true;
          return [
            ad.adName,
            ad.campaignName,
            ad.creator.employeeId,
            ad.creator.firstName,
            ad.creator.lastName,
            ad.creator.email,
          ].some((value) => value?.toLowerCase().includes(legacySearch));
        });

    const creativeAdIds = new Map<string, string[]>();
    for (const creative of creatives) {
      const ids = creative.metaAdLinks.map((link) => link.adId);
      if (ids.length === 0 && creative.metaAdId) ids.push(creative.metaAdId);
      creativeAdIds.set(creative.id, [...new Set(ids)]);
    }
    const legacyAdIds = legacyAds.map((ad) => ad.adId);
    const adIds = [...new Set([...creativeAdIds.values()].flat().concat(legacyAdIds))];
    const { metricsByAd, descriptorByAd } = await this.loadAdMetrics(context.tenantId, adIds, range.start, range.end);
    // Resolved before the rows are built so each one can be told whether it won.
    const scopedUserId = !canReadAll ? context.userId : (query.creatorId ?? null);
    const winnerRule = await this.resolveWinnerArCeiling(context.tenantId, scopedUserId, range.start, range.end);
    const baseRows = creatives.map((creative) => {
      const metrics = this.sumMetrics(creativeAdIds.get(creative.id) ?? [], metricsByAd);
      const hookRate = creative.kind === CreativeKind.VIDEO ? guard.rate('hook', metrics.hookNumerator, metrics.hookDenominator) : null;
      const holdRate = creative.kind === CreativeKind.VIDEO ? guard.rate('hold', metrics.holdNumerator, metrics.holdDenominator) : null;
      const completionRate = creative.kind === CreativeKind.VIDEO ? guard.rate('completion', metrics.completionNumerator, metrics.completionDenominator) : null;
      const ctr = guard.rate('ctr', metrics.linkClicks, metrics.impressions);
      const lpRate = guard.rate('lp rate', metrics.landingPageViews, metrics.linkClicks);
      const conversionRate = guard.rate('order rate', metrics.orders, metrics.landingPageViews);
      const resolved = metrics.delivered + metrics.cancelled + metrics.rts;
      const linkedAdIds = creativeAdIds.get(creative.id) ?? [];
      const topAd = linkedAdIds.map((adId) => descriptorByAd.get(adId)).filter((value): value is AdDescriptor => Boolean(value)).sort((a, b) => b.spend - a.spend)[0] ?? null;
      const arPct = arPercent(metrics.spend, metrics.grossSales, metrics.excludedSales);
      const isWinner = metrics.orders >= WINNER_MIN_ORDERS && arPct !== null && arPct <= winnerRule.ceiling;
      return {
        id: creative.id, code: creative.code, title: creative.title, kind: creative.kind,
        mediaUrl: creative.mediaUrl,
        store: { id: creative.storeConfig.storeId, name: creative.storeConfig.storeNameSnapshot },
        creator: { id: creative.createdBy.id, name: this.personName(creative.createdBy) },
        revisionState: creative.revisionState, performanceStatus: creative.performanceStatus,
        linked: linkedAdIds.length > 0, metaAdId: linkedAdIds[0] ?? null, metaAdIds: linkedAdIds,
        adCount: linkedAdIds.length, topAd, testing: metrics.spend < 3_000 && metrics.orders < 10,
        isWinner,
        metrics: {
          creativeScore: null as number | null, winnerScore: null as number | null,
          decision: 'NOT_CONFIGURED' as const, bottleneck: null as string | null,
          verdict: null as string | null, verdictReason: null as string | null,
          hookRate, holdRate, completionRate, ctr, lpRate, conversionRate,
          // Displayed rates follow the analytics/sales conventions (cancellation
          // and delivery over ALL attributed orders, RTS over delivered+RTS) so
          // a creative whose only finished orders are cancellations no longer
          // reads a meaningless 100%. The resolved-based delivery rate is kept
          // separately: the reference C-Score's 0.80 ceiling is defined on it.
          deliveryRate: guard.rate('delivery rate', metrics.delivered, metrics.orders),
          cancellationRate: guard.rate('cancel', metrics.cancelled, metrics.orders),
          rtsRate: guard.rate('rts', metrics.rts, metrics.delivered + metrics.rts),
          deliveryRateResolved: guard.rate('delivery', metrics.delivered, resolved),
          // Frequency is a plain weighted average, not a rate — values above 1 are normal.
          frequency: safeRatio(metrics.frequencyNumerator, metrics.frequencyDenominator),
          impressions: metrics.impressions, linkClicks: metrics.linkClicks,
          landingPageViews: metrics.landingPageViews, orders: metrics.orders, deliveredOrders: metrics.delivered,
          // Spend and AR% are the two figures the creative is judged on, so they
          // travel with every row. MAR% (spend ÷ gross attributed revenue) rides
          // along as the Business Performance convention. The deeper P&L below
          // stays behind analytics.sales — knowing what your video cost is not
          // the same as reading the company's margins.
          spend: money(metrics.spend),
          arPct: arPct === null ? null : round(arPct, 4),
          mar: safeRatio(metrics.spend, metrics.revenue),
          ...(canViewMoney ? {
            costPerOrder: metrics.orders > 0 ? money(metrics.spend / metrics.orders) : null,
            deliveredCostPerOrder: metrics.delivered > 0 ? money(metrics.spend / metrics.delivered) : null,
            deliveredRevenue: money(metrics.deliveredRevenue), netMargin: money(metrics.deliveredRevenue - metrics.costs - metrics.spend),
          } : {}),
        },
        _totals: metrics,
      };
    });
    const storeMedians = this.storeMedians(baseRows);
    const scoredRows = baseRows.map((row) => {
      const storeMedian = storeMedians.get(row.store.id ?? '') ?? null;
      // Graded against the same AR% ceiling the winner rule uses, so a 10 on
      // C-Score and a Winner pill can never point in opposite directions.
      row.metrics.creativeScore = creativeCScore({
        kind: row.kind,
        arPct: row.metrics.arPct,
        arCeiling: winnerRule.ceiling,
        orders: row.metrics.orders,
        spend: row.metrics.spend,
        hookRate: row.metrics.hookRate,
        holdRate: row.metrics.holdRate,
        ctr: row.metrics.ctr,
        cvr: row.metrics.conversionRate,
        storeMedianCvr: storeMedian,
      });
      row.metrics.bottleneck = this.bottleneck(row.kind, row.metrics, storeMedian);
      // Money decides, craft explains. Runs after the bottleneck so the reason
      // can name the step that broke.
      const { verdict, reason } = creativeVerdict({
        testing: row.testing,
        orders: row.metrics.orders,
        spend: row.metrics.spend,
        arPct: row.metrics.arPct,
        arCeiling: winnerRule.ceiling,
        killLine: ADVERTISING_PROVISIONAL_DEFAULTS.adSpendRatioWarning,
        fatiguing: row.performanceStatus === CreativePerformanceStatus.FATIGUED,
        bottleneck: row.metrics.bottleneck,
      });
      row.metrics.verdict = verdict;
      row.metrics.verdictReason = reason;
      return row;
    });
    const sorted = this.sortRows(scoredRows, requestedSortKey, query.sortDirection, canViewMoney);
    let nextRank = 0;
    const defaultRanking = requestedSortKey === defaultSortKey && query.sortDirection === 'desc';
    const ranked = sorted.map((row) => {
      const sortValue = requestedSortKey === 'code' ? null : row.metrics[requestedSortKey as keyof typeof row.metrics];
      const rank = row.testing ? null : ++nextRank;
      const medal = defaultRanking && rank !== null && rank <= 3 && Number(sortValue ?? 0) > 0 ? rank : null;
      const { _totals, ...publicRow } = row;
      return { ...publicRow, rank, medal };
    });
    const total = ranked.length;
    const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
    const page = Math.min(query.page, totalPages);
    const items = ranked.slice((page - 1) * query.pageSize, page * query.pageSize);
    const registeredTotals = baseRows.reduce((acc, row) => this.addMetrics(acc, row._totals), emptyMetrics());
    const legacyTotals = this.sumMetrics(legacyAdIds, metricsByAd);
    const totals = this.addMetrics(registeredTotals, legacyTotals);
    const decisions = await this.decisionMetrics(context.tenantId, creatives.map((creative) => creative.id), range.start, range.end);
    const outputCount = creatives.filter((creative) => creative.createdAt >= range.start && creative.createdAt <= range.end).length;
    const linkedCreatives = baseRows.filter((row) => row.linked).length;
    const missingVideoMetrics = baseRows.filter((row) => row.kind === CreativeKind.VIDEO && row.metrics.impressions > 0 && row.metrics.hookRate === null).length;
    const kpis = {
      hookRate: this.metric(guard, 'hook', totals.hookNumerator, totals.hookDenominator),
      holdRate: this.metric(guard, 'hold', totals.holdNumerator, totals.holdDenominator),
      completionRate: this.metric(guard, 'completion', totals.completionNumerator, totals.completionDenominator),
      ctr: this.metric(guard, 'ctr', totals.linkClicks, totals.impressions),
      cvr: this.metric(guard, 'cvr', totals.orders, totals.linkClicks),
      output: { value: outputCount, numerator: null, denominator: null },
      medianTurnaroundHours: { value: decisions.medianTurnaroundHours, numerator: null, denominator: decisions.turnaroundCount },
      // Volume + funnel tiles combine explicitly linked registry ads with the
      // scoped creator's otherwise-unlinked employee-ID history. Workflow
      // counts below remain registry-only. Rate denominators follow the
      // creative-performance convention: resolved = delivered + cancelled +
      // rts.
      orders: { value: totals.orders, numerator: null, denominator: null },
      adSpend: { value: money(totals.spend), numerator: null, denominator: null },
      // MAR% (AR%): ad spend ÷ attributed gross revenue — the SAME formula as
      // the Business Performance AR% (spend/revenue), so the two screens agree.
      // safeRatio (not the guard) so a zero-revenue period reads "not measured"
      // without raising a data warning.
      mar: { value: safeRatio(totals.spend, totals.revenue), numerator: money(totals.spend), denominator: money(totals.revenue) },
      delivered: { value: totals.delivered, numerator: null, denominator: null },
      // Dashboard tiles follow the analytics/sales conventions so the two
      // screens read the same way: cancellation and delivery are shares of ALL
      // attributed orders (raw), RTS is rts ÷ (delivered + rts). The
      // per-creative leaderboard/C-Score keep the resolved-based craft
      // convention, which the reference C-Score ceilings assume.
      cancellationRate: this.metric(guard, 'cancellation rate', totals.cancelled, totals.orders),
      rtsRate: this.metric(guard, 'rts rate', totals.rts, totals.delivered + totals.rts),
      deliveryRate: this.metric(guard, 'delivery rate', totals.delivered, totals.orders),
    };
    // Winners are drawn from the published set rather than from every scoped
    // creative, so the rate can never exceed 100% by counting an older
    // creative that only started earning inside this window.
    const publishedRows = baseRows.filter((row) => decisions.publishedIds.has(row.id));
    const winners = publishedRows.filter((row) => row.isWinner).length;
    const blendedAr = arPercent(totals.spend, totals.grossSales, totals.excludedSales);
    // Deliberately not behind analytics.sales. The sibling advertising
    // dashboard already shows spend to everyone who can reach this workspace,
    // and gating it here would blank the tile for the advertiser, who is the
    // one person whose whole job is the spend.
    const production = {
      published: publishedRows.length,
      publishedVideos: publishedRows.filter((row) => row.kind === CreativeKind.VIDEO).length,
      publishedStatics: publishedRows.filter((row) => row.kind === CreativeKind.STATIC).length,
      winners,
      winRate: publishedRows.length > 0 ? round(winners / publishedRows.length, 4) : null,
      adSpend: money(totals.spend),
      arPct: blendedAr === null ? null : round(blendedAr, 4),
      linkedCount: linkedCreatives,
      scopedCount: baseRows.length,
      rule: {
        minOrders: WINNER_MIN_ORDERS,
        arCeiling: round(winnerRule.ceiling, 4),
        provisional: winnerRule.provisional,
      },
    };
    const scorecard = {
      ...this.buildScorecard({
        kpis, decisions, outputCount, days: range.days,
        scope: canReadAll && !query.creatorId ? 'TEAM' : 'PERSONAL',
        revisionCensus: this.revisionCensus(creatives),
        spend: totals.spend, arPct: production.arPct, winRate: production.winRate,
        published: production.published,
      }),
      production,
    };
    const craftBoard = this.buildCraftBoard(baseRows);
    const historicalAttribution = {
      total: legacyAds.length,
      items: legacyAds
        .map((ad) => {
          const metrics = metricsByAd.get(ad.adId) ?? emptyMetrics();
          const descriptor = descriptorByAd.get(ad.adId);
          return {
            adId: ad.adId,
            adName: descriptor?.adName ?? ad.adName ?? ad.adId,
            campaignName: descriptor?.campaignName ?? ad.campaignName,
            creator: {
              id: ad.creator.id,
              name: this.personName(ad.creator),
              employeeId: ad.creator.employeeId,
            },
            metrics: {
              spend: money(metrics.spend),
              orders: metrics.orders,
              delivered: metrics.delivered,
              hookRate: safeRatio(metrics.hookNumerator, metrics.hookDenominator),
              holdRate: safeRatio(metrics.holdNumerator, metrics.holdDenominator),
              completionRate: safeRatio(metrics.completionNumerator, metrics.completionDenominator),
              ctr: safeRatio(metrics.linkClicks, metrics.impressions),
              mar: safeRatio(metrics.spend, metrics.revenue),
            },
          };
        })
        .sort((left, right) => right.metrics.spend - left.metrics.spend)
        .slice(0, 20),
    };
    const withheldStages = [...guard.stages.keys()];
    return {
      selected: { startDate: range.startKey, endDate: range.endKey, query: query.query ?? '', storeId: effectiveStoreId ?? '', kind: query.kind ?? '', creatorId: query.creatorId ?? '', lens: selectedLens, sortKey: requestedSortKey, sortDirection: query.sortDirection },
      permissions: { canReadAll, canViewMoney },
      filters: {
        stores: stores.stores,
        defaultStoreId: stores.defaultStoreId,
        creators: creatorRows.map((creator) => ({ value: creator.id, label: this.personName(creator) })).sort((a, b) => a.label.localeCompare(b.label)),
      },
      floors: {
        values: { ...CREATIVE_CRAFT_FLOORS },
        provisional: CREATIVE_FLOORS_PROVISIONAL,
        // The scorecard's own targets, so the UI can name the bar each band is
        // measured against. Only the win-rate floor is a guess.
        scorecard: { ...SCORECARD_KPI_TARGETS, outputProvisional: SCORECARD_OUTPUT_TARGETS_PROVISIONAL },
      },
      capabilities: {
        callDeck: { available: false, reason: 'Call tracking is not connected to this workspace yet.' },
        landingPages: { available: false, reason: 'Landing-page performance is not tracked by this workspace yet.' },
      },
      kpis,
      scorecard,
      craftBoard,
      historicalAttribution,
      warnings: [
        ...(legacyAds.length > 0 ? [{ code: 'LEGACY_EMPLOYEE_ATTRIBUTION', severity: 'info', message: `${legacyAds.length} historical Meta ad${legacyAds.length === 1 ? '' : 's'} matched by employee ID and included in performance totals.` }] : []),
        ...(baseRows.length > 0 && linkedCreatives < baseRows.length ? [{ code: 'UNLINKED_CREATIVES', severity: 'warning', message: `${baseRows.length - linkedCreatives} registered creative${baseRows.length - linkedCreatives === 1 ? ' is' : 's are'} not linked to a Meta ad.` }] : []),
        ...(missingVideoMetrics > 0 ? [{ code: 'MISSING_VIDEO_METRICS', severity: 'info', message: `${missingVideoMetrics} video creative${missingVideoMetrics === 1 ? '' : 's'} have impressions but no measured 3-second play data in this range.` }] : []),
        ...(totals.impressions === 0 ? [{ code: 'NO_DELIVERY_DATA', severity: 'info', message: 'No attributed reconciled delivery data was found for the selected range.' }] : []),
        ...(guard.count > 0 ? [{ code: 'IMPOSSIBLE_RATES', severity: 'warning', message: `${guard.count} rate${guard.count === 1 ? ' was' : 's were'} withheld because a source reported an impossible value above 100% (${withheldStages.join(', ')}).` }] : []),
      ],
      items, pagination: { page, pageSize: query.pageSize, total, totalPages }, generatedAt: new Date().toISOString(),
    };
  }

  private async loadAdMetrics(tenantId: string, adIds: string[], start: Date, end: Date) {
    const metricsByAd = new Map<string, MetricTotals>();
    const descriptorByAd = new Map<string, AdDescriptor>();
    if (adIds.length === 0) return { metricsByAd, descriptorByAd };
    const date = { gte: start, lte: end };
    const [reconciled, hookRows, holdRows, completionRows, metaRows] = await Promise.all([
      this.prisma.reconcileMarketing.groupBy({ by: ['adId'], where: { tenantId, adId: { in: adIds }, date }, _sum: {
        spend: true, impressions: true, linkClicks: true, leads: true, purchasesPos: true,
        codPos: true, deliveredCount: true, canceledCount: true, rtsCount: true, deliveredCodPos: true,
        sfSdrPos: true, ffSdrPos: true, ifSdrPos: true, codFeeDeliveredPos: true, cogsDeliveredPos: true,
        canceledCodPos: true, rtsCodPos: true, restockingCodPos: true, abandonedCodPos: true,
      } }),
      this.prisma.metaAdInsight.groupBy({ by: ['adId'], where: { tenantId, adId: { in: adIds }, date, videoPlays3s: { not: null } }, _sum: { videoPlays3s: true, impressions: true } }),
      this.prisma.metaAdInsight.groupBy({ by: ['adId'], where: { tenantId, adId: { in: adIds }, date, videoPlays3s: { not: null }, thruPlays: { not: null } }, _sum: { videoPlays3s: true, thruPlays: true } }),
      this.prisma.metaAdInsight.groupBy({ by: ['adId'], where: { tenantId, adId: { in: adIds }, date, thruPlays: { not: null } }, _sum: { thruPlays: true, impressions: true } }),
      this.prisma.metaAdInsight.findMany({ where: { tenantId, adId: { in: adIds }, date }, select: { adId: true, adName: true, campaignName: true, adsetId: true, spend: true, frequency: true, impressions: true } }),
    ]);
    for (const row of reconciled) {
      const bucket = metricsByAd.get(row.adId) ?? emptyMetrics();
      bucket.spend += toNumber(row._sum.spend); bucket.impressions += row._sum.impressions ?? 0;
      bucket.linkClicks += row._sum.linkClicks ?? 0; bucket.landingPageViews += row._sum.leads ?? 0;
      bucket.orders += row._sum.purchasesPos ?? 0; bucket.delivered += row._sum.deliveredCount ?? 0;
      bucket.revenue += toNumber(row._sum.codPos);
      bucket.cancelled += row._sum.canceledCount ?? 0; bucket.rts += row._sum.rtsCount ?? 0;
      bucket.deliveredRevenue += toNumber(row._sum.deliveredCodPos);
      bucket.costs += toNumber(row._sum.sfSdrPos) + toNumber(row._sum.ffSdrPos) + toNumber(row._sum.ifSdrPos) + toNumber(row._sum.codFeeDeliveredPos) + toNumber(row._sum.cogsDeliveredPos);
      // AR% follows the Marketing KPI exclusion policy used by every other
      // advertising surface: cancelled, RTS, restocked and abandoned money is
      // not revenue. Diverging here would make two dashboards disagree.
      bucket.grossSales += toNumber(row._sum.codPos);
      bucket.excludedSales += toNumber(row._sum.canceledCodPos) + toNumber(row._sum.rtsCodPos)
        + toNumber(row._sum.restockingCodPos) + toNumber(row._sum.abandonedCodPos);
      metricsByAd.set(row.adId, bucket);
    }
    for (const row of hookRows) { const bucket = metricsByAd.get(row.adId) ?? emptyMetrics(); bucket.hookNumerator += row._sum.videoPlays3s ?? 0; bucket.hookDenominator += row._sum.impressions ?? 0; metricsByAd.set(row.adId, bucket); }
    for (const row of holdRows) { const bucket = metricsByAd.get(row.adId) ?? emptyMetrics(); bucket.holdNumerator += row._sum.thruPlays ?? 0; bucket.holdDenominator += row._sum.videoPlays3s ?? 0; metricsByAd.set(row.adId, bucket); }
    for (const row of completionRows) { const bucket = metricsByAd.get(row.adId) ?? emptyMetrics(); bucket.completionNumerator += row._sum.thruPlays ?? 0; bucket.completionDenominator += row._sum.impressions ?? 0; metricsByAd.set(row.adId, bucket); }
    for (const row of metaRows) {
      const bucket = metricsByAd.get(row.adId) ?? emptyMetrics();
      if (row.frequency !== null && row.impressions > 0) { bucket.frequencyNumerator += toNumber(row.frequency) * row.impressions; bucket.frequencyDenominator += row.impressions; }
      metricsByAd.set(row.adId, bucket);
      const spend = toNumber(row.spend); const current = descriptorByAd.get(row.adId);
      descriptorByAd.set(row.adId, current
        ? { ...current, spend: current.spend + spend }
        : { adId: row.adId, adName: row.adName, campaignName: row.campaignName, adsetId: row.adsetId, spend });
    }
    return { metricsByAd, descriptorByAd };
  }

  /**
   * The scorecard, graded on the owner's three weighted KPIs rather than on
   * craft rates: daily ad spend (40%), ads-to-revenue ratio (40%) and creative
   * output (20%).
   *
   * Ad-spend ratio is a ceiling — lower is better — so it rides the inverted
   * curve. An unmeasurable band is reweighted out rather than counted as zero,
   * so a period with no spend does not read as a zero score.
   */
  private buildScorecard(input: {
    kpis: Record<'hookRate' | 'holdRate' | 'completionRate' | 'ctr', { value: number | null }>;
    decisions: { approved: number; cancelled: number; medianTurnaroundHours: number | null; turnaroundCount: number };
    outputCount: number;
    days: number;
    scope: 'PERSONAL' | 'TEAM';
    revisionCensus: Array<{ status: string; count: number }>;
    spend: number;
    arPct: number | null;
    winRate: number | null;
    published: number;
  }) {
    const { kpis, decisions, outputCount, days, scope, revisionCensus, spend, arPct, winRate, published } = input;
    // Craft bands are reported, not scored — they say how the work is landing.
    const bands = [
      { key: 'hookRate' as const, value: kpis.hookRate.value, floor: CREATIVE_CRAFT_FLOORS.hookRate as number | null, score: bandScore(kpis.hookRate.value, CREATIVE_CRAFT_FLOORS.hookRate) },
      { key: 'holdRate' as const, value: kpis.holdRate.value, floor: CREATIVE_CRAFT_FLOORS.holdRate as number | null, score: bandScore(kpis.holdRate.value, CREATIVE_CRAFT_FLOORS.holdRate) },
      { key: 'completionRate' as const, value: kpis.completionRate.value, floor: CREATIVE_CRAFT_FLOORS.completionRate as number | null, score: bandScore(kpis.completionRate.value, CREATIVE_CRAFT_FLOORS.completionRate) },
      { key: 'ctr' as const, value: kpis.ctr.value, floor: CREATIVE_CRAFT_FLOORS.ctr as number | null, score: bandScore(kpis.ctr.value, CREATIVE_CRAFT_FLOORS.ctr) },
    ].map((band) => ({ ...band, weight: SCORECARD_BAND_WEIGHTS[band.key] }));

    // The 1–10 comes from the owner's KPIs alone. Daily spend is the period's
    // total over its length, so a 7-day and a 30-day window compare fairly.
    const dailySpend = days > 0 ? spend / days : null;
    const kpiBands = [
      {
        key: 'dailySpend' as const, value: dailySpend,
        target: SCORECARD_KPI_TARGETS.dailySpend as number,
        score: bandScore(dailySpend, SCORECARD_KPI_TARGETS.dailySpend),
      },
      {
        key: 'adSpendRatio' as const, value: arPct,
        target: SCORECARD_KPI_TARGETS.adSpendRatio as number,
        score: invertedBandScore(arPct, SCORECARD_KPI_TARGETS.adSpendRatio),
      },
      {
        key: 'creativeOutput' as const, value: winRate,
        target: SCORECARD_KPI_TARGETS.winRate as number,
        score: creativeOutputScore(
          published, SCORECARD_KPI_TARGETS.publishedPerPeriod,
          winRate, SCORECARD_KPI_TARGETS.winRate,
        ),
      },
    ].map((band) => ({ ...band, weight: SCORECARD_KPI_WEIGHTS[band.key] }));
    const overall = weightedBandScore(kpiBands);
    return {
      scope,
      overall,
      verdict: scorecardVerdict(overall),
      bands,
      kpiBands,
      efficiency: {
        approvedCount: decisions.approved,
        cancelledCount: decisions.cancelled,
        outputCount,
        approvedPerDay: days > 0 ? round(decisions.approved / days, 2) : null,
        quotaConfigured: false,
        quotaAttainment: null,
        medianTurnaroundHours: decisions.medianTurnaroundHours,
      },
      revisionCensus,
    };
  }

  private revisionCensus(creatives: Array<{ revisionState: string }>) {
    const counts = new Map<string, number>();
    for (const creative of creatives) counts.set(creative.revisionState, (counts.get(creative.revisionState) ?? 0) + 1);
    return [...counts.entries()].map(([status, count]) => ({ status, count }));
  }

  /**
   * Money-free craft board. Videos are graded on hook/hold/completion, statics
   * on the click; cancel rate is the one non-craft term — a promise-match
   * signal expressed as a percentage so no peso figure is needed.
   */
  private buildCraftBoard(rows: Array<{
    id: string; code: string; title: string; kind: CreativeKind; mediaUrl: string | null;
    performanceStatus: CreativePerformanceStatus;
    metrics: { hookRate: number | null; holdRate: number | null; completionRate: number | null; ctr: number | null; cancellationRate: number | null; impressions: number };
  }>) {
    const gradeable = rows.filter((row) => row.metrics.impressions > 0);
    const toCraftRow = (row: (typeof gradeable)[number]) => {
      const fatiguing = row.performanceStatus === CreativePerformanceStatus.FATIGUED;
      const signals = {
        hookRate: row.metrics.hookRate, holdRate: row.metrics.holdRate,
        completionRate: row.metrics.completionRate, ctr: row.metrics.ctr,
        cancellationRate: row.metrics.cancellationRate, fatiguing,
      };
      const { verdict, reason } = craftVerdict(row.kind, signals);
      return {
        id: row.id, code: row.code, title: row.title, kind: row.kind, mediaUrl: row.mediaUrl,
        fatiguing, hookRate: signals.hookRate, holdRate: signals.holdRate,
        completionRate: signals.completionRate, ctr: signals.ctr,
        cancellationRate: signals.cancellationRate, verdict, reason,
      };
    };
    const byRateDesc = (key: 'hookRate' | 'ctr') =>
      (a: ReturnType<typeof toCraftRow>, b: ReturnType<typeof toCraftRow>) => {
        if (a[key] === null && b[key] === null) return a.code.localeCompare(b.code);
        if (a[key] === null) return 1;
        if (b[key] === null) return -1;
        return (b[key] as number) - (a[key] as number);
      };
    return {
      videos: gradeable.filter((row) => row.kind === CreativeKind.VIDEO).map(toCraftRow).sort(byRateDesc('hookRate')),
      statics: gradeable.filter((row) => row.kind === CreativeKind.STATIC).map(toCraftRow).sort(byRateDesc('ctr')),
      ungradedCount: rows.length - gradeable.length,
    };
  }

  private sumMetrics(adIds: string[], source: Map<string, MetricTotals>) { return adIds.reduce((total, adId) => this.addMetrics(total, source.get(adId) ?? emptyMetrics()), emptyMetrics()); }
  private addMetrics(target: MetricTotals, source: MetricTotals) { for (const key of METRIC_KEYS) target[key] += source[key]; return target; }
  private storeMedians(rows: Array<{ store: { id: string | null }; metrics: { conversionRate: number | null } }>) {
    const grouped = new Map<string, number[]>();
    for (const row of rows) if (row.metrics.conversionRate !== null) grouped.set(row.store.id ?? '', [...(grouped.get(row.store.id ?? '') ?? []), row.metrics.conversionRate]);
    const result = new Map<string, number>();
    for (const [key, rates] of grouped) { const value = median(rates); if (value !== null) result.set(key, value); }
    return result;
  }
  /**
   * The funnel step that broke first, using the same bars C-Score grades
   * against so the two never disagree. Delivery is gone from the ladder — it
   * is a fulfilment outcome, not a step the editor's cut controls.
   */
  private bottleneck(kind: CreativeKind, values: { hookRate: number | null; holdRate: number | null; ctr: number | null; conversionRate: number | null }, storeMedian: number | null) {
    if (kind === CreativeKind.VIDEO && values.hookRate !== null && values.hookRate < C_SCORE_TARGETS.hookRate) return 'HOOK';
    if (kind === CreativeKind.VIDEO && values.holdRate !== null && values.holdRate < C_SCORE_TARGETS.holdRate) return 'HOLD';
    if (values.ctr !== null && values.ctr < C_SCORE_TARGETS.ctr) return 'CTR';
    if (values.conversionRate !== null && storeMedian && values.conversionRate < storeMedian * 0.6) return 'ORDER_RATE';
    return null;
  }
  private async decisionMetrics(tenantId: string, creativeIds: string[], start: Date, end: Date) {
    if (!creativeIds.length) return { approved: 0, cancelled: 0, medianTurnaroundHours: null, turnaroundCount: 0, publishedIds: new Set<string>() };
    const [events, approvedCreatives, liveEvents] = await Promise.all([
      this.prisma.creativeStatusEvent.findMany({ where: { tenantId, creativeId: { in: creativeIds }, dimension: CreativeStatusDimension.REVISION, toStatus: { in: ['NEEDS_REVISION', 'RESOLVED'] }, createdAt: { gte: start, lte: end } }, select: { creativeId: true, toStatus: true } }),
      this.prisma.creative.findMany({ where: { tenantId, id: { in: creativeIds }, approvedAt: { gte: start, lte: end }, submittedAt: { not: null } }, select: { submittedAt: true, approvedAt: true } }),
      // "Published" now means the creative actually went out. The old QC ladder
      // (FOR_POSTING/POSTED) no longer exists, and approvedAt is only ever read
      // — nothing writes it since the approval step was removed — so going LIVE
      // on the performance ladder is the only honest publish signal left.
      this.prisma.creativeStatusEvent.findMany({ where: { tenantId, creativeId: { in: creativeIds }, dimension: CreativeStatusDimension.PERFORMANCE, toStatus: 'LIVE', createdAt: { gte: start, lte: end } }, select: { creativeId: true } }),
    ]);
    const approved = new Set(events.filter((event) => event.toStatus === 'RESOLVED').map((event) => event.creativeId)).size;
    const cancelled = new Set(events.filter((event) => event.toStatus === 'NEEDS_REVISION').map((event) => event.creativeId)).size;
    // A relaunch (FATIGUED -> LIVE) can fire twice in one window; count the creative once.
    const publishedIds = new Set(liveEvents.map((event) => event.creativeId));
    const hours = approvedCreatives.map((creative) => ((creative.approvedAt as Date).getTime() - (creative.submittedAt as Date).getTime()) / 3_600_000);
    const medianHours = median(hours);
    return { approved, cancelled, medianTurnaroundHours: medianHours === null ? null : round(medianHours, 1), turnaroundCount: hours.length, publishedIds };
  }

  /**
   * The AR% a creative must beat to count as a win. Prefers the person's
   * configured Marketing KPI target over the provisional house default.
   *
   * Marketing targets are stored in PERCENT units (30 means 30%) while every
   * ratio in this module is a fraction, hence the divide.
   */
  private async resolveWinnerArCeiling(tenantId: string, userId: string | null, start: Date, end: Date) {
    const fallback = ADVERTISING_PROVISIONAL_DEFAULTS.adSpendRatioHealthy;
    if (!userId) return { ceiling: fallback, provisional: true };
    const target = await this.prisma.marketingKpiTarget.findFirst({
      where: {
        tenantId, userId, metricKey: 'USER_AR_PCT',
        startDate: { lte: end },
        OR: [{ endDate: null }, { endDate: { gte: start } }],
      },
      orderBy: { startDate: 'desc' }, select: { targetValue: true },
    });
    const configured = target ? toNumber(target.targetValue) / 100 : null;
    return configured !== null && configured > 0
      ? { ceiling: configured, provisional: false }
      : { ceiling: fallback, provisional: true };
  }
  private metric(guard: RateGuard, stage: string, numerator: number, denominator: number) {
    return { value: guard.rate(stage, numerator, denominator), numerator, denominator };
  }
  private sortRows<T extends { code: string; metrics: Record<string, unknown> }>(rows: T[], requested: CreativeOverviewSortKey, direction: 'asc' | 'desc', canViewMoney: boolean) {
    // spend and arPct are readable by everyone in this workspace, so only the
    // deeper P&L keys fall back when money is hidden.
    const key = !canViewMoney && ['netMargin', 'costPerOrder', 'deliveredCostPerOrder'].includes(requested) ? 'creativeScore' : requested;
    const multiplier = direction === 'asc' ? 1 : -1;
    return [...rows].sort((left, right) => { const a = key === 'code' ? left.code : left.metrics[key]; const b = key === 'code' ? right.code : right.metrics[key]; if (a == null && b == null) return left.code.localeCompare(right.code); if (a == null) return 1; if (b == null) return -1; const compared = typeof a === 'string' ? a.localeCompare(String(b)) : Number(a) - Number(b); return compared === 0 ? left.code.localeCompare(right.code) : compared * multiplier; });
  }
  private personName(person: { firstName: string | null; lastName: string | null; email: string }) { return [person.firstName, person.lastName].filter(Boolean).join(' ') || person.email; }
  private resolveDateRange(startDate?: string, endDate?: string) {
    const today = new Date(); const defaultEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59, 999)); const defaultStart = new Date(defaultEnd); defaultStart.setUTCDate(defaultStart.getUTCDate() - 29); defaultStart.setUTCHours(0, 0, 0, 0);
    const start = startDate ? new Date(`${startDate}T00:00:00.000Z`) : defaultStart; const end = endDate ? new Date(`${endDate}T23:59:59.999Z`) : defaultEnd;
    if (start > end) throw new BadRequestException('startDate must be on or before endDate');
    if ((end.getTime() - start.getTime()) / 86_400_000 > 366) throw new BadRequestException('Creative overview supports a maximum date range of 366 days');
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));
    return { start, end, days, startKey: start.toISOString().slice(0, 10), endKey: end.toISOString().slice(0, 10) };
  }
}
