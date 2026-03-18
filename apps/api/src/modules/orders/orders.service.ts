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

type ListConfirmationPhoneHistoryParams = {
  phone?: string;
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

type AssigningSellerPayload = {
  avatar_url: string | null;
  email: string | null;
  fb_id: string | null;
  id: string | null;
  name: string | null;
  phone_number: string | null;
};

const STATIC_ASSIGNING_SELLER_PAYLOAD: AssigningSellerPayload = {
  avatar_url: null,
  email: 'wetradejaysonquiatchon@gmail.com',
  fb_id: '122115075452788142',
  id: '31440f2c-bc28-4d91-bf6e-d09dd921b62c',
  name: 'Arnold Sayson',
  phone_number: null,
};

@Injectable()
export class OrdersService {
  private readonly allowedConfirmationStatusUpdates = new Set([1, 6, 7, 11]);

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

  private getConfirmationUpdateProcessingTtlSeconds(): number {
    const raw = process.env.CONFIRMATION_UPDATE_PROCESSING_TTL_SECONDS;
    const parsed = Number.parseInt(raw || '', 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return 300;
    return Math.min(parsed, 3600);
  }

  private getConfirmationUpdateProcessingCutoff(): Date {
    return dayjs().subtract(this.getConfirmationUpdateProcessingTtlSeconds(), 'second').toDate();
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

  private stripPhoneDigits(value: string): string {
    return value.replace(/\D/g, '');
  }

  private normalizePhoneToCanonical(value: string | null | undefined): string | null {
    if (!value) return null;
    const digits = this.stripPhoneDigits(value);
    if (!digits) return null;

    if (/^63\d{10}$/.test(digits)) return digits;
    if (/^0\d{10}$/.test(digits)) return `63${digits.slice(1)}`;
    if (/^9\d{9}$/.test(digits)) return `63${digits}`;

    return null;
  }

  private buildPhoneMatchVariants(canonicalPhone: string): string[] {
    const local10 = canonicalPhone.slice(2);
    return Array.from(new Set([canonicalPhone, `+${canonicalPhone}`, `0${local10}`, local10]));
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

  private async clearConfirmationUpdateInFlight(orderRowId: string): Promise<void> {
    await this.prisma.posOrder.update({
      where: { id: orderRowId },
      data: {
        confirmationUpdateRequestedAt: null,
        confirmationUpdateTargetStatus: null,
      },
    });
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
    const processingCutoff = this.getConfirmationUpdateProcessingCutoff();
    const processingFilter: Prisma.PosOrderWhereInput = {
      OR: [
        { confirmationUpdateRequestedAt: null },
        { confirmationUpdateRequestedAt: { lt: processingCutoff } },
      ],
    };

    const rangeWhere: Prisma.PosOrderWhereInput = {
      tenantId,
      status: 0,
      AND: [processingFilter],
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

    const andClauses: Prisma.PosOrderWhereInput[] = [processingFilter];
    if (search) {
      andClauses.push({
        OR: [
          { posOrderId: { contains: search, mode: 'insensitive' } },
          { customerName: { contains: search, mode: 'insensitive' } },
          { customerPhone: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    const where: Prisma.PosOrderWhereInput = {
      tenantId,
      status: 0,
      AND: andClauses,
      dateLocal: {
        gte: startDate,
        lte: endDate,
      },
      shopId: { in: effectiveShopIds },
    };

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

  async listConfirmationPhoneHistory(params: ListConfirmationPhoneHistoryParams) {
    const rawPhone = params.phone?.trim() || '';
    const canonicalPhone = this.normalizePhoneToCanonical(rawPhone);
    if (!canonicalPhone) {
      throw new BadRequestException('Invalid phone number format');
    }

    const page = this.parsePage(params.page);
    const limit = this.parseLimit(params.limit);
    const skip = (page - 1) * limit;
    const local10 = canonicalPhone.slice(2);
    const phoneVariants = this.buildPhoneMatchVariants(canonicalPhone);

    const { tenantId } = await this.teamContext.getContext();

    const [stores, candidateRows] = await this.prisma.$transaction([
      this.prisma.posStore.findMany({
        where: { tenantId },
        select: {
          shopId: true,
          shopName: true,
          name: true,
        },
      }),
      this.prisma.posOrder.findMany({
        where: {
          tenantId,
          customerPhone: { not: null },
          OR: [
            ...phoneVariants.map((phone) => ({ customerPhone: phone })),
            { customerPhone: { endsWith: local10 } },
          ],
        },
        orderBy: [{ dateLocal: 'desc' }, { insertedAt: 'desc' }],
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
    ]);

    const normalizedRows = (candidateRows as PosOrderListRow[]).filter(
      (row) => this.normalizePhoneToCanonical(row.customerPhone) === canonicalPhone,
    );

    const total = normalizedRows.length;
    const pageRows = normalizedRows.slice(skip, skip + limit);
    const pageCount = total === 0 ? 0 : Math.ceil(total / limit);

    const storeMetaByShopId = new Map(
      stores.map((store) => [
        store.shopId,
        {
          shopName: store.shopName?.trim() || store.name?.trim() || store.shopId,
        },
      ]),
    );

    const items = pageRows.map((row) => ({
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
      selected: {
        phone: rawPhone,
        canonical_phone: canonicalPhone,
      },
    };
  }

  async updateConfirmationOrderStatus(orderRowId: string, targetStatus: number) {
    if (!this.allowedConfirmationStatusUpdates.has(targetStatus)) {
      throw new BadRequestException('Invalid status. Allowed values: 1, 6, 7, 11');
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

    const processingCutoff = this.getConfirmationUpdateProcessingCutoff();
    const processingRequestedAt = new Date();
    const lockResult = await this.prisma.posOrder.updateMany({
      where: {
        id: order.id,
        tenantId,
        status: 0,
        OR: [
          { confirmationUpdateRequestedAt: null },
          { confirmationUpdateRequestedAt: { lt: processingCutoff } },
        ],
      },
      data: {
        confirmationUpdateRequestedAt: processingRequestedAt,
        confirmationUpdateTargetStatus: targetStatus,
      },
    });

    if (lockResult.count === 0) {
      throw new BadRequestException('Order update is already in progress. Please wait for webhook sync.');
    }

    const params = new URLSearchParams();
    params.set('api_key', apiKey);
    const requestBody: Record<string, unknown> = {
      status: targetStatus,
      assigning_seller: STATIC_ASSIGNING_SELLER_PAYLOAD,
      assigning_seller_id: STATIC_ASSIGNING_SELLER_PAYLOAD.id,
    };

    let response: Response;
    try {
      response = await fetch(
        `https://pos.pages.fm/api/v1/shops/${encodeURIComponent(order.shopId)}/orders/${encodeURIComponent(order.posOrderId)}?${params.toString()}`,
        {
          method: 'PUT',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        },
      );
    } catch (error) {
      await this.clearConfirmationUpdateInFlight(order.id).catch(() => undefined);
      const message =
        (error instanceof Error && error.message) || 'Failed to reach Pancake API';
      throw new BadRequestException(message);
    }

    if (!response.ok) {
      await this.clearConfirmationUpdateInFlight(order.id).catch(() => undefined);
      const responseText = await response.text().catch(() => '');
      throw new BadRequestException(
        `Failed to update Pancake order status (${response.status})${responseText ? `: ${responseText.slice(0, 180)}` : ''}`,
      );
    }

    // Local status remains source-of-truth from webhook callback.
    // The in-flight marker is set so the row disappears from confirmation queue immediately.
    return {
      accepted: true,
      shop_id: order.shopId,
      order_id: order.posOrderId,
      status: targetStatus,
      processing: true,
      processing_started_at: processingRequestedAt.toISOString(),
      processing_timeout_seconds: this.getConfirmationUpdateProcessingTtlSeconds(),
      assigning_seller_included: true,
      message: 'Status update sent. Waiting for webhook callback.',
    };
  }
}
