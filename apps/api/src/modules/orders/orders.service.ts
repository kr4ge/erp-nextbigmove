import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Prisma } from '@prisma/client';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TeamContextService } from '../../common/services/team-context.service';
import { IntegrationService } from '../integrations/integration.service';
import {
  CONFIRMATION_UPDATE_STATUS_JOB,
  CONFIRMATION_UPDATE_QUEUE,
  ConfirmationUpdateStatusJobData,
} from './orders.constants';

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

type ConfirmationTagOptionRow = {
  tagId: string;
  name: string;
  groupId: string | null;
  groupName: string | null;
};

type ConfirmationOrderTag = {
  id: string | null;
  name: string;
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
  private readonly logger = new Logger(OrdersService.name);
  private readonly confirmationStatusLabels: Record<number, string> = {
    1: 'Confirm',
    6: 'Cancel',
    7: 'Delete',
    11: 'Restocking',
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly teamContext: TeamContextService,
    private readonly integrationService: IntegrationService,
    @InjectQueue(CONFIRMATION_UPDATE_QUEUE)
    private readonly confirmationUpdateQueue: Queue<ConfirmationUpdateStatusJobData>,
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
    return this.extractTagDetails(tagsRaw).map((entry) => entry.name);
  }

  private extractTagDetails(tagsRaw: Prisma.JsonValue | null): ConfirmationOrderTag[] {
    if (!Array.isArray(tagsRaw)) return [];

    const seen = new Set<string>();
    const details: ConfirmationOrderTag[] = [];

    for (const entry of tagsRaw) {
      if (typeof entry === 'string') {
        const name = entry.trim();
        if (!name) continue;
        const key = `|${name.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        details.push({ id: null, name });
        continue;
      }

      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      const source = entry as Record<string, unknown>;
      const nameRaw = source.name;
      const idRaw = source.id ?? source.tag_id;
      const name = typeof nameRaw === 'string' ? nameRaw.trim() : '';
      if (!name) continue;

      const id =
        typeof idRaw === 'string'
          ? idRaw.trim() || null
          : typeof idRaw === 'number' && Number.isFinite(idRaw)
            ? String(idRaw)
            : null;

      const key = `${id || ''}|${name.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      details.push({ id, name });
    }

    return details;
  }

  private normalizeUpdateTags(tags: Array<{ id: string; name: string }>): Array<{ id: string; name: string }> {
    const seen = new Set<string>();
    const normalized: Array<{ id: string; name: string }> = [];

    for (const entry of tags) {
      const id = entry?.id?.toString?.().trim?.() || '';
      const name = entry?.name?.toString?.().trim?.() || '';
      if (!id || !name) continue;

      const key = `${id}|${name.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      normalized.push({ id, name });
    }

    return normalized;
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

  async clearConfirmationUpdateInFlightByJob(
    orderRowId: string,
    tenantId: string,
  ): Promise<void> {
    await this.prisma.posOrder.updateMany({
      where: {
        id: orderRowId,
        tenantId,
      },
      data: {
        confirmationUpdateRequestedAt: null,
        confirmationUpdateTargetStatus: null,
      },
    });
  }

  private getConfirmationUpdateQueueJobOptions() {
    const attempts = Math.max(
      1,
      Number(process.env.CONFIRMATION_UPDATE_QUEUE_ATTEMPTS || 4),
    );
    const backoffDelay = Math.max(
      1000,
      Number(process.env.CONFIRMATION_UPDATE_QUEUE_BACKOFF_MS || 3000),
    );
    const timeout = Math.max(
      10000,
      Number(process.env.CONFIRMATION_UPDATE_QUEUE_TIMEOUT_MS || 45000),
    );

    return {
      attempts,
      backoff: { type: 'exponential' as const, delay: backoffDelay },
      timeout,
      removeOnComplete: true,
      removeOnFail: 1000,
    };
  }

  private async enqueueConfirmationStatusUpdate(
    data: ConfirmationUpdateStatusJobData,
  ): Promise<void> {
    await this.confirmationUpdateQueue.add(CONFIRMATION_UPDATE_STATUS_JOB, data, {
      jobId: `confirmation-update:${data.tenantId}:${data.shopId}:${data.posOrderId}`,
      ...this.getConfirmationUpdateQueueJobOptions(),
    });
  }

  private getConfirmationStatusLabel(status: number | null | undefined): string {
    if (typeof status !== 'number') return 'Unknown';
    return this.confirmationStatusLabels[status] || `Status ${status}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private isTransientDbError(error: any): boolean {
    const message = (error?.message || '').toString().toLowerCase();
    const code = (error?.code || '').toString().toUpperCase();
    const metaCode = (error?.meta?.code || '').toString().toUpperCase();

    return (
      code === 'P2034' ||
      metaCode === '40P01' ||
      message.includes('deadlock detected') ||
      message.includes('40p01') ||
      message.includes('could not serialize access due to')
    );
  }

  private async withDbRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxAttempts = 3,
  ): Promise<T> {
    let attempt = 0;
    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        return await operation();
      } catch (error: any) {
        if (!this.isTransientDbError(error) || attempt >= maxAttempts) {
          throw error;
        }
        const delayMs = Math.min(800, 120 * attempt);
        this.logger.warn(
          `Transient DB contention during ${operationName}. Retrying (${attempt}/${maxAttempts}) in ${delayMs}ms`,
        );
        await this.sleep(delayMs);
      }
    }
    throw new Error(`Failed ${operationName}`);
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
    const items = rows.map((row) => {
      const tagDetails = this.extractTagDetails(row.tags);
      return {
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
      tags: tagDetails.map((entry) => entry.name),
      tags_detail: tagDetails,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
      };
    });

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

    const items = pageRows.map((row) => {
      const tagDetails = this.extractTagDetails(row.tags);
      return {
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
      tags: tagDetails.map((entry) => entry.name),
      tags_detail: tagDetails,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
      };
    });

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

  async listConfirmationOrderTagOptions(orderRowId: string) {
    const { tenantId, teamIds, userTeams, isAdmin } = await this.teamContext.getContext();
    const allowedTeams =
      (Array.isArray(teamIds) && teamIds.length > 0 ? teamIds : userTeams) || [];
    const storeWhere = this.buildPosStoreAccessWhere(tenantId, allowedTeams, isAdmin);
    if (!storeWhere) {
      throw new ForbiddenException('No store access for current team scope');
    }

    const order = await this.prisma.posOrder.findFirst({
      where: {
        id: orderRowId,
        tenantId,
      },
      select: {
        id: true,
        shopId: true,
        posOrderId: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const store = await this.prisma.posStore.findFirst({
      where: {
        ...storeWhere,
        shopId: order.shopId,
      },
      select: {
        id: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!store) {
      throw new ForbiddenException('Order store is outside your team scope');
    }

    const rows = (await this.prisma.posTag.findMany({
      where: {
        tenantId,
        storeId: store.id,
      },
      orderBy: [{ groupName: 'asc' }, { name: 'asc' }],
      select: {
        tagId: true,
        name: true,
        groupId: true,
        groupName: true,
      },
    })) as ConfirmationTagOptionRow[];

    const groupedMap = new Map<string, { group_id: string; group_name: string; tags: Array<{ tag_id: string; name: string }> }>();
    const individual: Array<{ tag_id: string; name: string }> = [];

    for (const row of rows) {
      const tag = { tag_id: row.tagId, name: row.name };
      if (!row.groupId || !row.groupName) {
        individual.push(tag);
        continue;
      }

      const existing = groupedMap.get(row.groupId);
      if (!existing) {
        groupedMap.set(row.groupId, {
          group_id: row.groupId,
          group_name: row.groupName,
          tags: [tag],
        });
        continue;
      }
      existing.tags.push(tag);
    }

    return {
      order_id: order.id,
      shop_id: order.shopId,
      groups: Array.from(groupedMap.values()),
      individual,
      total: rows.length,
    };
  }

  async updateConfirmationOrderStatus(
    orderRowId: string,
    payload: { status?: number; tags?: Array<{ id: string; name: string }>; note?: string; note_print?: string },
  ) {
    try {
      const targetStatus =
        typeof payload.status === 'number' && Number.isFinite(payload.status)
          ? payload.status
          : null;
      const hasTagsPayload = Array.isArray(payload.tags);
      const targetTags = hasTagsPayload ? this.normalizeUpdateTags(payload.tags || []) : undefined;
      const hasNotePayload = Object.prototype.hasOwnProperty.call(payload, 'note');
      const targetNote = hasNotePayload ? (typeof payload.note === 'string' ? payload.note : '') : undefined;
      const hasNotePrintPayload = Object.prototype.hasOwnProperty.call(payload, 'note_print');
      const targetNotePrint = hasNotePrintPayload
        ? (typeof payload.note_print === 'string' ? payload.note_print : '')
        : undefined;

      if (targetStatus === null && !hasTagsPayload && !hasNotePayload && !hasNotePrintPayload) {
        throw new BadRequestException('Request must include status, tags, note, and/or note_print');
      }

      if (targetStatus !== null && !this.allowedConfirmationStatusUpdates.has(targetStatus)) {
        throw new BadRequestException('Invalid status. Allowed values: 1, 6, 7, 11');
      }

      const { tenantId, teamIds, userTeams, isAdmin } = await this.teamContext.getContext();
      const allowedTeams =
        (Array.isArray(teamIds) && teamIds.length > 0 ? teamIds : userTeams) || [];
      const storeWhere = this.buildPosStoreAccessWhere(tenantId, allowedTeams, isAdmin);
      if (!storeWhere) {
        throw new ForbiddenException('No store access for current team scope');
      }

      const order = await this.withDbRetry(
        () =>
          this.prisma.posOrder.findFirst({
            where: { id: orderRowId, tenantId },
            select: {
              id: true,
              shopId: true,
              posOrderId: true,
              status: true,
              confirmationUpdateRequestedAt: true,
              confirmationUpdateTargetStatus: true,
            },
          }),
        'read-confirmation-order',
      );

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      if (order.status !== 0) {
        throw new BadRequestException(
          'Only NEW (status 0) orders can be updated from confirmation queue',
        );
      }

      const processingCutoff = this.getConfirmationUpdateProcessingCutoff();
      if (targetStatus === null) {
        const hasInFlightStatusUpdate =
          !!order.confirmationUpdateRequestedAt &&
          order.confirmationUpdateRequestedAt >= processingCutoff;
        if (hasInFlightStatusUpdate) {
          const inflightTarget =
            typeof order.confirmationUpdateTargetStatus === 'number'
              ? order.confirmationUpdateTargetStatus
              : null;
          throw new ConflictException(
            `Order status update is already in progress (${this.getConfirmationStatusLabel(inflightTarget)}). Please wait for webhook sync.`,
          );
        }
      }

      const store = await this.withDbRetry(
        () =>
          this.prisma.posStore.findFirst({
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
          }),
        'read-confirmation-store',
      );

      if (!store) {
        throw new ForbiddenException('Order store is outside your team scope');
      }

      const hasStatusUpdate = targetStatus !== null;
      const processingRequestedAt = new Date();
      let lockedForStatusUpdate = false;

      if (hasStatusUpdate) {
        const lockResult = await this.withDbRetry(
          () =>
            this.prisma.posOrder.updateMany({
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
            }),
          'lock-confirmation-order',
        );

        if (lockResult.count === 0) {
          const latest = await this.withDbRetry(
            () =>
              this.prisma.posOrder.findUnique({
                where: { id: order.id },
                select: {
                  status: true,
                  confirmationUpdateRequestedAt: true,
                  confirmationUpdateTargetStatus: true,
                },
              }),
            'read-confirmation-order-after-lock',
          );

          if (!latest) {
            throw new NotFoundException('Order not found');
          }

          if (latest.status !== 0) {
            throw new BadRequestException('Order is no longer NEW. Please refresh.');
          }

          const inFlight =
            latest.confirmationUpdateRequestedAt &&
            latest.confirmationUpdateRequestedAt >= processingCutoff;
          if (inFlight) {
            const inflightTarget =
              typeof latest.confirmationUpdateTargetStatus === 'number'
                ? latest.confirmationUpdateTargetStatus
                : null;
            if (inflightTarget === targetStatus) {
              const startedAtIso =
                latest.confirmationUpdateRequestedAt?.toISOString?.() ||
                processingRequestedAt.toISOString();
              return {
                accepted: true,
                shop_id: order.shopId,
                order_id: order.posOrderId,
                status: targetStatus,
                tags_count: targetTags?.length ?? undefined,
                note_updated: hasNotePayload || undefined,
                note_print_updated: hasNotePrintPayload || undefined,
                processing: true,
                processing_started_at: startedAtIso,
                processing_timeout_seconds: this.getConfirmationUpdateProcessingTtlSeconds(),
                assigning_seller_included: true,
                message: 'Order update already in progress. Waiting for webhook callback.',
              };
            }
            throw new ConflictException(
              `Order update is already in progress (${this.getConfirmationStatusLabel(inflightTarget)}). Please wait for webhook sync.`,
            );
          }

          throw new BadRequestException(
            'Order update cannot be processed right now. Please retry.',
          );
        }

        lockedForStatusUpdate = true;
      }

      try {
        await this.enqueueConfirmationStatusUpdate({
          tenantId,
          orderRowId: order.id,
          shopId: order.shopId,
          posOrderId: order.posOrderId,
          targetStatus,
          targetTags: targetTags ?? null,
          targetNote,
          targetNotePrint,
        });
      } catch (error: any) {
        if (lockedForStatusUpdate) {
          await this.clearConfirmationUpdateInFlight(order.id).catch(() => undefined);
        }
        const message = (error?.message || '').toString();
        const normalized = message.toLowerCase();
        if (normalized.includes('job') && normalized.includes('exist')) {
          return {
            accepted: true,
            shop_id: order.shopId,
            order_id: order.posOrderId,
            status: targetStatus ?? undefined,
            tags_count: targetTags?.length ?? undefined,
            note_updated: hasNotePayload || undefined,
            note_print_updated: hasNotePrintPayload || undefined,
            processing: lockedForStatusUpdate,
            processing_started_at: lockedForStatusUpdate
              ? processingRequestedAt.toISOString()
              : undefined,
            processing_timeout_seconds: lockedForStatusUpdate
              ? this.getConfirmationUpdateProcessingTtlSeconds()
              : undefined,
            assigning_seller_included: true,
            queued: true,
            message: 'Order update already queued. Waiting for webhook callback.',
          };
        }
        throw new ServiceUnavailableException('Unable to queue order update right now. Please retry.');
      }

      return {
        accepted: true,
        shop_id: order.shopId,
        order_id: order.posOrderId,
        status: targetStatus ?? undefined,
        tags_count: targetTags?.length ?? undefined,
        note_updated: hasNotePayload || undefined,
        note_print_updated: hasNotePrintPayload || undefined,
        processing: lockedForStatusUpdate,
        processing_started_at: lockedForStatusUpdate
          ? processingRequestedAt.toISOString()
          : undefined,
        processing_timeout_seconds: lockedForStatusUpdate
          ? this.getConfirmationUpdateProcessingTtlSeconds()
          : undefined,
        assigning_seller_included: true,
        queued: true,
        message: lockedForStatusUpdate
          ? 'Order update queued. Waiting for webhook callback.'
          : 'Order update queued.',
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }

      if (this.isTransientDbError(error)) {
        throw new ServiceUnavailableException(
          'Order update is temporarily busy. Please retry in a few seconds.',
        );
      }

      this.logger.error(
        `Failed to update confirmation order id=${orderRowId} targetStatus=${payload?.status ?? 'n/a'} targetTags=${Array.isArray(payload?.tags) ? payload.tags.length : 0} targetNote=${Object.prototype.hasOwnProperty.call(payload, 'note') ? 1 : 0} targetNotePrint=${Object.prototype.hasOwnProperty.call(payload, 'note_print') ? 1 : 0}: ${error?.message || 'Unknown error'}`,
        error?.stack,
      );
      throw new ServiceUnavailableException(
        'Order update failed due to a temporary server issue. Please retry.',
      );
    }
  }

  async processQueuedConfirmationOrderStatusUpdate(
    jobData: ConfirmationUpdateStatusJobData,
  ): Promise<{ success: boolean; reason: string }> {
    const hasStatusUpdate = typeof jobData.targetStatus === 'number';
    const hasTagsUpdate = Array.isArray(jobData.targetTags);
    const hasNoteUpdate = typeof jobData.targetNote === 'string';
    const hasNotePrintUpdate = typeof jobData.targetNotePrint === 'string';

    if (!hasStatusUpdate && !hasTagsUpdate && !hasNoteUpdate && !hasNotePrintUpdate) {
      return { success: false, reason: 'NO_OPERATION' };
    }

    const order = await this.prisma.posOrder.findFirst({
      where: {
        id: jobData.orderRowId,
        tenantId: jobData.tenantId,
      },
      select: {
        id: true,
        shopId: true,
        posOrderId: true,
        status: true,
        confirmationUpdateTargetStatus: true,
      },
    });

    if (!order) {
      return { success: false, reason: 'ORDER_NOT_FOUND' };
    }

    if (order.status !== 0) {
      await this.clearConfirmationUpdateInFlight(order.id).catch(() => undefined);
      return { success: false, reason: 'STATUS_NOT_NEW' };
    }

    if (order.shopId !== jobData.shopId || order.posOrderId !== jobData.posOrderId) {
      await this.clearConfirmationUpdateInFlight(order.id).catch(() => undefined);
      return { success: false, reason: 'ORDER_MISMATCH' };
    }

    const store = await this.prisma.posStore.findFirst({
      where: {
        tenantId: jobData.tenantId,
        shopId: jobData.shopId,
      },
      select: {
        id: true,
        integrationId: true,
        apiKey: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!store) {
      await this.clearConfirmationUpdateInFlight(order.id).catch(() => undefined);
      return { success: false, reason: 'STORE_NOT_FOUND' };
    }

    const apiKey = await this.resolveStoreApiKey(jobData.tenantId, {
      id: store.id,
      integrationId: store.integrationId || null,
      apiKey: store.apiKey || null,
    });
    if (!apiKey) {
      await this.clearConfirmationUpdateInFlight(order.id).catch(() => undefined);
      return { success: false, reason: 'MISSING_API_KEY' };
    }

    const params = new URLSearchParams();
    params.set('api_key', apiKey);
    const requestBody: Record<string, unknown> = {
      assigning_seller: STATIC_ASSIGNING_SELLER_PAYLOAD,
      assigning_seller_id: STATIC_ASSIGNING_SELLER_PAYLOAD.id,
    };
    if (hasStatusUpdate) {
      requestBody.status = jobData.targetStatus;
    }
    if (hasTagsUpdate) {
      requestBody.tags = (jobData.targetTags || []).map((tag) => ({
        id: tag.id,
        name: tag.name,
      }));
    }
    if (hasNoteUpdate) {
      requestBody.note = jobData.targetNote || '';
    }
    if (hasNotePrintUpdate) {
      requestBody.note_print = jobData.targetNotePrint || '';
    }

    let response: Response;
    try {
      response = await fetch(
        `https://pos.pages.fm/api/v1/shops/${encodeURIComponent(jobData.shopId)}/orders/${encodeURIComponent(jobData.posOrderId)}?${params.toString()}`,
        {
          method: 'PUT',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        },
      );
    } catch (error: any) {
      throw new BadGatewayException(
        error?.message || 'Failed to reach Pancake API',
      );
    }

    if (!response.ok) {
      const responseText = await response.text().catch(() => '');
      const statusCode = response.status;

      if (statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
        await this.clearConfirmationUpdateInFlight(order.id).catch(() => undefined);
        return {
          success: false,
          reason: `UPSTREAM_CLIENT_ERROR_${statusCode}${responseText ? `:${responseText.slice(0, 120)}` : ''}`,
        };
      }

      throw new BadGatewayException(
        `Failed to update Pancake order (${statusCode})${responseText ? `: ${responseText.slice(0, 180)}` : ''}`,
      );
    }

    if (!hasStatusUpdate) {
      await this.clearConfirmationUpdateInFlight(order.id).catch(() => undefined);
    }

    const updates: string[] = [];
    if (hasStatusUpdate) updates.push('STATUS');
    if (hasTagsUpdate) updates.push('TAGS');
    if (hasNoteUpdate) updates.push('NOTE');
    if (hasNotePrintUpdate) updates.push('NOTE_PRINT');

    return {
      success: true,
      reason: `${updates.join('_') || 'ORDER'}_UPDATE_SENT`,
    };
  }
}
