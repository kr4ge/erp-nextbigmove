import { Injectable } from '@nestjs/common';
import { CreativeRevisionState, CreativeStatusDimension, Prisma } from '@prisma/client';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CREATIVE_AGENT_PERMISSIONS } from '../creative-agent.constants';
import { GetAdvertisingDashboardQueryDto } from '../dto/get-advertising-dashboard-query.dto';
import { ListAdvertisingPerformanceQueryDto } from '../dto/list-advertising-performance-query.dto';
import type { CreativeActor } from '../types/creative-actor.type';
import {
  adSpendRatio,
  ADVERTISING_PROVISIONAL_DEFAULTS,
  clickThroughRate,
  completionRate,
  conversionRate,
  costPerClick,
  costPerOrder,
  holdRate,
  hookRate,
  netContribution,
  resolvedRates,
} from '../utils/advertising-metrics';
import { isImpossibleRate, median, round } from '../utils/creative-metrics';
import { loadCreativeStoreOptions } from './creative-store-options';
import { CreativeAccessService } from './creative-access.service';
import { CreativePerformanceService, type AdvertisingDateRange } from './creative-performance.service';

dayjs.extend(utc);
dayjs.extend(timezone);

const MANILA_TZ = 'Asia/Manila';
/** Review submissions older than this are flagged as aging. Provisional SLA — no configured source exists. */
const REVIEW_SLA_HOURS = 48;
/** Data older than this many days is flagged stale. */
const STALE_DATA_DAYS = 2;

type Metric = {
  value: number | null;
  numerator: number | null;
  denominator: number | null;
  availability: 'OK' | 'NO_DATA' | 'UNAVAILABLE';
  provisional?: boolean;
  benchmark?: number | null;
};

type Alert = { code: string; severity: 'critical' | 'warning'; message: string; href?: string };

@Injectable()
export class CreativeAdvertisingDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CreativeAccessService,
    private readonly performance: CreativePerformanceService,
  ) {}

  async getDashboard(actor: CreativeActor, query: GetAdvertisingDashboardQueryDto) {
    const context = await this.access.resolve(actor);
    this.access.require(context, CREATIVE_AGENT_PERMISSIONS.READ_ALL);
    const tenantId = context.tenantId;
    const range = this.performance.resolveDateRange(query.startDate, query.endDate);
    const storeOptions = await loadCreativeStoreOptions(this.prisma, tenantId);
    // A single usable store is pinned rather than offered as a choice.
    const effectiveStoreId = query.storeId ?? storeOptions.defaultStoreId ?? undefined;
    const scopedAdIds = await this.performance.resolveScopedAdIds(tenantId, effectiveStoreId, query.creatorId);
    const scope = await this.performance.computeScope(tenantId, range, {
      accountId: query.accountId,
      storeAdIds: scopedAdIds,
    });
    const creativeScopeWhere: Prisma.CreativeWhereInput = {
      tenantId,
      ...(effectiveStoreId ? { storeConfig: { storeId: effectiveStoreId } } : {}),
      ...(query.creatorId ? { createdById: query.creatorId } : {}),
    };

    const [
      accountOptions,
      creators,
      videoTotals,
      revisionPipeline,
      calendar,
      trend,
      freshness,
      missingVideoCount,
      needsAction,
    ] = await Promise.all([
      this.performance.loadAccountOptions(tenantId),
      this.prisma.creative.findMany({
        where: { tenantId },
        distinct: ['createdById'],
        select: { createdBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
      }),
      this.loadVideoTotals(tenantId, range, query.accountId, scopedAdIds),
      this.loadRevisionPipeline(tenantId, range, creativeScopeWhere),
      this.loadCalendar(tenantId, range, query.accountId, scopedAdIds, creativeScopeWhere),
      this.loadTrend(tenantId, range, query.accountId, scopedAdIds),
      this.loadFreshness(tenantId),
      this.countMissingVideoMetrics(tenantId, range, query.accountId, scopedAdIds),
      this.loadNeedsAction(actor, range, query, effectiveStoreId),
    ]);

    let withheldRates = 0;
    const guardCount = (numerator: number, denominator: number) => {
      if (isImpossibleRate(numerator, denominator)) withheldRates += 1;
    };
    guardCount(videoTotals.plays3s, videoTotals.videoImpressions);
    guardCount(videoTotals.thruPlaysH, videoTotals.plays3sH);
    guardCount(videoTotals.thruPlays, videoTotals.thruImpressions);
    guardCount(scope.totals.linkClicks, scope.totals.impressions);
    guardCount(scope.totals.orders, scope.totals.leads);

    const metric = (
      value: number | null, numerator: number | null, denominator: number | null,
      extra: Partial<Metric> = {},
    ): Metric => ({
      value,
      numerator,
      denominator,
      availability: denominator === null || denominator === 0 ? 'NO_DATA' : 'OK',
      ...extra,
    });

    const totals = scope.totals;
    const cpp = costPerOrder(totals.spend, totals.orders);
    const periodNet = netContribution({
      deliveredRevenue: totals.deliveredSales,
      deliveredCogs: 0,
      fulfillmentCosts: totals.deliveredCosts,
      spend: totals.spend,
    });
    const resolved = resolvedRates(totals.delivered, totals.cancelled, totals.rts);
    const spendRatio = adSpendRatio(totals.spend, totals.adjustedSales);

    const kpis = {
      advertising: {
        costPerClick: metric(costPerClick(totals.spend, totals.linkClicks), totals.spend, totals.linkClicks),
        costPerOrder: metric(cpp, totals.spend, totals.orders, {
          benchmark: scope.ceiling.workingCeiling,
          provisional: scope.ceiling.provisional,
        }),
        posOrders: { value: totals.orders, numerator: null, denominator: null, availability: 'OK' as const },
        adSpendRatio: metric(spendRatio, totals.spend, totals.adjustedSales, {
          benchmark: ADVERTISING_PROVISIONAL_DEFAULTS.adSpendRatioHealthy,
          provisional: true,
        }),
        totalSpend: { value: round(totals.spend, 2), numerator: null, denominator: null, availability: 'OK' as const },
        linkedSpendCoverage: metric(scope.linkedSpendCoverage, scope.linkedSpend, totals.spend),
      },
      creative: {
        hookRate: metric(hookRate(videoTotals.plays3s, videoTotals.videoImpressions), videoTotals.plays3s, videoTotals.videoImpressions),
        holdRate: metric(holdRate(videoTotals.thruPlaysH, videoTotals.plays3sH), videoTotals.thruPlaysH, videoTotals.plays3sH),
        completionRate: metric(completionRate(videoTotals.thruPlays, videoTotals.thruImpressions), videoTotals.thruPlays, videoTotals.thruImpressions),
        ctr: metric(clickThroughRate(totals.linkClicks, totals.impressions), totals.linkClicks, totals.impressions, {
          benchmark: ADVERTISING_PROVISIONAL_DEFAULTS.benchmarkCtr,
          provisional: true,
        }),
        cvr: metric(conversionRate(totals.orders, totals.leads), totals.orders, totals.leads),
      },
    };

    const alerts = this.buildAlerts({
      cpp, ceiling: scope.ceiling.workingCeiling, ceilingProvisional: scope.ceiling.provisional,
      periodNet, cancellationRate: resolved.cancellationRate,
      attributionCoverage: scope.attributionCoverage,
      verdictsSuppressed: scope.verdictsSuppressed,
      unlinkedSpend: scope.unlinkedSpend,
      freshness,
      oldestWaitingHours: revisionPipeline.oldestWaitingHours,
      todayKey: range.todayKey,
    });

    return {
      selected: {
        startDate: range.startKey, endDate: range.endKey,
        storeId: effectiveStoreId ?? '', accountId: query.accountId ?? '', creatorId: query.creatorId ?? '',
      },
      permissions: {
        canManageLinks: this.access.has(context, CREATIVE_AGENT_PERMISSIONS.ALIAS_MANAGE),
        canReview: this.access.has(context, CREATIVE_AGENT_PERMISSIONS.REVIEW),
      },
      filters: {
        stores: storeOptions.stores,
        accounts: accountOptions,
        creators: creators
          .map(({ createdBy }) => ({
            value: createdBy.id,
            label: [createdBy.firstName, createdBy.lastName].filter(Boolean).join(' ') || createdBy.email,
          }))
          .sort((a, b) => a.label.localeCompare(b.label)),
      },
      alerts,
      kpis,
      revisionPipeline: revisionPipeline.summary,
      calendar,
      trend,
      needsAction,
      dataConfidence: {
        latestInsightDate: freshness.latestInsightDate,
        latestReconcileDate: freshness.latestReconcileDate,
        orderAttributionCoverage: metric(scope.attributionCoverage, scope.attributedPosOrders, scope.totalPosOrders, {
          benchmark: scope.benchmarks.minAttributionCoverage,
          provisional: true,
        }),
        linkedSpendCoverage: metric(scope.linkedSpendCoverage, scope.linkedSpend, totals.spend),
        missingVideoMetricsCount: missingVideoCount,
        withheldRateCount: withheldRates,
        verdictsSuppressed: scope.verdictsSuppressed,
        // Pixel purchase counts are not imported from Meta, so the POS-versus-
        // pixel gap cannot be measured. Reported honestly instead of faked.
        posMetaPurchaseGap: {
          available: false as const,
          reason: 'Meta pixel purchase counts are not imported; POS is the only order source.',
        },
      },
      scope: {
        ceiling: scope.ceiling,
        benchmarks: scope.benchmarks,
        periodNetContribution: periodNet,
      },
      capabilities: {
        monthlySpendCap: { available: false as const, reason: 'No monthly spend cap is configured.' },
      },
      generatedAt: new Date().toISOString(),
    };
  }

  private async loadVideoTotals(
    tenantId: string,
    range: AdvertisingDateRange,
    accountId: string | undefined,
    scopedAdIds: string[] | null,
  ) {
    const where = {
      tenantId,
      date: { gte: range.start, lte: range.end },
      ...(accountId ? { accountId } : {}),
      ...(scopedAdIds ? { adId: { in: scopedAdIds } } : {}),
    };
    const [hookRows, holdRows, completionRows] = await Promise.all([
      this.prisma.metaAdInsight.aggregate({
        where: { ...where, videoPlays3s: { not: null } },
        _sum: { videoPlays3s: true, impressions: true },
      }),
      this.prisma.metaAdInsight.aggregate({
        where: { ...where, videoPlays3s: { not: null }, thruPlays: { not: null } },
        _sum: { thruPlays: true, videoPlays3s: true },
      }),
      this.prisma.metaAdInsight.aggregate({
        where: { ...where, thruPlays: { not: null } },
        _sum: { thruPlays: true, impressions: true },
      }),
    ]);
    return {
      plays3s: hookRows._sum.videoPlays3s ?? 0,
      videoImpressions: hookRows._sum.impressions ?? 0,
      thruPlaysH: holdRows._sum.thruPlays ?? 0,
      plays3sH: holdRows._sum.videoPlays3s ?? 0,
      thruPlays: completionRows._sum.thruPlays ?? 0,
      thruImpressions: completionRows._sum.impressions ?? 0,
    };
  }

  /**
   * Feedback pipeline. Approval no longer exists — a linked creative is
   * already running — so this tracks open change requests and how quickly
   * they get resolved.
   */
  private async loadRevisionPipeline(
    tenantId: string,
    range: AdvertisingDateRange,
    creativeScopeWhere: Prisma.CreativeWhereInput,
  ) {
    const [stateCounts, requestedEvents, resolvedCreatives, oldestOpen, commentedCount] = await Promise.all([
      this.prisma.creative.groupBy({
        by: ['revisionState'],
        where: creativeScopeWhere,
        _count: { _all: true },
      }),
      this.prisma.creativeStatusEvent.findMany({
        where: {
          tenantId,
          dimension: CreativeStatusDimension.REVISION,
          toStatus: 'NEEDS_REVISION',
          createdAt: { gte: range.start, lte: range.end },
          creative: creativeScopeWhere,
        },
        select: { creativeId: true },
      }),
      this.prisma.creative.findMany({
        where: {
          ...creativeScopeWhere,
          revisionResolvedAt: { gte: range.start, lte: range.end },
          revisionRequestedAt: { not: null },
        },
        select: { revisionRequestedAt: true, revisionResolvedAt: true },
      }),
      this.prisma.creative.findFirst({
        where: {
          ...creativeScopeWhere,
          revisionState: CreativeRevisionState.NEEDS_REVISION,
          revisionRequestedAt: { not: null },
        },
        orderBy: { revisionRequestedAt: 'asc' },
        select: { revisionRequestedAt: true },
      }),
      this.prisma.creative.count({
        where: { ...creativeScopeWhere, reviewComments: { some: {} } },
      }),
    ]);
    const count = (state: CreativeRevisionState) =>
      stateCounts.find((row) => row.revisionState === state)?._count._all ?? 0;
    const hours = resolvedCreatives.map((creative) =>
      ((creative.revisionResolvedAt as Date).getTime() - (creative.revisionRequestedAt as Date).getTime()) / 3_600_000);
    const medianHours = median(hours);
    const oldestWaitingHours = oldestOpen?.revisionRequestedAt
      ? (Date.now() - oldestOpen.revisionRequestedAt.getTime()) / 3_600_000
      : null;
    return {
      summary: {
        needsRevision: count(CreativeRevisionState.NEEDS_REVISION),
        resolved: count(CreativeRevisionState.RESOLVED),
        noRequests: count(CreativeRevisionState.NONE),
        requestedInPeriod: new Set(requestedEvents.map((event) => event.creativeId)).size,
        resolvedInPeriod: resolvedCreatives.length,
        medianResolutionHours: medianHours === null ? null : round(medianHours, 1),
        withFeedback: commentedCount,
      },
      oldestWaitingHours,
    };
  }

  private async loadCalendar(
    tenantId: string,
    range: AdvertisingDateRange,
    accountId: string | undefined,
    scopedAdIds: string[] | null,
    creativeScopeWhere: Prisma.CreativeWhereInput,
  ) {
    const month = range.endKey.slice(0, 7);
    const monthStart = new Date(`${month}-01T00:00:00.000Z`);
    const monthEnd = new Date(`${dayjs(`${month}-01`).endOf('month').format('YYYY-MM-DD')}T23:59:59.999Z`);
    // createdAt is an instant; widen by the Manila offset so days at both
    // month edges are fetched, then the Manila-keyed bucketing filters them.
    const enrolledStart = new Date(monthStart.getTime() - 8 * 3_600_000);
    const enrolledEnd = new Date(monthEnd.getTime() + 8 * 3_600_000);
    const [rows, enrolled] = await Promise.all([
      this.prisma.reconcileMarketing.groupBy({
        by: ['date'],
        where: {
          tenantId,
          date: { gte: monthStart, lte: monthEnd },
          NOT: { adName: 'POS Unmatched Order' },
          ...(accountId ? { accountId } : {}),
          ...(scopedAdIds ? { adId: { in: scopedAdIds } } : {}),
        },
        _sum: {
          spend: true, purchasesPos: true, codPos: true,
          canceledCodPos: true, rtsCodPos: true, restockingCodPos: true, abandonedCodPos: true,
        },
      }),
      this.prisma.creative.findMany({
        where: { ...creativeScopeWhere, createdAt: { gte: enrolledStart, lte: enrolledEnd } },
        select: { createdAt: true },
      }),
    ]);
    const enrolledByDay = new Map<string, number>();
    for (const creative of enrolled) {
      const key = dayjs(creative.createdAt).tz(MANILA_TZ).format('YYYY-MM-DD');
      if (!key.startsWith(month)) continue;
      enrolledByDay.set(key, (enrolledByDay.get(key) ?? 0) + 1);
    }
    const toNum = (value: Prisma.Decimal | number | null) => Number(value ?? 0);
    const days = rows
      .map((row) => {
        const dateKey = row.date.toISOString().slice(0, 10);
        const spend = toNum(row._sum.spend);
        const orders = row._sum.purchasesPos ?? 0;
        const adjusted = Math.max(0, toNum(row._sum.codPos)
          - toNum(row._sum.canceledCodPos) - toNum(row._sum.rtsCodPos)
          - toNum(row._sum.restockingCodPos) - toNum(row._sum.abandonedCodPos));
        return {
          date: dateKey,
          orders,
          spend: round(spend, 2),
          cpp: costPerOrder(spend, orders),
          adSpendRatio: adSpendRatio(spend, adjusted),
          creativesEnrolled: enrolledByDay.get(dateKey) ?? 0,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
    for (const [dateKey, countValue] of enrolledByDay) {
      if (dateKey.startsWith(month) && !days.some((day) => day.date === dateKey)) {
        days.push({ date: dateKey, orders: 0, spend: 0, cpp: null, adSpendRatio: null, creativesEnrolled: countValue });
      }
    }
    days.sort((a, b) => a.date.localeCompare(b.date));
    return {
      month,
      monthLabel: dayjs(`${month}-01`).format('MMMM YYYY'),
      days,
    };
  }

  private async loadTrend(
    tenantId: string,
    range: AdvertisingDateRange,
    accountId: string | undefined,
    scopedAdIds: string[] | null,
  ) {
    const rows = await this.prisma.reconcileMarketing.groupBy({
      by: ['date'],
      where: {
        tenantId,
        date: { gte: range.start, lte: range.end },
        NOT: { adName: 'POS Unmatched Order' },
        ...(accountId ? { accountId } : {}),
        ...(scopedAdIds ? { adId: { in: scopedAdIds } } : {}),
      },
      _sum: { spend: true, codPos: true, deliveredCodPos: true, purchasesPos: true, deliveredCount: true },
      orderBy: { date: 'asc' },
    });
    const toNum = (value: Prisma.Decimal | number | null) => Number(value ?? 0);
    const byDate = new Map(rows.map((row) => [row.date.toISOString().slice(0, 10), row]));

    // Emit one point per calendar day in the range, so a day with no reconciled
    // rows plots as a real zero instead of being skipped — a gap would let the
    // curve interpolate straight across days that genuinely had no spend.
    // The label is formatted server-side in the tenant timezone so every client
    // renders the same string regardless of the viewer's own timezone.
    const labelFormatter = new Intl.DateTimeFormat('en-PH', {
      month: 'short', day: 'numeric', timeZone: MANILA_TZ,
    });
    const points: Array<{
      date: string; label: string; spend: number; grossValue: number;
      deliveredValue: number; orders: number; deliveredOrders: number;
    }> = [];
    for (let cursor = dayjs(range.startKey); !cursor.isAfter(dayjs(range.endKey), 'day'); cursor = cursor.add(1, 'day')) {
      const dateKey = cursor.format('YYYY-MM-DD');
      const row = byDate.get(dateKey);
      points.push({
        date: dateKey,
        label: labelFormatter.format(new Date(`${dateKey}T12:00:00.000Z`)),
        spend: round(toNum(row?._sum.spend ?? 0), 2),
        grossValue: round(toNum(row?._sum.codPos ?? 0), 2),
        deliveredValue: round(toNum(row?._sum.deliveredCodPos ?? 0), 2),
        orders: row?._sum.purchasesPos ?? 0,
        deliveredOrders: row?._sum.deliveredCount ?? 0,
      });
    }
    return points;
  }

  private async loadFreshness(tenantId: string) {
    const [insight, reconcile] = await Promise.all([
      this.prisma.metaAdInsight.aggregate({ where: { tenantId }, _max: { date: true } }),
      this.prisma.reconcileMarketing.aggregate({ where: { tenantId }, _max: { date: true } }),
    ]);
    return {
      latestInsightDate: insight._max.date ? insight._max.date.toISOString().slice(0, 10) : null,
      latestReconcileDate: reconcile._max.date ? reconcile._max.date.toISOString().slice(0, 10) : null,
    };
  }

  private async countMissingVideoMetrics(
    tenantId: string,
    range: AdvertisingDateRange,
    accountId: string | undefined,
    scopedAdIds: string[] | null,
  ) {
    const rows = await this.prisma.metaAdInsight.groupBy({
      by: ['adId'],
      where: {
        tenantId,
        date: { gte: range.start, lte: range.end },
        ...(accountId ? { accountId } : {}),
        ...(scopedAdIds ? { adId: { in: scopedAdIds } } : {}),
      },
      _sum: { impressions: true },
      _count: { videoPlays3s: true },
    });
    return rows.filter((row) => (row._sum.impressions ?? 0) > 0 && row._count.videoPlays3s === 0).length;
  }

  private async loadNeedsAction(
    actor: CreativeActor,
    range: AdvertisingDateRange,
    query: GetAdvertisingDashboardQueryDto,
    effectiveStoreId: string | undefined,
  ) {
    const performanceQuery = new ListAdvertisingPerformanceQueryDto();
    performanceQuery.startDate = range.startKey;
    performanceQuery.endDate = range.endKey;
    performanceQuery.storeId = effectiveStoreId;
    performanceQuery.accountId = query.accountId;
    performanceQuery.creatorId = query.creatorId;
    performanceQuery.group = 'ADS';
    performanceQuery.verdict = 'NEEDS_ACTION';
    performanceQuery.sortKey = 'spend';
    performanceQuery.sortDirection = 'desc';
    performanceQuery.page = 1;
    performanceQuery.pageSize = 5;
    const result = await this.performance.list(actor, performanceQuery);
    // Under suppression the NEEDS_ACTION filter is bypassed database-side, so
    // report zero rather than the unfiltered row count.
    const suppressed = result.scope.verdictsSuppressed;
    return {
      suppressed,
      total: suppressed ? 0 : result.pagination.total,
      items: suppressed ? [] : result.items,
    };
  }

  private buildAlerts(input: {
    cpp: number | null;
    ceiling: number | null;
    ceilingProvisional: boolean;
    periodNet: number;
    cancellationRate: number | null;
    attributionCoverage: number | null;
    verdictsSuppressed: boolean;
    unlinkedSpend: number;
    freshness: { latestInsightDate: string | null; latestReconcileDate: string | null };
    oldestWaitingHours: number | null;
    todayKey: string;
  }): Alert[] {
    const alerts: Alert[] = [];
    const peso = (value: number) => `₱${Math.round(value).toLocaleString('en-PH')}`;
    const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
    if (input.cpp !== null && input.ceiling !== null && input.cpp > input.ceiling) {
      alerts.push({
        code: 'CPP_ABOVE_CEILING', severity: 'critical',
        message: `CPP ${peso(input.cpp)} is above the working ceiling ${peso(input.ceiling)}${input.ceilingProvisional ? ' (provisional break-even derived)' : ''} — trim cost before scaling.`,
      });
    }
    if (input.periodNet < 0) {
      alerts.push({
        code: 'NEGATIVE_NET', severity: 'critical',
        message: `This period projects to a loss: net contribution is ${peso(input.periodNet)} after delivery costs and ad spend.`,
      });
    }
    if (input.cancellationRate !== null && input.cancellationRate > ADVERTISING_PROVISIONAL_DEFAULTS.maxCancellationRate) {
      alerts.push({
        code: 'CANCELLATION_ABOVE_TARGET', severity: 'warning',
        message: `Cancellation ${pct(input.cancellationRate)} exceeds the ${pct(ADVERTISING_PROVISIONAL_DEFAULTS.maxCancellationRate)} target (provisional) — route to order confirmation.`,
      });
    }
    if (input.verdictsSuppressed && input.attributionCoverage !== null) {
      alerts.push({
        code: 'LOW_ATTRIBUTION_COVERAGE', severity: 'warning',
        message: `Attribution coverage is ${pct(input.attributionCoverage)} — per-ad verdicts are suppressed below ${pct(ADVERTISING_PROVISIONAL_DEFAULTS.minAttributionCoverage)}.`,
      });
    }
    if (input.unlinkedSpend > 0) {
      alerts.push({
        code: 'UNLINKED_SPEND', severity: 'warning',
        message: `${peso(input.unlinkedSpend)} of spend is on Meta ads not linked to any registered creative.`,
        href: '/performance?linkStatus=UNLINKED',
      });
    }
    const staleBefore = dayjs(input.todayKey).subtract(STALE_DATA_DAYS, 'day').format('YYYY-MM-DD');
    if (input.freshness.latestInsightDate !== null && input.freshness.latestInsightDate < staleBefore) {
      alerts.push({
        code: 'STALE_META_DATA', severity: 'warning',
        message: `Latest Meta insight is from ${input.freshness.latestInsightDate} — the import may be behind.`,
      });
    }
    if (input.freshness.latestReconcileDate !== null && input.freshness.latestReconcileDate < staleBefore) {
      alerts.push({
        code: 'STALE_RECONCILIATION', severity: 'warning',
        message: `Latest reconciliation is from ${input.freshness.latestReconcileDate} — reconciled figures may be behind.`,
      });
    }
    if (input.oldestWaitingHours !== null && input.oldestWaitingHours > REVIEW_SLA_HOURS) {
      alerts.push({
        code: 'REVIEW_AGING', severity: 'warning',
        message: `The oldest submission has waited ${Math.floor(input.oldestWaitingHours)}h for review (SLA ${REVIEW_SLA_HOURS}h, provisional).`,
        href: '/assets?queue=REVIEW',
      });
    }
    // No monthly-cap alert: no spend cap is configured anywhere in the ERP.
    return alerts;
  }
}
