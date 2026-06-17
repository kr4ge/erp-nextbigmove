import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  IntegrationStatus,
  TenantStatus,
  WmsBasketUnitStatus,
  WmsFulfillmentAssignmentMode,
  WmsFulfillmentLineStatus,
  WmsFulfillmentOrderStatus,
  WmsInventoryUnitStatus,
  WmsPickReservationStatus,
  WmsStaffActivityOutcome,
  type Prisma,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GetWmsDispatchOutboundDto } from './dto/get-wms-dispatch-outbound.dto';
import { GetWmsDispatchReportsDto } from './dto/get-wms-dispatch-reports.dto';
import { GetWmsDispatchReturnsDto } from './dto/get-wms-dispatch-returns.dto';
import { GetWmsDispatchSummaryDto } from './dto/get-wms-dispatch-summary.dto';
import { ReconcileWmsDispatchOutboundDto } from './dto/reconcile-wms-dispatch-outbound.dto';
import { WmsInventoryService } from '../wms-inventory/wms-inventory.service';

type ActiveTenantOption = {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  wmsFulfillmentGoLiveAt: Date | null;
};

type DispatchScope = {
  activeStore: {
    id: string;
    tenantId: string;
    name: string;
    shopName: string | null;
    tenant: {
      name: string;
      slug: string;
    } | null;
  } | null;
  activeTenantId: string | null;
  stores: Array<{
    id: string;
    tenantId: string;
    name: string;
    shopName: string | null;
    tenant: {
      name: string;
      slug: string;
    } | null;
  }>;
  tenantOptions: ActiveTenantOption[];
};

type DispatchReturnUnit = {
  id: string;
  code: string;
  barcode: string;
  status: string;
  statusLabel: string;
  name: string;
  customId: string | null;
};

type DispatchTaskUnit = {
  id: string;
  code: string;
  barcode: string;
  status: string;
  statusLabel: string;
  name: string;
  customId: string | null;
  pickedAt: string | null;
  packedAt: string | null;
  pickedBy: {
    name: string;
    email: string;
  } | null;
  packedBy: {
    name: string;
    email: string;
  } | null;
};

type DispatchHistoryEntry = {
  id: string;
  actionType: string;
  label: string;
  detail: string | null;
  createdAt: string;
  actor: {
    name: string;
    email: string;
  } | null;
};

type DispatchReportsTrendPoint = {
  date: string;
  packedOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  returnedOrders: number;
};

type DispatchReportsStoreRow = {
  storeId: string;
  tenantId: string | null;
  storeName: string;
  tenantName: string | null;
  packedOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  returningOrders: number;
  returnedOrders: number;
  dispatchedUnits: number;
  rtsUnits: number;
};

type DispatchReportsActivityEntry = {
  id: string;
  actionType: string;
  label: string;
  detail: string | null;
  createdAt: string;
  storeName: string | null;
  tenantName: string | null;
  actor: {
    name: string;
    email: string;
  } | null;
};

type DispatchReturnSummaryCounts = {
  expectedUnits: number;
  verifiedUnits: number;
  pendingUnits: number;
};

const DEFAULT_DISPATCH_PAGE_SIZE = 10;
const DEFAULT_DISPATCH_REPORT_WINDOW_DAYS = 14;
const RETURNED_EQUIVALENT_UNIT_STATUSES = new Set<WmsInventoryUnitStatus>([
  WmsInventoryUnitStatus.RTS,
  WmsInventoryUnitStatus.PUTAWAY,
  WmsInventoryUnitStatus.DEADSTOCK,
  WmsInventoryUnitStatus.DAMAGED,
  WmsInventoryUnitStatus.LOST,
]);
const DISPATCH_RETURN_ACTIVITY_TYPES = [
  'ORDER_RTS_UNIT_VERIFY',
  'ORDER_RTS_COMPLETE',
] as const;
const DISPATCH_REPORT_TREND_ACTIVITY_TYPES = [
  'PACKING_COMPLETE',
  'ORDER_DISPATCH_SYNC',
  'ORDER_DELIVERY_SYNC',
  'ORDER_RTS_COMPLETE',
] as const;
const DISPATCH_REPORT_ACTIVITY_TYPES = [
  ...DISPATCH_REPORT_TREND_ACTIVITY_TYPES,
  'ORDER_RTS_UNIT_VERIFY',
] as const;
const MANILA_TIME_ZONE = 'Asia/Manila';

@Injectable()
export class WmsDispatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wmsInventoryService: WmsInventoryService,
  ) {}

  async getSummary(query: GetWmsDispatchSummaryDto) {
    const scope = await this.resolveScope(query);
    const [packedOrdersWhere, unitScope] = await Promise.all([
      this.buildPackedOrderScope(scope),
      this.buildInventoryUnitScope(scope),
    ]);

    const [
      packedOrders,
      shippedOrders,
      deliveredOrders,
      returningOrders,
      returnedOrders,
      packedUnits,
      dispatchedUnits,
      rtsUnits,
    ] = await Promise.all([
      this.prisma.wmsFulfillmentOrder.count({
        where: this.combineOrderWhere(
          packedOrdersWhere,
          this.buildOutboundLifecycleWhere('PACKED'),
        ),
      }),
      this.prisma.wmsFulfillmentOrder.count({
        where: this.combineOrderWhere(
          packedOrdersWhere,
          this.buildOutboundLifecycleWhere('SHIPPED'),
        ),
      }),
      this.prisma.wmsFulfillmentOrder.count({
        where: this.combineOrderWhere(
          packedOrdersWhere,
          this.buildOutboundLifecycleWhere('DELIVERED'),
        ),
      }),
      this.prisma.wmsFulfillmentOrder.count({
        where: this.combineOrderWhere(
          packedOrdersWhere,
          this.buildReturnLifecycleWhere('RETURNING'),
        ),
      }),
      this.prisma.wmsFulfillmentOrder.count({
        where: this.combineOrderWhere(
          packedOrdersWhere,
          this.buildReturnLifecycleWhere('RETURNED'),
        ),
      }),
      this.prisma.wmsInventoryUnit.count({
        where: {
          ...unitScope,
          status: WmsInventoryUnitStatus.PACKED,
        },
      }),
      this.prisma.wmsInventoryUnit.count({
        where: {
          ...unitScope,
          status: WmsInventoryUnitStatus.DISPATCHED,
        },
      }),
      this.prisma.wmsInventoryUnit.count({
        where: {
          ...unitScope,
          status: WmsInventoryUnitStatus.RTS,
        },
      }),
    ]);

    return {
      serverTime: new Date().toISOString(),
      context: this.mapScopeContext(scope),
      summary: {
        orders: {
          packed: packedOrders,
          shipped: shippedOrders,
          delivered: deliveredOrders,
          returning: returningOrders,
          returned: returnedOrders,
        },
        units: {
          packed: packedUnits,
          dispatched: dispatchedUnits,
          rts: rtsUnits,
        },
      },
    };
  }

  async getOutbound(query: GetWmsDispatchOutboundDto) {
    const scope = await this.resolveScope(query);
    const page = Math.max(query.page ?? 1, 1);
    const pageSize = Math.min(Math.max(query.pageSize ?? DEFAULT_DISPATCH_PAGE_SIZE, 5), 50);
    const where = this.combineOrderWhere(
      await this.buildPackedOrderScope(scope),
      this.buildSearchWhere(query.search),
      this.buildOutboundLifecycleWhere(query.status),
    );

    const [total, orders] = await Promise.all([
      this.prisma.wmsFulfillmentOrder.count({ where }),
      this.prisma.wmsFulfillmentOrder.findMany({
        where,
        select: this.dispatchListOrderSelect(),
        orderBy: [
          { updatedAt: 'desc' },
          { id: 'desc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      tenantReady: true,
      serverTime: new Date().toISOString(),
      pagination: {
        page,
        pageSize,
        total,
        hasMore: page * pageSize < total,
      },
      context: {
        activeTenantId: scope.activeTenantId,
        activeStoreId: scope.activeStore?.id ?? null,
      },
      tasks: orders.map((order) => this.mapDispatchTaskListItem(order)),
    };
  }

  async getReturns(query: GetWmsDispatchReturnsDto) {
    const scope = await this.resolveScope(query);
    const page = Math.max(query.page ?? 1, 1);
    const pageSize = Math.min(Math.max(query.pageSize ?? DEFAULT_DISPATCH_PAGE_SIZE, 5), 50);
    const where = this.combineOrderWhere(
      await this.buildPackedOrderScope(scope),
      this.buildSearchWhere(query.search),
      this.buildReturnLifecycleWhere(query.status),
    );

    const [total, orders] = await Promise.all([
      this.prisma.wmsFulfillmentOrder.count({ where }),
      this.prisma.wmsFulfillmentOrder.findMany({
        where,
        select: this.dispatchListOrderSelect(),
        orderBy: [
          { updatedAt: 'desc' },
          { id: 'desc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    const returnSummaries = await this.loadReturnSummaryCountsByOrder(orders);

    return {
      tenantReady: true,
      serverTime: new Date().toISOString(),
      pagination: {
        page,
        pageSize,
        total,
        hasMore: page * pageSize < total,
      },
      context: {
        activeTenantId: scope.activeTenantId,
        activeStoreId: scope.activeStore?.id ?? null,
      },
      tasks: orders.map((order) => ({
        task: this.mapDispatchTaskListItem(order),
        returnSummary: this.buildReturnSummary(
          order,
          returnSummaries.get(order.id) ?? {
            expectedUnits: 0,
            verifiedUnits: 0,
            pendingUnits: 0,
          },
        ),
      })),
    };
  }

  async getOutboundTask(query: GetWmsDispatchSummaryDto, taskId: string) {
    const scope = await this.resolveScope(query);
    const order = await this.prisma.wmsFulfillmentOrder.findFirst({
      where: this.combineOrderWhere(
        await this.buildPackedOrderScope(scope),
        this.buildOutboundLifecycleWhere(),
        { id: taskId },
      ),
      include: this.dispatchOrderInclude(),
    });

    if (!order) {
      throw new NotFoundException('Dispatch order not found in the active outbound scope');
    }

    return {
      tenantReady: true,
      serverTime: new Date().toISOString(),
      task: this.mapDispatchTask(order),
    };
  }

  async getReturnTask(query: GetWmsDispatchSummaryDto, taskId: string) {
    const scope = await this.resolveScope(query);
    const order = await this.prisma.wmsFulfillmentOrder.findFirst({
      where: this.combineOrderWhere(
        await this.buildPackedOrderScope(scope),
        this.buildReturnLifecycleWhere(),
        { id: taskId },
      ),
      include: this.dispatchOrderInclude(),
    });

    if (!order) {
      throw new NotFoundException('Dispatch order not found in the active returns scope');
    }

    const returnActivities = await this.loadReturnActivitiesByOrder([order.id]);

    return {
      tenantReady: true,
      serverTime: new Date().toISOString(),
      task: {
        task: this.mapDispatchTask(order),
        returnFlow: this.buildReturnFlow(order, returnActivities.get(order.id) ?? []),
      },
    };
  }

  async getReports(query: GetWmsDispatchReportsDto) {
    const scope = await this.resolveScope(query);
    const days = query.days ?? DEFAULT_DISPATCH_REPORT_WINDOW_DAYS;
    const packedOrderScope = await this.buildPackedOrderScope(scope);
    const unitScope = await this.buildInventoryUnitScope(scope);
    const dateKeys = this.buildRecentReportDateKeys(days);
    const windowStart = new Date(`${dateKeys[0] ?? this.formatManilaDateKey(new Date())}T00:00:00+08:00`);

    const [
      packedOrdersByStore,
      shippedOrdersByStore,
      deliveredOrdersByStore,
      returningOrdersByStore,
      returnedOrdersByStore,
      dispatchedUnitsByStore,
      rtsUnitsByStore,
      trendActivities,
      recentActivities,
    ] = await Promise.all([
      this.groupFulfillmentOrdersByStore(
        this.combineOrderWhere(
          packedOrderScope,
          this.buildOutboundLifecycleWhere('PACKED'),
        ),
      ),
      this.groupFulfillmentOrdersByStore(
        this.combineOrderWhere(
          packedOrderScope,
          this.buildOutboundLifecycleWhere('SHIPPED'),
        ),
      ),
      this.groupFulfillmentOrdersByStore(
        this.combineOrderWhere(
          packedOrderScope,
          this.buildOutboundLifecycleWhere('DELIVERED'),
        ),
      ),
      this.groupFulfillmentOrdersByStore(
        this.combineOrderWhere(
          packedOrderScope,
          this.buildReturnLifecycleWhere('RETURNING'),
        ),
      ),
      this.groupFulfillmentOrdersByStore(
        this.combineOrderWhere(
          packedOrderScope,
          this.buildReturnLifecycleWhere('RETURNED'),
        ),
      ),
      this.groupInventoryUnitsByStore({
        ...unitScope,
        status: WmsInventoryUnitStatus.DISPATCHED,
      }),
      this.groupInventoryUnitsByStore({
        ...unitScope,
        status: WmsInventoryUnitStatus.RTS,
      }),
      this.prisma.wmsStaffActivity.findMany({
        where: this.buildDispatchReportActivityWhere(scope, windowStart, DISPATCH_REPORT_TREND_ACTIVITY_TYPES),
        select: {
          id: true,
          actionType: true,
          resourceId: true,
          createdAt: true,
        },
        orderBy: [
          { createdAt: 'asc' },
          { id: 'asc' },
        ],
      }),
      this.prisma.wmsStaffActivity.findMany({
        where: this.buildDispatchReportActivityWhere(scope, windowStart, DISPATCH_REPORT_ACTIVITY_TYPES),
        select: {
          id: true,
          actionType: true,
          metadata: true,
          createdAt: true,
          storeId: true,
          tenantId: true,
          actor: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: [
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
        take: 12,
      }),
    ]);

    return {
      serverTime: new Date().toISOString(),
      context: this.mapScopeContext(scope),
      window: {
        days,
        startDate: dateKeys[0] ?? null,
        endDate: dateKeys[dateKeys.length - 1] ?? null,
      },
      trend: this.buildDispatchTrend(dateKeys, trendActivities),
      stores: this.buildDispatchReportsStoreRows(scope, {
        packedOrdersByStore,
        shippedOrdersByStore,
        deliveredOrdersByStore,
        returningOrdersByStore,
        returnedOrdersByStore,
        dispatchedUnitsByStore,
        rtsUnitsByStore,
      }),
      recentActivity: recentActivities.map((activity) => this.mapDispatchReportsActivity(scope, activity)),
    };
  }

  async reconcileOutbound(
    user: { userId?: string; id?: string } | null | undefined,
    body: ReconcileWmsDispatchOutboundDto,
  ) {
    const scope = await this.resolveScope(body);
    const requestedTaskIds = Array.from(new Set((body.taskIds ?? []).filter(Boolean)));
    const effectiveStoreId = scope.activeStore?.id ?? null;
    const effectiveTenantId = scope.activeTenantId ?? scope.activeStore?.tenantId ?? null;
    const targetOrders = requestedTaskIds.length > 0
      ? await this.prisma.wmsFulfillmentOrder.findMany({
          where: this.combineOrderWhere(
            await this.buildPackedOrderScope(scope),
            {
              id: {
                in: requestedTaskIds,
              },
            },
          ),
          select: {
            id: true,
            tenantId: true,
            storeId: true,
            shopId: true,
            posOrderId: true,
          },
        })
      : [];

    if (requestedTaskIds.length > 0 && targetOrders.length === 0) {
      throw new BadRequestException('No outbound dispatch orders matched the selected repair scope');
    }

    if (requestedTaskIds.length > 0 && targetOrders.length !== requestedTaskIds.length) {
      throw new BadRequestException('One or more selected orders are outside the active dispatch scope');
    }

    const tenantIds = Array.from(
      new Set(targetOrders.map((order) => order.tenantId).filter((value): value is string => Boolean(value))),
    );
    const reconcileTenantId = tenantIds[0] ?? effectiveTenantId;

    if (!reconcileTenantId) {
      throw new BadRequestException('Select a tenant or store before running dispatch repair');
    }

    if (tenantIds.length > 1) {
      throw new BadRequestException('Selected orders must belong to the same tenant');
    }

    const result = await this.wmsInventoryService.syncPackedUnitsToDispatchedForPosOrders({
      tenantId: reconcileTenantId,
      ...(requestedTaskIds.length > 0
        ? {
            posOrderRefs: targetOrders.map((order) => ({
              shopId: order.shopId,
              posOrderId: order.posOrderId,
            })),
          }
        : {
            storeId: effectiveStoreId,
          }),
      mode: 'MANUAL',
      actorId: user?.userId || user?.id || null,
    });

    return {
      reconciledAt: new Date().toISOString(),
      scope: {
        tenantId: reconcileTenantId,
        storeId: requestedTaskIds.length > 0 ? null : effectiveStoreId,
        targetedOrders: targetOrders.length,
      },
      result,
    };
  }

  private async resolveScope(query: GetWmsDispatchSummaryDto): Promise<DispatchScope> {
    const tenantOptions = await this.getActiveTenantOptions();
    const activeTenantId = query.tenantId ?? null;

    const stores = await this.prisma.posStore.findMany({
      where: {
        ...(activeTenantId ? { tenantId: activeTenantId } : {}),
        status: IntegrationStatus.ACTIVE,
      },
      select: {
        id: true,
        tenantId: true,
        name: true,
        shopName: true,
        tenant: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
      orderBy: [
        { tenant: { name: 'asc' } },
        { shopName: 'asc' },
        { name: 'asc' },
      ],
    });

    const activeStore = query.storeId
      ? stores.find((store) => store.id === query.storeId) ?? null
      : null;

    if (query.storeId && !activeStore) {
      throw new ForbiddenException('Selected store is not available for WMS dispatch');
    }

    return {
      activeStore,
      activeTenantId,
      stores,
      tenantOptions,
    };
  }

  private mapScopeContext(scope: DispatchScope) {
    return {
      activeTenantId: scope.activeTenantId,
      activeStoreId: scope.activeStore?.id ?? null,
      tenantOptions: scope.tenantOptions.map((tenant) => ({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
      })),
      stores: scope.stores.map((store) => ({
        id: store.id,
        tenantId: store.tenantId,
        name: store.shopName || store.name,
        tenantName: store.tenant?.name ?? null,
        tenantSlug: store.tenant?.slug ?? null,
      })),
    };
  }

  private async getActiveTenantOptions(): Promise<ActiveTenantOption[]> {
    return this.prisma.tenant.findMany({
      where: {
        status: {
          in: [TenantStatus.ACTIVE, TenantStatus.TRIAL],
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        wmsFulfillmentGoLiveAt: true,
      },
      orderBy: [{ name: 'asc' }],
    });
  }

  private async buildPackedOrderScope(scope: DispatchScope): Promise<Prisma.WmsFulfillmentOrderWhereInput> {
    const baseScope: Prisma.WmsFulfillmentOrderWhereInput = {
      status: WmsFulfillmentOrderStatus.PACKED,
      ...(scope.activeTenantId ? { tenantId: scope.activeTenantId } : {}),
      ...(scope.activeStore ? { storeId: scope.activeStore.id } : {}),
    };

    if (scope.activeTenantId) {
      const tenant = scope.tenantOptions.find((option) => option.id === scope.activeTenantId) ?? null;
      return this.combineOrderWhere(
        baseScope,
        this.buildFulfillmentGoLiveWhere(tenant?.wmsFulfillmentGoLiveAt ?? null),
      );
    }

    const goLiveFilters = scope.tenantOptions.map((tenantOption) => this.buildTenantGoLiveScope(tenantOption));
    if (goLiveFilters.length === 0) {
      return baseScope;
    }

    return this.combineOrderWhere(
      baseScope,
      {
        OR: goLiveFilters,
      },
    );
  }

  private async buildInventoryUnitScope(scope: DispatchScope): Promise<Prisma.WmsInventoryUnitWhereInput> {
    return {
      ...(scope.activeTenantId ? { tenantId: scope.activeTenantId } : {}),
      ...(scope.activeStore ? { storeId: scope.activeStore.id } : {}),
    };
  }

  private buildDispatchReportActivityWhere(
    scope: DispatchScope,
    windowStart: Date,
    actionTypes: readonly string[],
  ): Prisma.WmsStaffActivityWhereInput {
    return {
      ...(scope.activeTenantId ? { tenantId: scope.activeTenantId } : {}),
      ...(scope.activeStore ? { storeId: scope.activeStore.id } : {}),
      outcome: WmsStaffActivityOutcome.SUCCESS,
      actionType: {
        in: [...actionTypes],
      },
      createdAt: {
        gte: windowStart,
      },
    };
  }

  private async groupFulfillmentOrdersByStore(where: Prisma.WmsFulfillmentOrderWhereInput) {
    const rows = await this.prisma.wmsFulfillmentOrder.groupBy({
      by: ['storeId'],
      where,
      _count: {
        _all: true,
      },
    });

    return new Map(rows.map((row) => [row.storeId, row._count._all] as const));
  }

  private async groupInventoryUnitsByStore(where: Prisma.WmsInventoryUnitWhereInput) {
    const rows = await this.prisma.wmsInventoryUnit.groupBy({
      by: ['storeId'],
      where,
      _count: {
        _all: true,
      },
    });

    return new Map(rows.map((row) => [row.storeId, row._count._all] as const));
  }

  private buildSearchWhere(search?: string | null): Prisma.WmsFulfillmentOrderWhereInput {
    const normalizedSearch = search?.trim() || null;
    if (!normalizedSearch) {
      return {};
    }

    return {
      OR: [
        { posOrderId: { contains: normalizedSearch, mode: 'insensitive' } },
        {
          store: {
            is: {
              OR: [
                { name: { contains: normalizedSearch, mode: 'insensitive' } },
                { shopName: { contains: normalizedSearch, mode: 'insensitive' } },
              ],
            },
          },
        },
        {
          posOrder: {
            is: {
              OR: [
                { customerName: { contains: normalizedSearch, mode: 'insensitive' } },
                { tracking: { contains: normalizedSearch, mode: 'insensitive' } },
              ],
            },
          },
        },
      ],
    };
  }

  private buildOutboundLifecycleWhere(
    status?: 'PACKED' | 'SHIPPED' | 'DELIVERED',
  ): Prisma.WmsFulfillmentOrderWhereInput {
    if (status === 'SHIPPED') {
      return {
        posOrder: {
          is: {
            status: 2,
          },
        },
      };
    }

    if (status === 'DELIVERED') {
      return {
        posOrder: {
          is: {
            status: 3,
          },
        },
      };
    }

    if (status === 'PACKED') {
      return {
        OR: [
          {
            posOrder: {
              is: {
                status: null,
              },
            },
          },
          {
            posOrder: {
              is: {
                status: {
                  notIn: [2, 3, 4, 5],
                },
              },
            },
          },
        ],
      };
    }

    return {
      OR: [
        {
          posOrder: {
            is: {
              status: null,
            },
          },
        },
        {
          posOrder: {
            is: {
              status: {
                in: [2, 3],
              },
            },
          },
        },
        {
          posOrder: {
            is: {
              status: {
                notIn: [4, 5],
              },
            },
          },
        },
      ],
    };
  }

  private buildReturnLifecycleWhere(
    status?: 'RETURNING' | 'RETURNED',
  ): Prisma.WmsFulfillmentOrderWhereInput {
    if (status === 'RETURNING') {
      return {
        posOrder: {
          is: {
            status: 4,
          },
        },
      };
    }

    if (status === 'RETURNED') {
      return {
        posOrder: {
          is: {
            status: 5,
          },
        },
      };
    }

    return {
      posOrder: {
        is: {
          status: {
            in: [4, 5],
          },
        },
      },
    };
  }

  private dispatchListOrderSelect() {
    return {
      id: true,
      posOrderId: true,
      shopId: true,
      status: true,
      assignmentMode: true,
      totalQuantity: true,
      customerName: true,
      createdAt: true,
      store: {
        select: {
          id: true,
          tenantId: true,
          name: true,
          shopName: true,
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
      posOrder: {
        select: {
          insertedAt: true,
          dateLocal: true,
          tracking: true,
          status: true,
          statusName: true,
          deliveredAt: true,
          rtsAt: true,
          customerName: true,
          customerPhone: true,
        },
      },
    } satisfies Prisma.WmsFulfillmentOrderSelect;
  }

  private dispatchOrderInclude() {
    return {
      store: {
        select: {
          id: true,
          tenantId: true,
          name: true,
          shopName: true,
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
      warehouse: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
      claimedBy: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      packedBy: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      basket: {
        select: {
          id: true,
          barcode: true,
          status: true,
          maxFulfillmentOrders: true,
          claimedAt: true,
          fullAt: true,
          readyForPackAt: true,
          assignedPicker: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          assignedPacker: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          warehouse: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          _count: {
            select: {
              fulfillmentOrders: true,
            },
          },
        },
      },
      posOrder: {
        select: {
          insertedAt: true,
          dateLocal: true,
          tracking: true,
          status: true,
          statusName: true,
          deliveredAt: true,
          rtsAt: true,
          customerName: true,
          customerPhone: true,
        },
      },
      basketUnits: {
        where: {
          OR: [
            {
              status: {
                in: [WmsBasketUnitStatus.PICKED, WmsBasketUnitStatus.PACKED],
              },
            },
            {
              status: WmsBasketUnitStatus.REMOVED,
              packedAt: {
                not: null,
              },
            },
          ],
        },
        select: {
          id: true,
          status: true,
          fulfillmentLineId: true,
          fulfillmentOrderId: true,
          pickedAt: true,
          packedAt: true,
          pickedBy: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          packedBy: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          inventoryUnit: {
            select: {
              id: true,
              code: true,
              barcode: true,
              status: true,
              posProduct: {
                select: {
                  name: true,
                  customId: true,
                },
              },
            },
          },
        },
      },
      lines: {
        include: {
          reservations: {
            where: {
              status: {
                in: [WmsPickReservationStatus.RESERVED, WmsPickReservationStatus.PICKED],
              },
            },
            select: {
              id: true,
              status: true,
              pickedAt: true,
              pickedBy: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
              inventoryUnit: {
                select: {
                  id: true,
                  code: true,
                  barcode: true,
                  status: true,
                  posProduct: {
                    select: {
                      name: true,
                      customId: true,
                    },
                  },
                },
              },
            },
            orderBy: [{ sequence: 'asc' }],
          },
        },
        orderBy: [{ createdAt: 'asc' }],
      },
    } satisfies Prisma.WmsFulfillmentOrderInclude;
  }

  private async loadReturnSummaryCountsByOrder(orders: Array<{
    id: string;
    assignmentMode: WmsFulfillmentAssignmentMode;
  }>) {
    if (orders.length === 0) {
      return new Map<string, DispatchReturnSummaryCounts>();
    }

    const demandOrderIds = orders
      .filter((order) => order.assignmentMode === WmsFulfillmentAssignmentMode.BASKET_DEMAND)
      .map((order) => order.id);
    const legacyOrderIds = orders
      .filter((order) => order.assignmentMode !== WmsFulfillmentAssignmentMode.BASKET_DEMAND)
      .map((order) => order.id);

    const [basketUnits, reservations] = await Promise.all([
      demandOrderIds.length > 0
        ? this.prisma.wmsBasketUnit.findMany({
            where: {
              fulfillmentOrderId: {
                in: demandOrderIds,
              },
              OR: [
                {
                  status: WmsBasketUnitStatus.PACKED,
                },
                {
                  status: WmsBasketUnitStatus.REMOVED,
                  packedAt: {
                    not: null,
                  },
                },
              ],
            },
            select: {
              fulfillmentOrderId: true,
              inventoryUnit: {
                select: {
                  id: true,
                  status: true,
                },
              },
            },
          })
        : Promise.resolve([]),
      legacyOrderIds.length > 0
        ? this.prisma.wmsPickReservation.findMany({
            where: {
              fulfillmentOrderId: {
                in: legacyOrderIds,
              },
              status: {
                in: [WmsPickReservationStatus.RESERVED, WmsPickReservationStatus.PICKED],
              },
            },
            select: {
              fulfillmentOrderId: true,
              inventoryUnit: {
                select: {
                  id: true,
                  status: true,
                },
              },
            },
          })
        : Promise.resolve([]),
    ]);

    const summaryByOrderId = new Map<string, DispatchReturnSummaryCounts>();

    for (const basketUnit of basketUnits) {
      if (!basketUnit.fulfillmentOrderId || !basketUnit.inventoryUnit) {
        continue;
      }

      const current = summaryByOrderId.get(basketUnit.fulfillmentOrderId) ?? {
        expectedUnits: 0,
        verifiedUnits: 0,
        pendingUnits: 0,
      };
      current.expectedUnits += 1;
      if (RETURNED_EQUIVALENT_UNIT_STATUSES.has(basketUnit.inventoryUnit.status)) {
        current.verifiedUnits += 1;
      }
      summaryByOrderId.set(basketUnit.fulfillmentOrderId, current);
    }

    const seenLegacyUnits = new Set<string>();
    for (const reservation of reservations) {
      if (!reservation.inventoryUnit) {
        continue;
      }

      const dedupeKey = `${reservation.fulfillmentOrderId}:${reservation.inventoryUnit.id}`;
      if (seenLegacyUnits.has(dedupeKey)) {
        continue;
      }
      seenLegacyUnits.add(dedupeKey);

      const current = summaryByOrderId.get(reservation.fulfillmentOrderId) ?? {
        expectedUnits: 0,
        verifiedUnits: 0,
        pendingUnits: 0,
      };
      current.expectedUnits += 1;
      if (RETURNED_EQUIVALENT_UNIT_STATUSES.has(reservation.inventoryUnit.status)) {
        current.verifiedUnits += 1;
      }
      summaryByOrderId.set(reservation.fulfillmentOrderId, current);
    }

    for (const [orderId, current] of summaryByOrderId.entries()) {
      current.pendingUnits = Math.max(current.expectedUnits - current.verifiedUnits, 0);
      summaryByOrderId.set(orderId, current);
    }

    return summaryByOrderId;
  }

  private mapDispatchTask(order: any) {
    const lines = Array.isArray(order.lines)
      ? order.lines.filter((line: any) => (
          line.status !== WmsFulfillmentLineStatus.CANCELED
          && Math.max(line.quantityRequired ?? 0, 0) > 0
        ))
      : [];
    const unitRecords = this.getDispatchUnitRecords(order);
    const packedCount = this.isDemandOrder(order)
      ? this.getPackedBasketUnitCount(order)
      : this.getPackedReservationCount(order);

    return {
      id: order.id,
      posOrderId: order.posOrderId,
      shopId: order.shopId,
      status: order.status,
      assignmentMode: order.assignmentMode ?? WmsFulfillmentAssignmentMode.SERIAL_RESERVED,
      statusLabel: this.formatEnumLabel(order.status),
      issueReason: order.issueReason ?? null,
      customer: {
        name: order.customerName ?? order.posOrder?.customerName ?? null,
        phone: order.customerPhone ?? order.posOrder?.customerPhone ?? null,
      },
      totals: {
        required: Math.max(order.totalQuantity ?? 0, 0),
        picked: Math.max(order.pickedQuantity ?? 0, 0),
        packed: Math.min(packedCount, Math.max(order.totalQuantity ?? 0, 0)),
        remaining: Math.max(Math.max(order.totalQuantity ?? 0, 0) - packedCount, 0),
      },
      store: order.store
        ? {
            id: order.store.id,
            tenantId: order.store.tenantId,
            name: order.store.shopName || order.store.name,
            tenantName: order.store.tenant?.name ?? null,
            tenantSlug: order.store.tenant?.slug ?? null,
          }
        : null,
      warehouse: order.warehouse
        ? {
            id: order.warehouse.id,
            code: order.warehouse.code,
            name: order.warehouse.name,
          }
        : null,
      claimedBy: this.mapActor(order.claimedBy),
      packedBy: this.mapActor(order.packedBy),
      claimedAt: order.claimedAt ?? null,
      completedAt: order.completedAt ?? null,
      orderDate: order.posOrder?.insertedAt ?? order.createdAt,
      orderDateLocal: order.posOrder?.dateLocal ?? null,
      tracking: order.posOrder?.tracking ?? null,
      delivery: this.mapDelivery(order),
      createdAt: order.createdAt,
      basket: order.basket
        ? {
            id: order.basket.id,
            barcode: order.basket.barcode,
            status: order.basket.status,
            statusLabel: this.formatEnumLabel(order.basket.status),
            maxFulfillmentOrders: Math.max(order.basket.maxFulfillmentOrders ?? 0, 0),
            currentFulfillmentOrders: Math.max(order.basket._count?.fulfillmentOrders ?? 0, 0),
            claimedAt: order.basket.claimedAt ?? null,
            fullAt: order.basket.fullAt ?? null,
            readyForPackAt: order.basket.readyForPackAt ?? null,
            assignedPicker: this.mapActor(order.basket.assignedPicker),
            assignedPacker: this.mapActor(order.basket.assignedPacker),
            warehouse: order.basket.warehouse
              ? {
                  id: order.basket.warehouse.id,
                  code: order.basket.warehouse.code,
                  name: order.basket.warehouse.name,
                }
              : null,
          }
        : null,
      unitRecords,
      lines: lines.map((line: any) => ({
        id: line.id,
        variationId: line.variationId,
        productId: line.productId,
        productName: line.productName,
        productDisplayId: line.productDisplayId ?? null,
        status: line.status,
        statusLabel: this.formatEnumLabel(line.status),
        issueReason: line.issueReason ?? null,
        required: Math.max(line.quantityRequired ?? 0, 0),
        allocated: Math.max(line.quantityAllocated ?? 0, 0),
        picked: Math.max(line.quantityPicked ?? 0, 0),
        packed: this.isDemandOrder(order)
          ? this.getPackedBasketUnitCountForLine(order, line.id, line.quantityRequired)
          : Math.min(
              (Array.isArray(line.reservations) ? line.reservations : []).filter((reservation: any) => (
                this.isPackedEquivalentInventoryStatus(reservation.inventoryUnit?.status)
              )).length,
              Math.max(line.quantityRequired ?? 0, 0),
            ),
        shortage: Math.max(Math.max(line.quantityRequired ?? 0, 0) - Math.max(line.quantityAllocated ?? 0, 0), 0),
      })),
    };
  }

  private mapDispatchTaskListItem(order: any) {
    return {
      id: order.id,
      posOrderId: order.posOrderId,
      status: order.status,
      statusLabel: this.formatEnumLabel(order.status),
      customer: {
        name: order.customerName ?? order.posOrder?.customerName ?? null,
      },
      totals: {
        required: Math.max(order.totalQuantity ?? 0, 0),
        packed: Math.max(order.totalQuantity ?? 0, 0),
      },
      store: order.store
        ? {
            id: order.store.id,
            tenantId: order.store.tenantId,
            name: order.store.shopName || order.store.name,
            tenantName: order.store.tenant?.name ?? null,
            tenantSlug: order.store.tenant?.slug ?? null,
          }
        : null,
      orderDate: order.posOrder?.insertedAt ?? order.createdAt,
      orderDateLocal: order.posOrder?.dateLocal ?? null,
      tracking: order.posOrder?.tracking ?? null,
      delivery: this.mapDelivery(order),
    };
  }

  private mapDelivery(order: any) {
    const posStatus = typeof order.posOrder?.status === 'number' ? order.posOrder.status : null;

    if (posStatus === 5) {
      return {
        posStatus,
        status: 'RETURNED' as const,
        label: 'Returned',
        deliveredAt: order.posOrder?.deliveredAt ?? null,
        rtsAt: order.posOrder?.rtsAt ?? null,
      };
    }

    if (posStatus === 4) {
      return {
        posStatus,
        status: 'RETURNING' as const,
        label: 'Returning',
        deliveredAt: order.posOrder?.deliveredAt ?? null,
        rtsAt: order.posOrder?.rtsAt ?? null,
      };
    }

    if (posStatus === 3) {
      return {
        posStatus,
        status: 'DELIVERED' as const,
        label: 'Delivered',
        deliveredAt: order.posOrder?.deliveredAt ?? null,
        rtsAt: order.posOrder?.rtsAt ?? null,
      };
    }

    if (posStatus === 2) {
      return {
        posStatus,
        status: 'SHIPPED' as const,
        label: 'Shipped',
        deliveredAt: order.posOrder?.deliveredAt ?? null,
        rtsAt: order.posOrder?.rtsAt ?? null,
      };
    }

    return {
      posStatus,
      status: 'PACKED' as const,
      label: 'Packed',
      deliveredAt: order.posOrder?.deliveredAt ?? null,
      rtsAt: order.posOrder?.rtsAt ?? null,
    };
  }

  private async loadReturnActivitiesByOrder(orderIds: string[]) {
    if (orderIds.length === 0) {
      return new Map<string, DispatchHistoryEntry[]>();
    }

    const rows = await this.prisma.wmsStaffActivity.findMany({
      where: {
        resourceType: 'WMS_FULFILLMENT_ORDER',
        resourceId: {
          in: orderIds,
        },
        actionType: {
          in: [...DISPATCH_RETURN_ACTIVITY_TYPES],
        },
        outcome: WmsStaffActivityOutcome.SUCCESS,
      },
      select: {
        id: true,
        resourceId: true,
        actionType: true,
        metadata: true,
        createdAt: true,
        actor: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
    });

    const historyByOrderId = new Map<string, DispatchHistoryEntry[]>();
    for (const row of rows) {
      if (!row.resourceId) {
        continue;
      }

      const existing = historyByOrderId.get(row.resourceId) ?? [];
      if (existing.length >= 12) {
        continue;
      }

      existing.push(this.mapReturnHistoryEntry(row));
      historyByOrderId.set(row.resourceId, existing);
    }

    return historyByOrderId;
  }

  private buildReturnFlow(
    order: any,
    history: DispatchHistoryEntry[],
  ) {
    const posStatus = typeof order.posOrder?.status === 'number' ? order.posOrder.status : null;
    const posStatusLabel = this.cleanOptionalText(order.posOrder?.statusName ?? null);
    const trackedUnits = this.getTrackedReturnUnits(order);
    const verifiedUnits = trackedUnits.filter((unit) => RETURNED_EQUIVALENT_UNIT_STATUSES.has(unit.status as WmsInventoryUnitStatus));
    const pendingUnits = trackedUnits.filter((unit) => !RETURNED_EQUIVALENT_UNIT_STATUSES.has(unit.status as WmsInventoryUnitStatus));
    const latestActivity = history[0] ?? null;

    let state: 'NONE' | 'RETURNING' | 'READY_TO_VERIFY' | 'PARTIAL' | 'VERIFIED' = 'NONE';
    let label: string | null = null;

    if (posStatus === 4) {
      state = 'RETURNING';
      label = 'Returning';
    } else if (posStatus === 5) {
      if (verifiedUnits.length >= trackedUnits.length && trackedUnits.length > 0) {
        state = 'VERIFIED';
        label = 'Processed';
      } else if (verifiedUnits.length > 0) {
        state = 'PARTIAL';
        label = 'Processed';
      } else {
        state = 'READY_TO_VERIFY';
        label = 'Returned';
      }
    }

    return {
      eligible: posStatus === 4 || posStatus === 5,
      posStatus,
      posStatusLabel: posStatusLabel ?? (posStatus === 4 ? 'Returning' : posStatus === 5 ? 'Returned' : null),
      state,
      label,
      canVerify: posStatus === 5 && pendingUnits.length > 0,
      expectedUnits: trackedUnits.length,
      verifiedUnits: verifiedUnits.map((unit) => this.mapReturnUnit(unit)),
      pendingUnits: pendingUnits.map((unit) => this.mapReturnUnit(unit)),
      history,
      lastVerifiedAt: latestActivity?.createdAt ?? null,
      lastVerifiedBy: latestActivity?.actor ?? null,
    };
  }

  private buildReturnSummary(
    order: any,
    counts: DispatchReturnSummaryCounts,
  ) {
    const posStatus = typeof order.posOrder?.status === 'number' ? order.posOrder.status : null;
    const posStatusLabel = this.cleanOptionalText(order.posOrder?.statusName ?? null);
    let state: 'NONE' | 'RETURNING' | 'READY_TO_VERIFY' | 'PARTIAL' | 'VERIFIED' = 'NONE';
    let label: string | null = null;

    if (posStatus === 4) {
      state = 'RETURNING';
      label = 'Returning';
    } else if (posStatus === 5) {
      if (counts.expectedUnits > 0 && counts.verifiedUnits >= counts.expectedUnits) {
        state = 'VERIFIED';
        label = 'Processed';
      } else if (counts.verifiedUnits > 0) {
        state = 'PARTIAL';
        label = 'Processed';
      } else {
        state = 'READY_TO_VERIFY';
        label = 'Returned';
      }
    }

    return {
      posStatus,
      posStatusLabel: posStatusLabel ?? (posStatus === 4 ? 'Returning' : posStatus === 5 ? 'Returned' : null),
      state,
      label,
      expectedUnits: counts.expectedUnits,
      verifiedUnits: counts.verifiedUnits,
      pendingUnits: counts.pendingUnits,
    };
  }

  private getTrackedReturnUnits(order: any) {
    if (this.isDemandOrder(order) || (Array.isArray(order?.basketUnits) && order.basketUnits.length > 0)) {
      const units = (Array.isArray(order?.basketUnits) ? order.basketUnits : [])
        .filter((basketUnit: any) => (
          this.isHistoricallyPackedDemandBasketUnit(basketUnit)
          && basketUnit.inventoryUnit
        ))
        .map((basketUnit: any) => ({
          id: basketUnit.inventoryUnit.id,
          code: basketUnit.inventoryUnit.code,
          barcode: basketUnit.inventoryUnit.barcode,
          status: basketUnit.inventoryUnit.status,
          name: basketUnit.inventoryUnit.posProduct?.name ?? basketUnit.inventoryUnit.code,
          customId: basketUnit.inventoryUnit.posProduct?.customId ?? null,
        }));

      return this.deduplicateReturnUnits(units);
    }

    const units = this.getAllPickReservations(order)
      .filter((reservation: any) => reservation.inventoryUnit)
      .map((reservation: any) => ({
        id: reservation.inventoryUnit.id,
        code: reservation.inventoryUnit.code,
        barcode: reservation.inventoryUnit.barcode,
        status: reservation.inventoryUnit.status,
        name: reservation.inventoryUnit.posProduct?.name ?? reservation.inventoryUnit.code,
        customId: reservation.inventoryUnit.posProduct?.customId ?? null,
      }));

    return this.deduplicateReturnUnits(units);
  }

  private deduplicateReturnUnits(units: Array<{
    id: string;
    code: string;
    barcode: string;
    status: string;
    name: string;
    customId: string | null;
  }>) {
    return Array.from(
      new Map(units.map((unit) => [unit.id, unit] as const)).values(),
    );
  }

  private mapReturnUnit(unit: {
    id: string;
    code: string;
    barcode: string;
    status: string;
    name: string;
    customId: string | null;
  }): DispatchReturnUnit {
    return {
      id: unit.id,
      code: unit.code,
      barcode: unit.barcode,
      status: unit.status,
      statusLabel: this.formatEnumLabel(unit.status),
      name: unit.name,
      customId: unit.customId,
    };
  }

  private getDispatchUnitRecords(order: any): DispatchTaskUnit[] {
    if (this.isDemandOrder(order) || (Array.isArray(order?.basketUnits) && order.basketUnits.length > 0)) {
      return this.deduplicateDispatchUnits(
        (Array.isArray(order?.basketUnits) ? order.basketUnits : [])
          .filter((basketUnit: any) => basketUnit.inventoryUnit)
          .map((basketUnit: any) => ({
            id: basketUnit.inventoryUnit.id,
            code: basketUnit.inventoryUnit.code,
            barcode: basketUnit.inventoryUnit.barcode,
            status: basketUnit.inventoryUnit.status,
            statusLabel: this.formatEnumLabel(basketUnit.inventoryUnit.status),
            name: basketUnit.inventoryUnit.posProduct?.name ?? basketUnit.inventoryUnit.code,
            customId: basketUnit.inventoryUnit.posProduct?.customId ?? null,
            pickedAt: basketUnit.pickedAt?.toISOString() ?? null,
            packedAt: basketUnit.packedAt?.toISOString() ?? null,
            pickedBy: this.mapActor(basketUnit.pickedBy),
            packedBy: this.mapActor(basketUnit.packedBy),
          })),
      );
    }

    return this.deduplicateDispatchUnits(
      this.getAllPickReservations(order)
        .filter((reservation: any) => reservation.inventoryUnit)
        .map((reservation: any) => ({
          id: reservation.inventoryUnit.id,
          code: reservation.inventoryUnit.code,
          barcode: reservation.inventoryUnit.barcode,
          status: reservation.inventoryUnit.status,
          statusLabel: this.formatEnumLabel(reservation.inventoryUnit.status),
          name: reservation.inventoryUnit.posProduct?.name ?? reservation.inventoryUnit.code,
          customId: reservation.inventoryUnit.posProduct?.customId ?? null,
          pickedAt: reservation.pickedAt?.toISOString() ?? null,
          packedAt: this.isPackedEquivalentInventoryStatus(reservation.inventoryUnit.status)
            ? (order.completedAt?.toISOString?.() ?? order.completedAt ?? null)
            : null,
          pickedBy: this.mapActor(reservation.pickedBy),
          packedBy: this.isPackedEquivalentInventoryStatus(reservation.inventoryUnit.status)
            ? this.mapActor(order.packedBy)
            : null,
        })),
    );
  }

  private deduplicateDispatchUnits(units: DispatchTaskUnit[]) {
    return Array.from(new Map(units.map((unit) => [unit.id, unit] as const)).values());
  }

  private mapReturnHistoryEntry(activity: {
    id: string;
    actionType: string;
    metadata: Prisma.JsonValue | null;
    createdAt: Date;
    actor: {
      firstName: string | null;
      lastName: string | null;
      email: string;
    } | null;
  }): DispatchHistoryEntry {
    const metadata = this.readActivityMetadata(activity.metadata);
    const unitCode = this.readActivityMetadataString(metadata, 'unitCode');
    const unitCount = this.readActivityMetadataNumber(metadata, 'unitCount');
    const trackingCode = this.cleanOptionalText(this.readActivityMetadataString(metadata, 'trackingCode'));
    const detailParts: string[] = [];
    let label = this.formatEnumLabel(activity.actionType);

    if (activity.actionType === 'ORDER_RTS_UNIT_VERIFY') {
      label = 'Verified returned unit';
      if (unitCode) {
        detailParts.push(unitCode);
      }
    }

    if (activity.actionType === 'ORDER_RTS_COMPLETE') {
      label = 'Completed RTS verification';
      if (typeof unitCount === 'number') {
        detailParts.push(`${unitCount} unit${unitCount === 1 ? '' : 's'} reconciled`);
      }
    }

    if (trackingCode) {
      detailParts.push(`Waybill ${trackingCode}`);
    }

    return {
      id: activity.id,
      actionType: activity.actionType,
      label,
      detail: detailParts.join(' · ') || null,
      createdAt: activity.createdAt.toISOString(),
      actor: this.mapActor(activity.actor),
    };
  }

  private readActivityMetadata(metadata: Prisma.JsonValue | null | undefined) {
    if (!metadata || Array.isArray(metadata) || typeof metadata !== 'object') {
      return null;
    }

    return metadata as Record<string, unknown>;
  }

  private readActivityMetadataString(metadata: Record<string, unknown> | null, key: string) {
    const value = metadata?.[key];

    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number') {
      return String(value);
    }

    return null;
  }

  private readActivityMetadataNumber(metadata: Record<string, unknown> | null, key: string) {
    const value = metadata?.[key];

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    return null;
  }

  private isDemandOrder(order: any) {
    return order.assignmentMode === WmsFulfillmentAssignmentMode.BASKET_DEMAND;
  }

  private getAllPickReservations(order: any) {
    return (Array.isArray(order?.lines) ? order.lines : []).flatMap((line: any) => line.reservations ?? []);
  }

  private getPackedReservationCount(order: any) {
    return this.getAllPickReservations(order).filter(
      (reservation: any) => this.isPackedEquivalentInventoryStatus(reservation.inventoryUnit?.status),
    ).length;
  }

  private getPackedBasketUnitCount(order: any) {
    return Math.min(
      (Array.isArray(order?.basketUnits) ? order.basketUnits : []).filter(
        (basketUnit: any) => this.isHistoricallyPackedDemandBasketUnit(basketUnit),
      ).length,
      Math.max(order?.totalQuantity ?? 0, 0),
    );
  }

  private getPackedBasketUnitCountForLine(
    order: any,
    fulfillmentLineId: string,
    quantityRequired: number,
  ) {
    return Math.min(
      (Array.isArray(order?.basketUnits) ? order.basketUnits : []).filter(
        (basketUnit: any) => (
          this.isHistoricallyPackedDemandBasketUnit(basketUnit)
          && basketUnit.fulfillmentLineId === fulfillmentLineId
        ),
      ).length,
      Math.max(quantityRequired ?? 0, 0),
    );
  }

  private isHistoricallyPackedDemandBasketUnit(
    basketUnit:
      | {
          status?: WmsBasketUnitStatus | string | null;
          packedAt?: Date | string | null;
        }
      | null
      | undefined,
  ) {
    if (!basketUnit) {
      return false;
    }

    return basketUnit.status === WmsBasketUnitStatus.PACKED
      || (basketUnit.status === WmsBasketUnitStatus.REMOVED && basketUnit.packedAt != null);
  }

  private isPackedEquivalentInventoryStatus(status: WmsInventoryUnitStatus | string | null | undefined) {
    return status === WmsInventoryUnitStatus.PACKED
      || status === WmsInventoryUnitStatus.DISPATCHED
      || RETURNED_EQUIVALENT_UNIT_STATUSES.has(status as WmsInventoryUnitStatus);
  }

  private mapActor(actor: {
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null) {
    if (!actor) {
      return null;
    }

    const name = [actor.firstName, actor.lastName].filter(Boolean).join(' ').trim();
    return {
      name: name || actor.email,
      email: actor.email,
    };
  }

  private cleanOptionalText(value: string | null | undefined) {
    return typeof value === 'string' && value.trim().length > 0
      ? value.trim()
      : null;
  }

  private buildDispatchTrend(
    dateKeys: string[],
    activities: Array<{
      id: string;
      actionType: string;
      resourceId: string | null;
      createdAt: Date;
    }>,
  ): DispatchReportsTrendPoint[] {
    const seeded = new Map<string, DispatchReportsTrendPoint>(
      dateKeys.map((date) => [date, {
        date,
        packedOrders: 0,
        shippedOrders: 0,
        deliveredOrders: 0,
        returnedOrders: 0,
      }]),
    );
    const seen = new Set<string>();

    for (const activity of activities) {
      const dateKey = this.formatManilaDateKey(activity.createdAt);
      const point = seeded.get(dateKey);
      if (!point) {
        continue;
      }

      const uniqueKey = `${dateKey}:${activity.actionType}:${activity.resourceId ?? activity.id}`;
      if (seen.has(uniqueKey)) {
        continue;
      }
      seen.add(uniqueKey);

      if (activity.actionType === 'PACKING_COMPLETE') {
        point.packedOrders += 1;
        continue;
      }

      if (activity.actionType === 'ORDER_DISPATCH_SYNC') {
        point.shippedOrders += 1;
        continue;
      }

      if (activity.actionType === 'ORDER_DELIVERY_SYNC') {
        point.deliveredOrders += 1;
        continue;
      }

      if (activity.actionType === 'ORDER_RTS_COMPLETE') {
        point.returnedOrders += 1;
      }
    }

    return dateKeys.map((date) => seeded.get(date) ?? {
      date,
      packedOrders: 0,
      shippedOrders: 0,
      deliveredOrders: 0,
      returnedOrders: 0,
    });
  }

  private buildDispatchReportsStoreRows(
    scope: DispatchScope,
    counts: {
      packedOrdersByStore: Map<string, number>;
      shippedOrdersByStore: Map<string, number>;
      deliveredOrdersByStore: Map<string, number>;
      returningOrdersByStore: Map<string, number>;
      returnedOrdersByStore: Map<string, number>;
      dispatchedUnitsByStore: Map<string, number>;
      rtsUnitsByStore: Map<string, number>;
    },
  ): DispatchReportsStoreRow[] {
    return scope.stores
      .map((store) => ({
        storeId: store.id,
        tenantId: store.tenantId ?? null,
        storeName: store.shopName || store.name,
        tenantName: store.tenant?.name ?? null,
        packedOrders: counts.packedOrdersByStore.get(store.id) ?? 0,
        shippedOrders: counts.shippedOrdersByStore.get(store.id) ?? 0,
        deliveredOrders: counts.deliveredOrdersByStore.get(store.id) ?? 0,
        returningOrders: counts.returningOrdersByStore.get(store.id) ?? 0,
        returnedOrders: counts.returnedOrdersByStore.get(store.id) ?? 0,
        dispatchedUnits: counts.dispatchedUnitsByStore.get(store.id) ?? 0,
        rtsUnits: counts.rtsUnitsByStore.get(store.id) ?? 0,
      }))
      .filter((store) => (
        store.packedOrders > 0
        || store.shippedOrders > 0
        || store.deliveredOrders > 0
        || store.returningOrders > 0
        || store.returnedOrders > 0
        || store.dispatchedUnits > 0
        || store.rtsUnits > 0
      ))
      .sort((left, right) => {
        const leftTotal = left.packedOrders + left.shippedOrders + left.deliveredOrders + left.returningOrders + left.returnedOrders;
        const rightTotal = right.packedOrders + right.shippedOrders + right.deliveredOrders + right.returningOrders + right.returnedOrders;
        if (rightTotal !== leftTotal) {
          return rightTotal - leftTotal;
        }

        return left.storeName.localeCompare(right.storeName);
      });
  }

  private mapDispatchReportsActivity(
    scope: DispatchScope,
    activity: {
      id: string;
      actionType: string;
      metadata: Prisma.JsonValue | null;
      createdAt: Date;
      storeId: string | null;
      tenantId: string | null;
      actor: {
        firstName: string | null;
        lastName: string | null;
        email: string;
      } | null;
    },
  ): DispatchReportsActivityEntry {
    const metadata = this.readActivityMetadata(activity.metadata);
    const posOrderId = this.cleanOptionalText(this.readActivityMetadataString(metadata, 'posOrderId'));
    const trackingCode = this.cleanOptionalText(this.readActivityMetadataString(metadata, 'trackingCode'));
    const basketCode = this.cleanOptionalText(this.readActivityMetadataString(metadata, 'basketCode'));
    const unitCode = this.cleanOptionalText(this.readActivityMetadataString(metadata, 'unitCode'));
    const unitCount = this.readActivityMetadataNumber(metadata, 'unitCount');
    const mode = this.cleanOptionalText(this.readActivityMetadataString(metadata, 'mode'));
    const store = scope.stores.find((entry) => entry.id === activity.storeId) ?? null;
    const detailParts: string[] = [];
    let label = this.formatEnumLabel(activity.actionType);

    if (activity.actionType === 'PACKING_COMPLETE') {
      label = 'Packed order';
    } else if (activity.actionType === 'ORDER_DISPATCH_SYNC') {
      label = 'Synced shipped order';
    } else if (activity.actionType === 'ORDER_DELIVERY_SYNC') {
      label = 'Synced delivered order';
    } else if (activity.actionType === 'ORDER_RTS_UNIT_VERIFY') {
      label = 'Verified returned unit';
    } else if (activity.actionType === 'ORDER_RTS_COMPLETE') {
      label = 'Completed RTS verification';
    }

    if (posOrderId) {
      detailParts.push(`Order #${posOrderId}`);
    }
    if (trackingCode) {
      detailParts.push(`Waybill ${trackingCode}`);
    }
    if (basketCode) {
      detailParts.push(basketCode);
    }
    if (unitCode) {
      detailParts.push(unitCode);
    }
    if (typeof unitCount === 'number' && unitCount > 0 && !unitCode) {
      detailParts.push(`${unitCount} unit${unitCount === 1 ? '' : 's'}`);
    }
    if (mode && mode !== 'AUTO') {
      detailParts.push(mode.toLowerCase());
    }

    return {
      id: activity.id,
      actionType: activity.actionType,
      label,
      detail: detailParts.join(' · ') || null,
      createdAt: activity.createdAt.toISOString(),
      storeName: store ? (store.shopName || store.name) : null,
      tenantName: store?.tenant?.name ?? scope.tenantOptions.find((tenant) => tenant.id === activity.tenantId)?.name ?? null,
      actor: this.mapActor(activity.actor),
    };
  }

  private buildRecentReportDateKeys(days: number) {
    const keys: string[] = [];
    const anchor = new Date();

    for (let index = days - 1; index >= 0; index -= 1) {
      const date = new Date(anchor);
      date.setDate(anchor.getDate() - index);
      keys.push(this.formatManilaDateKey(date));
    }

    return keys;
  }

  private formatManilaDateKey(date: Date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: MANILA_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
    const month = parts.find((part) => part.type === 'month')?.value ?? '00';
    const day = parts.find((part) => part.type === 'day')?.value ?? '00';

    return `${year}-${month}-${day}`;
  }

  private formatEnumLabel(value: string) {
    return value
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private combineOrderWhere(...clauses: Prisma.WmsFulfillmentOrderWhereInput[]) {
    const activeClauses = clauses.filter((clause) => Object.keys(clause).length > 0);
    if (activeClauses.length === 0) {
      return {};
    }
    if (activeClauses.length === 1) {
      return activeClauses[0];
    }
    return { AND: activeClauses } satisfies Prisma.WmsFulfillmentOrderWhereInput;
  }

  private buildTenantGoLiveScope(tenant: ActiveTenantOption): Prisma.WmsFulfillmentOrderWhereInput {
    return tenant.wmsFulfillmentGoLiveAt
      ? {
          tenantId: tenant.id,
          posOrder: {
            is: {
              insertedAt: {
                gte: tenant.wmsFulfillmentGoLiveAt,
              },
            },
          },
        }
      : {
          tenantId: tenant.id,
        };
  }

  private buildFulfillmentGoLiveWhere(goLiveAt: Date | null): Prisma.WmsFulfillmentOrderWhereInput {
    if (!goLiveAt) {
      return {};
    }

    return {
      posOrder: {
        is: {
          insertedAt: {
            gte: goLiveAt,
          },
        },
      },
    };
  }
}
