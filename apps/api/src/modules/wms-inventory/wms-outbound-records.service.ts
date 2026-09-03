import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import {
  IntegrationStatus,
  Prisma,
  TenantStatus,
  WmsFulfillmentAssignmentMode,
  WmsFulfillmentOrderStatus,
  WmsInventoryMovementType,
  WmsOutboundUnitStatus,
} from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GetWmsOutboundRecordsDto } from './dto/get-wms-outbound-records.dto';

const ACTIVE_WMS_TENANT_STATUSES = [TenantStatus.ACTIVE, TenantStatus.TRIAL] as const;
const OUTBOUND_STATUS_ORDER = [
  WmsOutboundUnitStatus.SHIPPED,
  WmsOutboundUnitStatus.DELIVERED,
  WmsOutboundUnitStatus.RETURNING,
  WmsOutboundUnitStatus.RETURNED,
] as const;
const POS_TO_OUTBOUND_STATUS: Record<number, WmsOutboundUnitStatus | undefined> = {
  2: WmsOutboundUnitStatus.SHIPPED,
  3: WmsOutboundUnitStatus.DELIVERED,
  4: WmsOutboundUnitStatus.RETURNING,
  5: WmsOutboundUnitStatus.RETURNED,
};
const DEFAULT_PAGE_SIZE = 20;
const MAX_DATE_RANGE_DAYS = 366;

const projectionOrderSelect = Prisma.validator<Prisma.WmsFulfillmentOrderSelect>()({
  id: true,
  tenantId: true,
  storeId: true,
  assignmentMode: true,
  posOrder: {
    select: {
      status: true,
      statusHistory: true,
      deliveredAt: true,
      rtsAt: true,
      tracking: true,
      updatedAt: true,
    },
  },
  basketUnits: {
    where: {
      packedAt: { not: null },
    },
    select: {
      fulfillmentLineId: true,
      inventoryUnit: {
        select: {
          id: true,
          warehouseId: true,
          productProfileId: true,
        },
      },
    },
  },
  reservations: {
    where: {
      pickedAt: { not: null },
    },
    select: {
      fulfillmentLineId: true,
      inventoryUnit: {
        select: {
          id: true,
          warehouseId: true,
          productProfileId: true,
        },
      },
    },
  },
});

type ProjectionOrder = Prisma.WmsFulfillmentOrderGetPayload<{
  select: typeof projectionOrderSelect;
}>;

type ProjectionUnit = {
  fulfillmentLineId: string | null;
  inventoryUnit: {
    id: string;
    warehouseId: string;
    productProfileId: string;
  };
};

@Injectable()
export class WmsOutboundRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async getRecords(query: GetWmsOutboundRecordsDto) {
    const scope = await this.resolveTenantScope(query.tenantId, query.allTenants === true);
    const isAllTenantScope = scope.canAccessAllTenants && !scope.activeTenantId;
    const page = Math.max(query.page ?? 1, 1);
    const pageSize = Math.min(Math.max(query.pageSize ?? DEFAULT_PAGE_SIZE, 5), 100);
    const dateWindow = this.resolveDateWindow(query.startDate, query.endDate);

    if (!scope.activeTenantId && !isAllTenantScope) {
      return this.emptyResponse({
        page,
        pageSize,
        startDate: dateWindow.startDate,
        endDate: dateWindow.endDate,
        tenants: scope.tenants,
      });
    }

    const tenantWhere: Prisma.WmsOutboundUnitRecordWhereInput = scope.activeTenantId
      ? { tenantId: scope.activeTenantId }
      : {};
    const availableStores = await this.prisma.posStore.findMany({
      where: {
        ...(scope.activeTenantId ? { tenantId: scope.activeTenantId } : {}),
        status: IntegrationStatus.ACTIVE,
      },
      select: {
        id: true,
        tenantId: true,
        name: true,
        shopName: true,
        tenant: { select: { name: true } },
      },
      orderBy: [{ tenant: { name: 'asc' } }, { shopName: 'asc' }, { name: 'asc' }],
    });
    const activeStore = query.storeId
      ? availableStores.find((store) => store.id === query.storeId) ?? null
      : null;

    if (query.storeId && !activeStore) {
      throw new ForbiddenException('Selected store is outside your WMS inventory scope');
    }

    const dateWhere = {
      latestEventAt: {
        gte: dateWindow.from,
        lt: dateWindow.to,
      },
    } satisfies Prisma.WmsOutboundUnitRecordWhereInput;
    const searchWhere = this.buildSearchWhere(query.search);
    const scopeWhere: Prisma.WmsOutboundUnitRecordWhereInput = {
      ...tenantWhere,
      ...dateWhere,
      ...(activeStore ? { storeId: activeStore.id } : {}),
      ...(query.productProfileId ? { productProfileId: query.productProfileId } : {}),
      ...searchWhere,
    };
    const recordsWhere: Prisma.WmsOutboundUnitRecordWhereInput = {
      ...scopeWhere,
      ...(query.status ? { currentStatus: query.status } : {}),
    };

    const [total, records, statusCounts, productIds] = await Promise.all([
      this.prisma.wmsOutboundUnitRecord.count({ where: recordsWhere }),
      this.prisma.wmsOutboundUnitRecord.findMany({
        where: recordsWhere,
        select: {
          id: true,
          currentStatus: true,
          shippedAt: true,
          deliveredAt: true,
          returningAt: true,
          returnedAt: true,
          latestEventAt: true,
          trackingCode: true,
          inventoryUnit: {
            select: {
              id: true,
              code: true,
              barcode: true,
              variationId: true,
              posProduct: {
                select: { name: true, customId: true },
              },
            },
          },
          tenant: { select: { id: true, name: true } },
          store: { select: { id: true, name: true, shopName: true } },
          warehouse: { select: { id: true, code: true, name: true } },
          productProfileId: true,
          fulfillmentOrder: {
            select: { id: true, posOrderId: true, shopId: true },
          },
        },
        orderBy: [{ latestEventAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.wmsOutboundUnitRecord.groupBy({
        by: ['currentStatus'],
        where: scopeWhere,
        _count: { _all: true },
      }),
      scope.activeTenantId || activeStore
        ? this.prisma.wmsOutboundUnitRecord.findMany({
            where: {
              ...tenantWhere,
              ...dateWhere,
              ...(activeStore ? { storeId: activeStore.id } : {}),
            },
            distinct: ['productProfileId'],
            select: { productProfileId: true },
          })
        : Promise.resolve([]),
    ]);

    const products = productIds.length > 0
      ? await this.prisma.wmsProductProfile.findMany({
          where: { id: { in: productIds.map((entry) => entry.productProfileId) } },
          select: {
            id: true,
            tenantId: true,
            storeId: true,
            variationId: true,
            posProduct: { select: { name: true, customId: true } },
            store: { select: { name: true, shopName: true, tenant: { select: { name: true } } } },
          },
          orderBy: [{ posProduct: { name: 'asc' } }],
        })
      : [];
    const statusCountMap = new Map(statusCounts.map((entry) => [entry.currentStatus, entry._count._all]));
    const summary = Object.fromEntries(
      OUTBOUND_STATUS_ORDER.map((status) => [status.toLowerCase(), statusCountMap.get(status) ?? 0]),
    );

    return {
      tenantReady: true,
      serverTime: new Date().toISOString(),
      summary,
      filters: {
        tenants: scope.tenants,
        stores: availableStores.map((store) => ({
          id: store.id,
          tenantId: store.tenantId,
          name: store.shopName || store.name,
          label: isAllTenantScope
            ? `${store.tenant.name} · ${store.shopName || store.name}`
            : store.shopName || store.name,
        })),
        products: products.map((product) => ({
          id: product.id,
          tenantId: product.tenantId,
          storeId: product.storeId,
          variationId: product.variationId,
          name: product.posProduct.name,
          customId: product.posProduct.customId,
          label: `${product.posProduct.name} · ${product.store.shopName || product.store.name}`,
        })),
        statuses: OUTBOUND_STATUS_ORDER.map((status) => ({
          value: status,
          label: this.formatStatusLabel(status),
          recordCount: statusCountMap.get(status) ?? 0,
        })),
        activeTenantId: scope.activeTenantId,
        activeStoreId: activeStore?.id ?? null,
        activeProductProfileId: query.productProfileId ?? null,
        activeStatus: query.status ?? null,
        startDate: dateWindow.startDate,
        endDate: dateWindow.endDate,
      },
      pagination: {
        page,
        pageSize,
        totalItems: total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      records: records.map((record) => ({
        id: record.id,
        status: record.currentStatus,
        eventAt: record.latestEventAt,
        shippedAt: record.shippedAt,
        deliveredAt: record.deliveredAt,
        returningAt: record.returningAt,
        returnedAt: record.returnedAt,
        trackingCode: record.trackingCode,
        unit: {
          id: record.inventoryUnit.id,
          code: record.inventoryUnit.code,
          barcode: record.inventoryUnit.barcode,
        },
        product: {
          profileId: record.productProfileId,
          variationId: record.inventoryUnit.variationId,
          name: record.inventoryUnit.posProduct.name,
          customId: record.inventoryUnit.posProduct.customId,
        },
        tenant: record.tenant,
        store: {
          id: record.store.id,
          name: record.store.shopName || record.store.name,
        },
        warehouse: record.warehouse,
        order: record.fulfillmentOrder,
      })),
    };
  }

  async syncForPosOrders(params: {
    tenantId: string;
    storeId?: string | null;
    posOrderRefs?: Array<{ shopId: string; posOrderId: string }>;
  }) {
    const refs = Array.from(
      new Map(
        (params.posOrderRefs ?? [])
          .filter((ref) => ref.shopId && ref.posOrderId)
          .map((ref) => [`${ref.shopId}::${ref.posOrderId}`, ref] as const),
      ).values(),
    );
    const orders = await this.prisma.wmsFulfillmentOrder.findMany({
      where: {
        tenantId: params.tenantId,
        ...(params.storeId ? { storeId: params.storeId } : {}),
        status: WmsFulfillmentOrderStatus.PACKED,
        posOrder: { is: { status: { in: [2, 3, 4, 5] } } },
        ...(refs.length > 0
          ? { OR: refs.map((ref) => ({ shopId: ref.shopId, posOrderId: ref.posOrderId })) }
          : {}),
      },
      select: projectionOrderSelect,
    });

    if (orders.length === 0) {
      return { upsertedRecords: 0 };
    }

    const orderIds = orders.map((order) => order.id);
    const dispatchMovements = await this.prisma.wmsInventoryMovement.findMany({
      where: {
        movementType: WmsInventoryMovementType.DISPATCH,
        referenceType: 'WMS_FULFILLMENT_ORDER',
        referenceId: { in: orderIds },
      },
      select: {
        referenceId: true,
        inventoryUnitId: true,
        createdAt: true,
        inventoryUnit: {
          select: {
            id: true,
            warehouseId: true,
            productProfileId: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    const dispatchedAtByUnit = new Map<string, Date>();
    const dispatchedUnitsByOrder = new Map<string, ProjectionUnit[]>();
    for (const movement of dispatchMovements) {
      if (!movement.referenceId) continue;
      const key = `${movement.referenceId}::${movement.inventoryUnitId}`;
      if (!dispatchedAtByUnit.has(key)) dispatchedAtByUnit.set(key, movement.createdAt);
      const units = dispatchedUnitsByOrder.get(movement.referenceId) ?? [];
      if (!units.some((unit) => unit.inventoryUnit.id === movement.inventoryUnitId)) {
        units.push({
          fulfillmentLineId: null,
          inventoryUnit: movement.inventoryUnit,
        });
        dispatchedUnitsByOrder.set(movement.referenceId, units);
      }
    }

    const writes: Prisma.PrismaPromise<unknown>[] = [];
    for (const order of orders) {
      const currentStatus = POS_TO_OUTBOUND_STATUS[order.posOrder.status ?? -1];
      if (!currentStatus) continue;

      const historyTimes = this.extractStatusTimes(order.posOrder.statusHistory);
      const units = this.resolveProjectionUnits(
        order,
        dispatchedUnitsByOrder.get(order.id) ?? [],
      );
      for (const unit of units) {
        const shippedAt = historyTimes.get(2)
          ?? dispatchedAtByUnit.get(`${order.id}::${unit.inventoryUnit.id}`)
          ?? null;
        const deliveredAt = historyTimes.get(3) ?? order.posOrder.deliveredAt ?? null;
        const returningAt = historyTimes.get(4) ?? null;
        const returnedAt = historyTimes.get(5) ?? order.posOrder.rtsAt ?? null;
        const latestEventAt = this.resolveLatestEventAt({
          currentStatus,
          shippedAt,
          deliveredAt,
          returningAt,
          returnedAt,
          fallback: order.posOrder.updatedAt,
        });

        writes.push(this.prisma.wmsOutboundUnitRecord.upsert({
          where: {
            fulfillmentOrderId_inventoryUnitId: {
              fulfillmentOrderId: order.id,
              inventoryUnitId: unit.inventoryUnit.id,
            },
          },
          create: {
            tenantId: order.tenantId,
            storeId: order.storeId,
            warehouseId: unit.inventoryUnit.warehouseId,
            productProfileId: unit.inventoryUnit.productProfileId,
            inventoryUnitId: unit.inventoryUnit.id,
            fulfillmentOrderId: order.id,
            fulfillmentLineId: unit.fulfillmentLineId,
            currentStatus,
            shippedAt,
            deliveredAt,
            returningAt,
            returnedAt,
            latestEventAt,
            trackingCode: order.posOrder.tracking,
          },
          update: {
            currentStatus,
            latestEventAt,
            trackingCode: order.posOrder.tracking,
            warehouseId: unit.inventoryUnit.warehouseId,
            productProfileId: unit.inventoryUnit.productProfileId,
            ...(unit.fulfillmentLineId ? { fulfillmentLineId: unit.fulfillmentLineId } : {}),
            ...(shippedAt ? { shippedAt } : {}),
            ...(deliveredAt ? { deliveredAt } : {}),
            ...(returningAt ? { returningAt } : {}),
            ...(returnedAt ? { returnedAt } : {}),
          },
        }));
      }
    }

    for (let index = 0; index < writes.length; index += 100) {
      await this.prisma.$transaction(writes.slice(index, index + 100));
    }

    return { upsertedRecords: writes.length };
  }

  private resolveProjectionUnits(
    order: ProjectionOrder,
    dispatchedUnits: ProjectionUnit[],
  ): ProjectionUnit[] {
    const basketUnits = order.basketUnits as ProjectionUnit[];
    const reservations = order.reservations as ProjectionUnit[];
    const preferred = order.assignmentMode === WmsFulfillmentAssignmentMode.BASKET_DEMAND
      ? basketUnits
      : reservations;
    const secondary = order.assignmentMode === WmsFulfillmentAssignmentMode.BASKET_DEMAND
      ? reservations
      : basketUnits;
    const associatedUnits = [...preferred, ...secondary];
    const lineByUnitId = new Map(
      associatedUnits.map((unit) => [unit.inventoryUnit.id, unit.fulfillmentLineId] as const),
    );
    const source = dispatchedUnits.length > 0
      ? dispatchedUnits.map((unit) => ({
          ...unit,
          fulfillmentLineId: lineByUnitId.get(unit.inventoryUnit.id) ?? null,
        }))
      : associatedUnits;

    return Array.from(
      new Map(source.map((unit) => [unit.inventoryUnit.id, unit] as const)).values(),
    );
  }

  private extractStatusTimes(value: Prisma.JsonValue | null) {
    const times = new Map<number, Date>();
    if (!Array.isArray(value)) return times;

    for (const rawEntry of value) {
      if (!rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) continue;
      const entry = rawEntry as Record<string, Prisma.JsonValue>;
      const rawStatus = Number(entry.status);
      const rawTimestamp = entry.updated_at ?? entry.updatedAt ?? entry.created_at ?? entry.createdAt;
      if (![2, 3, 4, 5].includes(rawStatus) || typeof rawTimestamp !== 'string') continue;
      const timestamp = new Date(rawTimestamp);
      if (Number.isNaN(timestamp.getTime())) continue;
      const current = times.get(rawStatus);
      if (!current || timestamp > current) times.set(rawStatus, timestamp);
    }

    return times;
  }

  private resolveLatestEventAt(params: {
    currentStatus: WmsOutboundUnitStatus;
    shippedAt: Date | null;
    deliveredAt: Date | null;
    returningAt: Date | null;
    returnedAt: Date | null;
    fallback: Date;
  }) {
    if (params.currentStatus === WmsOutboundUnitStatus.SHIPPED) return params.shippedAt ?? params.fallback;
    if (params.currentStatus === WmsOutboundUnitStatus.DELIVERED) return params.deliveredAt ?? params.fallback;
    if (params.currentStatus === WmsOutboundUnitStatus.RETURNING) return params.returningAt ?? params.fallback;
    return params.returnedAt ?? params.fallback;
  }

  private buildSearchWhere(search?: string): Prisma.WmsOutboundUnitRecordWhereInput {
    const normalized = search?.trim();
    if (!normalized) return {};

    return {
      OR: [
        { inventoryUnit: { is: { code: { contains: normalized, mode: 'insensitive' } } } },
        { inventoryUnit: { is: { barcode: { contains: normalized, mode: 'insensitive' } } } },
        { inventoryUnit: { is: { variationId: { contains: normalized, mode: 'insensitive' } } } },
        { inventoryUnit: { is: { posProduct: { is: { name: { contains: normalized, mode: 'insensitive' } } } } } },
        { fulfillmentOrder: { is: { posOrderId: { contains: normalized, mode: 'insensitive' } } } },
        { trackingCode: { contains: normalized, mode: 'insensitive' } },
      ],
    };
  }

  private resolveDateWindow(startDate?: string, endDate?: string) {
    const today = this.formatManilaDate(new Date());
    const defaultStart = new Date(`${today}T00:00:00+08:00`);
    defaultStart.setUTCDate(defaultStart.getUTCDate() - 29);
    const normalizedStart = startDate ?? this.formatManilaDate(defaultStart);
    const normalizedEnd = endDate ?? today;
    const from = new Date(`${normalizedStart}T00:00:00+08:00`);
    const inclusiveEnd = new Date(`${normalizedEnd}T00:00:00+08:00`);

    if (Number.isNaN(from.getTime()) || Number.isNaN(inclusiveEnd.getTime()) || from > inclusiveEnd) {
      throw new BadRequestException('Start date must be on or before end date');
    }

    const rangeDays = Math.floor((inclusiveEnd.getTime() - from.getTime()) / 86_400_000) + 1;
    if (rangeDays > MAX_DATE_RANGE_DAYS) {
      throw new BadRequestException(`Date range cannot exceed ${MAX_DATE_RANGE_DAYS} days`);
    }

    const to = new Date(inclusiveEnd);
    to.setUTCDate(to.getUTCDate() + 1);
    return { startDate: normalizedStart, endDate: normalizedEnd, from, to };
  }

  private formatManilaDate(value: Date) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(value);
  }

  private formatStatusLabel(status: WmsOutboundUnitStatus) {
    return status.charAt(0) + status.slice(1).toLowerCase();
  }

  private async resolveTenantScope(requestedTenantId?: string, forceAllTenants = false) {
    const clsTenantId = this.cls.get('tenantId') as string | undefined;
    const userRole = this.cls.get('userRole') as string | undefined;
    const hasGlobalWmsAccess = this.cls.get('wmsGlobalAccess') === true;
    const canAccessAllTenants = userRole === 'SUPER_ADMIN' || hasGlobalWmsAccess;
    const tenants = await this.prisma.tenant.findMany({
      where: { status: { in: [...ACTIVE_WMS_TENANT_STATUSES] } },
      select: { id: true, name: true, slug: true, status: true },
      orderBy: { name: 'asc' },
    });

    if (canAccessAllTenants) {
      const activeTenantId = requestedTenantId && tenants.some((tenant) => tenant.id === requestedTenantId)
        ? requestedTenantId
        : forceAllTenants
          ? null
          : clsTenantId && tenants.some((tenant) => tenant.id === clsTenantId)
            ? clsTenantId
            : tenants[0]?.id ?? null;
      return {
        activeTenantId,
        canAccessAllTenants: true,
        tenants: tenants.map((tenant) => ({
          id: tenant.id,
          label: tenant.name,
          slug: tenant.slug,
          status: tenant.status,
        })),
      };
    }

    if (!clsTenantId) {
      return { activeTenantId: null, canAccessAllTenants: false, tenants: [] };
    }
    if (requestedTenantId && requestedTenantId !== clsTenantId) {
      throw new ForbiddenException('Selected tenant is outside your WMS scope');
    }
    const tenant = tenants.find((entry) => entry.id === clsTenantId) ?? null;
    return {
      activeTenantId: tenant?.id ?? null,
      canAccessAllTenants: false,
      tenants: tenant
        ? [{ id: tenant.id, label: tenant.name, slug: tenant.slug, status: tenant.status }]
        : [],
    };
  }

  private emptyResponse(params: {
    page: number;
    pageSize: number;
    startDate: string;
    endDate: string;
    tenants: Array<{ id: string; label: string; slug: string; status: TenantStatus }>;
  }) {
    return {
      tenantReady: false,
      serverTime: new Date().toISOString(),
      summary: { shipped: 0, delivered: 0, returning: 0, returned: 0 },
      filters: {
        tenants: params.tenants,
        stores: [],
        products: [],
        statuses: OUTBOUND_STATUS_ORDER.map((status) => ({
          value: status,
          label: this.formatStatusLabel(status),
          recordCount: 0,
        })),
        activeTenantId: null,
        activeStoreId: null,
        activeProductProfileId: null,
        activeStatus: null,
        startDate: params.startDate,
        endDate: params.endDate,
      },
      pagination: { page: params.page, pageSize: params.pageSize, totalItems: 0, totalPages: 1 },
      records: [],
    };
  }
}
