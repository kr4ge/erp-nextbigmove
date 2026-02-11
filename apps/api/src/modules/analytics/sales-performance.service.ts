import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TeamContextService } from '../../common/services/team-context.service';
import { AnalyticsCacheService } from './analytics-cache.service';
import { Prisma } from '@prisma/client';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = process.env.NEXT_PUBLIC_TIMEZONE || 'Asia/Manila';

type SalesPerformanceRow = {
  salesAssignee: string | null;
  shopId: string;
  orderCount: number;
  totalCod: number;
  salesCod: number;
  mktgCod: number;
  upsellDelta: number;
  confirmedCount: number;
  marketingLeadCount: number;
  deliveredCount: number;
  rtsCount: number;
  pendingCount: number;
  cancelledCount: number;
  upsellCount: number;
  forUpsellCount: number;
  upsellTagCount: number;
  statusCounts: Record<string, number>;
  salesVsMktgPct: number;
  confirmationRatePct: number;
  rtsRatePct: number;
  pendingRatePct: number;
  cancellationRatePct: number;
  upsellRatePct: number;
};

@Injectable()
export class SalesPerformanceService {
  private readonly logger = new Logger(SalesPerformanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly teamContext: TeamContextService,
    private readonly analyticsCache: AnalyticsCacheService,
  ) {}

  private toNumber(val: any): number {
    const n = typeof val === 'string' ? parseFloat(val) : Number(val);
    return Number.isFinite(n) ? n : 0;
  }

  private normalizeAssignee(value?: string | null): string {
    return (value || '').trim().toLowerCase();
  }

  private diffDays(startStr: string, endStr: string): number {
    return dayjs(endStr, 'YYYY-MM-DD').diff(dayjs(startStr, 'YYYY-MM-DD'), 'day');
  }

  private shiftDate(dateStr: string, offsetDays: number): string {
    return dayjs(dateStr, 'YYYY-MM-DD').add(offsetDays, 'day').format('YYYY-MM-DD');
  }

  async getOverview(params: {
    startDate?: string;
    endDate?: string;
    salesAssignees?: string[];
  }) {
    const { startDate, endDate, salesAssignees = [] } = params;

    const startStr = (startDate && startDate.trim()) || dayjs().tz(TIMEZONE).format('YYYY-MM-DD');
    const endStr = (endDate && endDate.trim()) || startStr;

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

    const normalizedAssignees = (salesAssignees || [])
      .map((v) => v?.toString?.().trim?.() || '')
      .filter((v) => v.length > 0);
    const includeNull = normalizedAssignees.includes('__null__');
    const assigneeValues = normalizedAssignees.filter((v) => v !== '__null__');

    const { tenantId } = await this.teamContext.getContext();
    const effectiveTeamIds = await this.teamContext.getAnalyticsTeamIds('sales');

    if (Array.isArray(effectiveTeamIds) && effectiveTeamIds.length === 0) {
        const emptySummary = {
          upsell_delta: 0,
          sales_cod: 0,
          mktg_cod: 0,
          sales_vs_mktg_pct: 0,
          confirmed_count: 0,
          marketing_lead_count: 0,
          confirmation_rate_pct: 0,
          delivered_count: 0,
          rts_count: 0,
          rts_rate_pct: 0,
          pending_count: 0,
          cancelled_count: 0,
          pending_rate_pct: 0,
          cancellation_rate_pct: 0,
          upsell_rate_pct: 0,
          total_cod: 0,
          order_count: 0,
          upsell_count: 0,
          for_upsell_count: 0,
          upsell_tag_count: 0,
        };
      return {
        summary: emptySummary,
        prevSummary: emptySummary,
        rows: [],
        filters: { salesAssignees: [], includeUnassigned: false },
        selected: { start_date: startStr, end_date: endStr, sales_assignees: normalizedAssignees },
        rangeDays,
        lastUpdatedAt: null,
      };
    }

    const cacheVersion = await this.analyticsCache.getVersion(tenantId);
    const cacheKeyPayload = {
      tenantId,
      teamIds: effectiveTeamIds || [],
      start: startStr,
      end: endStr,
      salesAssignees: normalizedAssignees.sort(),
    };
    const cacheKey = `analytics:${tenantId}:${cacheVersion}:sales-performance:${this.analyticsCache.hashObject(cacheKeyPayload)}`;
    const cached = await this.analyticsCache.get<any>(cacheKey);
    if (cached) return cached;

    const buildBaseWhere = (start: string, end: string) => {
      const where = [
        Prisma.sql`"tenantId" = ${tenantId}::uuid`,
        Prisma.sql`"dateLocal" >= ${start}`,
        Prisma.sql`"dateLocal" <= ${end}`,
      ];
      if (Array.isArray(effectiveTeamIds) && effectiveTeamIds.length > 0) {
        const teamIdParams = effectiveTeamIds.map((id) => Prisma.sql`${id}::uuid`);
        where.push(Prisma.sql`"teamId" IN (${Prisma.join(teamIdParams)})`);
      }
      return where;
    };

    const applyAssigneeFilters = (base: Prisma.Sql[]) => {
      const filtered = [...base];
      if (assigneeValues.length > 0 && includeNull) {
        filtered.push(
          Prisma.sql`("salesAssignee" IN (${Prisma.join(assigneeValues)}) OR "salesAssignee" IS NULL)`,
        );
      } else if (assigneeValues.length > 0) {
        filtered.push(
          Prisma.sql`"salesAssignee" IN (${Prisma.join(assigneeValues)})`,
        );
      } else if (includeNull) {
        filtered.push(Prisma.sql`"salesAssignee" IS NULL`);
      }
      return filtered;
    };

    const baseWhere = buildBaseWhere(startStr, endStr);
    const filteredWhere = applyAssigneeFilters(baseWhere);
    const whereClause = Prisma.sql`WHERE ${Prisma.join(filteredWhere, ' AND ')}`;

    const prevBaseWhere = buildBaseWhere(prevStartStr, prevEndStr);
    const prevFilteredWhere = applyAssigneeFilters(prevBaseWhere);
    const prevWhereClause = Prisma.sql`WHERE ${Prisma.join(prevFilteredWhere, ' AND ')}`;

    const buildRowsQuery = (clause: Prisma.Sql) => Prisma.sql`
      WITH filtered AS (
        SELECT
          "salesAssignee",
          "shopId",
          "status",
          "cod",
          "salesCod",
          "mktgCod",
          "isMarketingSource",
          "forUpsell",
          "statusHistory",
          "tags",
          "upsellBreakdown"
        FROM "pos_orders"
        ${clause}
      ),
      agg AS (
        SELECT
          "salesAssignee",
          "shopId",
          COUNT(*)::int AS "order_count",
          COALESCE(SUM(COALESCE("cod", 0)), 0)::numeric AS "total_cod",
          COALESCE(SUM(COALESCE("salesCod", 0)), 0)::numeric AS "sales_cod",
          COALESCE(SUM(
            CASE
              WHEN COALESCE(jsonb_path_exists("statusHistory", '$[*] ? (@.status == 1)'), false)
                THEN 1
              ELSE 0
            END
          ), 0)::int AS "confirmed_count",
          COALESCE(SUM(CASE WHEN "isMarketingSource" THEN 1 ELSE 0 END), 0)::int AS "marketing_lead_count",
          COALESCE(SUM(CASE WHEN "forUpsell" THEN 1 ELSE 0 END), 0)::int AS "for_upsell_count",
          COALESCE(SUM(
            CASE
              WHEN COALESCE(jsonb_path_exists("tags", '$[*] ? (@.name == "UPSELL")'), false)
                THEN 1
              ELSE 0
            END
          ), 0)::int AS "upsell_tag_count",
          COALESCE(SUM(
            CASE
              WHEN "upsellBreakdown" IS NULL THEN 0
              ELSE
                (
                  CASE
                    WHEN ("upsellBreakdown"->>'new_amount') ~ '^-?\\d+(\\.\\d+)?$'
                      THEN ("upsellBreakdown"->>'new_amount')::numeric
                    ELSE 0
                  END
                ) -
                (
                  CASE
                    WHEN ("upsellBreakdown"->>'original_amount') ~ '^-?\\d+(\\.\\d+)?$'
                      THEN ("upsellBreakdown"->>'original_amount')::numeric
                    ELSE 0
                  END
                )
            END
          ), 0)::numeric AS "upsell_delta",
          COALESCE(SUM(
            CASE
              WHEN "mktgCod" IS NOT NULL THEN "mktgCod"
              ELSE COALESCE("cod", 0) - (
                CASE
                  WHEN "upsellBreakdown" IS NULL THEN 0
                  ELSE
                    (
                      CASE
                        WHEN ("upsellBreakdown"->>'new_amount') ~ '^-?\\d+(\\.\\d+)?$'
                          THEN ("upsellBreakdown"->>'new_amount')::numeric
                        ELSE 0
                      END
                    ) -
                    (
                      CASE
                        WHEN ("upsellBreakdown"->>'original_amount') ~ '^-?\\d+(\\.\\d+)?$'
                          THEN ("upsellBreakdown"->>'original_amount')::numeric
                        ELSE 0
                      END
                    )
                END
              )
            END
          ), 0)::numeric AS "mktg_cod",
          COALESCE(SUM(CASE WHEN "upsellBreakdown" IS NULL THEN 0 ELSE 1 END), 0)::int AS "upsell_count"
        FROM filtered
        GROUP BY "salesAssignee", "shopId"
      ),
      status_counts AS (
        SELECT
          "salesAssignee",
          "shopId",
          COALESCE("status"::text, 'null') AS status_key,
          COUNT(*)::int AS status_count
        FROM filtered
        GROUP BY "salesAssignee", "shopId", COALESCE("status"::text, 'null')
      )
      SELECT
        agg."salesAssignee",
        agg."shopId",
        agg."order_count",
        agg."total_cod",
        agg."sales_cod",
        agg."mktg_cod",
        agg."upsell_delta",
        agg."confirmed_count",
        agg."marketing_lead_count",
        agg."for_upsell_count",
        agg."upsell_tag_count",
        agg."upsell_count",
        COALESCE(jsonb_object_agg(sc.status_key, sc.status_count) FILTER (WHERE sc.status_key IS NOT NULL), '{}'::jsonb) AS "status_counts"
      FROM agg
      LEFT JOIN status_counts sc
        ON sc."salesAssignee" IS NOT DISTINCT FROM agg."salesAssignee"
        AND sc."shopId" = agg."shopId"
      GROUP BY
        agg."salesAssignee",
        agg."shopId",
        agg."order_count",
        agg."total_cod",
        agg."sales_cod",
        agg."mktg_cod",
        agg."upsell_delta",
        agg."confirmed_count",
        agg."marketing_lead_count",
        agg."for_upsell_count",
        agg."upsell_tag_count",
        agg."upsell_count"
      ORDER BY agg."salesAssignee" NULLS LAST, agg."shopId"
    `;

    const rowsQuery = buildRowsQuery(whereClause);
    const prevRowsQuery = buildRowsQuery(prevWhereClause);

    const [rawRows, prevRawRows] = await Promise.all([
      this.prisma.$queryRaw<any[]>(rowsQuery),
      this.prisma.$queryRaw<any[]>(prevRowsQuery),
    ]);

    const rows: SalesPerformanceRow[] = rawRows.map((row) => {
      const salesCod = this.toNumber(row.sales_cod);
      const mktgCod = this.toNumber(row.mktg_cod);
      const upsellDelta = this.toNumber(row.upsell_delta);
      const confirmedCount = this.toNumber(row.confirmed_count);
      const marketingLeadCount = this.toNumber(row.marketing_lead_count);
      const forUpsellCount = this.toNumber(row.for_upsell_count);
      const upsellTagCount = this.toNumber(row.upsell_tag_count);
      const totalCod = this.toNumber(row.total_cod);
      const statusCounts: Record<string, number> = row.status_counts || {};
      const deliveredCount = this.toNumber(statusCounts['3'] ?? 0);
      const rtsCount =
        this.toNumber(statusCounts['4'] ?? 0) + this.toNumber(statusCounts['5'] ?? 0);
      const pendingCount = this.toNumber(statusCounts['11'] ?? 0);
      const cancelledCount = this.toNumber(statusCounts['6'] ?? 0);
      const orderCount = this.toNumber(row.order_count);
      const rtsDenominator = deliveredCount + rtsCount;
      return {
        salesAssignee: row.salesAssignee ?? null,
        shopId: row.shopId,
        orderCount,
        totalCod,
        salesCod,
        mktgCod,
        upsellDelta,
        confirmedCount,
        marketingLeadCount,
        upsellCount: this.toNumber(row.upsell_count),
        forUpsellCount,
        upsellTagCount,
        deliveredCount,
        rtsCount,
        pendingCount,
        cancelledCount,
        statusCounts,
        salesVsMktgPct: mktgCod > 0 ? (salesCod / mktgCod) * 100 : 0,
        confirmationRatePct:
          orderCount > 0
            ? (confirmedCount / orderCount) * 100
            : 0,
        rtsRatePct: rtsDenominator > 0 ? (rtsCount / rtsDenominator) * 100 : 0,
        pendingRatePct: orderCount > 0 ? (pendingCount / orderCount) * 100 : 0,
        cancellationRatePct: orderCount > 0 ? (cancelledCount / orderCount) * 100 : 0,
        upsellRatePct: forUpsellCount > 0 ? (upsellTagCount / forUpsellCount) * 100 : 0,
      };
    });

    const summary = rows.reduce(
      (acc, row) => {
        acc.upsell_delta += row.upsellDelta;
        acc.sales_cod += row.salesCod;
        acc.mktg_cod += row.mktgCod;
        acc.confirmed_count += row.confirmedCount;
        acc.marketing_lead_count += row.marketingLeadCount;
        acc.delivered_count += row.deliveredCount;
        acc.rts_count += row.rtsCount;
        acc.pending_count += row.pendingCount;
        acc.cancelled_count += row.cancelledCount;
        acc.total_cod += row.totalCod;
        acc.order_count += row.orderCount;
        acc.upsell_count += row.upsellCount;
        acc.for_upsell_count += row.forUpsellCount;
        acc.upsell_tag_count += row.upsellTagCount;
        return acc;
      },
      {
        upsell_delta: 0,
        sales_cod: 0,
        mktg_cod: 0,
        confirmed_count: 0,
        marketing_lead_count: 0,
        delivered_count: 0,
        rts_count: 0,
        pending_count: 0,
        cancelled_count: 0,
        total_cod: 0,
        order_count: 0,
        upsell_count: 0,
        for_upsell_count: 0,
        upsell_tag_count: 0,
      },
    );

    const summaryWithPct = {
      ...summary,
      sales_vs_mktg_pct: summary.mktg_cod > 0 ? (summary.sales_cod / summary.mktg_cod) * 100 : 0,
      confirmation_rate_pct:
        summary.order_count > 0
          ? (summary.confirmed_count / summary.order_count) * 100
          : 0,
      rts_rate_pct:
        summary.delivered_count + summary.rts_count > 0
          ? (summary.rts_count / (summary.delivered_count + summary.rts_count)) * 100
          : 0,
      pending_rate_pct:
        summary.order_count > 0
          ? (summary.pending_count / summary.order_count) * 100
          : 0,
      cancellation_rate_pct:
        summary.order_count > 0
          ? (summary.cancelled_count / summary.order_count) * 100
          : 0,
      upsell_rate_pct:
        summary.for_upsell_count > 0
          ? (summary.upsell_tag_count / summary.for_upsell_count) * 100
          : 0,
    };

    const prevSummary = prevRawRows.reduce(
      (acc, row) => {
        acc.upsell_delta += this.toNumber(row.upsell_delta);
        acc.sales_cod += this.toNumber(row.sales_cod);
        acc.mktg_cod += this.toNumber(row.mktg_cod);
        acc.confirmed_count += this.toNumber(row.confirmed_count);
        acc.marketing_lead_count += this.toNumber(row.marketing_lead_count);
        acc.delivered_count += this.toNumber(row.status_counts?.['3'] ?? 0);
        acc.rts_count +=
          this.toNumber(row.status_counts?.['4'] ?? 0) +
          this.toNumber(row.status_counts?.['5'] ?? 0);
        acc.pending_count += this.toNumber(row.status_counts?.['11'] ?? 0);
        acc.cancelled_count += this.toNumber(row.status_counts?.['6'] ?? 0);
        acc.total_cod += this.toNumber(row.total_cod);
        acc.order_count += this.toNumber(row.order_count);
        acc.upsell_count += this.toNumber(row.upsell_count);
        acc.for_upsell_count += this.toNumber(row.for_upsell_count);
        acc.upsell_tag_count += this.toNumber(row.upsell_tag_count);
        return acc;
      },
      {
        upsell_delta: 0,
        sales_cod: 0,
        mktg_cod: 0,
        confirmed_count: 0,
        marketing_lead_count: 0,
        delivered_count: 0,
        rts_count: 0,
        pending_count: 0,
        cancelled_count: 0,
        total_cod: 0,
        order_count: 0,
        upsell_count: 0,
        for_upsell_count: 0,
        upsell_tag_count: 0,
      },
    );
    const prevSummaryWithPct = {
      ...prevSummary,
      sales_vs_mktg_pct: prevSummary.mktg_cod > 0 ? (prevSummary.sales_cod / prevSummary.mktg_cod) * 100 : 0,
      confirmation_rate_pct:
        prevSummary.order_count > 0
          ? (prevSummary.confirmed_count / prevSummary.order_count) * 100
          : 0,
      rts_rate_pct:
        prevSummary.delivered_count + prevSummary.rts_count > 0
          ? (prevSummary.rts_count / (prevSummary.delivered_count + prevSummary.rts_count)) * 100
          : 0,
      pending_rate_pct:
        prevSummary.order_count > 0
          ? (prevSummary.pending_count / prevSummary.order_count) * 100
          : 0,
      cancellation_rate_pct:
        prevSummary.order_count > 0
          ? (prevSummary.cancelled_count / prevSummary.order_count) * 100
          : 0,
      upsell_rate_pct:
        prevSummary.for_upsell_count > 0
          ? (prevSummary.upsell_tag_count / prevSummary.for_upsell_count) * 100
          : 0,
    };

    const optionsWhere = Prisma.sql`WHERE ${Prisma.join(baseWhere, ' AND ')}`;
    const assigneeOptionsQuery = Prisma.sql`
      SELECT DISTINCT "salesAssignee"
      FROM "pos_orders"
      ${optionsWhere}
      AND "salesAssignee" IS NOT NULL
      ORDER BY "salesAssignee"
    `;
    const unassignedCountQuery = Prisma.sql`
      SELECT COUNT(*)::int AS "count"
      FROM "pos_orders"
      ${optionsWhere}
      AND "salesAssignee" IS NULL
    `;
    const [assigneeRows, users, unassignedCountRows] = await Promise.all([
      this.prisma.$queryRaw<any[]>(assigneeOptionsQuery),
      this.prisma.user.findMany({
        where: { tenantId },
        select: { employeeId: true, firstName: true, lastName: true, email: true },
      }),
      this.prisma.$queryRaw<any[]>(unassignedCountQuery),
    ]);
    const unassignedCount = this.toNumber(unassignedCountRows?.[0]?.count);
    const includeUnassigned = unassignedCount > 0;

    const userMap: Record<string, string> = {};
    users.forEach((u) => {
      const full = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || u.employeeId || '';
      if (u.employeeId) {
        userMap[this.normalizeAssignee(u.employeeId)] = full;
      }
      if (full) {
        userMap[this.normalizeAssignee(full)] = full;
      }
    });

    const salesAssigneesDisplayMap: Record<string, string> = {};
    const optionMap: Record<string, string> = {};
    assigneeRows.forEach((r) => {
      const raw = r.salesAssignee ?? '';
      const trimmed = raw.trim();
      if (!trimmed) return;
      const normalized = this.normalizeAssignee(trimmed);
      const display = userMap[normalized] || trimmed;
      optionMap[trimmed] = trimmed;
      if (!salesAssigneesDisplayMap[trimmed]) {
        salesAssigneesDisplayMap[trimmed] = display;
      }
      if (!salesAssigneesDisplayMap[normalized]) {
        salesAssigneesDisplayMap[normalized] = display;
      }
    });
    if (includeUnassigned) {
      salesAssigneesDisplayMap['__null__'] = unassignedCount > 0 ? `Unassigned (${unassignedCount})` : 'Unassigned';
    }

    const assigneeOptions = Object.keys(optionMap).sort((a, b) => {
      const da = salesAssigneesDisplayMap[a] || optionMap[a] || a;
      const db = salesAssigneesDisplayMap[b] || optionMap[b] || b;
      return da.localeCompare(db);
    });

    const lastUpdatedQuery = Prisma.sql`
      SELECT MAX("updatedAt") AS "last_updated"
      FROM "pos_orders"
      ${optionsWhere}
    `;
    const lastUpdatedRows = await this.prisma.$queryRaw<any[]>(lastUpdatedQuery);
    const lastUpdatedAt = lastUpdatedRows?.[0]?.last_updated ?? null;

    const response = {
      summary: summaryWithPct,
      prevSummary: prevSummaryWithPct,
      rows,
      filters: {
        salesAssignees: assigneeOptions,
        salesAssigneesDisplayMap,
        includeUnassigned,
      },
      selected: {
        start_date: startStr,
        end_date: endStr,
        sales_assignees: normalizedAssignees,
      },
      rangeDays,
      lastUpdatedAt,
    };

    await this.analyticsCache.set(cacheKey, response);
    return response;
  }
}
