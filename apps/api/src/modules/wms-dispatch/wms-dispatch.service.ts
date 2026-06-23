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
import type { Request } from 'express';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GetWmsDispatchOutboundDto } from './dto/get-wms-dispatch-outbound.dto';
import { GetWmsDispatchReportsDto } from './dto/get-wms-dispatch-reports.dto';
import { GetWmsDispatchReturnsDto } from './dto/get-wms-dispatch-returns.dto';
import { GetWmsDispatchSummaryDto } from './dto/get-wms-dispatch-summary.dto';
import { ReconcileWmsDispatchOutboundDto } from './dto/reconcile-wms-dispatch-outbound.dto';
import { VoidWmsDispatchOutboundDto } from './dto/void-wms-dispatch-outbound.dto';
import { OrdersService } from '../orders/orders.service';
import { WmsFulfillmentOpsService } from '../wms-fulfillment/wms-fulfillment-ops.service';
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
  currentLocation: {
    id: string;
    code: string;
    name: string;
  } | null;
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

type DispatchOutboundLifecycleStatus =
  | 'PACKED'
  | 'PACKED_CANCELED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELED';

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
  awaitingPlacementUnits: number;
  placedUnits: number;
};

const DEFAULT_DISPATCH_PAGE_SIZE = 10;
const DEFAULT_DISPATCH_REPORT_WINDOW_DAYS = 14;
const RETURNED_EQUIVALENT_UNIT_STATUSES = new Set<WmsInventoryUnitStatus>([
  WmsInventoryUnitStatus.RTS,
  WmsInventoryUnitStatus.STAGED,
  WmsInventoryUnitStatus.PUTAWAY,
  WmsInventoryUnitStatus.DEADSTOCK,
  WmsInventoryUnitStatus.DAMAGED,
  WmsInventoryUnitStatus.LOST,
  WmsInventoryUnitStatus.ARCHIVED,
]);
const DISPATCH_RETURN_ACTIVITY_TYPES = [
  'ORDER_RTS_UNIT_VERIFY',
  'ORDER_RTS_DISPOSITION',
  'ORDER_RTS_COMPLETE',
] as const;
const DISPATCH_OUTBOUND_ACTIVITY_TYPES = [
  'PACKING_TRACKING_VERIFY',
  'PACKING_COMPLETE',
  'ORDER_DISPATCH_SYNC',
  'ORDER_DELIVERY_SYNC',
  'DISPATCH_VOID_COMPLETE',
  'DISPATCH_VOID_REPAIR_COMPLETE',
] as const;
const DISPATCH_REPORT_TREND_ACTIVITY_TYPES = [
  'PACKING_COMPLETE',
  'ORDER_DISPATCH_SYNC',
  'ORDER_DELIVERY_SYNC',
  'ORDER_RTS_COMPLETE',
] as const;
const DISPATCH_REPORT_ACTIVITY_TYPES = [
  ...DISPATCH_REPORT_TREND_ACTIVITY_TYPES,
  'DISPATCH_VOID_COMPLETE',
  'DISPATCH_VOID_REPAIR_COMPLETE',
  'ORDER_RTS_UNIT_VERIFY',
  'ORDER_RTS_DISPOSITION',
] as const;
const MANILA_TIME_ZONE = 'Asia/Manila';
const CONFIRMED_POS_ORDER_STATUS = 1;
const WAITING_FOR_PRINTING_POS_ORDER_STATUS = 12;

@Injectable()
export class WmsDispatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wmsInventoryService: WmsInventoryService,
    private readonly wmsFulfillmentOpsService: WmsFulfillmentOpsService,
    private readonly ordersService: OrdersService,
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
      await this.buildOutboundOrderScope(scope, query.status),
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
    const lifecycleStatus = this.resolveReturnLifecycleStatusFilter(query.status);
    const workflowStatus = this.resolveReturnWorkflowStatusFilter(query.status);
    const where = this.combineOrderWhere(
      await this.buildPackedOrderScope(scope),
      this.buildSearchWhere(query.search),
      this.buildReturnLifecycleWhere(lifecycleStatus),
    );

    if (workflowStatus) {
      const orders = await this.prisma.wmsFulfillmentOrder.findMany({
        where,
        select: this.dispatchListOrderSelect(),
        orderBy: [
          { updatedAt: 'desc' },
          { id: 'desc' },
        ],
      });
      const returnSummaries = await this.loadReturnSummaryCountsByOrder(orders);
      const filteredTasks = orders
        .map((order) => this.mapReturnListItem(order, returnSummaries))
        .filter((entry) => entry.returnSummary.state === workflowStatus);
      const pagedTasks = filteredTasks.slice((page - 1) * pageSize, page * pageSize);

      return {
        tenantReady: true,
        serverTime: new Date().toISOString(),
        pagination: {
          page,
          pageSize,
          total: filteredTasks.length,
          hasMore: page * pageSize < filteredTasks.length,
        },
        context: {
          activeTenantId: scope.activeTenantId,
          activeStoreId: scope.activeStore?.id ?? null,
        },
        tasks: pagedTasks,
      };
    }

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
      tasks: orders.map((order) => this.mapReturnListItem(order, returnSummaries)),
    };
  }

  async getOutboundTask(query: GetWmsDispatchSummaryDto, taskId: string) {
    const scope = await this.resolveScope(query);
    const order = await this.prisma.wmsFulfillmentOrder.findFirst({
      where: this.combineOrderWhere(
        await this.buildOutboundOrderScope(scope),
        this.buildOutboundLifecycleWhere(),
        { id: taskId },
      ),
      include: this.dispatchOrderInclude(),
    });

    if (!order) {
      throw new NotFoundException('Dispatch order not found in the active outbound scope');
    }

    const outboundActivities = await this.loadOutboundActivitiesByOrder([order.id]);

    return {
      tenantReady: true,
      serverTime: new Date().toISOString(),
      task: this.mapDispatchTask(order, {
        history: outboundActivities.get(order.id) ?? [],
      }),
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

    const [returnActivities, dispositionKeysByOrderId] = await Promise.all([
      this.loadReturnActivitiesByOrder([order.id]),
      this.loadSuccessfulReturnDispositionUnitKeysByOrder([order.id]),
    ]);

    return {
      tenantReady: true,
      serverTime: new Date().toISOString(),
      task: {
        task: this.mapDispatchTask(order),
        returnFlow: this.buildReturnFlow(
          order,
          returnActivities.get(order.id) ?? [],
          dispositionKeysByOrderId.get(order.id) ?? this.emptyDispositionUnitKeySets(),
        ),
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
    user: { userId?: string; id?: string; sessionId?: string | null } | null | undefined,
    body: ReconcileWmsDispatchOutboundDto,
    request?: Request,
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
            assignmentMode: true,
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

    const repairTargets = requestedTaskIds.length > 0
      ? targetOrders.filter((order) => order.assignmentMode === WmsFulfillmentAssignmentMode.BASKET_DEMAND)
      : await this.prisma.wmsFulfillmentOrder.findMany({
          where: this.combineOrderWhere(
            await this.buildPackedOrderScope(scope),
            {
              assignmentMode: WmsFulfillmentAssignmentMode.BASKET_DEMAND,
            },
          ),
          select: {
            id: true,
            posOrderId: true,
          },
          orderBy: [
            { updatedAt: 'desc' },
            { id: 'desc' },
          ],
        });
    const repairResults: Array<{
      outcome: 'repaired' | 'skipped';
      fulfillmentOrderId: string;
      posOrderId: string | null;
      previousStatus: string | null;
      nextStatus: string | null;
      reason: string | null;
      affectedBasketIds: string[];
    }> = [];

    for (const order of repairTargets) {
      const repairResult = await this.wmsFulfillmentOpsService.repairDemandOrderAfterStuckDispatchVoid(
        user ?? {},
        {
          fulfillmentOrderId: order.id,
        },
        request,
      );
      repairResults.push(repairResult);
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
      repair: {
        repaired: repairResults.filter((entry) => entry.outcome === 'repaired').length,
        skipped: repairResults.filter((entry) => entry.outcome === 'skipped').length,
        results: repairResults,
      },
      result,
    };
  }

  async voidOutboundTask(
    user: {
      userId?: string;
      id?: string;
      sessionId?: string | null;
      permissions?: string[];
      role?: string;
    } | null | undefined,
    taskId: string,
    body: VoidWmsDispatchOutboundDto,
    request?: Request,
  ) {
    const scope = await this.resolveScope(body);
    const reason = body.reason?.trim() ?? '';
    if (!reason) {
      throw new BadRequestException('Void reason is required');
    }

    const order = await this.prisma.wmsFulfillmentOrder.findFirst({
      where: this.combineOrderWhere(
        await this.buildOutboundOrderScope(scope),
        {
          OR: [
            this.buildOutboundLifecycleWhere('PACKED'),
            this.buildOutboundLifecycleWhere('PACKED_CANCELED'),
          ],
        },
        { id: taskId },
      ),
      select: {
        id: true,
        tenantId: true,
        storeId: true,
        shopId: true,
        posOrderId: true,
        posOrderDbId: true,
        assignmentMode: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Packed dispatch order not found in the active outbound scope');
    }

    if (order.assignmentMode !== WmsFulfillmentAssignmentMode.BASKET_DEMAND) {
      throw new BadRequestException('Dispatch void is currently available only for basket-demand packed orders');
    }

    const releaseResult = await this.wmsFulfillmentOpsService.releaseDemandOrderForDispatchVoid(
      user ?? {},
      {
        fulfillmentOrderId: order.id,
        reason,
      },
      request,
    );

    const posStatusUpdate = releaseResult.resolution === 'RETURNED_TO_PICKING'
      ? await this.enqueueVoidedDispatchOrdersConfirmedStatus([
          {
            tenantId: releaseResult.tenantId,
            storeId: releaseResult.storeId,
            posOrderDbId: releaseResult.posOrderDbId,
            shopId: releaseResult.shopId,
            posOrderId: releaseResult.posOrderId,
            warehouseId: releaseResult.warehouseId,
          },
        ])
      : {
          targetStatus: CONFIRMED_POS_ORDER_STATUS,
          queued: 0,
          skipped: 0,
          failed: 0,
          results: [],
        };

    return {
      success: true,
      taskId: releaseResult.fulfillmentOrderId,
      posOrderId: releaseResult.posOrderId,
      resolution: releaseResult.resolution,
      restoredPackedUnits: releaseResult.restoredPackedUnits,
      affectedBasketIds: releaseResult.affectedBasketIds,
      posStatusUpdate,
    };
  }

  private async enqueueVoidedDispatchOrdersConfirmedStatus(
    orders: Array<{
      tenantId: string;
      storeId: string;
      posOrderDbId: string;
      shopId: string;
      posOrderId: string;
      warehouseId: string | null;
    }>,
  ) {
    const summary = {
      targetStatus: CONFIRMED_POS_ORDER_STATUS,
      queued: 0,
      skipped: 0,
      failed: 0,
      results: [] as Array<{
        posOrderId: string;
        outcome: 'queued' | 'skipped' | 'failed';
        reason: string;
        currentStatus?: number | null;
      }>,
    };

    if (orders.length === 0) {
      return summary;
    }

    const results = await Promise.all(orders.map(async (order) => {
      try {
        const result = await this.ordersService.enqueueSystemPosOrderStatusUpdate({
          tenantId: order.tenantId,
          orderRowId: order.posOrderDbId,
          shopId: order.shopId,
          posOrderId: order.posOrderId,
          targetStatus: CONFIRMED_POS_ORDER_STATUS,
          allowedCurrentStatuses: [WAITING_FOR_PRINTING_POS_ORDER_STATUS],
          source: 'wms_picking',
        });

        if (result.skipped) {
          return {
            posOrderId: order.posOrderId,
            outcome: 'skipped' as const,
            reason: result.reason,
            currentStatus: result.currentStatus,
          };
        }

        return {
          posOrderId: order.posOrderId,
          outcome: 'queued' as const,
          reason: result.reason,
          currentStatus: result.currentStatus,
        };
      } catch (error) {
        return {
          posOrderId: order.posOrderId,
          outcome: 'failed' as const,
          reason: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
        };
      }
    }));

    for (const result of results) {
      summary.results.push(result);
      if (result.outcome === 'queued') {
        summary.queued += 1;
      } else if (result.outcome === 'skipped') {
        summary.skipped += 1;
      } else {
        summary.failed += 1;
      }
    }

    return summary;
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

  private async buildOutboundOrderScope(
    scope: DispatchScope,
    status?: DispatchOutboundLifecycleStatus,
  ): Promise<Prisma.WmsFulfillmentOrderWhereInput> {
    const allowedStatuses = status === 'CANCELED'
      ? [WmsFulfillmentOrderStatus.CANCELED]
      : status
        ? [WmsFulfillmentOrderStatus.PACKED]
        : [WmsFulfillmentOrderStatus.PACKED, WmsFulfillmentOrderStatus.CANCELED];
    const baseScope: Prisma.WmsFulfillmentOrderWhereInput = {
      status: {
        in: allowedStatuses,
      },
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
    status?: DispatchOutboundLifecycleStatus,
  ): Prisma.WmsFulfillmentOrderWhereInput {
    if (!status) {
      return {
        OR: [
          this.buildOutboundLifecycleWhere('PACKED'),
          this.buildOutboundLifecycleWhere('PACKED_CANCELED'),
          this.buildOutboundLifecycleWhere('SHIPPED'),
          this.buildOutboundLifecycleWhere('DELIVERED'),
          this.buildOutboundLifecycleWhere('CANCELED'),
        ],
      };
    }

    if (status === 'SHIPPED') {
      return {
        status: WmsFulfillmentOrderStatus.PACKED,
        posOrder: {
          is: {
            status: 2,
          },
        },
      };
    }

    if (status === 'DELIVERED') {
      return {
        status: WmsFulfillmentOrderStatus.PACKED,
        posOrder: {
          is: {
            status: 3,
          },
        },
      };
    }

    if (status === 'PACKED_CANCELED') {
      return {
        status: WmsFulfillmentOrderStatus.PACKED,
        posOrder: {
          is: {
            status: 6,
          },
        },
      };
    }

    if (status === 'CANCELED') {
      return {
        status: WmsFulfillmentOrderStatus.CANCELED,
      };
    }

    if (status === 'PACKED') {
      return {
        status: WmsFulfillmentOrderStatus.PACKED,
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
                  notIn: [2, 3, 4, 5, 6],
                },
              },
            },
          },
        ],
      };
    }

    return {};
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

  private resolveReturnLifecycleStatusFilter(
    status?: GetWmsDispatchReturnsDto['status'],
  ): 'RETURNING' | 'RETURNED' | undefined {
    if (status === 'RETURNING') {
      return 'RETURNING';
    }

    if (
      status === 'RETURNED'
      || status === 'READY_TO_VERIFY'
      || status === 'AWAITING_PLACEMENT'
      || status === 'PARTIAL'
      || status === 'VERIFIED'
    ) {
      return 'RETURNED';
    }

    return undefined;
  }

  private resolveReturnWorkflowStatusFilter(
    status?: GetWmsDispatchReturnsDto['status'],
  ): 'READY_TO_VERIFY' | 'AWAITING_PLACEMENT' | 'PARTIAL' | 'VERIFIED' | undefined {
    if (status === 'RETURNED') {
      return 'READY_TO_VERIFY';
    }

    if (
      status === 'READY_TO_VERIFY'
      || status === 'AWAITING_PLACEMENT'
      || status === 'PARTIAL'
      || status === 'VERIFIED'
    ) {
      return status;
    }

    return undefined;
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
      rtsDisposedAt: true,
      rtsDisposedBy: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
        },
      },
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
      rtsDisposedBy: {
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
          isVoid: true,
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
              currentLocation: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
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
                  currentLocation: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                    },
                  },
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

    const orderIds = orders.map((order) => order.id);
    const demandOrderIds = orders
      .filter((order) => order.assignmentMode === WmsFulfillmentAssignmentMode.BASKET_DEMAND)
      .map((order) => order.id);
    const legacyOrderIds = orders
      .filter((order) => order.assignmentMode !== WmsFulfillmentAssignmentMode.BASKET_DEMAND)
      .map((order) => order.id);

    const [basketUnits, reservations, dispositionKeysByOrderId] = await Promise.all([
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
      this.loadSuccessfulReturnDispositionUnitKeysByOrder(orderIds),
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
        awaitingPlacementUnits: 0,
        placedUnits: 0,
      };
      const historicallyDisposedUnits = dispositionKeysByOrderId.get(basketUnit.fulfillmentOrderId) ?? this.emptyDispositionUnitKeySets();
      const isHistoricallyDisposed = this.isHistoricallyDisposedReturnUnit(
        basketUnit.inventoryUnit,
        historicallyDisposedUnits,
      );
      current.expectedUnits += 1;
      if (RETURNED_EQUIVALENT_UNIT_STATUSES.has(basketUnit.inventoryUnit.status) || isHistoricallyDisposed) {
        current.verifiedUnits += 1;
        if (this.isAwaitingReturnPlacementStatus(basketUnit.inventoryUnit.status)) {
          current.awaitingPlacementUnits += 1;
        } else {
          current.placedUnits += 1;
        }
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
        awaitingPlacementUnits: 0,
        placedUnits: 0,
      };
      const historicallyDisposedUnits = dispositionKeysByOrderId.get(reservation.fulfillmentOrderId) ?? this.emptyDispositionUnitKeySets();
      const isHistoricallyDisposed = this.isHistoricallyDisposedReturnUnit(
        reservation.inventoryUnit,
        historicallyDisposedUnits,
      );
      current.expectedUnits += 1;
      if (RETURNED_EQUIVALENT_UNIT_STATUSES.has(reservation.inventoryUnit.status) || isHistoricallyDisposed) {
        current.verifiedUnits += 1;
        if (this.isAwaitingReturnPlacementStatus(reservation.inventoryUnit.status)) {
          current.awaitingPlacementUnits += 1;
        } else {
          current.placedUnits += 1;
        }
      }
      summaryByOrderId.set(reservation.fulfillmentOrderId, current);
    }

    for (const [orderId, current] of summaryByOrderId.entries()) {
      current.pendingUnits = Math.max(current.expectedUnits - current.verifiedUnits, 0);
      summaryByOrderId.set(orderId, current);
    }

    return summaryByOrderId;
  }

  private mapDispatchTask(
    order: any,
    options?: {
      history?: DispatchHistoryEntry[];
    },
  ) {
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
      voidControl: this.buildDispatchVoidControl(order),
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
      history: options?.history ?? [],
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

  private emptyReturnSummaryCounts(): DispatchReturnSummaryCounts {
    return {
      expectedUnits: 0,
      verifiedUnits: 0,
      pendingUnits: 0,
      awaitingPlacementUnits: 0,
      placedUnits: 0,
    };
  }

  private mapReturnListItem(
    order: any,
    returnSummaries: Map<string, DispatchReturnSummaryCounts>,
  ) {
    return {
      task: this.mapDispatchTaskListItem(order),
      returnSummary: this.buildReturnSummary(
        order,
        returnSummaries.get(order.id) ?? this.emptyReturnSummaryCounts(),
      ),
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

    if (order.status === WmsFulfillmentOrderStatus.CANCELED) {
      return {
        posStatus,
        status: 'CANCELED' as const,
        label: 'Cancelled',
        deliveredAt: order.posOrder?.deliveredAt ?? null,
        rtsAt: order.posOrder?.rtsAt ?? null,
      };
    }

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

    if (posStatus === 6) {
      return {
        posStatus,
        status: 'PACKED_CANCELED' as const,
        label: 'Packed cancelled',
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

  private async loadOutboundActivitiesByOrder(orderIds: string[]) {
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
          in: [...DISPATCH_OUTBOUND_ACTIVITY_TYPES],
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

      existing.push(this.mapOutboundHistoryEntry(row));
      historyByOrderId.set(row.resourceId, existing);
    }

    return historyByOrderId;
  }

  private buildReturnFlow(
    order: any,
    history: DispatchHistoryEntry[],
    historicallyDisposedUnits: { unitIds: Set<string>; unitCodes: Set<string> },
  ) {
    const posStatus = typeof order.posOrder?.status === 'number' ? order.posOrder.status : null;
    const posStatusLabel = this.cleanOptionalText(order.posOrder?.statusName ?? null);
    const trackedUnits = this.getTrackedReturnUnits(order);
    const verifiedUnits = trackedUnits.filter((unit) => (
      RETURNED_EQUIVALENT_UNIT_STATUSES.has(unit.status as WmsInventoryUnitStatus)
      || this.isHistoricallyDisposedReturnUnit(unit, historicallyDisposedUnits)
    ));
    const pendingUnits = trackedUnits.filter((unit) => (
      !RETURNED_EQUIVALENT_UNIT_STATUSES.has(unit.status as WmsInventoryUnitStatus)
      && !this.isHistoricallyDisposedReturnUnit(unit, historicallyDisposedUnits)
    ));
    const awaitingPlacementUnits = verifiedUnits.filter(
      (unit) => this.isAwaitingReturnPlacementStatus(unit.status as WmsInventoryUnitStatus),
    );
    const placedUnits = verifiedUnits.filter(
      (unit) => !this.isAwaitingReturnPlacementStatus(unit.status as WmsInventoryUnitStatus),
    );
    const latestActivity = history[0] ?? null;
    const latestVerification = history.find((entry) => entry.actionType === 'ORDER_RTS_UNIT_VERIFY') ?? null;
    const returnProgress = this.resolveReturnProgressState({
      posStatus,
      expectedUnits: trackedUnits.length,
      verifiedUnits: verifiedUnits.length,
      awaitingPlacementUnits: awaitingPlacementUnits.length,
    });
    const isCompleted = trackedUnits.length > 0
      && pendingUnits.length === 0
      && awaitingPlacementUnits.length === 0;

    return {
      eligible: posStatus === 4 || posStatus === 5,
      posStatus,
      posStatusLabel: posStatusLabel ?? (posStatus === 4 ? 'Returning' : posStatus === 5 ? 'Returned' : null),
      state: returnProgress.state,
      label: returnProgress.label,
      canVerify: posStatus === 5 && pendingUnits.length > 0,
      expectedUnits: trackedUnits.length,
      awaitingPlacementUnits: awaitingPlacementUnits.length,
      placedUnits: placedUnits.length,
      verifiedUnits: verifiedUnits.map((unit) => this.mapReturnUnit(unit)),
      pendingUnits: pendingUnits.map((unit) => this.mapReturnUnit(unit)),
      history,
      lastActionAt: latestActivity?.createdAt ?? null,
      lastActionBy: latestActivity?.actor ?? null,
      disposedAt: isCompleted ? (order.rtsDisposedAt ?? null) : null,
      disposedBy: isCompleted && order.rtsDisposedBy
        ? this.mapActor(order.rtsDisposedBy)
        : null,
      lastVerifiedAt: latestVerification?.createdAt ?? null,
      lastVerifiedBy: latestVerification?.actor ?? null,
    };
  }

  private buildDispatchVoidControl(order: any) {
    if (order.assignmentMode !== WmsFulfillmentAssignmentMode.BASKET_DEMAND) {
      return {
        eligible: false,
        reason: 'Only basket-demand packed orders can be voided from Dispatch.',
      };
    }

    if (order.status === WmsFulfillmentOrderStatus.CANCELED) {
      return {
        eligible: false,
        reason: 'This dispatch order is already cancelled in WMS.',
      };
    }

    const delivery = this.mapDelivery(order);
    if (order.posOrder?.isVoid && delivery?.status !== 'PACKED_CANCELED') {
      return {
        eligible: false,
        reason: 'This order is already voided in POS and can no longer be reopened from Dispatch.',
      };
    }

    if (delivery?.status !== 'PACKED' && delivery?.status !== 'PACKED_CANCELED') {
      return {
        eligible: false,
        reason: 'Only orders still in Packed or Packed cancelled stage can be voided from Dispatch.',
      };
    }

    const packedBasketUnits = (Array.isArray(order?.basketUnits) ? order.basketUnits : []).filter(
      (basketUnit: any) => (
        this.isHistoricallyPackedDemandBasketUnit(basketUnit)
        && basketUnit.fulfillmentOrderId === order.id
        && basketUnit.inventoryUnit
      ),
    );

    if (packedBasketUnits.length === 0) {
      return {
        eligible: false,
        reason: 'No packed unit history is available to restore for this order.',
      };
    }

    const changedUnit = packedBasketUnits.find(
      (basketUnit: any) => basketUnit.inventoryUnit?.status !== WmsInventoryUnitStatus.PACKED,
    );
    if (changedUnit) {
      return {
        eligible: false,
        reason: 'Historical packed units already returned to inventory. Use Repair order sync to reopen this order.',
      };
    }

    return {
      eligible: true,
      reason: null,
    };
  }

  private buildReturnSummary(
    order: any,
    counts: DispatchReturnSummaryCounts,
  ) {
    const posStatus = typeof order.posOrder?.status === 'number' ? order.posOrder.status : null;
    const posStatusLabel = this.cleanOptionalText(order.posOrder?.statusName ?? null);
    const returnProgress = this.resolveReturnProgressState({
      posStatus,
      expectedUnits: counts.expectedUnits,
      verifiedUnits: counts.verifiedUnits,
      awaitingPlacementUnits: counts.awaitingPlacementUnits,
    });
    const isCompleted = counts.expectedUnits > 0
      && counts.pendingUnits === 0
      && counts.awaitingPlacementUnits === 0;

    return {
      posStatus,
      posStatusLabel: posStatusLabel ?? (posStatus === 4 ? 'Returning' : posStatus === 5 ? 'Returned' : null),
      state: returnProgress.state,
      label: returnProgress.label,
      expectedUnits: counts.expectedUnits,
      verifiedUnits: counts.verifiedUnits,
      pendingUnits: counts.pendingUnits,
      awaitingPlacementUnits: counts.awaitingPlacementUnits,
      placedUnits: counts.placedUnits,
      disposedAt: isCompleted ? (order.rtsDisposedAt ?? null) : null,
      disposedBy: isCompleted && order.rtsDisposedBy
        ? this.mapActor(order.rtsDisposedBy)
        : null,
    };
  }

  private async loadSuccessfulReturnDispositionUnitKeysByOrder(orderIds: string[]) {
    if (orderIds.length === 0) {
      return new Map<string, { unitIds: Set<string>; unitCodes: Set<string> }>();
    }

    const rows = await this.prisma.wmsStaffActivity.findMany({
      where: {
        resourceType: 'WMS_FULFILLMENT_ORDER',
        resourceId: {
          in: orderIds,
        },
        actionType: 'ORDER_RTS_DISPOSITION',
        outcome: WmsStaffActivityOutcome.SUCCESS,
      },
      select: {
        resourceId: true,
        metadata: true,
      },
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
    });

    const dispositionKeysByOrderId = new Map<string, { unitIds: Set<string>; unitCodes: Set<string> }>();

    for (const row of rows) {
      if (!row.resourceId) {
        continue;
      }

      const existing = dispositionKeysByOrderId.get(row.resourceId) ?? this.emptyDispositionUnitKeySets();
      const metadata = this.readActivityMetadata(row.metadata);
      const unitId = this.readActivityMetadataString(metadata, 'unitId');
      const unitCode = this.readActivityMetadataString(metadata, 'unitCode');

      if (unitId) {
        existing.unitIds.add(unitId);
      }

      if (unitCode) {
        existing.unitCodes.add(unitCode);
      }

      dispositionKeysByOrderId.set(row.resourceId, existing);
    }

    return dispositionKeysByOrderId;
  }

  private emptyDispositionUnitKeySets() {
    return {
      unitIds: new Set<string>(),
      unitCodes: new Set<string>(),
    };
  }

  private isHistoricallyDisposedReturnUnit(
    unit: { id?: string | null; code?: string | null; status?: string | WmsInventoryUnitStatus | null } | null | undefined,
    historicallyDisposedUnits: { unitIds: Set<string>; unitCodes: Set<string> },
  ) {
    if (!unit || unit.status === WmsInventoryUnitStatus.RTS) {
      return false;
    }

    return (unit.id ? historicallyDisposedUnits.unitIds.has(unit.id) : false)
      || (unit.code ? historicallyDisposedUnits.unitCodes.has(unit.code) : false);
  }

  private resolveReturnProgressState(params: {
    posStatus: number | null;
    expectedUnits: number;
    verifiedUnits: number;
    awaitingPlacementUnits: number;
  }) {
    const { posStatus, expectedUnits, verifiedUnits, awaitingPlacementUnits } = params;

    let state: 'NONE' | 'RETURNING' | 'READY_TO_VERIFY' | 'PARTIAL' | 'VERIFIED' | 'AWAITING_PLACEMENT' = 'NONE';
    let label: string | null = null;

    if (posStatus === 4) {
      state = 'RETURNING';
      label = 'Returning';
    } else if (posStatus === 5) {
      if (awaitingPlacementUnits > 0) {
        state = 'AWAITING_PLACEMENT';
        label = 'Awaiting placement';
      } else if (expectedUnits > 0 && verifiedUnits >= expectedUnits) {
        state = 'VERIFIED';
        label = 'Processed';
      } else if (verifiedUnits > 0) {
        state = 'PARTIAL';
        label = 'Processed';
      } else {
        state = 'READY_TO_VERIFY';
        label = 'Returned';
      }
    }

    return {
      state,
      label,
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
          currentLocation: basketUnit.inventoryUnit.currentLocation
            ? {
                id: basketUnit.inventoryUnit.currentLocation.id,
                code: basketUnit.inventoryUnit.currentLocation.code,
                name: basketUnit.inventoryUnit.currentLocation.name,
              }
            : null,
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
        currentLocation: reservation.inventoryUnit.currentLocation
          ? {
              id: reservation.inventoryUnit.currentLocation.id,
              code: reservation.inventoryUnit.currentLocation.code,
              name: reservation.inventoryUnit.currentLocation.name,
            }
          : null,
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
    currentLocation: {
      id: string;
      code: string;
      name: string;
    } | null;
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
    currentLocation: {
      id: string;
      code: string;
      name: string;
    } | null;
  }): DispatchReturnUnit {
    return {
      id: unit.id,
      code: unit.code,
      barcode: unit.barcode,
      status: unit.status,
      statusLabel: this.formatEnumLabel(unit.status),
      name: unit.name,
      customId: unit.customId,
      currentLocation: unit.currentLocation,
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
    const targetCode = this.cleanOptionalText(this.readActivityMetadataString(metadata, 'targetCode'));
    const dispositionAction = this.cleanOptionalText(this.readActivityMetadataString(metadata, 'dispositionAction'));
    const detailParts: string[] = [];
    let label = this.formatEnumLabel(activity.actionType);

    if (activity.actionType === 'ORDER_RTS_UNIT_VERIFY') {
      label = 'Verified returned unit';
      if (unitCode) {
        detailParts.push(unitCode);
      }
    }

    if (activity.actionType === 'ORDER_RTS_DISPOSITION') {
      label = 'Applied RTS disposition';
      if (unitCode) {
        detailParts.push(unitCode);
      }
      if (dispositionAction) {
        detailParts.push(this.formatEnumLabel(dispositionAction));
      }
      if (targetCode) {
        detailParts.push(`Moved to ${targetCode}`);
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

  private mapOutboundHistoryEntry(activity: {
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
    const posOrderId = this.cleanOptionalText(this.readActivityMetadataString(metadata, 'posOrderId'));
    const trackingCode = this.cleanOptionalText(this.readActivityMetadataString(metadata, 'trackingCode'));
    const basketCode = this.cleanOptionalText(this.readActivityMetadataString(metadata, 'basketCode'));
    const restoredPackedUnits = this.readActivityMetadataNumber(metadata, 'restoredPackedUnits');
    const unitCount = this.readActivityMetadataNumber(metadata, 'unitCount');
    const reason = this.cleanOptionalText(this.readActivityMetadataString(metadata, 'reason'));
    const detailParts: string[] = [];
    let label = this.formatEnumLabel(activity.actionType);

    if (activity.actionType === 'PACKING_TRACKING_VERIFY') {
      label = 'Verified waybill';
    } else if (activity.actionType === 'PACKING_COMPLETE') {
      label = 'Packed order';
    } else if (activity.actionType === 'ORDER_DISPATCH_SYNC') {
      label = 'Synced shipped order';
    } else if (activity.actionType === 'ORDER_DELIVERY_SYNC') {
      label = 'Synced delivered order';
    } else if (activity.actionType === 'DISPATCH_VOID_COMPLETE') {
      label = 'Voided packed order';
    } else if (activity.actionType === 'DISPATCH_VOID_REPAIR_COMPLETE') {
      label = 'Reopened packed order';
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
    if (typeof restoredPackedUnits === 'number' && restoredPackedUnits > 0) {
      detailParts.push(`${restoredPackedUnits} unit${restoredPackedUnits === 1 ? '' : 's'} restored`);
    } else if (typeof unitCount === 'number' && unitCount > 0) {
      detailParts.push(`${unitCount} unit${unitCount === 1 ? '' : 's'}`);
    }
    const nextStatus = this.cleanOptionalText(this.readActivityMetadataString(metadata, 'nextStatus'));
    if (nextStatus) {
      detailParts.push(`Next ${this.formatEnumLabel(nextStatus)}`);
    }
    if (reason) {
      detailParts.push(reason);
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

  private isAwaitingReturnPlacementStatus(status: WmsInventoryUnitStatus | string | null | undefined) {
    return status === WmsInventoryUnitStatus.RTS;
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
    } else if (activity.actionType === 'DISPATCH_VOID_COMPLETE') {
      label = 'Voided packed order';
    } else if (activity.actionType === 'DISPATCH_VOID_REPAIR_COMPLETE') {
      label = 'Reopened packed order';
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
