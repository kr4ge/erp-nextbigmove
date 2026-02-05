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
  sales: number;
  mktg: number;
  upsellCount: number;
  statusCounts: Record<string, number>;
  salesVsMktgPct: number;
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
        sales: 0,
        mktg: 0,
        sales_vs_mktg_pct: 0,
        total_cod: 0,
        order_count: 0,
        upsell_count: 0,
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
          "upsellSales",
          "mktgBaseline",
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
          COALESCE(SUM(
            CASE
              WHEN "upsellSales" IS NOT NULL THEN "upsellSales"
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
          ), 0)::numeric AS "sales",
          COALESCE(SUM(
            CASE
              WHEN "mktgBaseline" IS NOT NULL THEN "mktgBaseline"
              ELSE COALESCE("cod", 0) - (
                CASE
                  WHEN "upsellSales" IS NOT NULL THEN "upsellSales"
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
          ), 0)::numeric AS "mktg",
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
        agg."sales",
        agg."mktg",
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
        agg."sales",
        agg."mktg",
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
      const sales = this.toNumber(row.sales);
      const mktg = this.toNumber(row.mktg);
      const totalCod = this.toNumber(row.total_cod);
      return {
        salesAssignee: row.salesAssignee ?? null,
        shopId: row.shopId,
        orderCount: this.toNumber(row.order_count),
        totalCod,
        sales,
        mktg,
        upsellCount: this.toNumber(row.upsell_count),
        statusCounts: row.status_counts || {},
        salesVsMktgPct: mktg > 0 ? (totalCod / mktg) * 100 : 0,
      };
    });

    const summary = rows.reduce(
      (acc, row) => {
        acc.sales += row.sales;
        acc.mktg += row.mktg;
        acc.total_cod += row.totalCod;
        acc.order_count += row.orderCount;
        acc.upsell_count += row.upsellCount;
        return acc;
      },
      { sales: 0, mktg: 0, total_cod: 0, order_count: 0, upsell_count: 0 },
    );

    const summaryWithPct = {
      ...summary,
      sales_vs_mktg_pct: summary.mktg > 0 ? (summary.total_cod / summary.mktg) * 100 : 0,
    };

    const prevSummary = prevRawRows.reduce(
      (acc, row) => {
        acc.sales += this.toNumber(row.sales);
        acc.mktg += this.toNumber(row.mktg);
        acc.total_cod += this.toNumber(row.total_cod);
        acc.order_count += this.toNumber(row.order_count);
        acc.upsell_count += this.toNumber(row.upsell_count);
        return acc;
      },
      { sales: 0, mktg: 0, total_cod: 0, order_count: 0, upsell_count: 0 },
    );
    const prevSummaryWithPct = {
      ...prevSummary,
      sales_vs_mktg_pct: prevSummary.mktg > 0 ? (prevSummary.total_cod / prevSummary.mktg) * 100 : 0,
    };

    const optionsWhere = Prisma.sql`WHERE ${Prisma.join(baseWhere, ' AND ')}`;
    const assigneeOptionsQuery = Prisma.sql`
      SELECT DISTINCT "salesAssignee"
      FROM "pos_orders"
      ${optionsWhere}
      AND "salesAssignee" IS NOT NULL
      ORDER BY "salesAssignee"
    `;
    const assigneeRows = await this.prisma.$queryRaw<any[]>(assigneeOptionsQuery);
    const assigneeOptions = assigneeRows.map((r) => r.salesAssignee).filter(Boolean);

    const includeUnassignedQuery = Prisma.sql`
      SELECT EXISTS(
        SELECT 1 FROM "pos_orders"
        ${optionsWhere}
        AND "salesAssignee" IS NULL
      ) AS "has_unassigned"
    `;
    const includeUnassignedRow = await this.prisma.$queryRaw<any[]>(includeUnassignedQuery);
    const includeUnassigned = !!includeUnassignedRow?.[0]?.has_unassigned;

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
