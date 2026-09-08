import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AdLibraryFormat, AdStrategyTag, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TeamContextService } from '../../common/services/team-context.service';
import { MediaAssetsService } from '../../common/services/media-assets.service';
import { parseAdName } from './ad-name';
import {
  aggregate,
  evaluate,
  formatPeso,
  rankByContribution,
  type AdEconomics,
  type AdRow,
  type Benchmark,
} from './ad-metrics';

/**
 * Reads ReconcileMarketing — the table where Meta spend is already joined to
 * Pancake orders on pUtmContent — and turns it into per-ad economics.
 *
 * This module adds no ingestion of its own. The spend arrives through the
 * existing manual Meta upload workflow and the join is done by
 * reconcile-marketing.service; everything here sits on top of that.
 */

/** Benchmark used when a tenant has not set one. Matches the schema defaults. */
const DEFAULT_BENCHMARK: Benchmark = {
  cpp: 30000,
  cpm: 15000,
  ctrPct: 2.0,
  deliveryRate: 0.55,
  cancelRate: 0.25,
  rtsRate: 0.1,
  targetMer: 2.5,
};

export interface PeriodSummary {
  spend: number;
  purchases: number;
  netContribution: number;
  realizedMer: number | null;
  cpp: number | null;
  adsWithSpend: number;
  adsWithNoOrders: number;
}

export interface AdvertisingPosition {
  period: { start: string; end: string };
  benchmark: Benchmark;
  benchmarkIsDefault: boolean;
  summary: PeriodSummary;
  ads: AdEconomics[];
}

/** Prisma Decimal to integer centavos. Rounds once, at the boundary. */
function toCentavos(value: Prisma.Decimal | null | undefined): number {
  if (!value) return 0;
  return Math.round(Number(value) * 100);
}

@Injectable()
export class AdvertisingService {
  private readonly logger = new Logger(AdvertisingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly teamContext: TeamContextService,
    private readonly mediaAssets: MediaAssetsService,
  ) {}

  /**
   * The whole advertiser's position for a date range: every ad that spent or
   * sold, scored against the benchmark and ranked by what it is worth.
   */
  async getPosition(params: {
    startDate: string;
    endDate: string;
    accountId?: string;
  }): Promise<AdvertisingPosition> {
    const context = await this.teamContext.getContext();
    const { tenantId } = context;

    const where: Prisma.ReconcileMarketingWhereInput = {
      tenantId,
      date: { gte: new Date(params.startDate), lte: new Date(params.endDate) },
      ...(params.accountId ? { accountId: params.accountId } : {}),
    };

    // Non-admins see only the teams they belong to, matching how the rest of
    // the platform scopes marketing data.
    if (!context.isAdmin && context.userTeams.length) {
      where.teamId = { in: context.userTeams };
    }

    const rows = await this.prisma.reconcileMarketing.findMany({
      where,
      select: {
        adId: true,
        adName: true,
        campaignId: true,
        campaignName: true,
        marketingAssociate: true,
        spend: true,
        impressions: true,
        clicks: true,
        linkClicks: true,
        purchasesPos: true,
        processedPurchasesPos: true,
        deliveredCodPos: true,
        cogsDeliveredPos: true,
        codFeeDeliveredPos: true,
        cogsRtsPos: true,
        sfPos: true,
        ffPos: true,
        ifPos: true,
        deliveredCount: true,
        shippedCount: true,
        canceledCount: true,
        rtsCount: true,
      },
    });

    const { benchmark, isDefault } = await this.loadBenchmark(tenantId, params.accountId);

    // One AdRow per day per ad, then folded into one position per ad.
    const byAd = new Map<string, AdRow[]>();
    for (const row of rows) {
      const mapped: AdRow = {
        adId: row.adId,
        adName: row.adName,
        campaignId: row.campaignId,
        campaignName: row.campaignName,
        marketingAssociate: row.marketingAssociate,

        spend: toCentavos(row.spend),
        impressions: row.impressions,
        clicks: row.clicks,
        linkClicks: row.linkClicks,

        purchasesPos: row.purchasesPos,
        processedPurchasesPos: row.processedPurchasesPos,

        deliveredCod: toCentavos(row.deliveredCodPos),
        deliveredCogs: toCentavos(row.cogsDeliveredPos),
        deliveredCodFee: toCentavos(row.codFeeDeliveredPos),
        rtsCogs: toCentavos(row.cogsRtsPos),
        shippingFee: toCentavos(row.sfPos),
        fulfillmentFee: toCentavos(row.ffPos),
        insuranceFee: toCentavos(row.ifPos),

        deliveredCount: row.deliveredCount,
        shippedCount: row.shippedCount,
        canceledCount: row.canceledCount,
        rtsCount: row.rtsCount,
      };

      const bucket = byAd.get(row.adId);
      if (bucket) bucket.push(mapped);
      else byAd.set(row.adId, [mapped]);
    }

    const ads: AdEconomics[] = [];
    for (const adRows of byAd.values()) {
      const folded = aggregate(adRows);
      if (folded) ads.push(evaluate(folded, benchmark));
    }

    return {
      period: { start: params.startDate, end: params.endDate },
      benchmark,
      benchmarkIsDefault: isDefault,
      summary: this.summarise(ads),
      ads: rankByContribution(ads),
    };
  }

  /**
   * The swipe file. Newest first, optionally narrowed by a search across the
   * fields someone would actually remember an ad by: whose it was, what it
   * said, and why it was kept.
   */
  async listLibraryEntries(params: { q?: string; format?: AdLibraryFormat }) {
    const context = await this.teamContext.getContext();
    const q = params.q?.trim();

    const where: Prisma.AdLibraryEntryWhereInput = {
      tenantId: context.tenantId,
      ...(context.isAdmin || !context.userTeams.length
        ? {}
        : { teamId: { in: context.userTeams } }),
      ...(params.format ? { format: params.format } : {}),
      ...(q
        ? {
            OR: [
              { pageName: { contains: q, mode: 'insensitive' } },
              { headline: { contains: q, mode: 'insensitive' } },
              { bodyCopy: { contains: q, mode: 'insensitive' } },
              { notes: { contains: q, mode: 'insensitive' } },
              { tags: { has: q } },
            ],
          }
        : {}),
    };

    const entries = await this.prisma.adLibraryEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        pageName: true,
        sourceUrl: true,
        format: true,
        headline: true,
        bodyCopy: true,
        ctaText: true,
        notes: true,
        tags: true,
        createdAt: true,
        createdBy: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    return entries;
  }

  async createLibraryEntry(input: {
    pageName: string;
    sourceUrl?: string;
    format?: AdLibraryFormat;
    headline?: string;
    bodyCopy?: string;
    ctaText?: string;
    notes?: string;
    tags?: string[];
  }) {
    const context = await this.teamContext.getContext();

    return this.prisma.adLibraryEntry.create({
      data: {
        tenantId: context.tenantId,
        teamId: context.teamId ?? null,
        createdById: context.userId ?? null,
        pageName: input.pageName.trim(),
        sourceUrl: input.sourceUrl?.trim() || null,
        format: input.format ?? AdLibraryFormat.OTHER,
        headline: input.headline?.trim() || null,
        bodyCopy: input.bodyCopy?.trim() || null,
        ctaText: input.ctaText?.trim() || null,
        notes: input.notes?.trim() || null,
        tags: (input.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
      },
      select: { id: true },
    });
  }

  async deleteLibraryEntry(id: string) {
    const context = await this.teamContext.getContext();
    const entry = await this.prisma.adLibraryEntry.findFirst({
      where: { id, tenantId: context.tenantId },
      select: { id: true },
    });
    if (!entry) {
      throw new NotFoundException('Library entry not found');
    }

    await this.prisma.adLibraryEntry.delete({ where: { id } });
    return { id };
  }

  /**
   * The creatives that ran, and what each earned.
   *
   * The join is exact: Meta says which ads carry a creative, and every one of
   * those ad ids is summed straight out of ReconcileMarketing. Nothing here
   * depends on a naming convention holding.
   */
  async listCreatives(params: { startDate?: string; endDate?: string }) {
    const context = await this.teamContext.getContext();

    const creatives = await this.prisma.adCreative.findMany({
      where: { tenantId: context.tenantId },
      orderBy: { lastSyncedAt: 'desc' },
      select: {
        id: true,
        metaCreativeId: true,
        name: true,
        thumbnailUrl: true,
        imageUrl: true,
        videoId: true,
        title: true,
        body: true,
        adIds: true,
        lastSyncedAt: true,
      },
    });

    if (!creatives.length) return [];

    const where: Prisma.ReconcileMarketingWhereInput = { tenantId: context.tenantId };
    if (params.startDate && params.endDate) {
      where.date = { gte: new Date(params.startDate), lte: new Date(params.endDate) };
    }

    const rows = await this.prisma.reconcileMarketing.findMany({
      where,
      select: { adId: true, adName: true, spend: true, purchasesPos: true, deliveredCodPos: true },
    });

    const byAdId = new Map<string, typeof rows>();
    for (const row of rows) {
      const bucket = byAdId.get(row.adId);
      if (bucket) bucket.push(row);
      else byAdId.set(row.adId, [row]);
    }

    return creatives.map((creative) => {
      const matched = creative.adIds.flatMap((adId) => byAdId.get(adId) ?? []);
      return {
        ...creative,
        ads: matched.length,
        adNames: Array.from(new Set(matched.map((row) => row.adName).filter(Boolean))).slice(0, 5),
        spend: matched.reduce((total, row) => total + toCentavos(row.spend), 0),
        purchases: matched.reduce((total, row) => total + row.purchasesPos, 0),
        deliveredCod: matched.reduce((total, row) => total + toCentavos(row.deliveredCodPos), 0),
      };
    });
  }

  /**
   * The strategy log, newest change first.
   *
   * Not scoped to the selected period on purpose. A change made six weeks ago
   * can still be the reason this week reads the way it does, and an operator
   * scanning for a cause should not have to guess the right date range first.
   */
  async listStrategyEntries(limit = 100) {
    const context = await this.teamContext.getContext();

    return this.prisma.adStrategyEntry.findMany({
      where: {
        tenantId: context.tenantId,
        ...(context.isAdmin || !context.userTeams.length
          ? {}
          : { teamId: { in: context.userTeams } }),
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: Math.min(limit, 500),
      select: {
        id: true,
        date: true,
        title: true,
        description: true,
        tag: true,
        result: true,
        resultUpdatedAt: true,
        createdAt: true,
        createdBy: { select: { firstName: true, lastName: true, email: true } },
      },
    });
  }

  async createStrategyEntry(input: {
    date: string;
    title: string;
    description?: string;
    tag?: AdStrategyTag;
  }) {
    const context = await this.teamContext.getContext();

    return this.prisma.adStrategyEntry.create({
      data: {
        tenantId: context.tenantId,
        teamId: context.teamId ?? null,
        createdById: context.userId ?? null,
        date: new Date(input.date),
        title: input.title.trim(),
        description: input.description?.trim() || null,
        tag: input.tag ?? AdStrategyTag.OTHER,
      },
      select: { id: true },
    });
  }

  /**
   * Record what actually happened. Separate from creation because the whole
   * value of the log is the gap between deciding something and finding out.
   */
  async recordStrategyResult(id: string, result: string) {
    const context = await this.teamContext.getContext();

    const entry = await this.prisma.adStrategyEntry.findFirst({
      where: { id, tenantId: context.tenantId },
      select: { id: true },
    });
    if (!entry) {
      throw new NotFoundException('Strategy entry not found');
    }

    return this.prisma.adStrategyEntry.update({
      where: { id },
      data: { result: result.trim(), resultUpdatedAt: new Date() },
      select: { id: true, result: true, resultUpdatedAt: true },
    });
  }

  /** The benchmark as the settings screen needs it: values plus where they came from. */
  async getBenchmarkSettings() {
    const { tenantId } = await this.teamContext.getContext();
    const { benchmark, isDefault } = await this.loadBenchmark(tenantId);
    const stored = await this.prisma.adBenchmark.findFirst({
      where: { tenantId, accountId: null },
      select: { label: true, updatedAt: true },
    });

    return {
      benchmark,
      isDefault,
      label: stored?.label ?? 'Industry benchmark',
      updatedAt: stored?.updatedAt ?? null,
    };
  }

  /**
   * Save the tenant-wide benchmark.
   *
   * Deliberately one per tenant for now. Per-account overrides are supported by
   * the schema but nothing sets them yet, and a settings screen offering a
   * choice nobody can complete is worse than one that does not.
   */
  async saveBenchmark(input: {
    label?: string;
    cpp: number;
    cpm: number;
    ctrPct: number;
    deliveryRate: number;
    cancelRate: number;
    rtsRate: number;
    targetMer: number;
  }) {
    const { tenantId } = await this.teamContext.getContext();

    const data = {
      label: input.label?.trim() || 'Industry benchmark',
      cpp: new Prisma.Decimal(input.cpp),
      cpm: new Prisma.Decimal(input.cpm),
      ctrPct: input.ctrPct,
      deliveryRate: input.deliveryRate,
      cancelRate: input.cancelRate,
      rtsRate: input.rtsRate,
      targetMer: input.targetMer,
    };

    const existing = await this.prisma.adBenchmark.findFirst({
      where: { tenantId, accountId: null },
      select: { id: true },
    });

    if (existing) {
      await this.prisma.adBenchmark.update({ where: { id: existing.id }, data });
    } else {
      await this.prisma.adBenchmark.create({ data: { ...data, tenantId, accountId: null } });
    }

    return this.getBenchmarkSettings();
  }

  /**
   * The Meta ad accounts this tenant can see, with what each one has spent.
   *
   * Spend is summed from ReconcileMarketing rather than the account record, so
   * an account that was connected but never used reads as zero instead of blank.
   */
  async listAccounts(params: { startDate?: string; endDate?: string }) {
    const context = await this.teamContext.getContext();
    const { tenantId } = context;

    const accounts = await this.prisma.metaAdAccount.findMany({
      where: {
        tenantId,
        ...(context.isAdmin || !context.userTeams.length
          ? {}
          : { teamId: { in: context.userTeams } }),
      },
      select: {
        id: true,
        accountId: true,
        name: true,
        currency: true,
        status: true,
        enabled: true,
        lastSyncAt: true,
      },
      orderBy: { name: 'asc' },
    });

    const where: Prisma.ReconcileMarketingWhereInput = { tenantId };
    if (params.startDate && params.endDate) {
      where.date = { gte: new Date(params.startDate), lte: new Date(params.endDate) };
    }

    const spendByAccount = await this.prisma.reconcileMarketing.groupBy({
      by: ['accountId'],
      where,
      _sum: { spend: true, purchasesPos: true },
    });

    const spendMap = new Map(
      spendByAccount.map((row) => [
        row.accountId,
        { spend: toCentavos(row._sum.spend), purchases: row._sum.purchasesPos ?? 0 },
      ]),
    );

    return accounts.map((account) => ({
      ...account,
      spend: spendMap.get(account.accountId)?.spend ?? 0,
      purchases: spendMap.get(account.accountId)?.purchases ?? 0,
    }));
  }

  /**
   * Everything the dashboard shows, in one read.
   *
   * Metrics the export does not carry come back as null rather than zero. A
   * hook rate of 0% and a hook rate nobody measured look identical on a card,
   * and only one of them means the creative failed.
   */
  async getDashboard(params: { startDate: string; endDate: string; accountId?: string }) {
    const context = await this.teamContext.getContext();
    const { tenantId } = context;

    const where: Prisma.ReconcileMarketingWhereInput = {
      tenantId,
      date: { gte: new Date(params.startDate), lte: new Date(params.endDate) },
      ...(params.accountId ? { accountId: params.accountId } : {}),
      ...(context.isAdmin || !context.userTeams.length
        ? {}
        : { teamId: { in: context.userTeams } }),
    };

    const rows = await this.prisma.reconcileMarketing.findMany({
      where,
      select: {
        date: true,
        adId: true,
        adName: true,
        spend: true,
        impressions: true,
        linkClicks: true,
        purchasesPos: true,
        codPos: true,
        deliveredCodPos: true,
      },
      orderBy: { date: 'asc' },
    });

    const { benchmark, isDefault } = await this.loadBenchmark(tenantId, params.accountId);

    let spend = 0;
    let impressions = 0;
    let linkClicks = 0;
    let purchases = 0;
    let orderValue = 0;
    let delivered = 0;
    let taggedSpend = 0;

    // One bucket per day for the chart and the calendar.
    const byDay = new Map<string, { spend: number; orders: number; orderValue: number; delivered: number }>();

    for (const row of rows) {
      const rowSpend = toCentavos(row.spend);
      spend += rowSpend;
      impressions += row.impressions;
      linkClicks += row.linkClicks;
      purchases += row.purchasesPos;
      orderValue += toCentavos(row.codPos);
      delivered += toCentavos(row.deliveredCodPos);

      // Spend an operator can trace back to a creative. The rest is money that
      // ran under a name nobody can look up.
      if (parseAdName(row.adName).code) taggedSpend += rowSpend;

      const key = row.date.toISOString().slice(0, 10);
      const day = byDay.get(key) ?? { spend: 0, orders: 0, orderValue: 0, delivered: 0 };
      day.spend += rowSpend;
      day.orders += row.purchasesPos;
      day.orderValue += toCentavos(row.codPos);
      day.delivered += toCentavos(row.deliveredCodPos);
      byDay.set(key, day);
    }

    const ratio = (a: number, b: number): number | null => (b > 0 ? a / b : null);

    const cpp = ratio(spend, purchases);
    const daily = Array.from(byDay.entries())
      .map(([date, d]) => ({ date, ...d, cpp: ratio(d.spend, d.orders) }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Changes logged in the period, so the chart can say what happened that day.
    const entries = await this.prisma.adStrategyEntry.findMany({
      where: {
        tenantId,
        date: { gte: new Date(params.startDate), lte: new Date(params.endDate) },
      },
      select: { date: true, title: true, tag: true },
      orderBy: { date: 'asc' },
    });

    const markers = new Map<string, string[]>();
    for (const entry of entries) {
      const key = entry.date.toISOString().slice(0, 10);
      markers.set(key, [...(markers.get(key) ?? []), entry.title]);
    }

    return {
      period: { start: params.startDate, end: params.endDate },
      benchmark,
      benchmarkIsDefault: isDefault,

      advertising: {
        spend,
        purchases,
        orderValue,
        delivered,
        cpc: ratio(spend, linkClicks),
        cpp,
        /// Spend over gross sales. Lower is better — it is the share of revenue
        /// the ads ate.
        arPct: ratio(spend, orderValue),
        creativeTaggedPct: ratio(taggedSpend, spend),
        untaggedSpend: spend - taggedSpend,
      },

      creative: {
        ctr: ratio(linkClicks, impressions),
        // The export carries these; nothing brings them this far yet.
        hookRate: null as number | null,
        holdRate: null as number | null,
        thruPlayRate: null as number | null,
        avgWatchSeconds: null as number | null,
        cvr: null as number | null,
      },

      attention: cpp !== null && cpp > benchmark.cpp
        ? [{
          severity: 'warning' as const,
          message: `CPP ${formatPeso(cpp)} is above your ceiling ${formatPeso(benchmark.cpp)} — trim cost before scaling.`,
        }]
        : [],

      daily,
      markers: Array.from(markers.entries()).map(([date, titles]) => ({ date, titles })),
    };
  }

  /**
   * The account's own benchmark, else the tenant-wide one, else the defaults.
   * Reports which it was, because a verdict measured against an unedited
   * default deserves to be read differently from one the tenant chose.
   */
  private async loadBenchmark(
    tenantId: string,
    accountId?: string,
  ): Promise<{ benchmark: Benchmark; isDefault: boolean }> {
    const found = await this.prisma.adBenchmark.findFirst({
      where: { tenantId, accountId: accountId ?? null },
    })
      ?? (accountId
        ? await this.prisma.adBenchmark.findFirst({ where: { tenantId, accountId: null } })
        : null);

    if (!found) return { benchmark: DEFAULT_BENCHMARK, isDefault: true };

    return {
      isDefault: false,
      benchmark: {
        cpp: toCentavos(found.cpp),
        cpm: toCentavos(found.cpm),
        ctrPct: found.ctrPct,
        deliveryRate: found.deliveryRate,
        cancelRate: found.cancelRate,
        rtsRate: found.rtsRate,
        targetMer: found.targetMer,
      },
    };
  }

  private summarise(ads: AdEconomics[]): PeriodSummary {
    const spend = ads.reduce((t, a) => t + a.spend, 0);
    const purchases = ads.reduce((t, a) => t + a.purchases, 0);
    const netContribution = ads.reduce((t, a) => t + a.netContribution, 0);
    const deliveredCod = ads.reduce(
      (t, a) => t + (a.realizedMer !== null ? a.realizedMer * a.spend : 0),
      0,
    );

    return {
      spend,
      purchases,
      netContribution,
      realizedMer: spend > 0 ? deliveredCod / spend : null,
      cpp: purchases > 0 ? spend / purchases : null,
      adsWithSpend: ads.filter((a) => a.spend > 0).length,
      adsWithNoOrders: ads.filter((a) => a.spend > 0 && a.purchases === 0).length,
    };
  }
}
