import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TeamContextService } from '../../common/services/team-context.service';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import * as customParseFormat from 'dayjs/plugin/customParseFormat';
import { AnalyticsCacheService } from './analytics-cache.service';
import { User } from '@prisma/client';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

const TIMEZONE = 'Asia/Manila';

type KpiSums = {
  spend: number;
  linkClicks: number;
  impressions: number;
  leads: number;
  purchases: number;
  revenue: number;
  canceledCod: number;
  restockingCod: number;
  canceledCount: number;
  restockingCount: number;
};

const NULL_ASSOCIATE_KEY = '__null__';

type Kpis = {
  revenue: number;
  ad_spend: number;
  ar: number;
  link_clicks: number;
  cpc: number;
  ctr: number;
  gross_sales: number;
  roas: number;
  cpp: number;
  leads: number;
  cpl: number;
  conversion_rate: number;
};

type TopAssociateRow = {
  associate: string;
  revenue: number;
  cpc: number;
  ad_spend: number;
  ar_pct: number;
  conversion_pct: number;
  ads_running: number;
  ads_created: number;
  ads_active: number;
};

type TopCampaignRow = {
  campaign: string;
  revenue: number;
  cpc: number;
  ad_spend: number;
  ar_pct: number;
};

type TopCreativeRow = {
  associate: string;
  ad_name: string;
  revenue: number;
  cpc: number;
  ad_spend: number;
  ar_pct: number;
};

@Injectable()
export class MarketingAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teamContext: TeamContextService,
    private readonly analyticsCache: AnalyticsCacheService,
  ) {}

  private readonly logger = new Logger(MarketingAnalyticsService.name);

  private normalizeAssociate(val: string | null | undefined): string {
    return (val || '').trim().toLowerCase();
  }

  private toNumber(val: any): number {
    const n = typeof val === 'string' ? parseFloat(val) : Number(val);
    return Number.isFinite(n) ? n : 0;
  }

  private computeKpis(sum: KpiSums, opts: { excludeCancel: boolean; excludeRestocking: boolean }): Kpis {
    const spend = sum.spend || 0;
    const excludedCanceled = opts.excludeCancel ? sum.canceledCod || 0 : 0;
    const excludedRestocking = opts.excludeRestocking ? sum.restockingCod || 0 : 0;
    const revenueRaw = sum.revenue || 0;
    const revenue = Math.max(0, revenueRaw - excludedCanceled - excludedRestocking);
    const clicks = sum.linkClicks || 0;
    const impressions = sum.impressions || 0;
    const leads = sum.leads || 0;
    const rawSales = sum.purchases || 0;
    const excludedCanceledCount = opts.excludeCancel ? sum.canceledCount || 0 : 0;
    const excludedRestockingCount = opts.excludeRestocking ? sum.restockingCount || 0 : 0;
    const sales = Math.max(0, rawSales - excludedCanceledCount - excludedRestockingCount);

    return {
      revenue,
      ad_spend: spend,
      ar: revenue > 0 ? (spend / revenue) * 100 : 0,
      link_clicks: clicks,
      cpc: clicks > 0 ? spend / clicks : 0,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      gross_sales: sales,
      roas: spend > 0 ? revenue / spend : 0,
      cpp: sales > 0 ? spend / sales : 0,
      leads,
      cpl: leads > 0 ? spend / leads : 0,
      conversion_rate: leads > 0 ? (sales / leads) * 100 : 0,
    };
  }

  private computeTopAssociates(rows: any[], adsRunningMap: Record<string, number>, adsCreatedMap: Record<string, number>, opts: { excludeCancel: boolean; excludeRestocking: boolean }): TopAssociateRow[] {
    return rows.map((r) => {
      const key = this.normalizeAssociate(r.marketingAssociate);
      const spend = this.toNumber(r._sum?.spend);
      const clicks = this.toNumber(r._sum?.linkClicks);
      const leads = this.toNumber(r._sum?.leads);
      const purchases = this.toNumber(r._sum?.purchasesPos);
      const revenueRaw = this.toNumber(r._sum?.codPos);
      const canceledCod = this.toNumber(r._sum?.canceledCodPos);
      const restockingCod = this.toNumber(r._sum?.restockingCodPos);
      const canceledCount = this.toNumber(r._sum?.canceledCount);
      const restockingCount = this.toNumber(r._sum?.restockingCount);

      const revenue = Math.max(0, revenueRaw - (opts.excludeCancel ? canceledCod : 0) - (opts.excludeRestocking ? restockingCod : 0));
      const netPurchases = Math.max(0, purchases - (opts.excludeCancel ? canceledCount : 0) - (opts.excludeRestocking ? restockingCount : 0));

      const cpc = clicks > 0 ? spend / clicks : 0;
      const ar_pct = revenue > 0 ? (spend / revenue) * 100 : 0;
      const conversion_pct = leads > 0 ? (netPurchases / leads) * 100 : 0;

      return {
        associate: key,
        revenue,
        cpc,
        ad_spend: spend,
        ar_pct,
        conversion_pct,
        ads_running: adsRunningMap[key] || 0,
        ads_created: adsCreatedMap[key] || 0,
        ads_active: adsRunningMap[key] || 0, // no status field; fallback to running
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }

  private computeTopCampaigns(rows: any[], opts: { excludeCancel: boolean; excludeRestocking: boolean }): TopCampaignRow[] {
    return rows.map((r) => {
      const spend = this.toNumber(r._sum?.spend);
      const clicks = this.toNumber(r._sum?.linkClicks);
      const revenueRaw = this.toNumber(r._sum?.codPos);
      const canceledCod = this.toNumber(r._sum?.canceledCodPos);
      const restockingCod = this.toNumber(r._sum?.restockingCodPos);

      const revenue = Math.max(0, revenueRaw - (opts.excludeCancel ? canceledCod : 0) - (opts.excludeRestocking ? restockingCod : 0));
      const cpc = clicks > 0 ? spend / clicks : 0;
      const ar_pct = revenue > 0 ? (spend / revenue) * 100 : 0;

      return {
        campaign: (r.campaignName as string) || (r.campaignId as string) || '',
        revenue,
        cpc,
        ad_spend: spend,
        ar_pct,
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }

  private computeTopCreatives(rows: any[], associatesDisplayMap: Record<string, string>, opts: { excludeCancel: boolean; excludeRestocking: boolean }): TopCreativeRow[] {
    return rows.map((r) => {
      const key = this.normalizeAssociate(r.marketingAssociate);
      const spend = this.toNumber(r._sum?.spend);
      const clicks = this.toNumber(r._sum?.linkClicks);
      const revenueRaw = this.toNumber(r._sum?.codPos);
      const canceledCod = this.toNumber(r._sum?.canceledCodPos);
      const restockingCod = this.toNumber(r._sum?.restockingCodPos);

      const revenue = Math.max(0, revenueRaw - (opts.excludeCancel ? canceledCod : 0) - (opts.excludeRestocking ? restockingCod : 0));
      const cpc = clicks > 0 ? spend / clicks : 0;
      const ar_pct = revenue > 0 ? (spend / revenue) * 100 : 0;

      return {
        associate: key,
        ad_name: (r.adName as string) || (r.adId as string) || '',
        revenue,
        cpc,
        ad_spend: spend,
        ar_pct,
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }

  private buildAssociateKeysForUser(user: any): string[] {
    const keys: string[] = [];
    const emp = (user?.employeeId || '').trim();
    const full = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
    if (emp) keys.push(this.normalizeAssociate(emp));
    if (full) keys.push(this.normalizeAssociate(full));
    return Array.from(new Set(keys.filter(Boolean)));
  }

  async getOverview(params: { startDate?: string; endDate?: string; associates?: string[]; excludeCancel?: boolean; excludeRestocking?: boolean; tables?: string[] }) {
    const { startDate, endDate, associates: associateParams = [], excludeCancel = true, excludeRestocking = true, tables = [] } = params;
    const startStr = (startDate && startDate.trim()) || dayjs().tz(TIMEZONE).format('YYYY-MM-DD');
    const endStr = (endDate && endDate.trim()) || startStr;

    // Validate date formats
    if (!dayjs(startStr, 'YYYY-MM-DD', true).isValid()) {
      throw new BadRequestException('Invalid start_date format. Expected YYYY-MM-DD');
    }
    if (!dayjs(endStr, 'YYYY-MM-DD', true).isValid()) {
      throw new BadRequestException('Invalid end_date format. Expected YYYY-MM-DD');
    }

    // Convert to Date objects for Prisma queries (date column stores calendar dates, no time component)
    const start = new Date(`${startStr}T00:00:00.000Z`);
    const end = new Date(`${endStr}T00:00:00.000Z`);
    if (start > end) {
      throw new BadRequestException('start_date must be before end_date');
    }
    const rangeDays = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    const prevEndStr = dayjs(startStr, 'YYYY-MM-DD').subtract(1, 'day').format('YYYY-MM-DD');
    const prevStartStr = dayjs(startStr, 'YYYY-MM-DD').subtract(rangeDays, 'day').format('YYYY-MM-DD');
    const prevEnd = new Date(`${prevEndStr}T00:00:00.000Z`);
    const prevStart = new Date(`${prevStartStr}T00:00:00.000Z`);

    const normalizedAssociates = associateParams
      .map((a) => this.normalizeAssociate(a))
      .filter((v) => v.length > 0);
    const includeNullAssociate = normalizedAssociates.includes(this.normalizeAssociate(NULL_ASSOCIATE_KEY));

    const { tenantId, teamId } = await this.teamContext.getContext();
    const effectiveTeamIds = await this.teamContext.getAnalyticsTeamIds('marketing');
    const associateFilter =
      normalizedAssociates.length > 0
        ? {
            OR: [
              ...normalizedAssociates
                .filter((a) => a !== this.normalizeAssociate(NULL_ASSOCIATE_KEY))
                .map((a) => ({
                  marketingAssociate: { equals: a, mode: 'insensitive' as const },
                })),
              ...(includeNullAssociate ? [{ marketingAssociate: null as any }] : []),
            ],
          }
        : {};

    const baseWhere = await this.teamContext.buildTeamWhereClause(
      {
        date: { gte: start, lte: end },
      },
      effectiveTeamIds || undefined,
    );
    const whereCurrent = {
      ...baseWhere,
      ...associateFilter,
    };
    const wherePrev = await this.teamContext.buildTeamWhereClause(
      {
        date: { gte: prevStart, lte: prevEnd },
        ...associateFilter,
      },
      effectiveTeamIds || undefined,
    );

    const cacheVersion = await this.analyticsCache.getVersion(tenantId);
    const cacheTeamIds = effectiveTeamIds ? [...effectiveTeamIds].sort() : teamId ? [teamId] : [];
    const cacheKeyPayload = {
      tenantId,
      teamIds: cacheTeamIds,
      start: startStr,
      end: endStr,
      associates: normalizedAssociates.sort(),
      includeNullAssociate,
      flags: { excludeCancel, excludeRestocking },
      tables: tables.slice().sort(),
    };
    const cacheKey = `analytics:${tenantId}:${cacheVersion}:marketing:${this.analyticsCache.hashObject(cacheKeyPayload)}`;
    const cached = await this.analyticsCache.get<any>(cacheKey);
    if (cached) {
      this.logger.log(`CACHE HIT ${cacheKey}`);
      return cached;
    }
    this.logger.log(`CACHE MISS ${cacheKey}`);

    const sumFields = {
      spend: true as const,
      linkClicks: true as const,
      impressions: true as const,
      leads: true as const,
      purchasesPos: true as const,
      codPos: true as const,
      canceledCodPos: true as const,
      restockingCodPos: true as const,
      canceledCount: true as const,
      restockingCount: true as const,
    };

    const [currentAgg, prevAgg, lastUpdatedAgg, associateRows, users, nullAssociateCount] = await Promise.all([
      this.prisma.reconcileMarketing.aggregate({
        where: whereCurrent,
        _sum: sumFields,
      }),
      this.prisma.reconcileMarketing.aggregate({
        where: wherePrev,
        _sum: sumFields,
      }),
      this.prisma.reconcileMarketing.aggregate({
        where: whereCurrent,
        _max: { updatedAt: true },
      }),
      this.prisma.reconcileMarketing.findMany({
        where: {
          ...baseWhere,
          marketingAssociate: { not: null },
        },
        distinct: ['marketingAssociate'],
        select: { marketingAssociate: true },
      }),
      this.prisma.user.findMany({
        where: { tenantId },
        select: { employeeId: true, firstName: true, lastName: true, email: true },
      }),
      this.prisma.reconcileMarketing.count({
        where: {
          ...baseWhere,
          marketingAssociate: null,
        },
      }),
    ]);

    const sumToObj = (agg: any): KpiSums => ({
      spend: this.toNumber(agg?._sum?.spend),
      linkClicks: this.toNumber(agg?._sum?.linkClicks),
      impressions: this.toNumber(agg?._sum?.impressions),
      leads: this.toNumber(agg?._sum?.leads),
      purchases: this.toNumber(agg?._sum?.purchasesPos),
      revenue: this.toNumber(agg?._sum?.codPos),
      canceledCod: this.toNumber(agg?._sum?.canceledCodPos),
      restockingCod: this.toNumber(agg?._sum?.restockingCodPos),
      canceledCount: this.toNumber(agg?._sum?.canceledCount),
      restockingCount: this.toNumber(agg?._sum?.restockingCount),
    });

    const kpis = this.computeKpis(sumToObj(currentAgg), { excludeCancel, excludeRestocking });
    const prevKpis = this.computeKpis(sumToObj(prevAgg), { excludeCancel, excludeRestocking });

    // Build associate display map
    const userMap: Record<string, string> = {};
    users.forEach((u) => {
      const full = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || u.employeeId || '';
      if (u.employeeId) {
        userMap[this.normalizeAssociate(u.employeeId)] = full;
      }
      if (full) {
        userMap[this.normalizeAssociate(full)] = full;
      }
    });

    const associatesDisplayMap: Record<string, string> = {};
    const optionMap: Record<string, string> = {};
    associateRows.forEach((r) => {
      const raw = r.marketingAssociate ?? '';
      const trimmed = raw.trim();
      if (!trimmed) return;
      const norm = this.normalizeAssociate(trimmed);
      if (!optionMap[norm]) {
        optionMap[norm] = trimmed;
      }
      if (!associatesDisplayMap[norm]) {
        associatesDisplayMap[norm] = userMap[norm] || trimmed;
      }
    });

    if (nullAssociateCount > 0) {
      associatesDisplayMap[this.normalizeAssociate(NULL_ASSOCIATE_KEY)] = `Unassigned (${nullAssociateCount})`;
      optionMap[this.normalizeAssociate(NULL_ASSOCIATE_KEY)] = NULL_ASSOCIATE_KEY;
    }

    const associateOptions = Object.keys(optionMap).sort((a, b) => {
      const da = associatesDisplayMap[a] || optionMap[a] || a;
      const db = associatesDisplayMap[b] || optionMap[b] || b;
      return da.localeCompare(db);
    });

    // Build top associates table
    const needAssociates = tables.length === 0 || tables.includes('associates');
    const needCampaigns = tables.includes('campaigns');
    const needCreatives = tables.includes('creatives');

    const topAssocRowsRaw = needAssociates
      ? await this.prisma.reconcileMarketing.groupBy({
          by: ['marketingAssociate'],
          where: whereCurrent,
          _sum: {
            spend: true,
            linkClicks: true,
            leads: true,
            purchasesPos: true,
            codPos: true,
            canceledCodPos: true,
            restockingCodPos: true,
            canceledCount: true,
            restockingCount: true,
          },
        })
      : [];

    // Merge case/whitespace variants of the same associate key
    const mergedAssocMap: Record<string, { marketingAssociate: string | null; _sum: any }> = {};
    const sumFieldsKeys = [
      'spend',
      'linkClicks',
      'leads',
      'purchasesPos',
      'codPos',
      'canceledCodPos',
      'restockingCodPos',
      'canceledCount',
      'restockingCount',
    ];
    topAssocRowsRaw.forEach((row) => {
      const key = this.normalizeAssociate(row.marketingAssociate);
      if (!mergedAssocMap[key]) {
        mergedAssocMap[key] = {
          marketingAssociate: row.marketingAssociate,
          _sum: Object.fromEntries(sumFieldsKeys.map((k) => [k, 0])),
        };
      }
      sumFieldsKeys.forEach((k) => {
        mergedAssocMap[key]._sum[k] = this.toNumber(mergedAssocMap[key]._sum[k]) + this.toNumber(row._sum?.[k]);
      });
    });
    const topAssocRows = Object.values(mergedAssocMap);

    // Ads running: distinct adId with spend > 0 in range
    const runningRows = needAssociates
      ? await this.prisma.reconcileMarketing.findMany({
          where: {
            ...whereCurrent,
            spend: { gt: 0 },
          },
          select: { marketingAssociate: true, adId: true },
        })
      : [];
    const adsRunningMap: Record<string, number> = {};
    const runningSet: Record<string, Set<string>> = {};
    runningRows.forEach((r) => {
      if (!r.adId) return;
      const key = this.normalizeAssociate(r.marketingAssociate);
      if (!runningSet[key]) runningSet[key] = new Set<string>();
      runningSet[key].add(r.adId);
    });
    Object.entries(runningSet).forEach(([k, set]) => {
      adsRunningMap[k] = set.size;
    });

    // Ads created: distinct adId with dateCreated in range
    const adsCreatedRows = needAssociates
      ? await this.prisma.reconcileMarketing.findMany({
          where: {
            tenantId,
            teamId: teamId || undefined,
            ...(associateFilter?.OR ? { OR: associateFilter.OR } : {}),
            dateCreated: { gte: start, lte: end },
          },
          select: { marketingAssociate: true, adId: true },
        })
      : [];
    const adsCreatedMap: Record<string, number> = {};
    const createdSet: Record<string, Set<string>> = {};
    adsCreatedRows.forEach((r) => {
      if (!r.adId) return;
      const key = this.normalizeAssociate(r.marketingAssociate);
      if (!createdSet[key]) createdSet[key] = new Set<string>();
      createdSet[key].add(r.adId);
    });
    Object.entries(createdSet).forEach(([k, set]) => {
      adsCreatedMap[k] = set.size;
    });

    const topAssociates = needAssociates
      ? this.computeTopAssociates(topAssocRows, adsRunningMap, adsCreatedMap, {
          excludeCancel,
          excludeRestocking,
        }).map((r) => ({
          ...r,
          associateDisplay: associatesDisplayMap[r.associate] || r.associate,
        }))
      : [];

    const topCampaignRows = needCampaigns
      ? await this.prisma.reconcileMarketing.groupBy({
          by: ['campaignId', 'campaignName'],
          where: {
            tenantId,
            teamId: teamId || undefined,
            date: { gte: start, lte: end },
            ...(associateFilter?.OR ? { OR: associateFilter.OR } : {}),
          },
          _sum: {
            spend: true,
            linkClicks: true,
            codPos: true,
            canceledCodPos: true,
            restockingCodPos: true,
          },
        })
      : [];
    const topCampaigns = needCampaigns
      ? this.computeTopCampaigns(topCampaignRows, { excludeCancel, excludeRestocking })
      : [];

    const topCreativeRows = needCreatives
      ? await this.prisma.reconcileMarketing.groupBy({
          by: ['marketingAssociate', 'adId', 'adName'],
          where: whereCurrent,
          _sum: {
            spend: true,
            linkClicks: true,
            codPos: true,
            canceledCodPos: true,
            restockingCodPos: true,
          },
        })
      : [];
    const topCreatives = needCreatives
      ? this.computeTopCreatives(topCreativeRows, associatesDisplayMap, { excludeCancel, excludeRestocking }).map((r) => ({
          ...r,
          associateDisplay: associatesDisplayMap[r.associate] || r.associate,
        }))
      : [];

    const response = {
      kpis,
      prevKpis,
      filters: {
        associates: associateOptions,
        associatesDisplayMap,
      },
      selected: {
        start_date: startStr,
        end_date: endStr,
        associates: normalizedAssociates,
      },
      rangeDays,
      lastUpdatedAt: lastUpdatedAgg?._max?.updatedAt || null,
      topAssociates,
      topCampaigns,
      topCreatives,
    };

    this.logger.log(`CACHE SET ${cacheKey}`);
    await this.analyticsCache.set(cacheKey, response);
    return response;
  }

  async getMyStats(opts: {
    startDate?: string;
    endDate?: string;
    excludeCancel: boolean;
    excludeRestocking: boolean;
    user: any;
  }) {
    const startStr = (opts.startDate && opts.startDate.trim()) || dayjs().tz(TIMEZONE).format('YYYY-MM-DD');
    const endStr = (opts.endDate && opts.endDate.trim()) || startStr;

    const start = new Date(`${startStr}T00:00:00.000Z`);
    const end = new Date(`${endStr}T23:59:59.999Z`);
    if (start > end) {
      throw new BadRequestException('start_date must be before or equal to end_date');
    }

    const associateKeys = this.buildAssociateKeysForUser(opts.user);
    if (associateKeys.length === 0) {
      return {
        matchedAs: null,
        kpis: {
          ad_spend: 0,
          ar: 0,
          winning_creatives: 0,
          creatives_created: 0,
          overall_ranking: null,
        },
      };
    }

    const { tenantId, teamId } = await this.teamContext.getContext();
    const effectiveTeams = await this.teamContext.getAnalyticsTeamIds('marketing');

    const associateFilter = {
      OR: associateKeys.map((a) => ({ marketingAssociate: { equals: a, mode: 'insensitive' as const } })),
    };

    const baseWhere = await this.teamContext.buildTeamWhereClause(
      {
        date: { gte: start, lte: end },
        ...associateFilter,
      },
      effectiveTeams || undefined,
    );

    const agg = await this.prisma.reconcileMarketing.aggregate({
      where: baseWhere,
      _sum: {
        spend: true,
        codPos: true,
        canceledCodPos: true,
        restockingCodPos: true,
      },
    });

    const spend = this.toNumber(agg?._sum?.spend);
    const revenueRaw = this.toNumber(agg?._sum?.codPos);
    const canceledCod = this.toNumber(agg?._sum?.canceledCodPos);
    const restockingCod = this.toNumber(agg?._sum?.restockingCodPos);
    const revenue = Math.max(0, revenueRaw - (opts.excludeCancel ? canceledCod : 0) - (opts.excludeRestocking ? restockingCod : 0));
    const ar = revenue > 0 ? (spend / revenue) * 100 : 0;

    const winningRows = await this.prisma.reconcileMarketing.findMany({
      where: baseWhere,
      select: { spend: true, codPos: true, adId: true, adName: true },
    });
    const winningList = winningRows.filter((r) => {
      const s = this.toNumber(r.spend);
      const rev = this.toNumber(r.codPos);
      if (s <= 5000) return false;
      const arPct = rev > 0 ? (s / rev) * 100 : 0;
      return arPct < 30;
    });
    const winning_creatives = winningList.length;
    const winning_creatives_list = winningList.map((r) => ({
      adId: r.adId || null,
      adName: r.adName || null,
    }));

    const createdRows = await this.prisma.reconcileMarketing.findMany({
      where: {
        tenantId,
        ...associateFilter,
        ...(effectiveTeams ? { teamId: effectiveTeams.length === 1 ? effectiveTeams[0] : { in: effectiveTeams } } : {}),
        dateCreated: { gte: start, lte: end },
      },
      select: { adId: true },
    });
    const creatives_created = Array.from(new Set(createdRows.map((r) => r.adId).filter(Boolean))).length;

    return {
      matchedAs: associateKeys[0] || null,
      kpis: {
        ad_spend: spend,
        ar,
        winning_creatives,
        creatives_created,
        overall_ranking: null,
      },
      winning_creatives_list,
    };
  }

  async getLeaderStats(opts: {
    startDate?: string;
    endDate?: string;
    excludeCancel: boolean;
    excludeRestocking: boolean;
    user: User;
    teamCodeOverride?: string | null;
  }) {
    const startStr = (opts.startDate && opts.startDate.trim()) || dayjs().tz(TIMEZONE).format('YYYY-MM-DD');
    const endStr = (opts.endDate && opts.endDate.trim()) || startStr;

    const start = new Date(`${startStr}T00:00:00.000Z`);
    const end = new Date(`${endStr}T23:59:59.999Z`);
    if (start > end) {
      throw new BadRequestException('start_date must be before or equal to end_date');
    }

    const { tenantId, teamId } = await this.teamContext.getContext();

    // Derive leader's teamCode, allow explicit override from caller
    const teamCodeRaw =
      (opts.teamCodeOverride && opts.teamCodeOverride.trim()) ||
      (
        await this.prisma.team.findFirst({
          where: { id: teamId || undefined, tenantId },
          select: { teamCode: true },
        })
      )?.teamCode;
    const teamCode = teamCodeRaw ? teamCodeRaw.trim() : '';
    if (!teamCode) {
      return { team_ad_spend: 0, team_ar: 0, team_overall_ranking: null };
    }

    // Normalize helper (trim + lowercase) for matching
    const norm = (v: string | null | undefined) => (v || '').trim().toLowerCase();
    const targetCode = norm(teamCode);

    // Fetch rows in range for tenant, then match by normalized teamCode
    const rows = await this.prisma.reconcileMarketing.findMany({
      where: {
        tenantId,
        date: { gte: start, lte: end },
      },
      select: {
        teamCode: true,
        spend: true,
        codPos: true,
        canceledCodPos: true,
        restockingCodPos: true,
      },
    });

    const filtered = rows.filter((r) => norm(r.teamCode) === targetCode);

    // If no matching rows, return zeros
    if (filtered.length === 0) {
      return { team_ad_spend: 0, team_ar: 0, team_overall_ranking: null };
    }

    const spend = this.toNumber(filtered.reduce((acc, r) => acc + this.toNumber(r.spend), 0));
    const revenueRaw = this.toNumber(filtered.reduce((acc, r) => acc + this.toNumber(r.codPos), 0));
    const canceledCod = this.toNumber(filtered.reduce((acc, r) => acc + this.toNumber(r.canceledCodPos), 0));
    const restockingCod = this.toNumber(filtered.reduce((acc, r) => acc + this.toNumber(r.restockingCodPos), 0));
    const revenue = Math.max(0, revenueRaw - (opts.excludeCancel ? canceledCod : 0) - (opts.excludeRestocking ? restockingCod : 0));
    const ar = revenue > 0 ? (spend / revenue) * 100 : 0;

    return {
      team_ad_spend: spend,
      team_ar: ar,
      team_overall_ranking: null,
    };
  }
}
