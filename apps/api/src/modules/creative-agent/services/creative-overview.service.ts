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
  isImpossibleRate,
  median,
  round,
  safeRatio,
  SCORECARD_BAND_WEIGHTS,
  scorecardVerdict,
  weightedBandScore,
} from '../utils/creative-metrics';
import { CreativeAccessService } from './creative-access.service';

type MetricTotals = {
  spend: number; impressions: number; linkClicks: number; landingPageViews: number;
  orders: number; delivered: number; cancelled: number; rts: number;
  deliveredRevenue: number; costs: number;
  hookNumerator: number; hookDenominator: number; holdNumerator: number; holdDenominator: number;
  completionNumerator: number; completionDenominator: number;
  frequencyNumerator: number; frequencyDenominator: number;
};
type AdDescriptor = { adId: string; adName: string; campaignName: string; adsetId: string; spend: number };
const emptyMetrics = (): MetricTotals => ({
  spend: 0, impressions: 0, linkClicks: 0, landingPageViews: 0, orders: 0, delivered: 0,
  cancelled: 0, rts: 0, deliveredRevenue: 0, costs: 0, hookNumerator: 0,
  hookDenominator: 0, holdNumerator: 0, holdDenominator: 0, completionNumerator: 0,
  completionDenominator: 0, frequencyNumerator: 0, frequencyDenominator: 0,
});
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
  constructor(private readonly prisma: PrismaService, private readonly access: CreativeAccessService) {}

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
    const where: Prisma.CreativeWhereInput = {
      tenantId: context.tenantId,
      ...(!canReadAll ? { createdById: context.userId } : query.creatorId ? { createdById: query.creatorId } : {}),
      ...(query.storeId ? { storeConfig: { storeId: query.storeId } } : {}),
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
    const [creatives, stores, creatorRows] = await Promise.all([
      this.prisma.creative.findMany({ where, select: {
        id: true, code: true, title: true, kind: true, mediaUrl: true, qcStatus: true,
        performanceStatus: true, createdAt: true, submittedAt: true, approvedAt: true,
        metaAdId: true, metaAdLinks: { select: { adId: true }, orderBy: { linkedAt: 'asc' } },
        storeConfig: { select: { storeId: true, storeNameSnapshot: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      } }),
      this.prisma.creativeStoreConfig.findMany({
        where: { tenantId: context.tenantId, active: true, storeId: { not: null } },
        select: { storeId: true, storeNameSnapshot: true }, orderBy: { storeNameSnapshot: 'asc' },
      }),
      this.prisma.creative.findMany({
        where: { tenantId: context.tenantId, ...(!canReadAll ? { createdById: context.userId } : {}) },
        distinct: ['createdById'], select: { createdBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
      }),
    ]);

    const creativeAdIds = new Map<string, string[]>();
    for (const creative of creatives) {
      const ids = creative.metaAdLinks.map((link) => link.adId);
      if (ids.length === 0 && creative.metaAdId) ids.push(creative.metaAdId);
      creativeAdIds.set(creative.id, [...new Set(ids)]);
    }
    const adIds = [...new Set([...creativeAdIds.values()].flat())];
    const { metricsByAd, descriptorByAd } = await this.loadAdMetrics(context.tenantId, adIds, range.start, range.end);
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
      return {
        id: creative.id, code: creative.code, title: creative.title, kind: creative.kind,
        mediaUrl: creative.mediaUrl,
        store: { id: creative.storeConfig.storeId, name: creative.storeConfig.storeNameSnapshot },
        creator: { id: creative.createdBy.id, name: this.personName(creative.createdBy) },
        qcStatus: creative.qcStatus, performanceStatus: creative.performanceStatus,
        linked: linkedAdIds.length > 0, metaAdId: linkedAdIds[0] ?? null, metaAdIds: linkedAdIds,
        adCount: linkedAdIds.length, topAd, testing: metrics.spend < 3_000 && metrics.orders < 10,
        metrics: {
          creativeScore: null as number | null, winnerScore: null as number | null,
          decision: 'NOT_CONFIGURED' as const, bottleneck: null as string | null,
          hookRate, holdRate, completionRate, ctr, lpRate, conversionRate,
          deliveryRate: guard.rate('delivery', metrics.delivered, resolved),
          cancellationRate: guard.rate('cancel', metrics.cancelled, resolved),
          rtsRate: guard.rate('rts', metrics.rts, resolved),
          // Frequency is a plain weighted average, not a rate — values above 1 are normal.
          frequency: safeRatio(metrics.frequencyNumerator, metrics.frequencyDenominator),
          impressions: metrics.impressions, linkClicks: metrics.linkClicks,
          landingPageViews: metrics.landingPageViews, orders: metrics.orders, deliveredOrders: metrics.delivered,
          ...(canViewMoney ? {
            spend: money(metrics.spend), costPerOrder: metrics.orders > 0 ? money(metrics.spend / metrics.orders) : null,
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
      row.metrics.creativeScore = this.creativeScore(row.kind, row.metrics, storeMedian);
      row.metrics.bottleneck = this.bottleneck(row.kind, row.metrics, storeMedian);
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
    const totals = baseRows.reduce((acc, row) => this.addMetrics(acc, row._totals), emptyMetrics());
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
      approvalRate: this.metric(guard, 'approval', decisions.approved, decisions.approved + decisions.cancelled),
      medianTurnaroundHours: { value: decisions.medianTurnaroundHours, numerator: null, denominator: decisions.turnaroundCount },
    };
    const scorecard = this.buildScorecard({
      kpis, decisions, outputCount, days: range.days,
      scope: canReadAll && !query.creatorId ? 'TEAM' : 'PERSONAL',
      qcCensus: this.qcCensus(creatives),
    });
    const craftBoard = this.buildCraftBoard(baseRows);
    const withheldStages = [...guard.stages.keys()];
    return {
      selected: { startDate: range.startKey, endDate: range.endKey, query: query.query ?? '', storeId: query.storeId ?? '', kind: query.kind ?? '', creatorId: query.creatorId ?? '', lens: selectedLens, sortKey: requestedSortKey, sortDirection: query.sortDirection },
      permissions: { canReadAll, canViewMoney },
      filters: {
        stores: stores.filter((store) => store.storeId).map((store) => ({ value: store.storeId as string, label: store.storeNameSnapshot })),
        creators: creatorRows.map(({ createdBy }) => ({ value: createdBy.id, label: this.personName(createdBy) })).sort((a, b) => a.label.localeCompare(b.label)),
      },
      floors: {
        values: { ...CREATIVE_CRAFT_FLOORS },
        provisional: CREATIVE_FLOORS_PROVISIONAL,
      },
      capabilities: {
        callDeck: { available: false, reason: 'Call tracking is not connected to this workspace yet.' },
        landingPages: { available: false, reason: 'Landing-page performance is not tracked by this workspace yet.' },
      },
      kpis,
      scorecard,
      craftBoard,
      warnings: [
        ...(baseRows.length > 0 && linkedCreatives < baseRows.length ? [{ code: 'UNLINKED_CREATIVES', severity: 'warning', message: `${baseRows.length - linkedCreatives} registered creative${baseRows.length - linkedCreatives === 1 ? ' is' : 's are'} not linked to a Meta ad.` }] : []),
        ...(missingVideoMetrics > 0 ? [{ code: 'MISSING_VIDEO_METRICS', severity: 'info', message: `${missingVideoMetrics} video creative${missingVideoMetrics === 1 ? '' : 's'} have impressions but no measured 3-second play data in this range.` }] : []),
        ...(totals.impressions === 0 ? [{ code: 'NO_DELIVERY_DATA', severity: 'info', message: 'No linked reconciled delivery data was found for the selected range.' }] : []),
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
        deliveredCount: true, canceledCount: true, rtsCount: true, deliveredCodPos: true,
        sfSdrPos: true, ffSdrPos: true, ifSdrPos: true, codFeeDeliveredPos: true, cogsDeliveredPos: true,
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
      bucket.cancelled += row._sum.canceledCount ?? 0; bucket.rts += row._sum.rtsCount ?? 0;
      bucket.deliveredRevenue += toNumber(row._sum.deliveredCodPos);
      bucket.costs += toNumber(row._sum.sfSdrPos) + toNumber(row._sum.ffSdrPos) + toNumber(row._sum.ifSdrPos) + toNumber(row._sum.codFeeDeliveredPos) + toNumber(row._sum.cogsDeliveredPos);
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
   * The personal (or team-aggregate) craft scorecard. Band values are weighted
   * aggregates over the scoped rows — never averages of per-creative rates.
   * The quota band is intentionally unavailable: no daily-quota model exists,
   * and an unmeasurable band is reweighted out rather than counted as zero.
   */
  private buildScorecard(input: {
    kpis: Record<'hookRate' | 'holdRate' | 'completionRate' | 'ctr' | 'approvalRate', { value: number | null }>;
    decisions: { approved: number; cancelled: number; medianTurnaroundHours: number | null; turnaroundCount: number };
    outputCount: number;
    days: number;
    scope: 'PERSONAL' | 'TEAM';
    qcCensus: Array<{ status: string; count: number }>;
  }) {
    const { kpis, decisions, outputCount, days, scope, qcCensus } = input;
    const hookRate = kpis.hookRate.value;
    const holdRate = kpis.holdRate.value;
    const completionRate = kpis.completionRate.value;
    const ctr = kpis.ctr.value;
    const approvalRate = kpis.approvalRate.value;
    const bands = [
      { key: 'hookRate' as const, value: hookRate, floor: CREATIVE_CRAFT_FLOORS.hookRate as number | null, score: bandScore(hookRate, CREATIVE_CRAFT_FLOORS.hookRate) },
      { key: 'holdRate' as const, value: holdRate, floor: CREATIVE_CRAFT_FLOORS.holdRate as number | null, score: bandScore(holdRate, CREATIVE_CRAFT_FLOORS.holdRate) },
      { key: 'completionRate' as const, value: completionRate, floor: CREATIVE_CRAFT_FLOORS.completionRate as number | null, score: bandScore(completionRate, CREATIVE_CRAFT_FLOORS.completionRate) },
      { key: 'ctr' as const, value: ctr, floor: CREATIVE_CRAFT_FLOORS.ctr as number | null, score: bandScore(ctr, CREATIVE_CRAFT_FLOORS.ctr) },
      // Approval has no craft floor; the band maps the finished-decision rate straight onto 0…10.
      { key: 'approvalRate' as const, value: approvalRate, floor: null, score: approvalRate === null ? null : round(approvalRate * 10, 1) },
    ].map((band) => ({ ...band, weight: SCORECARD_BAND_WEIGHTS[band.key] }));
    const overall = weightedBandScore(bands);
    return {
      scope,
      overall,
      verdict: scorecardVerdict(overall),
      bands,
      efficiency: {
        approvedCount: decisions.approved,
        cancelledCount: decisions.cancelled,
        outputCount,
        approvedPerDay: days > 0 ? round(decisions.approved / days, 2) : null,
        quotaConfigured: false,
        quotaAttainment: null,
        medianTurnaroundHours: decisions.medianTurnaroundHours,
      },
      qcCensus,
    };
  }

  private qcCensus(creatives: Array<{ qcStatus: string }>) {
    const counts = new Map<string, number>();
    for (const creative of creatives) counts.set(creative.qcStatus, (counts.get(creative.qcStatus) ?? 0) + 1);
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
  private creativeScore(kind: CreativeKind, values: { hookRate: number | null; holdRate: number | null; ctr: number | null; deliveryRate: number | null; conversionRate: number | null }, storeMedian: number | null) {
    const candidates = [
      ...(kind === CreativeKind.VIDEO ? [{ value: values.hookRate, target: 0.2, weight: 0.25 }, { value: values.holdRate, target: 0.45, weight: 0.2 }] : []),
      { value: values.deliveryRate, target: 0.55, weight: 0.25 }, { value: values.ctr, target: 0.015, weight: 0.15 },
      { value: values.conversionRate, target: storeMedian && storeMedian > 0 ? storeMedian : null, weight: 0.15 },
    ];
    const measured = candidates.filter((item): item is { value: number; target: number; weight: number } => item.value !== null && item.target !== null);
    const weight = measured.reduce((sum, item) => sum + item.weight, 0);
    return weight === 0 ? null : round(measured.reduce((sum, item) => sum + Math.min(item.value / item.target, 1.5) * item.weight, 0) / weight * 100, 1);
  }
  private bottleneck(kind: CreativeKind, values: { hookRate: number | null; holdRate: number | null; ctr: number | null; deliveryRate: number | null; conversionRate: number | null }, storeMedian: number | null) {
    if (kind === CreativeKind.VIDEO && values.hookRate !== null && values.hookRate < 0.2) return 'HOOK';
    if (kind === CreativeKind.VIDEO && values.holdRate !== null && values.holdRate < 0.45) return 'HOLD';
    if (values.ctr !== null && values.ctr < 0.015) return 'CTR';
    if (values.conversionRate !== null && storeMedian && values.conversionRate < storeMedian * 0.6) return 'ORDER_RATE';
    if (values.deliveryRate !== null && values.deliveryRate < 0.55) return 'DELIVERY';
    return null;
  }
  private async decisionMetrics(tenantId: string, creativeIds: string[], start: Date, end: Date) {
    if (!creativeIds.length) return { approved: 0, cancelled: 0, medianTurnaroundHours: null, turnaroundCount: 0 };
    const [events, approvedCreatives] = await Promise.all([
      this.prisma.creativeStatusEvent.findMany({ where: { tenantId, creativeId: { in: creativeIds }, dimension: CreativeStatusDimension.QC, toStatus: { in: ['FOR_POSTING', 'CANCELLED'] }, createdAt: { gte: start, lte: end } }, select: { creativeId: true, toStatus: true } }),
      this.prisma.creative.findMany({ where: { tenantId, id: { in: creativeIds }, approvedAt: { gte: start, lte: end }, submittedAt: { not: null } }, select: { submittedAt: true, approvedAt: true } }),
    ]);
    const approved = new Set(events.filter((event) => event.toStatus === 'FOR_POSTING').map((event) => event.creativeId)).size;
    const cancelled = new Set(events.filter((event) => event.toStatus === 'CANCELLED').map((event) => event.creativeId)).size;
    const hours = approvedCreatives.map((creative) => ((creative.approvedAt as Date).getTime() - (creative.submittedAt as Date).getTime()) / 3_600_000);
    const medianHours = median(hours);
    return { approved, cancelled, medianTurnaroundHours: medianHours === null ? null : round(medianHours, 1), turnaroundCount: hours.length };
  }
  private metric(guard: RateGuard, stage: string, numerator: number, denominator: number) {
    return { value: guard.rate(stage, numerator, denominator), numerator, denominator };
  }
  private sortRows<T extends { code: string; metrics: Record<string, unknown> }>(rows: T[], requested: CreativeOverviewSortKey, direction: 'asc' | 'desc', canViewMoney: boolean) {
    const key = !canViewMoney && ['spend', 'netMargin', 'costPerOrder', 'deliveredCostPerOrder'].includes(requested) ? 'creativeScore' : requested;
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
