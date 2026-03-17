import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TeamContextService } from '../../common/services/team-context.service';
import { IntegrationService } from '../integrations/integration.service';

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = process.env.NEXT_PUBLIC_TIMEZONE || process.env.TIMEZONE || 'Asia/Manila';

type ListConfirmationOrdersParams = {
  startDate?: string;
  endDate?: string;
  shopIds?: string | string[];
  search?: string;
  page?: string;
  limit?: string;
};

type PosStoreAccessRow = {
  shopId: string;
  shopName: string | null;
  name: string | null;
};

type PosOrderListRow = {
  id: string;
  shopId: string;
  posOrderId: string;
  dateLocal: string;
  insertedAt: Date;
  status: number | null;
  statusName: string | null;
  isAbandoned: boolean;
  cod: Prisma.Decimal | null;
  reportsByPhoneOrderFail: number | null;
  reportsByPhoneOrderSuccess: number | null;
  customerName: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  itemData: Prisma.JsonValue | null;
  orderSnapshot: Prisma.JsonValue | null;
  tags: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class OrdersService {
  private readonly allowedConfirmationStatusUpdates = new Set([1, 6, 11]);

  constructor(
    private readonly prisma: PrismaService,
    private readonly teamContext: TeamContextService,
    private readonly integrationService: IntegrationService,
  ) {}

  private normalizeDateLocal(value: string | undefined, fallback: string): string {
    if (!value) return fallback;
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return fallback;
    const parsed = dayjs.tz(`${trimmed}T00:00:00`, TIMEZONE);
    if (!parsed.isValid()) return fallback;
    return parsed.format('YYYY-MM-DD');
  }

  private getTodayDateLocal(): string {
    return dayjs().tz(TIMEZONE).format('YYYY-MM-DD');
  }

  private parsePage(raw?: string): number {
    const parsed = Number.parseInt(raw || '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  private parseLimit(raw?: string): number {
    const parsed = Number.parseInt(raw || '', 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return 20;
    return Math.min(parsed, 200);
  }

  private parseShopIds(raw?: string | string[]): string[] {
    if (!raw) return [];
    const list = Array.isArray(raw) ? raw : [raw];
    const exploded = list
      .flatMap((entry) => entry.split(','))
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    return Array.from(new Set(exploded));
  }

  private toNumber(value: Prisma.Decimal | number | string | null | undefined): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const parsed = Number.parseFloat(value.toString());
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private extractTagNames(tagsRaw: Prisma.JsonValue | null): string[] {
    if (!Array.isArray(tagsRaw)) return [];
    const names: string[] = [];
    for (const entry of tagsRaw) {
      if (typeof entry === 'string') {
        const trimmed = entry.trim();
        if (trimmed) names.push(trimmed);
        continue;
      }
      if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        const name = (entry as Record<string, unknown>).name;
        if (typeof name === 'string' && name.trim()) {
          names.push(name.trim());
        }
      }
    }
    return Array.from(new Set(names));
  }

  private buildPosStoreAccessWhere(
    tenantId: string,
    allowedTeams: string[],
    isAdmin: boolean,
  ): Prisma.PosStoreWhereInput | null {
    const shouldRestrict = !isAdmin || (isAdmin && allowedTeams.length > 0);
    if (!shouldRestrict) {
      return { tenantId };
    }

    if (allowedTeams.length === 0) {
      return null;
    }

    return {
      tenantId,
      OR: [
        { teamId: { in: allowedTeams } },
        { integration: { teamId: { in: allowedTeams } } },
        { integration: { sharedTeams: { some: { teamId: { in: allowedTeams } } } } },
      ],
    };
  }

  private async resolveStoreApiKey(
    tenantId: string,
    store: { id: string; integrationId: string | null; apiKey: string | null },
  ): Promise<string | null> {
    const storeApiKey = store.apiKey?.trim() || '';
    if (storeApiKey) return storeApiKey;

    if (!store.integrationId) return null;

    try {
      const credentials = await this.integrationService.getDecryptedCredentials(
        store.integrationId,
        tenantId,
      );
      const apiKey = credentials?.apiKey?.toString?.().trim?.() || '';
      if (!apiKey) return null;

      await this.prisma.posStore.update({
        where: { id: store.id },
        data: { apiKey },
      });

      return apiKey;
    } catch {
      return null;
    }
  }

  async listConfirmationOrders(params: ListConfirmationOrdersParams) {
    const today = this.getTodayDateLocal();
    let startDate = this.normalizeDateLocal(params.startDate, today);
    let endDate = this.normalizeDateLocal(params.endDate, today);
    if (startDate > endDate) {
      [startDate, endDate] = [endDate, startDate];
    }

    const page = this.parsePage(params.page);
    const limit = this.parseLimit(params.limit);
    const skip = (page - 1) * limit;
    const search = params.search?.trim() || '';

    const { tenantId, teamIds, userTeams, isAdmin } = await this.teamContext.getContext();
    const allowedTeams = (Array.isArray(teamIds) && teamIds.length > 0 ? teamIds : userTeams) || [];
    const storeWhere = this.buildPosStoreAccessWhere(tenantId, allowedTeams, isAdmin);

    if (!storeWhere) {
      return {
        items: [],
        pagination: {
          page,
          limit,
          total: 0,
          pageCount: 0,
        },
        filters: {
          shops: [],
        },
        selected: {
          start_date: startDate,
          end_date: endDate,
          shop_ids: [],
          search,
        },
      };
    }

    const stores = (await this.prisma.posStore.findMany({
      where: storeWhere,
      select: {
        shopId: true,
        shopName: true,
        name: true,
      },
      orderBy: [{ shopName: 'asc' }, { name: 'asc' }],
    })) as PosStoreAccessRow[];

    const accessibleShopIds = Array.from(new Set(stores.map((store) => store.shopId).filter(Boolean)));
    if (accessibleShopIds.length === 0) {
      return {
        items: [],
        pagination: {
          page,
          limit,
          total: 0,
          pageCount: 0,
        },
        filters: {
          shops: [],
        },
        selected: {
          start_date: startDate,
          end_date: endDate,
          shop_ids: [],
          search,
        },
      };
    }

    const accessibleShopSet = new Set(accessibleShopIds);
    const requestedShopIds = this.parseShopIds(params.shopIds);
    const selectedShopIds = requestedShopIds.filter((shopId) => accessibleShopSet.has(shopId));
    const effectiveShopIds = selectedShopIds.length > 0 ? selectedShopIds : accessibleShopIds;

    const rangeWhere: Prisma.PosOrderWhereInput = {
      tenantId,
      status: 0,
      dateLocal: {
        gte: startDate,
        lte: endDate,
      },
      shopId: { in: accessibleShopIds },
    };

    const shopsInRangeRows = await this.prisma.posOrder.findMany({
      where: rangeWhere,
      select: { shopId: true },
      distinct: ['shopId'],
    });
    const shopsInRange = new Set(shopsInRangeRows.map((row) => row.shopId));

    const storeMetaByShopId = new Map(
      stores.map((store) => [
        store.shopId,
        {
          shopName: store.shopName?.trim() || store.name?.trim() || store.shopId,
        },
      ]),
    );

    const shopOptions = stores
      .filter((store) => shopsInRange.has(store.shopId))
      .map((store) => ({
        shop_id: store.shopId,
        shop_name:
          storeMetaByShopId.get(store.shopId)?.shopName || store.shopName?.trim() || store.name?.trim() || store.shopId,
      }));

    const where: Prisma.PosOrderWhereInput = {
      tenantId,
      status: 0,
      dateLocal: {
        gte: startDate,
        lte: endDate,
      },
      shopId: { in: effectiveShopIds },
    };

    if (search) {
      where.OR = [
        { posOrderId: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerPhone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, rows] = (await this.prisma.$transaction([
      this.prisma.posOrder.count({ where }),
      this.prisma.posOrder.findMany({
        where,
        orderBy: [{ dateLocal: 'desc' }, { insertedAt: 'desc' }],
        skip,
        take: limit,
        select: {
          id: true,
          shopId: true,
          posOrderId: true,
          dateLocal: true,
          insertedAt: true,
          status: true,
          statusName: true,
          isAbandoned: true,
          cod: true,
          reportsByPhoneOrderFail: true,
          reportsByPhoneOrderSuccess: true,
          customerName: true,
          customerPhone: true,
          customerAddress: true,
          itemData: true,
          orderSnapshot: true,
          tags: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ])) as [number, PosOrderListRow[]];

    const pageCount = total === 0 ? 0 : Math.ceil(total / limit);
    const items = rows.map((row) => ({
      id: row.id,
      shop_id: row.shopId,
      shop_name: storeMetaByShopId.get(row.shopId)?.shopName || row.shopId,
      pos_order_id: row.posOrderId,
      date_local: row.dateLocal,
      inserted_at: row.insertedAt.toISOString(),
      inserted_at_local: dayjs(row.insertedAt).tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss'),
      status: row.status,
      status_name: row.statusName,
      is_abandoned: row.isAbandoned,
      cod: this.toNumber(row.cod),
      reports_by_phone_fail: row.reportsByPhoneOrderFail,
      reports_by_phone_success: row.reportsByPhoneOrderSuccess,
      customer_name: row.customerName || null,
      customer_phone: row.customerPhone || null,
      customer_address: row.customerAddress || null,
      item_data: row.itemData,
      order_snapshot: row.orderSnapshot,
      tags: this.extractTagNames(row.tags),
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    }));

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        pageCount,
      },
      filters: {
        shops: shopOptions,
      },
      selected: {
        start_date: startDate,
        end_date: endDate,
        shop_ids: selectedShopIds,
        search,
      },
    };
  }

  async updateConfirmationOrderStatus(orderRowId: string, targetStatus: number) {
    if (!this.allowedConfirmationStatusUpdates.has(targetStatus)) {
      throw new BadRequestException('Invalid status. Allowed values: 1, 6, 11');
    }

    const { tenantId, teamIds, userTeams, isAdmin } = await this.teamContext.getContext();
    const allowedTeams = (Array.isArray(teamIds) && teamIds.length > 0 ? teamIds : userTeams) || [];
    const storeWhere = this.buildPosStoreAccessWhere(tenantId, allowedTeams, isAdmin);
    if (!storeWhere) {
      throw new ForbiddenException('No store access for current team scope');
    }

    const order = await this.prisma.posOrder.findFirst({
      where: { id: orderRowId, tenantId },
      select: {
        id: true,
        shopId: true,
        posOrderId: true,
        status: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== 0) {
      throw new BadRequestException('Only NEW (status 0) orders can be updated from confirmation queue');
    }

    const store = await this.prisma.posStore.findFirst({
      where: {
        ...storeWhere,
        shopId: order.shopId,
      },
      select: {
        id: true,
        shopId: true,
        apiKey: true,
        integrationId: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!store) {
      throw new ForbiddenException('Order store is outside your team scope');
    }

    const apiKey = await this.resolveStoreApiKey(tenantId, {
      id: store.id,
      integrationId: store.integrationId || null,
      apiKey: store.apiKey || null,
    });
    if (!apiKey) {
      throw new BadRequestException(`Missing API key for shop ${order.shopId}`);
    }

    const params = new URLSearchParams();
    params.set('api_key', apiKey);

    const response = await fetch(
      `https://pos.pages.fm/api/v1/shops/${encodeURIComponent(order.shopId)}/orders/${encodeURIComponent(order.posOrderId)}?${params.toString()}`,
      {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ status: targetStatus }),
      },
    );

    if (!response.ok) {
      const responseText = await response.text().catch(() => '');
      throw new BadRequestException(
        `Failed to update Pancake order status (${response.status})${responseText ? `: ${responseText.slice(0, 180)}` : ''}`,
      );
    }

    // Local DB remains unchanged here; webhook callback is source of truth.
    return {
      accepted: true,
      shop_id: order.shopId,
      order_id: order.posOrderId,
      status: targetStatus,
      message: 'Status update sent. Waiting for webhook callback.',
    };
  }
}
