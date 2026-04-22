import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import { PrismaService } from '../../common/prisma/prisma.service';

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = process.env.NEXT_PUBLIC_TIMEZONE || process.env.TIMEZONE || 'Asia/Manila';

type GetPosOrdersReportParams = {
  startDate?: string;
  endDate?: string;
};

type PosOrdersReportRow = {
  shopId: string;
  totalOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  returningOrders: number;
  returnedOrders: number;
  inProcessOrders: number;
  totalRevenue: number;
  shippedRevenue: number;
  deliveredRevenue: number;
  cancelledRevenue: number;
  returningRevenue: number;
  returnedRevenue: number;
  inProcessRevenue: number;
};

@Injectable()
export class ReportsService {
  private readonly inProcessStatuses = [0, 1, 9, 11, 12, 13];

  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  private getTenantId(): string {
    const tenantId = this.cls.get<string>('tenantId');
    if (!tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    return tenantId;
  }

  private getTodayDateLocal(): string {
    return dayjs().tz(TIMEZONE).format('YYYY-MM-DD');
  }

  private normalizeDateValue(value: string | undefined, fallback: string): string {
    const candidate = value?.trim() || fallback;
    if (!dayjs(candidate, 'YYYY-MM-DD', true).isValid()) {
      throw new BadRequestException('Date filters must use YYYY-MM-DD format');
    }
    return candidate;
  }

  private toNumber(value: unknown): number {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }

  private toRate(numerator: number, denominator: number): number {
    if (denominator <= 0) return 0;
    return numerator / denominator;
  }

  async getPosOrdersSummary(params: GetPosOrdersReportParams) {
    const tenantId = this.getTenantId();
    const today = this.getTodayDateLocal();
    const startDate = this.normalizeDateValue(params.startDate, today);
    const endDate = this.normalizeDateValue(params.endDate, today);

    if (endDate < startDate) {
      throw new BadRequestException('start_date must be before or equal to end_date');
    }

    const rows = await this.prisma.$queryRaw<PosOrdersReportRow[]>(Prisma.sql`
      SELECT
        "shopId" AS "shopId",
        COUNT(*)::int AS "totalOrders",
        COUNT(*) FILTER (WHERE "status" = 2)::int AS "shippedOrders",
        COUNT(*) FILTER (WHERE "status" = 3)::int AS "deliveredOrders",
        COUNT(*) FILTER (WHERE "status" = 6)::int AS "cancelledOrders",
        COUNT(*) FILTER (WHERE "status" = 4)::int AS "returningOrders",
        COUNT(*) FILTER (WHERE "status" = 5)::int AS "returnedOrders",
        COUNT(*) FILTER (WHERE "status" IN (${Prisma.join(this.inProcessStatuses)}))::int AS "inProcessOrders",
        COALESCE(SUM(COALESCE("cod", 0)::double precision), 0)::double precision AS "totalRevenue",
        COALESCE(SUM(CASE WHEN "status" = 2 THEN COALESCE("cod", 0)::double precision ELSE 0 END), 0)::double precision AS "shippedRevenue",
        COALESCE(SUM(CASE WHEN "status" = 3 THEN COALESCE("cod", 0)::double precision ELSE 0 END), 0)::double precision AS "deliveredRevenue",
        COALESCE(SUM(CASE WHEN "status" = 6 THEN COALESCE("cod", 0)::double precision ELSE 0 END), 0)::double precision AS "cancelledRevenue",
        COALESCE(SUM(CASE WHEN "status" = 4 THEN COALESCE("cod", 0)::double precision ELSE 0 END), 0)::double precision AS "returningRevenue",
        COALESCE(SUM(CASE WHEN "status" = 5 THEN COALESCE("cod", 0)::double precision ELSE 0 END), 0)::double precision AS "returnedRevenue",
        COALESCE(SUM(CASE WHEN "status" IN (${Prisma.join(this.inProcessStatuses)}) THEN COALESCE("cod", 0)::double precision ELSE 0 END), 0)::double precision AS "inProcessRevenue"
      FROM "pos_orders"
      WHERE "tenantId" = ${tenantId}::uuid
        AND "dateLocal" >= ${startDate}
        AND "dateLocal" <= ${endDate}
      GROUP BY "shopId"
      ORDER BY COUNT(*) DESC, "shopId" ASC
    `);

    const shopIds = rows.map((row) => row.shopId).filter((row) => row.length > 0);
    const stores = shopIds.length
      ? await this.prisma.posStore.findMany({
          where: {
            tenantId,
            shopId: { in: shopIds },
          },
          select: {
            shopId: true,
            shopName: true,
            name: true,
            updatedAt: true,
          },
          orderBy: [{ shopId: 'asc' }, { updatedAt: 'desc' }],
        })
      : [];

    const storeNameByShopId = new Map<string, string>();
    for (const store of stores) {
      if (storeNameByShopId.has(store.shopId)) continue;
      const displayName = store.shopName?.trim() || store.name?.trim() || store.shopId;
      storeNameByShopId.set(store.shopId, displayName);
    }

    const items = rows.map((row) => {
      const totalOrders = this.toNumber(row.totalOrders);
      const shippedOrders = this.toNumber(row.shippedOrders);
      const deliveredOrders = this.toNumber(row.deliveredOrders);
      const cancelledOrders = this.toNumber(row.cancelledOrders);
      const returningOrders = this.toNumber(row.returningOrders);
      const returnedOrders = this.toNumber(row.returnedOrders);
      const inProcessOrders = this.toNumber(row.inProcessOrders);
      const rtsOrders = returningOrders + returnedOrders;

      return {
        shop_id: row.shopId,
        pos_store_name: storeNameByShopId.get(row.shopId) || row.shopId,
        qty: {
          all_orders: totalOrders,
          shipped: shippedOrders,
          delivered: deliveredOrders,
          cancelled: cancelledOrders,
          returning: returningOrders,
          returned: returnedOrders,
          in_process: inProcessOrders,
          rts_rate: this.toRate(rtsOrders, deliveredOrders + rtsOrders),
          pending_rate: this.toRate(inProcessOrders, totalOrders),
          cancellation_rate: this.toRate(cancelledOrders, totalOrders),
        },
        revenue: {
          all_orders: this.toNumber(row.totalRevenue),
          shipped: this.toNumber(row.shippedRevenue),
          delivered: this.toNumber(row.deliveredRevenue),
          cancelled: this.toNumber(row.cancelledRevenue),
          returning: this.toNumber(row.returningRevenue),
          returned: this.toNumber(row.returnedRevenue),
          in_process: this.toNumber(row.inProcessRevenue),
        },
      };
    });

    return {
      items,
      row_count: items.length,
      selected: {
        start_date: startDate,
        end_date: endDate,
      },
      generated_at: new Date().toISOString(),
    };
  }
}
