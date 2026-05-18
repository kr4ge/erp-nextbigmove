import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  IntegrationStatus,
  Prisma,
  UserStatus,
  WmsBasketStatus,
  WmsStaffAssignmentTaskType,
  TenantStatus,
  WmsFulfillmentLineStatus,
  WmsFulfillmentOrderStatus,
  WmsInventoryMovementType,
  WmsInventoryUnitStatus,
  WmsLocationKind,
  WmsPickReservationStatus,
  WmsReceivingBatchStatus,
  WmsTransferStatus,
  WmsWarehouseStatus,
} from '@prisma/client';
import type { Request } from 'express';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EffectiveAccessService } from '../../common/services/effective-access.service';
import { WmsStaffActivityService } from '../../common/services/wms-staff-activity.service';
import {
  GetWmsMobileStockDto,
  type WmsMobileStockMode,
} from './dto/get-wms-mobile-stock.dto';
import {
  GetWmsMobileStockScanDto,
  GetWmsMobileStockScopedDto,
  WmsMobileStockMoveDto,
} from './dto/wms-mobile-stock-execution.dto';
import {
  GetWmsMobilePickBasketLookupDto,
  GetWmsMobilePickingTasksDto,
  WmsMobilePickHandoffDto,
  WmsMobilePickScanDto,
  WmsMobilePickScopedDto,
} from './dto/wms-mobile-picking.dto';

type BootstrapUser = {
  userId?: string;
  id?: string;
  email?: string;
  tenantId?: string | null;
  role?: string;
  permissions?: string[];
  firstName?: string | null;
  lastName?: string | null;
  avatar?: string | null;
  employeeId?: string | null;
  defaultTeamId?: string | null;
  sessionId?: string | null;
};

type MobileTenantOption = {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
};

const STOCK_PUTAWAY_BATCH_STATUSES = [
  WmsReceivingBatchStatus.STAGED,
  WmsReceivingBatchStatus.PUTAWAY_PENDING,
] as const;

const STOCK_TRANSFERABLE_UNIT_STATUSES = [
  WmsInventoryUnitStatus.RECEIVED,
  WmsInventoryUnitStatus.STAGED,
  WmsInventoryUnitStatus.PUTAWAY,
  WmsInventoryUnitStatus.RTS,
  WmsInventoryUnitStatus.DAMAGED,
] as const;

const DEFAULT_STOCK_PAGE_SIZE = 12;
const MOBILE_PUTAWAY_SOURCE_STATUSES = new Set<WmsInventoryUnitStatus>([
  WmsInventoryUnitStatus.RECEIVED,
  WmsInventoryUnitStatus.STAGED,
]);
const MOBILE_MOVE_DESTINATION_KINDS = new Set<WmsLocationKind>([
  WmsLocationKind.BIN,
  WmsLocationKind.RECEIVING_STAGING,
  WmsLocationKind.PACKING,
  WmsLocationKind.DISPATCH_STAGING,
  WmsLocationKind.RTS,
  WmsLocationKind.DAMAGE,
  WmsLocationKind.QUARANTINE,
]);

const DEFAULT_PICKING_PAGE_SIZE = 10;
const CONFIRMED_POS_ORDER_STATUS = 1;
const PICKING_SYNC_ORDER_LIMIT = 80;
const ACTIVE_PICKING_ORDER_STATUSES = [
  WmsFulfillmentOrderStatus.READY,
  WmsFulfillmentOrderStatus.PARTIAL,
  WmsFulfillmentOrderStatus.RESTOCKING,
  WmsFulfillmentOrderStatus.ISSUE,
  WmsFulfillmentOrderStatus.IN_PICKING,
] as const;
const ACTIVE_PICK_RESERVATION_STATUSES = [
  WmsPickReservationStatus.RESERVED,
  WmsPickReservationStatus.PICKED,
] as const;
const ACTIVE_PICK_BASKET_STATUSES = [
  WmsBasketStatus.ASSIGNED,
  WmsBasketStatus.IN_PICKING,
  WmsBasketStatus.FULL_HELD,
] as const;
const PICKER_ACTIVE_BASKET_STATUSES = [
  WmsBasketStatus.ASSIGNED,
  WmsBasketStatus.IN_PICKING,
] as const;
const BLOCKED_PICK_BASKET_STATUSES = [
  WmsBasketStatus.DAMAGED,
  WmsBasketStatus.RETIRED,
] as const;
const PICK_ASSIGNMENT_PERMISSIONS = [
  'wms.fulfillment.write',
  'wms.fulfillment.edit',
  'wms.fulfillment.override',
] as const;
const PICK_SUPERVISOR_PERMISSIONS = [
  'wms.fulfillment.override',
] as const;
const PACK_HANDOFF_PERMISSIONS = [
  'wms.dispatch.write',
  'wms.dispatch.edit',
  'wms.dispatch.override',
] as const;

type FulfillmentLineDraft = {
  variationId: string;
  productId: string | null;
  productName: string;
  productDisplayId: string | null;
  quantityRequired: number;
  lineSnapshot: Prisma.InputJsonValue;
};

@Injectable()
export class WmsMobileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    private readonly effectiveAccessService: EffectiveAccessService,
    private readonly wmsStaffActivityService: WmsStaffActivityService,
  ) {}

  async getBootstrap(user: BootstrapUser, request?: Request) {
    const userId = user.userId || user.id || null;
    const sessionId = (this.cls.get('sessionId') as string | undefined) || user.sessionId || null;
    const tenantContext = await this.resolveMobileTenantContext(user, request, {
      allowMissingPlatformTenant: true,
    });
    const tenantId = tenantContext.tenantId;

    if (!userId) {
      return this.buildTenantSelectionBootstrap(user, userId, sessionId, tenantContext.tenantOptions);
    }

    if (!tenantId) {
      if (user.role === 'SUPER_ADMIN') {
        return this.buildPlatformBootstrap(user, userId, sessionId, tenantContext.tenantOptions);
      }

      return this.buildGlobalWmsBootstrap(user, userId, sessionId, tenantContext.tenantOptions, request);
    }

    const [tenant, access, taskAssignment, teamMemberships, stores, warehouses] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
        },
      }),
      this.effectiveAccessService.resolveUserAccess({
        userId,
        tenantId,
        basePermissions: Array.isArray(user.permissions) ? user.permissions : [],
        workspace: 'wms',
      }),
      this.getWmsTaskAssignment(userId),
      this.effectiveAccessService.getActiveTeamMemberships(userId, tenantId),
      this.prisma.posStore.findMany({
        where: {
          tenantId,
          status: IntegrationStatus.ACTIVE,
        },
        select: {
          id: true,
          name: true,
          shopId: true,
          shopName: true,
          teamId: true,
        },
        orderBy: [{ name: 'asc' }],
      }),
      this.prisma.wmsWarehouse.findMany({
        where: {
          status: WmsWarehouseStatus.ACTIVE,
        },
        select: {
          id: true,
          code: true,
          name: true,
          status: true,
        },
        orderBy: [{ name: 'asc' }],
      }),
    ]);

    const defaultTeamId =
      user.defaultTeamId
      || teamMemberships.find((membership) => membership.isDefault)?.teamId
      || teamMemberships[0]?.teamId
      || null;
    const defaultStoreId = stores[0]?.id ?? null;
    const defaultWarehouseId = warehouses[0]?.id ?? null;

    if (user.role !== 'SUPER_ADMIN' && !access.permissions.some((permission) => permission.startsWith('wms.'))) {
      throw new ForbiddenException('This account has no WMS access');
    }

    await this.wmsStaffActivityService.recordFromRequest({
      request,
      tenantId,
      actorId: userId,
      teamId: defaultTeamId,
      sessionId,
      actionType: 'BOOTSTRAP',
      resourceType: 'STOX_APP',
      resourceId: 'phase-1',
      metadata: {
        teamCount: teamMemberships.length,
        storeCount: stores.length,
        warehouseCount: warehouses.length,
      },
    });

    return {
      tenantReady: true,
      app: {
        key: 'stox',
        phase: 1,
        mode: process.env.NODE_ENV || 'development',
      },
      session: {
        sessionId,
      },
      user: {
        id: userId,
        email: user.email ?? null,
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
        avatar: user.avatar ?? null,
        employeeId: user.employeeId ?? null,
        role: user.role ?? null,
      },
      tenant: tenant
        ? {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            status: tenant.status,
          }
        : null,
      access: {
        permissions: access.permissions,
        roles: access.roles.map((role) => ({
          id: role.id,
          key: role.key,
          name: role.name,
          scope: role.scope,
          workspace: role.workspace,
          teamId: role.teamId,
        })),
      },
      operations: {
        taskAssignment: taskAssignment,
      },
      context: {
        tenantOptions: tenantContext.tenantOptions,
        defaultTeamId,
        defaultStoreId,
        defaultWarehouseId,
        teams: teamMemberships.map((membership) => ({
          id: membership.teamId,
          name: membership.teamName,
          code: membership.teamCode,
          isDefault: membership.isDefault,
          role: membership.role,
        })),
        stores: stores.map((store) => ({
          id: store.id,
          name: store.name,
          shopId: store.shopId,
          shopName: store.shopName,
          teamId: store.teamId,
        })),
        warehouses: warehouses.map((warehouse) => ({
          id: warehouse.id,
          code: warehouse.code,
          name: warehouse.name,
          status: warehouse.status,
        })),
      },
      readiness: {
        teams: teamMemberships.length,
        stores: stores.length,
        warehouses: warehouses.length,
      },
    };
  }

  async getStock(user: BootstrapUser, query: GetWmsMobileStockDto, request?: Request) {
    const userId = user.userId || user.id || null;
    const tenantContext = await this.resolveMobileStockContext(user, query, request);
    const tenantId = tenantContext.tenantId;
    const sessionId = (this.cls.get('sessionId') as string | undefined) || user.sessionId || null;

    if (!userId) {
      return this.buildEmptyStockResponse(false);
    }

    const activeMode = query.mode ?? 'putaway';
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_STOCK_PAGE_SIZE;
    const skip = (page - 1) * pageSize;

    const storeWhere: Prisma.PosStoreWhereInput = {
      ...(tenantId ? { tenantId } : {}),
      status: IntegrationStatus.ACTIVE,
    };

    const [stores, warehouses] = await Promise.all([
      this.prisma.posStore.findMany({
        where: storeWhere,
        select: {
          id: true,
          tenantId: true,
          name: true,
          shopName: true,
          teamId: true,
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
        orderBy: [{ name: 'asc' }],
      }),
      this.prisma.wmsWarehouse.findMany({
        where: {
          status: WmsWarehouseStatus.ACTIVE,
        },
        select: {
          id: true,
          code: true,
          name: true,
        },
        orderBy: [{ code: 'asc' }],
      }),
    ]);

    const activeStore = query.storeId
      ? stores.find((store) => store.id === query.storeId) ?? null
      : null;
    const activeWarehouse = query.warehouseId
      ? warehouses.find((warehouse) => warehouse.id === query.warehouseId) ?? null
      : null;
    const activeStoreId = activeStore?.id ?? null;
    const activeWarehouseId = activeWarehouse?.id ?? null;

    const unitScope: Prisma.WmsInventoryUnitWhereInput = {
      ...(tenantId ? { tenantId } : {}),
      ...(activeStoreId ? { storeId: activeStoreId } : {}),
      ...(activeWarehouseId ? { warehouseId: activeWarehouseId } : {}),
    };
    const receivingScope: Prisma.WmsReceivingBatchWhereInput = {
      ...(tenantId ? { tenantId } : {}),
      ...(activeStoreId ? { storeId: activeStoreId } : {}),
      ...(activeWarehouseId ? { warehouseId: activeWarehouseId } : {}),
    };
    const transferScope: Prisma.WmsTransferWhereInput = {
      ...(tenantId ? { tenantId } : {}),
      ...(activeWarehouseId ? { warehouseId: activeWarehouseId } : {}),
    };
    const binScope: Prisma.WmsLocationWhereInput = {
      isActive: true,
      kind: WmsLocationKind.BIN,
      ...(activeWarehouseId ? { warehouseId: activeWarehouseId } : {}),
    };

    const [
      totalUnits,
      locatedUnits,
      stagedUnits,
      movableUnitCount,
      putawayBatchCount,
      transferCount,
      binCount,
      putawayQueue,
      movableUnits,
      recentTransfers,
      bins,
    ] = await Promise.all([
      this.prisma.wmsInventoryUnit.count({
        where: unitScope,
      }),
      this.prisma.wmsInventoryUnit.count({
        where: {
          ...unitScope,
          currentLocationId: {
            not: null,
          },
        },
      }),
      this.prisma.wmsInventoryUnit.count({
        where: {
          ...unitScope,
          status: WmsInventoryUnitStatus.STAGED,
        },
      }),
      this.prisma.wmsInventoryUnit.count({
        where: {
          ...unitScope,
          status: {
            in: [...STOCK_TRANSFERABLE_UNIT_STATUSES],
          },
        },
      }),
      this.prisma.wmsReceivingBatch.count({
        where: {
          ...receivingScope,
          status: {
            in: [...STOCK_PUTAWAY_BATCH_STATUSES],
          },
        },
      }),
      this.prisma.wmsTransfer.count({
        where: transferScope,
      }),
      this.prisma.wmsLocation.count({
        where: binScope,
      }),
      this.prisma.wmsReceivingBatch.findMany({
        where: {
          ...receivingScope,
          status: {
            in: [...STOCK_PUTAWAY_BATCH_STATUSES],
          },
        },
        select: {
          id: true,
          code: true,
          status: true,
          store: {
            select: {
              id: true,
              name: true,
              shopName: true,
            },
          },
          warehouse: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          stagingLocation: {
            select: {
              id: true,
              code: true,
              name: true,
              kind: true,
            },
          },
          _count: {
            select: {
              inventoryUnits: true,
            },
          },
          updatedAt: true,
        },
        orderBy: [{ updatedAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.wmsInventoryUnit.findMany({
        where: {
          ...unitScope,
          status: {
            in: [...STOCK_TRANSFERABLE_UNIT_STATUSES],
          },
        },
        select: {
          id: true,
          code: true,
          barcode: true,
          status: true,
          productId: true,
          variationId: true,
          posProduct: {
            select: {
              id: true,
              name: true,
              customId: true,
            },
          },
          warehouse: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          currentLocation: {
            select: {
              id: true,
              code: true,
              name: true,
              kind: true,
            },
          },
          updatedAt: true,
        },
        orderBy: [{ updatedAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.wmsTransfer.findMany({
        where: transferScope,
        select: {
          id: true,
          code: true,
          status: true,
          fromLocation: {
            select: {
              id: true,
              code: true,
              name: true,
              kind: true,
            },
          },
          toLocation: {
            select: {
              id: true,
              code: true,
              name: true,
              kind: true,
            },
          },
          warehouse: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          createdBy: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          _count: {
            select: {
              items: true,
            },
          },
          createdAt: true,
        },
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.wmsLocation.findMany({
        where: binScope,
        select: {
          id: true,
          code: true,
          name: true,
          capacity: true,
          warehouse: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          _count: {
            select: {
              inventoryUnits: true,
            },
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
        skip,
        take: pageSize,
      }),
    ]);

    const unlocatedUnits = Math.max(totalUnits - locatedUnits, 0);
    const activeTotal = this.getStockModeTotal(activeMode, {
      bins: binCount,
      move: movableUnitCount,
      putaway: putawayBatchCount,
      recent: transferCount,
    });
    const activityTenantId = tenantId ?? activeStore?.tenantId ?? null;

    await this.wmsStaffActivityService.recordFromRequest({
      request,
      tenantId: activityTenantId,
      actorId: userId,
      teamId: activeStore?.teamId ?? user.defaultTeamId ?? null,
      sessionId,
      actionType: 'STOCK_VIEW',
      resourceType: 'STOX_STOCK',
      resourceId: activeWarehouseId,
      storeId: activeStoreId,
      warehouseId: activeWarehouseId,
      metadata: {
        totalUnits,
        stagedUnits,
        movableUnitCount,
        putawayBatchCount,
      },
    });

    return {
      tenantReady: true,
      serverTime: new Date().toISOString(),
      pagination: {
        mode: activeMode,
        page,
        pageSize,
        total: activeTotal,
        hasMore: page * pageSize < activeTotal,
      },
      context: {
        tenantOptions: tenantContext.tenantOptions,
        activeTenantId: tenantId,
        activeStoreId,
        activeWarehouseId,
        stores: stores.map((store) => ({
          id: store.id,
          tenantId: store.tenantId,
          name: store.shopName || store.name,
          tenantName: store.tenant.name,
          tenantSlug: store.tenant.slug,
        })),
        warehouses: warehouses.map((warehouse) => ({
          id: warehouse.id,
          code: warehouse.code,
          name: warehouse.name,
        })),
      },
      summary: {
        totalUnits,
        locatedUnits,
        unlocatedUnits,
        stagedUnits,
        movableUnits: movableUnitCount,
        putawayBatches: putawayBatchCount,
        transfers: transferCount,
        bins: binCount,
      },
      putawayQueue: putawayQueue.map((batch) => ({
        id: batch.id,
        code: batch.code,
        status: batch.status,
        statusLabel: this.formatEnumLabel(batch.status),
        unitCount: batch._count.inventoryUnits,
        store: {
          id: batch.store.id,
          name: batch.store.shopName || batch.store.name,
        },
        warehouse: batch.warehouse,
        stagingLocation: batch.stagingLocation
          ? this.mapLocation(batch.stagingLocation)
          : null,
        updatedAt: batch.updatedAt,
      })),
      movableUnits: movableUnits.map((unit) => ({
        id: unit.id,
        code: unit.code,
        barcode: unit.barcode,
        status: unit.status,
        statusLabel: this.formatEnumLabel(unit.status),
        productId: unit.productId,
        variationId: unit.variationId,
        name: unit.posProduct.name,
        customId: unit.posProduct.customId,
        warehouse: unit.warehouse,
        currentLocation: unit.currentLocation ? this.mapLocation(unit.currentLocation) : null,
        updatedAt: unit.updatedAt,
      })),
      recentTransfers: recentTransfers.map((transfer) => ({
        id: transfer.id,
        code: transfer.code,
        status: transfer.status,
        statusLabel: this.formatEnumLabel(transfer.status),
        itemCount: transfer._count.items,
        warehouse: transfer.warehouse,
        fromLocation: transfer.fromLocation ? this.mapLocation(transfer.fromLocation) : null,
        toLocation: this.mapLocation(transfer.toLocation),
        actor: this.mapActor(transfer.createdBy),
        createdAt: transfer.createdAt,
      })),
      bins: bins.map((bin) => {
        const occupiedUnits = bin._count.inventoryUnits;
        const availableUnits =
          bin.capacity === null ? null : Math.max(bin.capacity - occupiedUnits, 0);

        return {
          id: bin.id,
          code: bin.code,
          name: bin.name,
          label: `${bin.code} · ${bin.name}`,
          warehouse: bin.warehouse,
          capacity: bin.capacity,
          occupiedUnits,
          availableUnits,
          isFull: bin.capacity !== null ? occupiedUnits >= bin.capacity : false,
        };
      }),
    };
  }

  async getTenantOptions(user: BootstrapUser) {
    return {
      tenants: await this.getPlatformTenantOptions(),
    };
  }

  async scanStockCode(user: BootstrapUser, query: GetWmsMobileStockScanDto, request?: Request) {
    const tenantContext = await this.resolveMobileStockContext(user, { tenantId: query.tenantId }, request);
    const code = this.normalizeScannedCode(query.code);

    const unit = await this.findUnitByCode(code, tenantContext.tenantId);
    if (unit) {
      await this.recordStockActivity(user, request, {
        tenantId: unit.tenantId,
        teamId: unit.teamId,
        actionType: 'STOCK_SCAN',
        resourceType: 'WMS_INVENTORY_UNIT',
        resourceId: unit.id,
        metadata: { code, resultType: 'unit' },
      });

      return {
        found: true,
        type: 'unit',
        unit: this.mapMobileUnitDetail(unit),
      };
    }

    const location = await this.findLocationByCode(code);
    if (location) {
      await this.recordStockActivity(user, request, {
        tenantId: tenantContext.tenantId,
        teamId: null,
        actionType: 'STOCK_SCAN',
        resourceType: 'WMS_LOCATION',
        resourceId: location.id,
        metadata: { code, resultType: 'bin' },
      });

      return {
        found: true,
        type: location.kind === WmsLocationKind.BIN ? 'bin' : 'location',
        bin: await this.buildMobileBinDetail(location.id, tenantContext.tenantId),
      };
    }

    const batch = await this.findBatchByCode(code, tenantContext.tenantId);
    if (batch) {
      await this.recordStockActivity(user, request, {
        tenantId: batch.tenantId,
        teamId: batch.teamId,
        actionType: 'STOCK_SCAN',
        resourceType: 'WMS_RECEIVING_BATCH',
        resourceId: batch.id,
        metadata: { code, resultType: 'batch' },
      });

      return {
        found: true,
        type: 'batch',
        batch: this.mapMobileBatchDetail(batch),
      };
    }

    await this.recordStockActivity(user, request, {
      tenantId: tenantContext.tenantId,
      teamId: null,
      actionType: 'STOCK_SCAN',
      resourceType: 'STOX_STOCK',
      resourceId: null,
      metadata: { code, resultType: 'none' },
    });

    return {
      found: false,
      type: 'none',
      code,
    };
  }

  async getStockUnit(
    user: BootstrapUser,
    id: string,
    query: GetWmsMobileStockScopedDto,
    request?: Request,
  ) {
    const tenantContext = await this.resolveMobileStockContext(user, { tenantId: query.tenantId }, request);
    const unit = await this.findUnitById(id, tenantContext.tenantId);

    if (!unit) {
      throw new NotFoundException('Inventory unit was not found');
    }

    await this.recordStockActivity(user, request, {
      tenantId: unit.tenantId,
      teamId: unit.teamId,
      actionType: 'STOCK_UNIT_VIEW',
      resourceType: 'WMS_INVENTORY_UNIT',
      resourceId: unit.id,
    });

    return {
      unit: this.mapMobileUnitDetail(unit),
    };
  }

  async getStockBin(
    user: BootstrapUser,
    id: string,
    query: GetWmsMobileStockScopedDto,
    request?: Request,
  ) {
    const tenantContext = await this.resolveMobileStockContext(user, { tenantId: query.tenantId }, request);
    const bin = await this.buildMobileBinDetail(id, tenantContext.tenantId);

    if (!bin) {
      throw new NotFoundException('Bin was not found');
    }

    await this.recordStockActivity(user, request, {
      tenantId: tenantContext.tenantId,
      teamId: null,
      actionType: 'STOCK_BIN_VIEW',
      resourceType: 'WMS_LOCATION',
      resourceId: bin.id,
    });

    return { bin };
  }

  async getStockBatch(
    user: BootstrapUser,
    id: string,
    query: GetWmsMobileStockScopedDto,
    request?: Request,
  ) {
    const tenantContext = await this.resolveMobileStockContext(user, { tenantId: query.tenantId }, request);
    const batch = await this.findBatchById(id, tenantContext.tenantId);

    if (!batch) {
      throw new NotFoundException('Receiving batch was not found');
    }

    await this.recordStockActivity(user, request, {
      tenantId: batch.tenantId,
      teamId: batch.teamId,
      actionType: 'STOCK_BATCH_VIEW',
      resourceType: 'WMS_RECEIVING_BATCH',
      resourceId: batch.id,
    });

    return {
      batch: this.mapMobileBatchDetail(batch),
    };
  }

  async putawayStockUnit(user: BootstrapUser, body: WmsMobileStockMoveDto, request?: Request) {
    const unit = await this.findUnitById(body.unitId, body.tenantId ?? null);
    if (!unit) {
      throw new NotFoundException('Inventory unit was not found');
    }

    await this.assertActionTenantAccess(user, body.tenantId, unit.tenantId, request);
    this.assertMobileActionPreconditions(unit, body);

    if (!this.isMobilePutawayCandidate(unit)) {
      throw new BadRequestException(
        `Unit ${unit.code} is not in receiving staging. Use Move for already stored units.`,
      );
    }

    const target = await this.resolveTargetLocation(body.targetCode, unit.warehouseId);
    if (target.kind !== WmsLocationKind.BIN) {
      throw new BadRequestException('Putaway target must be a bin');
    }

    const notes = this.cleanOptionalText(body.notes) ?? `STOX putaway to ${target.code}`;
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      await this.assertLocationCapacity(tx, target.id, target.code, target.capacity, 1, unit.currentLocationId);

      const updatedUnit = await tx.wmsInventoryUnit.update({
        where: { id: unit.id },
        data: {
          currentLocationId: target.id,
          status: WmsInventoryUnitStatus.PUTAWAY,
          updatedById: user.userId || user.id || undefined,
        },
        include: this.mobileUnitInclude(),
      });

      await tx.wmsInventoryMovement.create({
        data: {
          tenantId: unit.tenantId,
          teamId: unit.teamId,
          inventoryUnitId: unit.id,
          warehouseId: unit.warehouseId,
          fromLocationId: unit.currentLocationId,
          toLocationId: target.id,
          fromStatus: unit.status,
          toStatus: WmsInventoryUnitStatus.PUTAWAY,
          movementType: WmsInventoryMovementType.PUTAWAY,
          referenceType: unit.receivingBatchId ? 'RECEIVING_BATCH' : 'STOX_PUTAWAY',
          referenceId: unit.receivingBatchId,
          referenceCode: unit.receivingBatch?.code ?? null,
          notes,
          actorId: user.userId || user.id || null,
          createdAt: now,
        },
      });

      if (unit.receivingBatchId) {
        await this.refreshReceivingBatchPutawayState(tx, unit.receivingBatchId, user.userId || user.id || null, now);
      }

      return updatedUnit;
    });

    await this.recordStockActivity(user, request, {
      tenantId: unit.tenantId,
      teamId: unit.teamId,
      actionType: 'STOCK_PUTAWAY',
      resourceType: 'WMS_INVENTORY_UNIT',
      resourceId: unit.id,
      storeId: unit.storeId,
      warehouseId: unit.warehouseId,
      metadata: {
        clientRequestId: body.clientRequestId ?? null,
        targetLocationId: target.id,
        targetCode: target.code,
      },
    });

    return {
      success: true,
      unit: this.mapMobileUnitDetail(result),
    };
  }

  async moveStockUnit(user: BootstrapUser, body: WmsMobileStockMoveDto, request?: Request) {
    const unit = await this.findUnitById(body.unitId, body.tenantId ?? null);
    if (!unit) {
      throw new NotFoundException('Inventory unit was not found');
    }

    await this.assertActionTenantAccess(user, body.tenantId, unit.tenantId, request);
    this.assertMobileActionPreconditions(unit, body);

    if (!unit.currentLocationId) {
      throw new BadRequestException(`Unit ${unit.code} is missing a current location`);
    }

    if (this.isMobilePutawayCandidate(unit)) {
      throw new BadRequestException(`Use Putaway for unit ${unit.code} from receiving staging`);
    }

    if (!STOCK_TRANSFERABLE_UNIT_STATUSES.includes(unit.status as typeof STOCK_TRANSFERABLE_UNIT_STATUSES[number])) {
      throw new BadRequestException(`Unit ${unit.code} cannot be moved from ${unit.status}`);
    }

    const target = await this.resolveTargetLocation(body.targetCode, unit.warehouseId);
    if (target.id === unit.currentLocationId) {
      throw new BadRequestException('Target location must be different from the current location');
    }

    if (!this.isMobileMoveDestinationAllowed(target.kind)) {
      throw new BadRequestException('Target location is not valid for a mobile stock move');
    }

    const nextStatus = this.resolveMobileMoveStatus(unit.status, target.kind);
    const transferCode = this.buildMobileTransferCode();
    const notes = this.cleanOptionalText(body.notes) ?? `STOX move to ${target.code}`;
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      if (target.kind === WmsLocationKind.BIN) {
        await this.assertLocationCapacity(tx, target.id, target.code, target.capacity, 1, unit.currentLocationId);
      }

      const transfer = await tx.wmsTransfer.create({
        data: {
          code: transferCode,
          tenantId: unit.tenantId,
          teamId: unit.teamId,
          warehouseId: unit.warehouseId,
          fromLocationId: unit.currentLocationId,
          toLocationId: target.id,
          status: WmsTransferStatus.COMPLETED,
          notes,
          createdById: user.userId || user.id || null,
          updatedById: user.userId || user.id || null,
        },
      });

      await tx.wmsTransferItem.create({
        data: {
          transferId: transfer.id,
          inventoryUnitId: unit.id,
          lineNo: 1,
        },
      });

      const updatedUnit = await tx.wmsInventoryUnit.update({
        where: { id: unit.id },
        data: {
          currentLocationId: target.id,
          status: nextStatus,
          updatedById: user.userId || user.id || undefined,
        },
        include: this.mobileUnitInclude(),
      });

      await tx.wmsInventoryMovement.create({
        data: {
          tenantId: unit.tenantId,
          teamId: unit.teamId,
          inventoryUnitId: unit.id,
          warehouseId: unit.warehouseId,
          fromLocationId: unit.currentLocationId,
          toLocationId: target.id,
          fromStatus: unit.status,
          toStatus: nextStatus,
          movementType: WmsInventoryMovementType.TRANSFER,
          referenceType: 'TRANSFER',
          referenceId: transfer.id,
          referenceCode: transfer.code,
          notes,
          actorId: user.userId || user.id || null,
          createdAt: now,
        },
      });

      return {
        transfer,
        unit: updatedUnit,
      };
    });

    await this.recordStockActivity(user, request, {
      tenantId: unit.tenantId,
      teamId: unit.teamId,
      actionType: 'STOCK_MOVE',
      resourceType: 'WMS_INVENTORY_UNIT',
      resourceId: unit.id,
      storeId: unit.storeId,
      warehouseId: unit.warehouseId,
      metadata: {
        clientRequestId: body.clientRequestId ?? null,
        targetLocationId: target.id,
        targetCode: target.code,
        transferId: result.transfer.id,
        transferCode: result.transfer.code,
      },
    });

    return {
      success: true,
      transfer: {
        id: result.transfer.id,
        code: result.transfer.code,
        status: result.transfer.status,
      },
      unit: this.mapMobileUnitDetail(result.unit),
    };
  }

  async getPickingTasks(user: BootstrapUser, query: GetWmsMobilePickingTasksDto, request?: Request) {
    const userId = user.userId || user.id || null;
    const tenantContext = await this.resolveMobileStockContext(user, query as GetWmsMobileStockDto, request);
    const tenantId = tenantContext.tenantId;
    const sessionId = (this.cls.get('sessionId') as string | undefined) || user.sessionId || null;

    if (!userId) {
      return this.buildEmptyPickingResponse(false);
    }

    const [access, taskAssignment] = await Promise.all([
      this.effectiveAccessService.resolveUserAccess({
        userId,
        ...(tenantId ? { tenantId } : {}),
        basePermissions: Array.isArray(user.permissions) ? user.permissions : [],
        workspace: 'wms',
      }),
      this.getWmsTaskAssignment(userId),
    ]);
    this.assertPickExecutionAccess(user, access.permissions, taskAssignment);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PICKING_PAGE_SIZE;
    const skip = (page - 1) * pageSize;

    const stores = await this.prisma.posStore.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        status: IntegrationStatus.ACTIVE,
      },
      select: {
        id: true,
        tenantId: true,
        teamId: true,
        name: true,
        shopId: true,
        shopName: true,
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: [{ name: 'asc' }],
    });

    const activeStore = query.storeId
      ? stores.find((store) => store.id === query.storeId) ?? null
      : null;

    if (query.storeId && !activeStore) {
      throw new ForbiddenException('Selected store is not available for STOX picking');
    }

    await this.syncConfirmedPickingOrders({
      tenantId,
      storeId: activeStore?.id ?? null,
      stores,
      actorId: userId,
    });

    const statusFilter = query.status
      ? (query.status as WmsFulfillmentOrderStatus)
      : { in: [...ACTIVE_PICKING_ORDER_STATUSES] };
    const scopedWhere: Prisma.WmsFulfillmentOrderWhereInput = {
      ...(tenantId ? { tenantId } : {}),
      ...(activeStore ? { storeId: activeStore.id } : {}),
    };
    const heldBasketWhere: Prisma.WmsBasketWhereInput = {
      assignedPickerId: userId,
      status: {
        in: [...ACTIVE_PICK_BASKET_STATUSES],
      },
      ...(tenantId ? { tenantId } : {}),
      ...(activeStore ? {
        fulfillmentOrder: {
          is: {
            storeId: activeStore.id,
          },
        },
      } : {}),
    };
    const availableBasketWhere: Prisma.WmsBasketWhereInput = {
      status: WmsBasketStatus.AVAILABLE,
      warehouseId: {
        not: null,
      },
    };
    const registeredBasketWhere: Prisma.WmsBasketWhereInput = {
      status: {
        notIn: [...BLOCKED_PICK_BASKET_STATUSES],
      },
      warehouseId: {
        not: null,
      },
    };
    const activeBasketWhere: Prisma.WmsBasketWhereInput = {
      assignedPickerId: userId,
      status: {
        in: [...PICKER_ACTIVE_BASKET_STATUSES],
      },
      ...(tenantId ? { tenantId } : {}),
      ...(activeStore ? {
        fulfillmentOrder: {
          is: {
            storeId: activeStore.id,
          },
        },
      } : {}),
    };
    const pickedHistoryWhere: Prisma.WmsFulfillmentOrderWhereInput = {
      ...scopedWhere,
      claimedById: userId,
      status: {
        in: [
          WmsFulfillmentOrderStatus.READY_FOR_PACK,
          WmsFulfillmentOrderStatus.PICKED,
        ],
      },
      basket: {
        isNot: null,
      },
    };
    const taskWhere: Prisma.WmsFulfillmentOrderWhereInput = {
      ...scopedWhere,
      status: statusFilter,
    };

    const [total, statusGroups, tasks, heldBaskets, pickedHistory, activeLoad, availableBasketCount, registeredBasketCount, availableBaskets, packerOptions] = await Promise.all([
      this.prisma.wmsFulfillmentOrder.count({ where: taskWhere }),
      this.prisma.wmsFulfillmentOrder.groupBy({
        by: ['status'],
        where: scopedWhere,
        _count: {
          _all: true,
        },
      }),
      this.prisma.wmsFulfillmentOrder.findMany({
        where: taskWhere,
        include: this.pickingTaskInclude(),
        orderBy: [
          { status: 'asc' },
          { createdAt: 'asc' },
        ],
        skip,
        take: pageSize,
      }),
      this.prisma.wmsBasket.findMany({
        where: heldBasketWhere,
        include: {
          fulfillmentOrder: {
            include: this.pickingTaskInclude(),
          },
        },
        orderBy: [
          { status: 'asc' },
          { fullAt: 'desc' },
          { claimedAt: 'desc' },
          { createdAt: 'desc' },
        ],
      }),
      this.prisma.wmsFulfillmentOrder.findMany({
        where: pickedHistoryWhere,
        include: this.pickingTaskInclude(),
        orderBy: [
          { completedAt: 'desc' },
          { updatedAt: 'desc' },
        ],
        take: 20,
      }),
      this.prisma.wmsBasket.count({ where: activeBasketWhere }),
      this.prisma.wmsBasket.count({ where: availableBasketWhere }),
      this.prisma.wmsBasket.count({ where: registeredBasketWhere }),
      this.prisma.wmsBasket.findMany({
        where: availableBasketWhere,
        include: this.mobileBasketInclude(),
        orderBy: [
          { warehouse: { name: 'asc' } },
          { barcode: 'asc' },
        ],
        take: 40,
      }),
      this.listPackingHandoffCandidates(),
    ]);

    await this.wmsStaffActivityService.recordFromRequest({
      request,
      tenantId: tenantId ?? activeStore?.tenantId ?? null,
      actorId: userId,
      teamId: activeStore?.teamId ?? user.defaultTeamId ?? null,
      sessionId,
      actionType: 'PICKING_VIEW',
      resourceType: 'STOX_PICKING',
      resourceId: activeStore?.id ?? null,
      storeId: activeStore?.id ?? null,
      metadata: {
        page,
        pageSize,
        status: query.status ?? null,
        total,
      },
    });

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
        tenantOptions: tenantContext.tenantOptions,
        activeTenantId: tenantId,
        activeStoreId: activeStore?.id ?? null,
        stores: stores.map((store) => ({
          id: store.id,
          tenantId: store.tenantId,
          name: store.shopName || store.name,
          tenantName: store.tenant.name,
          tenantSlug: store.tenant.slug,
        })),
        packerOptions,
      },
      summary: this.mapPickingSummary(statusGroups),
      picker: {
        registeredBaskets: registeredBasketCount,
        activeLoad,
        availableSlots: availableBasketCount,
        heldBaskets: heldBaskets.length,
        fullHeldBaskets: heldBaskets.filter((basket) => basket.status === WmsBasketStatus.FULL_HELD).length,
      },
      availableBaskets: availableBaskets.map((basket) => this.mapMobilePickBasket(basket)),
      heldBaskets: heldBaskets.map((basket) => this.mapMobileHeldBasket(basket)),
      pickedHistory: pickedHistory.map((task) => this.mapMobilePickingTask(task)),
      tasks: tasks.map((task) => this.mapMobilePickingTask(task)),
    };
  }

  async claimPickingTask(
    user: BootstrapUser,
    id: string,
    body: WmsMobilePickScopedDto,
    request?: Request,
  ) {
    const userId = user.userId || user.id || null;
    if (!userId) {
      throw new ForbiddenException('Missing WMS user context');
    }

    await this.allocateFulfillmentOrder(id, userId);
    const order = await this.findPickingOrderForAction(user, id, body.tenantId, request);

    if (order.claimedById === userId && (
      order.status === WmsFulfillmentOrderStatus.READY
      || order.status === WmsFulfillmentOrderStatus.IN_PICKING
    )) {
      return {
        success: true,
        task: this.mapMobilePickingTask(order),
      };
    }

    if (order.claimedById && order.claimedById !== userId) {
      throw new ConflictException('This pick task is already claimed by another staff member');
    }

    if (order.status !== WmsFulfillmentOrderStatus.READY) {
      throw new BadRequestException(`Order ${order.posOrderId} is ${this.formatEnumLabel(order.status)} and cannot be claimed yet`);
    }

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      await this.assertAvailableBasketForClaim(order, tx);

      const claimResult = await tx.wmsFulfillmentOrder.updateMany({
        where: {
          id: order.id,
          status: WmsFulfillmentOrderStatus.READY,
          claimedById: null,
        },
        data: {
          claimedById: userId,
          claimedAt: new Date(),
        },
      });

      if (claimResult.count !== 1) {
        throw new ConflictException('This pick task was already claimed or changed status');
      }

      return tx.wmsFulfillmentOrder.findUniqueOrThrow({
        where: { id: order.id },
        include: this.pickingTaskInclude(),
      });
    });

    await this.recordStockActivity(user, request, {
      tenantId: updatedOrder.tenantId,
      teamId: updatedOrder.teamId,
      actionType: 'PICKING_CLAIM',
      resourceType: 'WMS_FULFILLMENT_ORDER',
      resourceId: updatedOrder.id,
      storeId: updatedOrder.storeId,
      warehouseId: updatedOrder.warehouseId,
    });

    return {
      success: true,
      task: this.mapMobilePickingTask(updatedOrder),
    };
  }

  async scanPickingBin(
    user: BootstrapUser,
    id: string,
    body: WmsMobilePickScanDto,
    request?: Request,
  ) {
    const userId = user.userId || user.id || null;
    const order = await this.findPickingOrderForAction(user, id, body.tenantId, request);
    this.assertPickingTaskClaimedByUser(order, userId, { allowReadyWithoutBasket: true });
    this.assertPickingTaskHasBasket(order);

    const location = await this.findLocationByCode(body.code);
    if (!location || location.kind !== WmsLocationKind.BIN) {
      throw new NotFoundException('Scanned code is not a WMS bin');
    }

    const pendingReservations = this.getPendingPickReservations(order).filter(
      (reservation) => reservation.inventoryUnit.currentLocationId === location.id,
    );

    if (pendingReservations.length === 0) {
      throw new BadRequestException(`Bin ${location.code} has no reserved units for order ${order.posOrderId}`);
    }

    await this.recordStockActivity(user, request, {
      tenantId: order.tenantId,
      teamId: order.teamId,
      actionType: 'PICKING_BIN_SCAN',
      resourceType: 'WMS_LOCATION',
      resourceId: location.id,
      storeId: order.storeId,
      warehouseId: location.warehouse.id,
      metadata: {
        fulfillmentOrderId: order.id,
        posOrderId: order.posOrderId,
        pendingUnits: pendingReservations.length,
      },
    });

    return {
      success: true,
      bin: {
        id: location.id,
        code: location.code,
        name: location.name,
        kind: location.kind,
        warehouse: location.warehouse,
      },
      pendingUnits: pendingReservations.map((reservation) => this.mapMobilePickReservation(reservation)),
    };
  }

  async scanPickingBasket(
    user: BootstrapUser,
    id: string,
    body: WmsMobilePickScanDto,
    request?: Request,
  ) {
    const userId = user.userId || user.id || null;
    const order = await this.findPickingOrderForAction(user, id, body.tenantId, request);
    this.assertPickingTaskClaimedByUser(order, userId, { allowReadyWithoutBasket: true });

    const basketCode = this.normalizeScannedCode(body.code);
    const now = new Date();
    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      const scopedOrder = await tx.wmsFulfillmentOrder.findUnique({
        where: { id: order.id },
        include: this.pickingTaskInclude(),
      });

      if (!scopedOrder) {
        throw new NotFoundException('Pick task was not found');
      }

      if (scopedOrder.basket?.barcode === basketCode) {
        return scopedOrder;
      }

      if (scopedOrder.basket) {
        if (scopedOrder.pickedQuantity > 0) {
          throw new ConflictException(`Order ${scopedOrder.posOrderId} is already assigned to basket ${scopedOrder.basket.barcode}`);
        }

        await tx.wmsBasket.update({
          where: { id: scopedOrder.basket.id },
          data: {
            tenantId: null,
            status: WmsBasketStatus.AVAILABLE,
            assignedPickerId: null,
            assignedPackerId: null,
            fulfillmentOrderId: null,
            claimedAt: null,
            fullAt: null,
            readyForPackAt: null,
          },
        });
      }

      const existingBasket = await tx.wmsBasket.findUnique({
        where: { barcode: basketCode },
        include: this.mobileBasketInclude(),
      });

      if (!existingBasket) {
        throw new NotFoundException(`Basket ${basketCode} is not registered. Add it in WMS Warehouses first.`);
      }

      if (BLOCKED_PICK_BASKET_STATUSES.includes(existingBasket.status as (typeof BLOCKED_PICK_BASKET_STATUSES)[number])) {
        throw new ConflictException(`Basket ${existingBasket.barcode} is ${this.formatEnumLabel(existingBasket.status)} and cannot be used`);
      }

      if (existingBasket.status !== WmsBasketStatus.AVAILABLE && existingBasket.fulfillmentOrderId !== scopedOrder.id) {
        throw new ConflictException(`Basket ${existingBasket.barcode} is ${this.formatEnumLabel(existingBasket.status)} and not available`);
      }

      if (existingBasket.fulfillmentOrderId && existingBasket.fulfillmentOrderId !== scopedOrder.id) {
        throw new ConflictException(
          `Basket ${existingBasket.barcode} already contains order ${existingBasket.fulfillmentOrder?.posOrderId ?? existingBasket.fulfillmentOrderId}`,
        );
      }

      if (existingBasket?.assignedPickerId && existingBasket.assignedPickerId !== userId) {
        throw new ConflictException(`Basket ${existingBasket.barcode} is currently assigned to another picker`);
      }

      if (scopedOrder.warehouseId && existingBasket.warehouseId && existingBasket.warehouseId !== scopedOrder.warehouseId) {
        throw new ConflictException(`Basket ${existingBasket.barcode} belongs to ${existingBasket.warehouse?.name ?? 'another warehouse'}`);
      }

      const assignResult = await tx.wmsBasket.updateMany({
        where: {
          id: existingBasket.id,
          status: WmsBasketStatus.AVAILABLE,
          fulfillmentOrderId: null,
          assignedPickerId: null,
        },
        data: {
          tenantId: scopedOrder.tenantId,
          status: WmsBasketStatus.ASSIGNED,
          assignedPickerId: userId,
          assignedPackerId: null,
          fulfillmentOrderId: scopedOrder.id,
          claimedAt: now,
          fullAt: null,
          readyForPackAt: null,
        },
      });

      if (assignResult.count !== 1) {
        throw new ConflictException(`Basket ${existingBasket.barcode} is no longer available`);
      }

      await tx.wmsFulfillmentOrder.update({
        where: { id: scopedOrder.id },
        data: {
          status: WmsFulfillmentOrderStatus.IN_PICKING,
        },
      });

      return tx.wmsFulfillmentOrder.findUniqueOrThrow({
        where: { id: scopedOrder.id },
        include: this.pickingTaskInclude(),
      });
    });

    await this.recordStockActivity(user, request, {
      tenantId: updatedOrder.tenantId,
      teamId: updatedOrder.teamId,
      actionType: 'PICKING_BASKET_SCAN',
      resourceType: 'WMS_BASKET',
      resourceId: updatedOrder.basket?.id ?? null,
      storeId: updatedOrder.storeId,
      warehouseId: updatedOrder.warehouseId,
      metadata: {
        fulfillmentOrderId: updatedOrder.id,
        posOrderId: updatedOrder.posOrderId,
        basketCode,
      },
    });

    return {
      success: true,
      task: this.mapMobilePickingTask(updatedOrder),
    };
  }

  async scanPickingUnit(
    user: BootstrapUser,
    id: string,
    body: WmsMobilePickScanDto,
    request?: Request,
  ) {
    const userId = user.userId || user.id || null;
    const order = await this.findPickingOrderForAction(user, id, body.tenantId, request);
    this.assertPickingTaskClaimedByUser(order, userId);
    this.assertPickingTaskHasBasket(order);

    const scannedCode = this.normalizeScannedCode(body.code);
    const allReservations = this.getAllPickReservations(order);
    const matchingReservation = allReservations.find((reservation) => (
      reservation.inventoryUnit.code === scannedCode
      || reservation.inventoryUnit.barcode === scannedCode
      || reservation.inventoryUnit.id === scannedCode
    ));

    if (!matchingReservation) {
      const scannedUnit = await this.findUnitByCode(scannedCode, order.tenantId);
      if (!scannedUnit) {
        throw new NotFoundException('Scanned unit was not found');
      }

      const requiredVariationIds = new Set(order.lines.map((line: any) => line.variationId));
      if (requiredVariationIds.has(scannedUnit.variationId)) {
        throw new BadRequestException(`Unit ${scannedUnit.code} is not reserved for this order. Resync the queue before picking it.`);
      }

      throw new BadRequestException(`Unit ${scannedUnit.code} is not one of the products required by this order`);
    }

    if (matchingReservation.status === WmsPickReservationStatus.PICKED) {
      throw new ConflictException(`Unit ${matchingReservation.inventoryUnit.code} was already picked for this order`);
    }

    if (matchingReservation.status !== WmsPickReservationStatus.RESERVED) {
      throw new BadRequestException(`Unit ${matchingReservation.inventoryUnit.code} is not active for picking`);
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.wmsPickReservation.update({
        where: { id: matchingReservation.id },
        data: {
          status: WmsPickReservationStatus.PICKED,
          pickedById: userId,
          pickedAt: now,
        },
      });

      await tx.wmsInventoryUnit.update({
        where: { id: matchingReservation.inventoryUnitId },
        data: {
          status: WmsInventoryUnitStatus.PICKED,
          currentLocationId: null,
          updatedById: userId || undefined,
        },
      });

      await tx.wmsInventoryMovement.create({
        data: {
          tenantId: order.tenantId,
          teamId: order.teamId,
          inventoryUnitId: matchingReservation.inventoryUnitId,
          warehouseId: matchingReservation.inventoryUnit.warehouseId,
          fromLocationId: matchingReservation.inventoryUnit.currentLocationId,
          toLocationId: null,
          fromStatus: matchingReservation.inventoryUnit.status,
          toStatus: WmsInventoryUnitStatus.PICKED,
          movementType: WmsInventoryMovementType.PICK,
          referenceType: 'WMS_FULFILLMENT_ORDER',
          referenceId: order.id,
          referenceCode: order.posOrderId,
          notes: `STOX picked for order ${order.posOrderId}`,
          actorId: userId,
          createdAt: now,
        },
      });

      await this.refreshFulfillmentOrderState(tx, order.id, now);
      await this.refreshFulfillmentBasketState(tx, order.id, now);
    });

    const updatedOrder = await this.findPickingOrderForAction(user, id, body.tenantId, request);

    await this.recordStockActivity(user, request, {
      tenantId: order.tenantId,
      teamId: order.teamId,
      actionType: 'PICKING_UNIT_SCAN',
      resourceType: 'WMS_INVENTORY_UNIT',
      resourceId: matchingReservation.inventoryUnitId,
      storeId: order.storeId,
      warehouseId: matchingReservation.inventoryUnit.warehouseId,
      metadata: {
        fulfillmentOrderId: order.id,
        fulfillmentLineId: matchingReservation.fulfillmentLineId,
        posOrderId: order.posOrderId,
        unitCode: matchingReservation.inventoryUnit.code,
      },
    });

    return {
      success: true,
      task: this.mapMobilePickingTask(updatedOrder),
    };
  }

  async lookupPickingBasket(
    user: BootstrapUser,
    query: GetWmsMobilePickBasketLookupDto,
    request?: Request,
  ) {
    const basketCode = this.normalizeScannedCode(query.code);
    const tenantContext = await this.resolveMobileStockContext(user, { tenantId: query.tenantId }, request);
    const basket = await this.prisma.wmsBasket.findUnique({
      where: { barcode: basketCode },
      include: this.mobileBasketInclude(),
    });
    const scopedBasket = basket && tenantContext.tenantId && basket.tenantId && basket.tenantId !== tenantContext.tenantId
      ? null
      : basket;

    await this.recordStockActivity(user, request, {
      tenantId: scopedBasket?.tenantId ?? tenantContext.tenantId,
      teamId: scopedBasket?.fulfillmentOrder?.teamId ?? null,
      actionType: 'PICKING_BASKET_LOOKUP',
      resourceType: 'WMS_BASKET',
      resourceId: scopedBasket?.id ?? null,
      storeId: scopedBasket?.fulfillmentOrder?.storeId ?? null,
      warehouseId: scopedBasket?.warehouseId ?? scopedBasket?.fulfillmentOrder?.warehouseId ?? null,
      metadata: {
        basketCode,
        found: Boolean(scopedBasket),
      },
    });

    return {
      found: Boolean(scopedBasket),
      basket: scopedBasket ? this.mapMobileBasketLookup(scopedBasket) : null,
    };
  }

  async completePickingTask(
    user: BootstrapUser,
    id: string,
    body: WmsMobilePickScopedDto,
    request?: Request,
  ) {
    const userId = user.userId || user.id || null;
    const order = await this.findPickingOrderForAction(user, id, body.tenantId, request);
    this.assertPickingTaskClaimedByUser(order, userId);

    if (order.pickedQuantity < order.totalQuantity) {
      throw new BadRequestException(`Order ${order.posOrderId} still has units to pick`);
    }

    const now = order.completedAt ?? new Date();
    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      await tx.wmsFulfillmentOrder.update({
        where: { id: order.id },
        data: {
          status: WmsFulfillmentOrderStatus.READY_FOR_PACK,
          completedAt: now,
        },
      });

      await this.refreshFulfillmentBasketState(tx, order.id, now);

      return tx.wmsFulfillmentOrder.findUniqueOrThrow({
        where: { id: order.id },
        include: this.pickingTaskInclude(),
      });
    });

    await this.recordStockActivity(user, request, {
      tenantId: updatedOrder.tenantId,
      teamId: updatedOrder.teamId,
      actionType: 'PICKING_COMPLETE',
      resourceType: 'WMS_FULFILLMENT_ORDER',
      resourceId: updatedOrder.id,
      storeId: updatedOrder.storeId,
      warehouseId: updatedOrder.warehouseId,
    });

    return {
      success: true,
      task: this.mapMobilePickingTask(updatedOrder),
    };
  }

  async handoffPickingTask(
    user: BootstrapUser,
    id: string,
    body: WmsMobilePickHandoffDto,
    request?: Request,
  ) {
    const userId = user.userId || user.id || null;
    if (!userId) {
      throw new ForbiddenException('Missing WMS user context');
    }

    const order = await this.findPickingOrderForAction(user, id, body.tenantId, request);

    if (order.claimedById !== userId) {
      throw new ForbiddenException('Only the claiming picker can hand off this basket');
    }

    if (!order.basket) {
      throw new BadRequestException(`Order ${order.posOrderId} has no basket to hand off`);
    }

    if (
      order.status !== WmsFulfillmentOrderStatus.READY_FOR_PACK
      && order.status !== WmsFulfillmentOrderStatus.PICKED
    ) {
      throw new BadRequestException(`Order ${order.posOrderId} is ${this.formatEnumLabel(order.status)} and cannot be handed off yet`);
    }

    const packerCandidate = await this.findPackingHandoffCandidate(body.packerId);
    if (!packerCandidate) {
      throw new NotFoundException('Selected packer is not available for WMS packing');
    }

    const now = new Date();
    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      const scopedOrder = await tx.wmsFulfillmentOrder.findUnique({
        where: { id: order.id },
        include: this.pickingTaskInclude(),
      });

      if (!scopedOrder || !scopedOrder.basket) {
        throw new NotFoundException('Pick task was not found');
      }

      if (
        scopedOrder.status !== WmsFulfillmentOrderStatus.READY_FOR_PACK
        && scopedOrder.status !== WmsFulfillmentOrderStatus.PICKED
      ) {
        throw new BadRequestException(`Order ${scopedOrder.posOrderId} is ${this.formatEnumLabel(scopedOrder.status)} and cannot be handed off yet`);
      }

      await tx.wmsBasket.update({
        where: { id: scopedOrder.basket.id },
        data: {
          assignedPackerId: packerCandidate.id,
          status: WmsBasketStatus.FULL_HELD,
          readyForPackAt: scopedOrder.basket.readyForPackAt ?? now,
        },
      });

      await tx.wmsFulfillmentOrder.update({
        where: { id: scopedOrder.id },
        data: {
          status: WmsFulfillmentOrderStatus.PICKED,
          completedAt: scopedOrder.completedAt ?? now,
        },
      });

      return tx.wmsFulfillmentOrder.findUniqueOrThrow({
        where: { id: scopedOrder.id },
        include: this.pickingTaskInclude(),
      });
    });

    await this.recordStockActivity(user, request, {
      tenantId: updatedOrder.tenantId,
      teamId: updatedOrder.teamId,
      actionType: 'PICKING_HANDOFF',
      resourceType: 'WMS_FULFILLMENT_ORDER',
      resourceId: updatedOrder.id,
      storeId: updatedOrder.storeId,
      warehouseId: updatedOrder.warehouseId,
      metadata: {
        fulfillmentOrderId: updatedOrder.id,
        posOrderId: updatedOrder.posOrderId,
        basketCode: updatedOrder.basket?.barcode ?? null,
        packerId: packerCandidate.id,
        packerEmail: packerCandidate.email,
      },
    });

    return {
      success: true,
      task: this.mapMobilePickingTask(updatedOrder),
    };
  }

  private async syncConfirmedPickingOrders(params: {
    tenantId: string | null;
    storeId: string | null;
    stores: Array<{
      id: string;
      tenantId: string;
      teamId: string | null;
      shopId: string;
      name: string;
      shopName: string;
    }>;
    actorId: string;
  }) {
    const scopedStores = params.storeId
      ? params.stores.filter((store) => store.id === params.storeId)
      : params.stores;

    if (scopedStores.length === 0) {
      return;
    }

    const storeByTenantShop = new Map(scopedStores.map((store) => [`${store.tenantId}:${store.shopId}`, store]));
    const shopIds = Array.from(new Set(scopedStores.map((store) => store.shopId)));
    const tenantIds = Array.from(new Set(scopedStores.map((store) => store.tenantId)));

    const confirmedOrders = await this.prisma.posOrder.findMany({
      where: {
        status: CONFIRMED_POS_ORDER_STATUS,
        isVoid: false,
        shopId: { in: shopIds },
        tenantId: params.tenantId ? params.tenantId : { in: tenantIds },
        wmsFulfillmentOrders: {
          none: {
            status: {
              in: [
                WmsFulfillmentOrderStatus.IN_PICKING,
                WmsFulfillmentOrderStatus.READY_FOR_PACK,
                WmsFulfillmentOrderStatus.PICKED,
                WmsFulfillmentOrderStatus.CANCELED,
              ],
            },
          },
        },
      },
      select: {
        id: true,
        tenantId: true,
        teamId: true,
        shopId: true,
        posOrderId: true,
        insertedAt: true,
        customerName: true,
        customerPhone: true,
        orderSnapshot: true,
      },
      orderBy: [{ insertedAt: 'asc' }],
      take: PICKING_SYNC_ORDER_LIMIT,
    });

    for (const posOrder of confirmedOrders) {
      const store = storeByTenantShop.get(`${posOrder.tenantId}:${posOrder.shopId}`);
      if (!store) {
        continue;
      }

      const lines = await this.extractFulfillmentLinesFromOrderSnapshot(posOrder.orderSnapshot, store.id);
      const posWarehouseRef = this.extractPosWarehouseRef(posOrder.orderSnapshot);
      const warehouseId = await this.resolveFulfillmentWarehouseId({
        tenantId: posOrder.tenantId,
        storeId: store.id,
        posWarehouseRef,
      });
      const totalQuantity = lines.reduce((sum, line) => sum + line.quantityRequired, 0);

      const fulfillmentOrder = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.wmsFulfillmentOrder.findUnique({
          where: { posOrderDbId: posOrder.id },
          select: {
            id: true,
            status: true,
          },
        });

        if (!existing) {
          return tx.wmsFulfillmentOrder.create({
            data: {
              tenantId: posOrder.tenantId,
              teamId: posOrder.teamId ?? store.teamId,
              storeId: store.id,
              posOrderDbId: posOrder.id,
              shopId: posOrder.shopId,
              posOrderId: posOrder.posOrderId,
              posWarehouseRef,
              warehouseId,
              customerName: posOrder.customerName,
              customerPhone: posOrder.customerPhone,
              status: lines.length === 0
                ? WmsFulfillmentOrderStatus.ISSUE
                : WmsFulfillmentOrderStatus.RESTOCKING,
              issueReason: lines.length === 0 ? 'Order has no pickable variation items' : null,
              totalQuantity,
              lastSyncedAt: new Date(),
              lines: {
                create: lines.map((line) => ({
                  tenantId: posOrder.tenantId,
                  productId: line.productId,
                  variationId: line.variationId,
                  productName: line.productName,
                  productDisplayId: line.productDisplayId,
                  quantityRequired: line.quantityRequired,
                  lineSnapshot: line.lineSnapshot,
                  status: WmsFulfillmentLineStatus.RESTOCKING,
                })),
              },
            },
            select: {
              id: true,
              status: true,
            },
          });
        }

        if (
          existing.status === WmsFulfillmentOrderStatus.IN_PICKING
          || existing.status === WmsFulfillmentOrderStatus.READY_FOR_PACK
          || existing.status === WmsFulfillmentOrderStatus.PICKED
          || existing.status === WmsFulfillmentOrderStatus.CANCELED
        ) {
          return existing;
        }

        await tx.wmsFulfillmentOrder.update({
          where: { id: existing.id },
          data: {
            teamId: posOrder.teamId ?? store.teamId,
            posWarehouseRef,
            warehouseId,
            customerName: posOrder.customerName,
            customerPhone: posOrder.customerPhone,
            totalQuantity,
            issueReason: lines.length === 0 ? 'Order has no pickable variation items' : null,
            lastSyncedAt: new Date(),
          },
        });

        if (lines.length === 0) {
          await tx.wmsFulfillmentOrder.update({
            where: { id: existing.id },
            data: { status: WmsFulfillmentOrderStatus.ISSUE },
          });
          return existing;
        }

        await Promise.all(lines.map((line) => (
          tx.wmsFulfillmentLine.upsert({
            where: {
              fulfillmentOrderId_variationId: {
                fulfillmentOrderId: existing.id,
                variationId: line.variationId,
              },
            },
            create: {
              fulfillmentOrderId: existing.id,
              tenantId: posOrder.tenantId,
              productId: line.productId,
              variationId: line.variationId,
              productName: line.productName,
              productDisplayId: line.productDisplayId,
              quantityRequired: line.quantityRequired,
              lineSnapshot: line.lineSnapshot,
              status: WmsFulfillmentLineStatus.RESTOCKING,
            },
            update: {
              productId: line.productId,
              productName: line.productName,
              productDisplayId: line.productDisplayId,
              quantityRequired: line.quantityRequired,
              lineSnapshot: line.lineSnapshot,
              issueReason: null,
            },
          })
        )));

        await tx.wmsFulfillmentLine.updateMany({
          where: {
            fulfillmentOrderId: existing.id,
            variationId: {
              notIn: lines.map((line) => line.variationId),
            },
            reservations: {
              none: {
                status: { in: [...ACTIVE_PICK_RESERVATION_STATUSES] },
              },
            },
          },
          data: {
            status: WmsFulfillmentLineStatus.CANCELED,
            quantityRequired: 0,
          },
        });

        return existing;
      });

      if (
        fulfillmentOrder.status !== WmsFulfillmentOrderStatus.IN_PICKING
        && fulfillmentOrder.status !== WmsFulfillmentOrderStatus.READY_FOR_PACK
        && fulfillmentOrder.status !== WmsFulfillmentOrderStatus.PICKED
        && fulfillmentOrder.status !== WmsFulfillmentOrderStatus.CANCELED
      ) {
        await this.allocateFulfillmentOrder(fulfillmentOrder.id, params.actorId);
      }
    }
  }

  private async allocateFulfillmentOrder(fulfillmentOrderId: string, actorId: string | null) {
    await this.prisma.$transaction(async (tx) => {
      const order = await tx.wmsFulfillmentOrder.findUnique({
        where: { id: fulfillmentOrderId },
        include: {
          lines: {
            include: {
              reservations: {
                where: {
                  status: { in: [...ACTIVE_PICK_RESERVATION_STATUSES] },
                },
              },
            },
          },
        },
      });

      if (
        !order
        || order.status === WmsFulfillmentOrderStatus.READY_FOR_PACK
        || order.status === WmsFulfillmentOrderStatus.PICKED
        || order.status === WmsFulfillmentOrderStatus.CANCELED
      ) {
        return;
      }

      for (const line of order.lines) {
        if (line.quantityRequired <= 0 || line.status === WmsFulfillmentLineStatus.CANCELED) {
          continue;
        }

        const activeReservationCount = line.reservations.length;
        const missingQuantity = Math.max(line.quantityRequired - activeReservationCount, 0);

        if (missingQuantity <= 0) {
          if (line.issueReason) {
            await tx.wmsFulfillmentLine.update({
              where: { id: line.id },
              data: { issueReason: null },
            });
          }
          continue;
        }

        const availableUnits = await this.findAvailablePickUnitsForLine(tx, {
          order,
          variationId: line.variationId,
          take: missingQuantity,
        });

        for (const [index, unit] of availableUnits.entries()) {
          await tx.wmsPickReservation.upsert({
            where: {
              fulfillmentLineId_inventoryUnitId: {
                fulfillmentLineId: line.id,
                inventoryUnitId: unit.id,
              },
            },
            create: {
              fulfillmentOrderId: order.id,
              fulfillmentLineId: line.id,
              tenantId: order.tenantId,
              inventoryUnitId: unit.id,
              status: WmsPickReservationStatus.RESERVED,
              sequence: activeReservationCount + index + 1,
              reservedById: actorId,
              reservedAt: new Date(),
            },
            update: {
              status: WmsPickReservationStatus.RESERVED,
              sequence: activeReservationCount + index + 1,
              reservedById: actorId,
              reservedAt: new Date(),
              pickedById: null,
              pickedAt: null,
            },
          });

          await tx.wmsInventoryUnit.update({
            where: { id: unit.id },
            data: {
              status: WmsInventoryUnitStatus.RESERVED,
              updatedById: actorId || undefined,
            },
          });

          await tx.wmsInventoryMovement.create({
            data: {
              tenantId: unit.tenantId,
              teamId: unit.teamId,
              inventoryUnitId: unit.id,
              warehouseId: unit.warehouseId,
              fromLocationId: unit.currentLocationId,
              toLocationId: unit.currentLocationId,
              fromStatus: unit.status,
              toStatus: WmsInventoryUnitStatus.RESERVED,
              movementType: WmsInventoryMovementType.RESERVATION,
              referenceType: 'WMS_FULFILLMENT_ORDER',
              referenceId: order.id,
              referenceCode: order.posOrderId,
              notes: `STOX reserved for order ${order.posOrderId}`,
              actorId,
            },
          });
        }

        const remainingQuantity = missingQuantity - availableUnits.length;
        await tx.wmsFulfillmentLine.update({
          where: { id: line.id },
          data: {
            issueReason: remainingQuantity > 0
              ? await this.buildPickShortageReason(tx, {
                  order,
                  variationId: line.variationId,
                })
              : null,
          },
        });
      }

      await this.refreshFulfillmentOrderState(tx, order.id, new Date());
    });
  }

  private async findAvailablePickUnitsForLine(
    tx: Prisma.TransactionClient,
    params: {
      order: {
        tenantId: string;
        storeId: string;
        posWarehouseRef: string | null;
      };
      variationId: string;
      take: number;
    },
  ) {
    const baseWhere: Prisma.WmsInventoryUnitWhereInput = {
      tenantId: params.order.tenantId,
      storeId: params.order.storeId,
      variationId: params.variationId,
      status: WmsInventoryUnitStatus.PUTAWAY,
      currentLocation: {
        is: {
          kind: WmsLocationKind.BIN,
        },
      },
      pickReservations: {
        none: {
          status: { in: [...ACTIVE_PICK_RESERVATION_STATUSES] },
        },
      },
    };
    const select = {
      id: true,
      tenantId: true,
      teamId: true,
      storeId: true,
      warehouseId: true,
      currentLocationId: true,
      status: true,
      code: true,
    } satisfies Prisma.WmsInventoryUnitSelect;
    const orderBy = [
      { updatedAt: 'asc' as const },
      { code: 'asc' as const },
    ];

    if (!params.order.posWarehouseRef) {
      return tx.wmsInventoryUnit.findMany({
        where: baseWhere,
        select,
        orderBy,
        take: params.take,
      });
    }

    const exactUnits = await tx.wmsInventoryUnit.findMany({
      where: {
        ...baseWhere,
        posWarehouseRef: params.order.posWarehouseRef,
      },
      select,
      orderBy,
      take: params.take,
    });

    const remainingQuantity = params.take - exactUnits.length;
    if (remainingQuantity <= 0) {
      return exactUnits;
    }

    const fallbackUnits = await tx.wmsInventoryUnit.findMany({
      where: {
        ...baseWhere,
        posWarehouseRef: null,
        id: {
          notIn: exactUnits.map((unit) => unit.id),
        },
      },
      select,
      orderBy,
      take: remainingQuantity,
    });

    return [...exactUnits, ...fallbackUnits];
  }

  private async buildPickShortageReason(
    tx: Prisma.TransactionClient,
    params: {
      order: {
        tenantId: string;
        storeId: string;
        posWarehouseRef: string | null;
      };
      variationId: string;
    },
  ) {
    const identityWhere: Prisma.WmsInventoryUnitWhereInput = {
      tenantId: params.order.tenantId,
      storeId: params.order.storeId,
      variationId: params.variationId,
    };
    const putawayWhere: Prisma.WmsInventoryUnitWhereInput = {
      ...identityWhere,
      status: WmsInventoryUnitStatus.PUTAWAY,
    };
    const binnedWhere: Prisma.WmsInventoryUnitWhereInput = {
      ...putawayWhere,
      currentLocation: {
        is: {
          kind: WmsLocationKind.BIN,
        },
      },
    };
    const unreservedWhere: Prisma.WmsInventoryUnitWhereInput = {
      ...binnedWhere,
      pickReservations: {
        none: {
          status: { in: [...ACTIVE_PICK_RESERVATION_STATUSES] },
        },
      },
    };
    const scopedWhere: Prisma.WmsInventoryUnitWhereInput = params.order.posWarehouseRef
      ? {
          ...unreservedWhere,
          OR: [
            { posWarehouseRef: params.order.posWarehouseRef },
            { posWarehouseRef: null },
          ],
        }
      : unreservedWhere;

    const [matchingUnits, putawayUnits, binnedUnits, freeBinnedUnits, scopedUnits] = await Promise.all([
      tx.wmsInventoryUnit.count({ where: identityWhere }),
      tx.wmsInventoryUnit.count({ where: putawayWhere }),
      tx.wmsInventoryUnit.count({ where: binnedWhere }),
      tx.wmsInventoryUnit.count({ where: unreservedWhere }),
      tx.wmsInventoryUnit.count({ where: scopedWhere }),
    ]);

    if (matchingUnits === 0) {
      return 'No WMS units match this order item for this store.';
    }

    if (putawayUnits === 0) {
      return 'Matching units exist but are not put away yet.';
    }

    if (binnedUnits === 0) {
      return 'Matching units are put away but not inside a bin.';
    }

    if (freeBinnedUnits === 0) {
      return 'Matching binned units are already reserved for another order.';
    }

    if (params.order.posWarehouseRef && scopedUnits === 0) {
      return 'Matching units are in a different POS warehouse scope.';
    }

    return 'No eligible unit is available for reservation.';
  }

  private async refreshFulfillmentOrderState(
    tx: Prisma.TransactionClient,
    fulfillmentOrderId: string,
    now: Date,
  ) {
    const order = await tx.wmsFulfillmentOrder.findUnique({
      where: { id: fulfillmentOrderId },
      include: {
        lines: {
          include: {
            reservations: {
              where: {
                status: { in: [...ACTIVE_PICK_RESERVATION_STATUSES] },
              },
            },
          },
        },
      },
    });

    if (!order) {
      return;
    }

    let totalQuantity = 0;
    let allocatedQuantity = 0;
    let pickedQuantity = 0;
    let hasIssue = false;

    for (const line of order.lines) {
      const required = Math.max(line.quantityRequired, 0);
      const allocated = line.reservations.length;
      const picked = line.reservations.filter((reservation) => reservation.status === WmsPickReservationStatus.PICKED).length;
      const nextLineStatus = this.resolveFulfillmentLineStatus(required, allocated, picked, line.status);

      totalQuantity += required;
      allocatedQuantity += Math.min(allocated, required);
      pickedQuantity += Math.min(picked, required);
      hasIssue = hasIssue || nextLineStatus === WmsFulfillmentLineStatus.ISSUE;

      await tx.wmsFulfillmentLine.update({
        where: { id: line.id },
        data: {
          quantityAllocated: Math.min(allocated, required),
          quantityPicked: Math.min(picked, required),
          status: nextLineStatus,
          issueReason: nextLineStatus === WmsFulfillmentLineStatus.READY
            || nextLineStatus === WmsFulfillmentLineStatus.PICKED
            ? null
            : line.issueReason,
        },
      });
    }

    const nextOrderStatus = this.resolveFulfillmentOrderStatus({
      currentStatus: order.status,
      claimedById: order.claimedById,
      totalQuantity,
      allocatedQuantity,
      pickedQuantity,
      hasIssue,
    });

    await tx.wmsFulfillmentOrder.update({
      where: { id: order.id },
      data: {
        totalQuantity,
        allocatedQuantity,
        pickedQuantity,
        status: nextOrderStatus,
        completedAt: nextOrderStatus === WmsFulfillmentOrderStatus.READY_FOR_PACK
          ? order.completedAt ?? now
          : null,
        issueReason: totalQuantity === 0 ? order.issueReason ?? 'Order has no pickable variation items' : null,
      },
    });
  }

  private async refreshFulfillmentBasketState(
    tx: Prisma.TransactionClient,
    fulfillmentOrderId: string,
    now: Date,
  ) {
    const order = await tx.wmsFulfillmentOrder.findUnique({
      where: { id: fulfillmentOrderId },
      select: {
        status: true,
        pickedQuantity: true,
        basket: {
          select: {
            id: true,
            status: true,
            fullAt: true,
            readyForPackAt: true,
          },
        },
      },
    });

    if (!order?.basket) {
      return;
    }

    const nextStatus = order.status === WmsFulfillmentOrderStatus.READY_FOR_PACK
      || order.status === WmsFulfillmentOrderStatus.PICKED
      ? WmsBasketStatus.FULL_HELD
      : order.pickedQuantity > 0
        ? WmsBasketStatus.IN_PICKING
        : WmsBasketStatus.ASSIGNED;

    await tx.wmsBasket.update({
      where: { id: order.basket.id },
      data: {
        status: nextStatus,
        fullAt: nextStatus === WmsBasketStatus.FULL_HELD
          ? order.basket.fullAt ?? now
          : null,
        readyForPackAt: nextStatus === WmsBasketStatus.FULL_HELD
          ? order.basket.readyForPackAt ?? now
          : null,
      },
    });
  }

  private async assertAvailableBasketForClaim(
    order: { warehouseId: string | null; posOrderId: string },
    client: Prisma.TransactionClient,
  ) {
    const availableBasket = await client.wmsBasket.findFirst({
      where: {
        status: WmsBasketStatus.AVAILABLE,
        warehouseId: order.warehouseId
          ? order.warehouseId
          : { not: null },
      },
      select: {
        id: true,
      },
    });

    if (!availableBasket) {
      throw new ConflictException(
        `No available picking baskets for order ${order.posOrderId}. Release a full basket to packing or register another basket before claiming.`,
      );
    }
  }

  private resolveFulfillmentLineStatus(
    required: number,
    allocated: number,
    picked: number,
    currentStatus: WmsFulfillmentLineStatus,
  ) {
    if (currentStatus === WmsFulfillmentLineStatus.CANCELED) {
      return WmsFulfillmentLineStatus.CANCELED;
    }

    if (required <= 0) {
      return WmsFulfillmentLineStatus.ISSUE;
    }

    if (picked >= required) {
      return WmsFulfillmentLineStatus.PICKED;
    }

    if (allocated >= required) {
      return WmsFulfillmentLineStatus.READY;
    }

    if (allocated > 0) {
      return WmsFulfillmentLineStatus.PARTIAL;
    }

    return WmsFulfillmentLineStatus.RESTOCKING;
  }

  private resolveFulfillmentOrderStatus(params: {
    currentStatus: WmsFulfillmentOrderStatus;
    claimedById: string | null;
    totalQuantity: number;
    allocatedQuantity: number;
    pickedQuantity: number;
    hasIssue: boolean;
  }) {
    if (params.currentStatus === WmsFulfillmentOrderStatus.CANCELED) {
      return WmsFulfillmentOrderStatus.CANCELED;
    }

    if (params.totalQuantity <= 0 || params.hasIssue) {
      return WmsFulfillmentOrderStatus.ISSUE;
    }

    if (params.pickedQuantity >= params.totalQuantity) {
      return WmsFulfillmentOrderStatus.READY_FOR_PACK;
    }

    if (params.currentStatus === WmsFulfillmentOrderStatus.IN_PICKING && params.claimedById) {
      return WmsFulfillmentOrderStatus.IN_PICKING;
    }

    if (params.allocatedQuantity >= params.totalQuantity) {
      return WmsFulfillmentOrderStatus.READY;
    }

    if (params.allocatedQuantity > 0) {
      return WmsFulfillmentOrderStatus.PARTIAL;
    }

    return WmsFulfillmentOrderStatus.RESTOCKING;
  }

  private async extractFulfillmentLinesFromOrderSnapshot(
    orderSnapshot: Prisma.JsonValue | null,
    storeId: string,
  ): Promise<FulfillmentLineDraft[]> {
    const snapshot = this.asJsonRecord(orderSnapshot);
    const items = Array.isArray(snapshot?.items) ? snapshot.items : [];
    const groupedLines = new Map<string, FulfillmentLineDraft>();
    const identifiers = new Set<string>();

    for (const rawItem of items) {
      const item = this.asJsonRecord(rawItem);
      if (!item) {
        continue;
      }

      const variationInfo = this.asJsonRecord(item.variation_info);
      [
        this.readString(item.variation_id),
        this.readString(item.variationId),
        this.readString(item.product_id),
        this.readString(item.productId),
        this.readString(item.product_display_id),
        this.readString(item.productDisplayId),
        this.readString(variationInfo?.display_id),
        this.readString(variationInfo?.product_display_id),
        this.readString(variationInfo?.barcode),
      ].forEach((value) => {
        if (value) {
          identifiers.add(value);
        }
      });
    }

    const candidateIds = Array.from(identifiers);
    const catalogProducts = candidateIds.length > 0
      ? await this.prisma.posProduct.findMany({
          where: {
            storeId,
            OR: [
              { variationId: { in: candidateIds } },
              { productId: { in: candidateIds } },
              { customId: { in: candidateIds } },
            ],
          },
          select: {
            productId: true,
            variationId: true,
            customId: true,
            name: true,
          },
        })
      : [];
    const productByVariationId = new Map(
      catalogProducts
        .filter((product) => product.variationId)
        .map((product) => [product.variationId!, product]),
    );
    const productByProductId = new Map(
      catalogProducts.map((product) => [product.productId, product]),
    );
    const productByCustomId = new Map(
      catalogProducts
        .filter((product) => product.customId)
        .map((product) => [product.customId!, product]),
    );

    for (const rawItem of items) {
      const item = this.asJsonRecord(rawItem);
      if (!item) {
        continue;
      }

      const sourceVariationId = this.readString(item.variation_id) ?? this.readString(item.variationId);
      const sourceProductId = this.readString(item.product_id) ?? this.readString(item.productId);
      const variationInfo = this.asJsonRecord(item.variation_info);
      const sourceDisplayIds = [
        this.readString(item.product_display_id),
        this.readString(item.productDisplayId),
        this.readString(variationInfo?.product_display_id),
        this.readString(variationInfo?.display_id),
        this.readString(variationInfo?.barcode),
      ].filter(Boolean) as string[];
      const resolvedProduct =
        (sourceVariationId ? productByVariationId.get(sourceVariationId) : null)
        ?? (sourceProductId ? productByVariationId.get(sourceProductId) : null)
        ?? (sourceProductId ? productByProductId.get(sourceProductId) : null)
        ?? sourceDisplayIds.map((id) => productByCustomId.get(id)).find(Boolean)
        ?? null;
      const variationId = resolvedProduct?.variationId ?? sourceVariationId ?? sourceProductId;
      if (!variationId) {
        continue;
      }

      const quantity = this.readPositiveInt(item.quantity);
      const returnedQuantity =
        this.readPositiveInt(item.returned_count)
        + this.readPositiveInt(item.return_quantity)
        + this.readPositiveInt(item.returning_quantity);
      const requiredQuantity = Math.max(quantity - returnedQuantity, 0);
      if (requiredQuantity <= 0) {
        continue;
      }

      const productId = resolvedProduct?.productId ?? sourceProductId;
      const productName =
        this.readString(variationInfo?.name)
        ?? resolvedProduct?.name
        ?? this.readString(item.note_product)
        ?? `Variation ${variationId}`;
      const productDisplayId =
        resolvedProduct?.customId
        ?? this.readString(variationInfo?.display_id)
        ?? this.readString(variationInfo?.product_display_id)
        ?? this.readString(variationInfo?.barcode);

      const existing = groupedLines.get(variationId);
      if (existing) {
        existing.quantityRequired += requiredQuantity;
        continue;
      }

      groupedLines.set(variationId, {
        variationId,
        productId,
        productName,
        productDisplayId,
        quantityRequired: requiredQuantity,
        lineSnapshot: {
          variationId,
          productId,
          productName,
          productDisplayId,
          sourceVariationId,
          sourceProductId,
          sourceItem: item,
        } as Prisma.InputJsonValue,
      });
    }

    return Array.from(groupedLines.values());
  }

  private extractPosWarehouseRef(orderSnapshot: Prisma.JsonValue | null) {
    const snapshot = this.asJsonRecord(orderSnapshot);
    return (
      this.readString(snapshot?.warehouse_id)
      ?? this.readString(snapshot?.warehouseId)
      ?? null
    );
  }

  private async resolveFulfillmentWarehouseId(params: {
    tenantId: string;
    storeId: string;
    posWarehouseRef: string | null;
  }) {
    if (!params.posWarehouseRef) {
      return null;
    }

    const unit = await this.prisma.wmsInventoryUnit.findFirst({
      where: {
        tenantId: params.tenantId,
        storeId: params.storeId,
        posWarehouseRef: params.posWarehouseRef,
      },
      select: {
        warehouseId: true,
      },
    });

    return unit?.warehouseId ?? null;
  }

  private async findPickingOrderForAction(
    user: BootstrapUser,
    id: string,
    requestedTenantId?: string | null,
    request?: Request,
  ) {
    const tenantContext = await this.resolveMobileStockContext(
      user,
      { tenantId: requestedTenantId ?? undefined } as GetWmsMobileStockDto,
      request,
    );
    const order = await this.prisma.wmsFulfillmentOrder.findFirst({
      where: {
        id,
        ...(tenantContext.tenantId ? { tenantId: tenantContext.tenantId } : {}),
      },
      include: this.pickingTaskInclude(),
    });

    if (!order) {
      throw new NotFoundException('Pick task was not found');
    }

    const userId = user.userId || user.id || null;
    if (userId) {
      const [access, taskAssignment] = await Promise.all([
        this.effectiveAccessService.resolveUserAccess({
          userId,
          ...(order.tenantId ? { tenantId: order.tenantId } : {}),
          basePermissions: Array.isArray(user.permissions) ? user.permissions : [],
          workspace: 'wms',
        }),
        this.getWmsTaskAssignment(userId),
      ]);
      this.assertPickExecutionAccess(user, access.permissions, taskAssignment);
    }

    return order;
  }

  private assertPickingTaskClaimedByUser(
    order: any,
    userId: string | null,
    options: { allowReadyWithoutBasket?: boolean } = {},
  ) {
    if (!userId) {
      throw new ForbiddenException('Missing WMS user context');
    }

    const isReadyBasketScan = options.allowReadyWithoutBasket
      && order.status === WmsFulfillmentOrderStatus.READY
      && !order.basket;

    if (order.status !== WmsFulfillmentOrderStatus.IN_PICKING && !isReadyBasketScan) {
      throw new BadRequestException(`Order ${order.posOrderId} must be claimed before scanning`);
    }

    if (order.claimedById !== userId) {
      throw new ForbiddenException('This pick task is assigned to another staff member');
    }
  }

  private assertPickingTaskHasBasket(order: any) {
    if (!order.basket) {
      throw new BadRequestException(`Scan a basket before picking order ${order.posOrderId}`);
    }
  }

  private getAllPickReservations(order: any) {
    return order.lines.flatMap((line: any) => line.reservations);
  }

  private getPendingPickReservations(order: any) {
    return this.getAllPickReservations(order).filter(
      (reservation: any) => reservation.status === WmsPickReservationStatus.RESERVED,
    );
  }

  private pickingTaskInclude() {
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
      posOrder: {
        select: {
          insertedAt: true,
          dateLocal: true,
        },
      },
      basket: {
        select: {
          id: true,
          barcode: true,
          status: true,
          warehouseId: true,
          claimedAt: true,
          fullAt: true,
          readyForPackAt: true,
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
        },
      },
      lines: {
        include: {
          reservations: {
            include: {
              inventoryUnit: {
                select: {
                  id: true,
                  code: true,
                  barcode: true,
                  status: true,
                  productId: true,
                  variationId: true,
                  warehouseId: true,
                  currentLocationId: true,
                  posProduct: {
                    select: {
                      id: true,
                      name: true,
                      customId: true,
                    },
                  },
                  warehouse: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                    },
                  },
                  currentLocation: {
                    select: {
                      id: true,
                      code: true,
                      barcode: true,
                      name: true,
                      kind: true,
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

  private mobileBasketInclude() {
    return {
      warehouse: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
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
      fulfillmentOrder: {
        include: this.pickingTaskInclude(),
      },
    } satisfies Prisma.WmsBasketInclude;
  }

  private mapMobilePickingTask(task: any) {
    const lines = Array.isArray(task.lines)
      ? task.lines.filter((line: any) => (
          line.status !== WmsFulfillmentLineStatus.CANCELED
          && Math.max(line.quantityRequired ?? 0, 0) > 0
        ))
      : [];
    const reservations = this.getAllPickReservations({ lines });
    const pendingReservations = reservations.filter(
      (reservation: any) => reservation.status === WmsPickReservationStatus.RESERVED,
    );
    const nextReservation = pendingReservations[0] ?? null;

    return {
      id: task.id,
      posOrderId: task.posOrderId,
      shopId: task.shopId,
      status: task.status,
      statusLabel: this.formatEnumLabel(task.status),
      issueReason: task.issueReason,
      customer: {
        name: task.customerName,
        phone: task.customerPhone,
      },
      totals: {
        required: task.totalQuantity,
        allocated: task.allocatedQuantity,
        picked: task.pickedQuantity,
        remaining: Math.max(task.totalQuantity - task.pickedQuantity, 0),
      },
      store: task.store
        ? {
            id: task.store.id,
            tenantId: task.store.tenantId,
            name: task.store.shopName || task.store.name,
            tenantName: task.store.tenant?.name ?? null,
          }
        : null,
      warehouse: task.warehouse,
      claimedBy: this.mapActor(task.claimedBy),
      claimedAt: task.claimedAt,
      completedAt: task.completedAt,
      orderDate: task.posOrder?.insertedAt ?? task.createdAt,
      orderDateLocal: task.posOrder?.dateLocal ?? null,
      createdAt: task.createdAt,
      basket: task.basket ? this.mapMobilePickBasket(task.basket) : null,
      lines: lines.map((line: any) => ({
        id: line.id,
        variationId: line.variationId,
        productId: line.productId,
        productName: line.productName,
        productDisplayId: line.productDisplayId,
        status: line.status,
        statusLabel: this.formatEnumLabel(line.status),
        issueReason: line.issueReason ?? null,
        required: line.quantityRequired,
        allocated: line.quantityAllocated,
        picked: line.quantityPicked,
        shortage: Math.max(line.quantityRequired - line.quantityAllocated, 0),
        reservations: line.reservations.map((reservation: any) => this.mapMobilePickReservation(reservation)),
      })),
      nextPick: nextReservation ? this.mapMobilePickReservation(nextReservation) : null,
    };
  }

  private mapMobilePickBasket(basket: any) {
    return {
      id: basket.id,
      barcode: basket.barcode,
      status: basket.status,
      statusLabel: this.formatEnumLabel(basket.status),
      warehouse: basket.warehouse
        ? {
            id: basket.warehouse.id,
            code: basket.warehouse.code,
            name: basket.warehouse.name,
          }
        : null,
      assignedPicker: basket.assignedPicker
        ? this.mapActor(basket.assignedPicker)
        : null,
      assignedPacker: basket.assignedPacker
        ? this.mapActor(basket.assignedPacker)
        : null,
      claimedAt: basket.claimedAt ?? null,
      fullAt: basket.fullAt ?? null,
      readyForPackAt: basket.readyForPackAt ?? null,
    };
  }

  private mapMobileHeldBasket(basket: any) {
    return {
      ...this.mapMobilePickBasket(basket),
      task: basket.fulfillmentOrder ? this.mapMobilePickingTask(basket.fulfillmentOrder) : null,
    };
  }

  private mapMobileBasketLookup(basket: any) {
    return {
      ...this.mapMobilePickBasket(basket),
      task: basket.fulfillmentOrder ? this.mapMobilePickingTask(basket.fulfillmentOrder) : null,
    };
  }

  private mapMobilePickReservation(reservation: any) {
    return {
      id: reservation.id,
      status: reservation.status,
      statusLabel: this.formatEnumLabel(reservation.status),
      sequence: reservation.sequence,
      lineId: reservation.fulfillmentLineId,
      unit: {
        id: reservation.inventoryUnit.id,
        code: reservation.inventoryUnit.code,
        barcode: reservation.inventoryUnit.barcode,
        status: reservation.inventoryUnit.status,
        statusLabel: this.formatEnumLabel(reservation.inventoryUnit.status),
        productId: reservation.inventoryUnit.productId,
        variationId: reservation.inventoryUnit.variationId,
        name: reservation.inventoryUnit.posProduct.name,
        customId: reservation.inventoryUnit.posProduct.customId,
        warehouse: reservation.inventoryUnit.warehouse,
        currentLocation: reservation.inventoryUnit.currentLocation
          ? this.mapLocation(reservation.inventoryUnit.currentLocation)
          : null,
      },
      pickedAt: reservation.pickedAt,
    };
  }

  private mapPickingSummary(
    statusGroups: Array<{ status: WmsFulfillmentOrderStatus; _count: { _all: number } }>,
  ) {
    const counts = Object.fromEntries(
      statusGroups.map((group) => [group.status, group._count._all]),
    ) as Partial<Record<WmsFulfillmentOrderStatus, number>>;

    return {
      ready: counts[WmsFulfillmentOrderStatus.READY] ?? 0,
      partial: counts[WmsFulfillmentOrderStatus.PARTIAL] ?? 0,
      restocking: counts[WmsFulfillmentOrderStatus.RESTOCKING] ?? 0,
      issue: counts[WmsFulfillmentOrderStatus.ISSUE] ?? 0,
      inPicking: counts[WmsFulfillmentOrderStatus.IN_PICKING] ?? 0,
      readyForPack: counts[WmsFulfillmentOrderStatus.READY_FOR_PACK] ?? 0,
      picked: counts[WmsFulfillmentOrderStatus.PICKED] ?? 0,
    };
  }

  private async getWmsTaskAssignment(userId: string) {
    const assignment = await this.prisma.wmsStaffAssignment.findUnique({
      where: { userId },
      select: {
        taskType: true,
      },
    });

    return assignment?.taskType ?? null;
  }

  private assertPickExecutionAccess(
    user: BootstrapUser,
    permissions: string[],
    taskAssignment: WmsStaffAssignmentTaskType | null,
  ) {
    if (user.role === 'SUPER_ADMIN' || this.hasAnyRequiredPermission(permissions, PICK_SUPERVISOR_PERMISSIONS)) {
      return;
    }

    if (!this.hasAnyRequiredPermission(permissions, PICK_ASSIGNMENT_PERMISSIONS)) {
      throw new ForbiddenException('This account does not have WMS picking permissions');
    }

    if (taskAssignment !== WmsStaffAssignmentTaskType.PICK) {
      throw new ForbiddenException('This account is not assigned to PICK in WMS Web');
    }
  }

  private async listPackingHandoffCandidates() {
    const users = await this.prisma.user.findMany({
      where: {
        tenantId: null,
        status: UserStatus.ACTIVE,
        wmsStaffAssignment: {
          is: {
            taskType: WmsStaffAssignmentTaskType.PACK,
          },
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        employeeId: true,
      },
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' },
        { email: 'asc' },
      ],
    });

    const resolved = await Promise.all(users.map(async (candidate) => {
      const access = await this.effectiveAccessService.resolveUserAccess({
        userId: candidate.id,
        workspace: 'wms',
      });

      if (!this.hasAnyRequiredPermission(access.permissions, PACK_HANDOFF_PERMISSIONS)) {
        return null;
      }

      return {
        id: candidate.id,
        name: this.formatActorName(candidate.firstName, candidate.lastName, candidate.email),
        email: candidate.email,
        employeeId: candidate.employeeId ?? null,
      };
    }));

    return resolved.filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));
  }

  private async findPackingHandoffCandidate(userId: string) {
    const candidates = await this.listPackingHandoffCandidates();
    return candidates.find((candidate) => candidate.id === userId) ?? null;
  }

  private buildEmptyPickingResponse(tenantReady: boolean) {
    return {
      tenantReady,
      serverTime: new Date().toISOString(),
      pagination: {
        page: 1,
        pageSize: DEFAULT_PICKING_PAGE_SIZE,
        total: 0,
        hasMore: false,
      },
      context: {
        tenantOptions: [],
        activeTenantId: null,
        activeStoreId: null,
        stores: [],
        packerOptions: [],
      },
      summary: {
        ready: 0,
        partial: 0,
        restocking: 0,
        issue: 0,
        inPicking: 0,
        readyForPack: 0,
        picked: 0,
      },
      picker: {
        registeredBaskets: 0,
        activeLoad: 0,
        availableSlots: 0,
        heldBaskets: 0,
        fullHeldBaskets: 0,
      },
      availableBaskets: [],
      heldBaskets: [],
      pickedHistory: [],
      tasks: [],
    };
  }

  private asJsonRecord(value: unknown): Record<string, any> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, any>
      : null;
  }

  private readString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0
      ? value.trim()
      : null;
  }

  private readPositiveInt(value: unknown) {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) {
      return 0;
    }

    return Math.max(Math.trunc(parsed), 0);
  }

  private hasAnyRequiredPermission(
    permissions: string[],
    requiredPermissions: readonly string[],
  ) {
    return requiredPermissions.some((permission) => permissions.includes(permission));
  }

  private formatActorName(
    firstName: string | null,
    lastName: string | null,
    fallback: string,
  ) {
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
    return fullName || fallback;
  }

  private async findUnitByCode(code: string, tenantId: string | null) {
    const normalizedCode = this.normalizeScannedCode(code);
    return this.prisma.wmsInventoryUnit.findFirst({
      where: {
        ...(tenantId ? { tenantId } : {}),
        OR: [
          { code: normalizedCode },
          { barcode: normalizedCode },
          ...(this.isUuid(normalizedCode) ? [{ id: normalizedCode }] : []),
        ],
      },
      include: this.mobileUnitInclude(),
    });
  }

  private async findUnitById(id: string, tenantId: string | null) {
    return this.prisma.wmsInventoryUnit.findFirst({
      where: {
        id,
        ...(tenantId ? { tenantId } : {}),
      },
      include: this.mobileUnitInclude(),
    });
  }

  private async findLocationByCode(code: string) {
    const normalizedCode = this.normalizeScannedCode(code);
    const candidates = await this.buildLocationLookupCandidates(normalizedCode);
    return this.prisma.wmsLocation.findFirst({
      where: {
        isActive: true,
        OR: this.buildLocationLookupWhere(candidates, normalizedCode),
      },
      include: {
        warehouse: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });
  }

  private async findBatchByCode(code: string, tenantId: string | null) {
    const normalizedCode = this.normalizeScannedCode(code);
    return this.prisma.wmsReceivingBatch.findFirst({
      where: {
        ...(tenantId ? { tenantId } : {}),
        OR: [
          { code: normalizedCode },
          ...(this.isUuid(normalizedCode) ? [{ id: normalizedCode }] : []),
        ],
      },
      include: this.mobileBatchInclude(),
    });
  }

  private async findBatchById(id: string, tenantId: string | null) {
    return this.prisma.wmsReceivingBatch.findFirst({
      where: {
        id,
        ...(tenantId ? { tenantId } : {}),
      },
      include: this.mobileBatchInclude(),
    });
  }

  private async buildMobileBinDetail(id: string, tenantId: string | null) {
    const bin = await this.prisma.wmsLocation.findUnique({
      where: { id },
      include: {
        warehouse: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        inventoryUnits: {
          where: {
            ...(tenantId ? { tenantId } : {}),
          },
          select: {
            id: true,
            code: true,
            barcode: true,
            status: true,
            updatedAt: true,
            posProduct: {
              select: {
                id: true,
                name: true,
                customId: true,
              },
            },
          },
          orderBy: [{ updatedAt: 'desc' }],
          take: 20,
        },
        _count: {
          select: {
            inventoryUnits: true,
          },
        },
      },
    });

    if (!bin || !bin.isActive) {
      return null;
    }

    const occupiedUnits = bin._count.inventoryUnits;
    const availableUnits = bin.capacity === null ? null : Math.max(bin.capacity - occupiedUnits, 0);

    return {
      id: bin.id,
      code: bin.code,
      barcode: bin.barcode,
      name: bin.name,
      kind: bin.kind,
      label: `${bin.warehouse.code} · ${bin.code}`,
      warehouse: bin.warehouse,
      capacity: bin.capacity,
      occupiedUnits,
      availableUnits,
      isFull: bin.capacity !== null ? occupiedUnits >= bin.capacity : false,
      units: bin.inventoryUnits.map((unit) => ({
        id: unit.id,
        code: unit.code,
        barcode: unit.barcode,
        status: unit.status,
        statusLabel: this.formatEnumLabel(unit.status),
        name: unit.posProduct.name,
        customId: unit.posProduct.customId,
        updatedAt: unit.updatedAt,
      })),
    };
  }

  private async resolveTargetLocation(targetCode: string, warehouseId: string) {
    const code = this.normalizeScannedCode(targetCode);
    const candidates = await this.buildLocationLookupCandidates(code, warehouseId);
    const targetSelect = {
      id: true,
      code: true,
      name: true,
      kind: true,
      warehouseId: true,
      capacity: true,
      warehouse: {
        select: {
          code: true,
          name: true,
        },
      },
    } satisfies Prisma.WmsLocationSelect;

    const target = await this.prisma.wmsLocation.findFirst({
      where: {
        warehouseId,
        isActive: true,
        OR: this.buildLocationLookupWhere(candidates, code),
      },
      select: targetSelect,
    });

    if (target) {
      return this.toMobileTargetLocation(target);
    }

    const targetInAnotherWarehouse = await this.prisma.wmsLocation.findFirst({
      where: {
        isActive: true,
        OR: this.buildLocationLookupWhere(candidates, code),
      },
      select: targetSelect,
    });

    if (targetInAnotherWarehouse) {
      throw new BadRequestException(
        `Target bin ${targetInAnotherWarehouse.code} belongs to ${targetInAnotherWarehouse.warehouse.code}, not this unit warehouse`,
      );
    }

    const targetWarehouse = await this.prisma.wmsWarehouse.findUnique({
      where: { id: warehouseId },
      select: { code: true },
    });

    if (!targetWarehouse) {
      throw new BadRequestException('Target location was not found in this warehouse');
    }

    throw new BadRequestException(
      `Target location ${code} was not found in warehouse ${targetWarehouse.code}`,
    );
  }

  private async buildLocationLookupCandidates(rawCode: string, warehouseId?: string) {
    const code = this.normalizeScannedCode(rawCode);
    const candidates = new Set<string>();
    this.addLocationLookupCandidate(candidates, code);

    if (!code) {
      return [];
    }

    const warehouses = warehouseId
      ? await this.prisma.wmsWarehouse.findMany({
          where: { id: warehouseId },
          select: { code: true },
        })
      : await this.prisma.wmsWarehouse.findMany({
          select: { code: true },
    });

    warehouses.forEach((warehouse) => {
      [`WMS-${warehouse.code}-`, `${warehouse.code}-`].forEach((prefix) => {
        if (code.toUpperCase().startsWith(prefix.toUpperCase())) {
          const stripped = code.slice(prefix.length).trim();

          if (stripped.length > 0) {
            this.addLocationLookupCandidate(candidates, stripped);
          }
        }
      });
    });

    return Array.from(candidates);
  }

  private buildLocationLookupWhere(candidates: string[], scannedCode: string): Prisma.WmsLocationWhereInput[] {
    return [
      ...candidates.flatMap((candidate) => [
        { code: { equals: candidate, mode: 'insensitive' as const } },
        { barcode: { equals: candidate, mode: 'insensitive' as const } },
      ]),
      ...(this.isUuid(scannedCode) ? [{ id: scannedCode }] : []),
    ];
  }

  private addLocationLookupCandidate(candidates: Set<string>, value: string) {
    const normalized = this.normalizeScannedCode(value);

    if (!normalized) {
      return;
    }

    candidates.add(normalized);
    candidates.add(normalized.toUpperCase());
  }

  private toMobileTargetLocation(
    target: Prisma.WmsLocationGetPayload<{
      select: {
        id: true;
        code: true;
        name: true;
        kind: true;
        warehouseId: true;
        capacity: true;
        warehouse: {
          select: {
            code: true;
            name: true;
          };
        };
      };
    }>,
  ) {
    return {
      id: target.id,
      code: target.code,
      name: target.name,
      kind: target.kind,
      warehouseId: target.warehouseId,
      capacity: target.capacity,
    };
  }

  private async assertActionTenantAccess(
    user: BootstrapUser,
    requestedTenantId: string | null | undefined,
    unitTenantId: string,
    request?: Request,
  ) {
    const tenantContext = await this.resolveMobileStockContext(
      user,
      { tenantId: requestedTenantId ?? undefined },
      request,
    );

    if (tenantContext.tenantId && tenantContext.tenantId !== unitTenantId) {
      throw new ForbiddenException('Selected unit is outside the active Partner scope');
    }
  }

  private async assertLocationCapacity(
    tx: Prisma.TransactionClient,
    targetLocationId: string,
    targetCode: string,
    capacity: number | null,
    demand: number,
    sourceLocationId: string | null,
  ) {
    if (capacity === null) {
      throw new BadRequestException(`Bin ${targetCode} is missing a capacity setting`);
    }

    if (sourceLocationId === targetLocationId) {
      return;
    }

    const occupiedUnits = await tx.wmsInventoryUnit.count({
      where: {
        currentLocationId: targetLocationId,
      },
    });
    const availableUnits = Math.max(capacity - occupiedUnits, 0);

    if (demand > availableUnits) {
      throw new BadRequestException(
        `Bin ${targetCode} has space for ${availableUnits} more unit${availableUnits === 1 ? '' : 's'}`,
      );
    }
  }

  private async refreshReceivingBatchPutawayState(
    tx: Prisma.TransactionClient,
    receivingBatchId: string,
    actorId: string | null,
    now: Date,
  ) {
    const [totalUnits, putAwayUnits] = await Promise.all([
      tx.wmsInventoryUnit.count({
        where: {
          receivingBatchId,
        },
      }),
      tx.wmsInventoryUnit.count({
        where: {
          receivingBatchId,
          status: WmsInventoryUnitStatus.PUTAWAY,
          currentLocation: {
            is: {
              kind: WmsLocationKind.BIN,
            },
          },
        },
      }),
    ]);

    const nextStatus =
      totalUnits > 0 && putAwayUnits === totalUnits
        ? WmsReceivingBatchStatus.COMPLETED
        : WmsReceivingBatchStatus.PUTAWAY_PENDING;

    await tx.wmsReceivingBatch.update({
      where: { id: receivingBatchId },
      data: {
        status: nextStatus,
        completedAt: nextStatus === WmsReceivingBatchStatus.COMPLETED ? now : null,
        ...(actorId ? { updatedById: actorId } : {}),
      },
    });
  }

  private mobileUnitInclude() {
    return {
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      store: {
        select: {
          id: true,
          name: true,
          shopName: true,
        },
      },
      warehouse: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
      currentLocation: {
        select: {
          id: true,
          code: true,
          barcode: true,
          name: true,
          kind: true,
        },
      },
      receivingBatch: {
        select: {
          id: true,
          code: true,
          status: true,
        },
      },
      posProduct: {
        select: {
          id: true,
          name: true,
          customId: true,
        },
      },
      movements: {
        include: {
          fromLocation: {
            select: {
              id: true,
              code: true,
              name: true,
              kind: true,
            },
          },
          toLocation: {
            select: {
              id: true,
              code: true,
              name: true,
              kind: true,
            },
          },
          actor: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
        take: 8,
      },
    } satisfies Prisma.WmsInventoryUnitInclude;
  }

  private mobileBatchInclude() {
    return {
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      store: {
        select: {
          id: true,
          name: true,
          shopName: true,
        },
      },
      warehouse: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
      stagingLocation: {
        select: {
          id: true,
          code: true,
          name: true,
          kind: true,
        },
      },
      inventoryUnits: {
        include: {
          posProduct: {
            select: {
              id: true,
              name: true,
              customId: true,
            },
          },
          currentLocation: {
            select: {
              id: true,
              code: true,
              name: true,
              kind: true,
            },
          },
        },
        orderBy: [{ updatedAt: 'desc' }],
        take: 30,
      },
      _count: {
        select: {
          inventoryUnits: true,
        },
      },
    } satisfies Prisma.WmsReceivingBatchInclude;
  }

  private mapMobileUnitDetail(unit: any) {
    return {
      id: unit.id,
      tenantId: unit.tenantId,
      tenant: unit.tenant,
      store: {
        id: unit.store.id,
        name: unit.store.shopName || unit.store.name,
      },
      warehouse: unit.warehouse,
      code: unit.code,
      barcode: unit.barcode,
      status: unit.status,
      statusLabel: this.formatEnumLabel(unit.status),
      productId: unit.productId,
      variationId: unit.variationId,
      name: unit.posProduct.name,
      customId: unit.posProduct.customId,
      receivingBatch: unit.receivingBatch
        ? {
            id: unit.receivingBatch.id,
            code: unit.receivingBatch.code,
            status: unit.receivingBatch.status,
            statusLabel: this.formatEnumLabel(unit.receivingBatch.status),
          }
        : null,
      currentLocation: unit.currentLocation ? this.mapLocation(unit.currentLocation) : null,
      allowedActions: {
        putaway: this.isMobilePutawayCandidate(unit),
        move: this.isMobileMoveCandidate(unit),
      },
      movements: Array.isArray(unit.movements)
        ? unit.movements.map((movement: any) => this.mapMobileMovement(movement))
        : [],
      updatedAt: unit.updatedAt,
    };
  }

  private isMobilePutawayCandidate(unit: {
    status: WmsInventoryUnitStatus;
    currentLocationId?: string | null;
    currentLocation?: { kind: WmsLocationKind } | null;
  }) {
    return (
      MOBILE_PUTAWAY_SOURCE_STATUSES.has(unit.status)
      && Boolean(unit.currentLocationId)
      && unit.currentLocation?.kind === WmsLocationKind.RECEIVING_STAGING
    );
  }

  private isMobileMoveCandidate(unit: {
    status: WmsInventoryUnitStatus;
    currentLocationId?: string | null;
    currentLocation?: { kind: WmsLocationKind } | null;
  }) {
    return (
      Boolean(unit.currentLocationId)
      && STOCK_TRANSFERABLE_UNIT_STATUSES.includes(unit.status as typeof STOCK_TRANSFERABLE_UNIT_STATUSES[number])
      && !this.isMobilePutawayCandidate(unit)
    );
  }

  private assertMobileActionPreconditions(
    unit: {
      code: string;
      status: WmsInventoryUnitStatus;
      currentLocationId?: string | null;
      updatedAt: Date;
    },
    body: WmsMobileStockMoveDto,
  ) {
    if (body.expectedStatus && body.expectedStatus !== unit.status) {
      throw new ConflictException(
        `Unit ${unit.code} changed from ${body.expectedStatus} to ${unit.status}. Rescan before continuing.`,
      );
    }

    if (body.expectedCurrentLocationId !== undefined) {
      const expectedLocationId = body.expectedCurrentLocationId ?? null;
      const actualLocationId = unit.currentLocationId ?? null;

      if (expectedLocationId !== actualLocationId) {
        throw new ConflictException(`Unit ${unit.code} moved after it was scanned. Rescan before continuing.`);
      }
    }

    if (body.expectedUpdatedAt) {
      const expectedUpdatedAt = new Date(body.expectedUpdatedAt);

      if (Number.isNaN(expectedUpdatedAt.getTime())) {
        throw new BadRequestException('Invalid expected unit timestamp');
      }

      if (expectedUpdatedAt.getTime() !== unit.updatedAt.getTime()) {
        throw new ConflictException(`Unit ${unit.code} changed after it was scanned. Rescan before continuing.`);
      }
    }
  }

  private mapMobileBatchDetail(batch: any) {
    return {
      id: batch.id,
      tenantId: batch.tenantId,
      tenant: batch.tenant,
      code: batch.code,
      status: batch.status,
      statusLabel: this.formatEnumLabel(batch.status),
      store: {
        id: batch.store.id,
        name: batch.store.shopName || batch.store.name,
      },
      warehouse: batch.warehouse,
      stagingLocation: batch.stagingLocation ? this.mapLocation(batch.stagingLocation) : null,
      unitCount: batch._count?.inventoryUnits ?? batch.inventoryUnits?.length ?? 0,
      units: Array.isArray(batch.inventoryUnits)
        ? batch.inventoryUnits.map((unit: any) => ({
            id: unit.id,
            code: unit.code,
            barcode: unit.barcode,
            status: unit.status,
            statusLabel: this.formatEnumLabel(unit.status),
            name: unit.posProduct.name,
            customId: unit.posProduct.customId,
            currentLocation: unit.currentLocation ? this.mapLocation(unit.currentLocation) : null,
            updatedAt: unit.updatedAt,
          }))
        : [],
      updatedAt: batch.updatedAt,
    };
  }

  private mapMobileMovement(movement: any) {
    return {
      id: movement.id,
      movementType: movement.movementType,
      fromStatus: movement.fromStatus,
      fromStatusLabel: movement.fromStatus ? this.formatEnumLabel(movement.fromStatus) : null,
      toStatus: movement.toStatus,
      toStatusLabel: movement.toStatus ? this.formatEnumLabel(movement.toStatus) : null,
      referenceType: movement.referenceType,
      referenceId: movement.referenceId,
      referenceCode: movement.referenceCode,
      notes: movement.notes,
      fromLocation: movement.fromLocation ? this.mapLocation(movement.fromLocation) : null,
      toLocation: movement.toLocation ? this.mapLocation(movement.toLocation) : null,
      actor: this.mapActor(movement.actor),
      createdAt: movement.createdAt,
    };
  }

  private async recordStockActivity(
    user: BootstrapUser,
    request: Request | undefined,
    activity: {
      tenantId: string | null;
      teamId: string | null;
      actionType: string;
      resourceType: string;
      resourceId: string | null;
      storeId?: string | null;
      warehouseId?: string | null;
      metadata?: Record<string, unknown>;
    },
  ) {
    await this.wmsStaffActivityService.recordFromRequest({
      request,
      tenantId: activity.tenantId,
      actorId: user.userId || user.id || null,
      teamId: activity.teamId,
      sessionId: (this.cls.get('sessionId') as string | undefined) || user.sessionId || null,
      actionType: activity.actionType,
      resourceType: activity.resourceType,
      resourceId: activity.resourceId,
      storeId: activity.storeId,
      warehouseId: activity.warehouseId,
      metadata: activity.metadata as Prisma.InputJsonValue | undefined,
    });
  }

  private isMobileMoveDestinationAllowed(kind: WmsLocationKind) {
    return MOBILE_MOVE_DESTINATION_KINDS.has(kind);
  }

  private resolveMobileMoveStatus(
    currentStatus: WmsInventoryUnitStatus,
    targetKind: WmsLocationKind,
  ) {
    if (targetKind === WmsLocationKind.BIN) {
      return WmsInventoryUnitStatus.PUTAWAY;
    }

    if (targetKind === WmsLocationKind.RECEIVING_STAGING) {
      return WmsInventoryUnitStatus.STAGED;
    }

    if (targetKind === WmsLocationKind.RTS) {
      return WmsInventoryUnitStatus.RTS;
    }

    if (targetKind === WmsLocationKind.DAMAGE || targetKind === WmsLocationKind.QUARANTINE) {
      return WmsInventoryUnitStatus.DAMAGED;
    }

    return currentStatus;
  }

  private buildMobileTransferCode() {
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, '')
      .slice(0, 14);
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();

    return `STOX-MV-${timestamp}-${suffix}`;
  }

  private cleanOptionalText(value?: string | null) {
    const trimmed = value?.trim();

    return trimmed && trimmed.length > 0 ? trimmed : null;
  }

  private normalizeScannedCode(value: string) {
    return value
      .normalize('NFKC')
      .replace(/[\u0000-\u001F\u007F]/g, '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/[‐‑‒–—―−]/g, '-')
      .replace(/\s*-\s*/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  private buildEmptyStockResponse(tenantReady: boolean) {
    return {
      tenantReady,
      serverTime: new Date().toISOString(),
      pagination: {
        mode: 'putaway',
        page: 1,
        pageSize: DEFAULT_STOCK_PAGE_SIZE,
        total: 0,
        hasMore: false,
      },
      context: {
        tenantOptions: [],
        activeTenantId: null,
        activeStoreId: null,
        activeWarehouseId: null,
        stores: [],
        warehouses: [],
      },
      summary: {
        totalUnits: 0,
        locatedUnits: 0,
        unlocatedUnits: 0,
        stagedUnits: 0,
        movableUnits: 0,
        putawayBatches: 0,
        transfers: 0,
        bins: 0,
      },
      putawayQueue: [],
      movableUnits: [],
      recentTransfers: [],
      bins: [],
    };
  }

  private getStockModeTotal(
    mode: WmsMobileStockMode,
    totals: Record<WmsMobileStockMode, number>,
  ) {
    return totals[mode] ?? 0;
  }

  private buildTenantSelectionBootstrap(
    user: BootstrapUser,
    userId: string | null,
    sessionId: string | null,
    tenantOptions: MobileTenantOption[],
  ) {
    return {
      tenantReady: false,
      app: {
        key: 'stox',
        phase: 1,
        mode: process.env.NODE_ENV || 'development',
      },
      session: {
        sessionId,
      },
      user: {
        id: userId,
        email: user.email ?? null,
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
        avatar: user.avatar ?? null,
        employeeId: user.employeeId ?? null,
        role: user.role ?? null,
      },
      tenant: null,
      access: {
        permissions: [],
        roles: [],
      },
      operations: {
        taskAssignment: null,
      },
      context: {
        tenantOptions,
        defaultTeamId: null,
        defaultStoreId: null,
        defaultWarehouseId: null,
        teams: [],
        stores: [],
        warehouses: [],
      },
      readiness: {
        teams: 0,
        stores: 0,
        warehouses: 0,
      },
    };
  }

  private buildPlatformBootstrap(
    user: BootstrapUser,
    userId: string,
    sessionId: string | null,
    tenantOptions: MobileTenantOption[],
  ) {
    return {
      tenantReady: true,
      app: {
        key: 'stox',
        phase: 1,
        mode: process.env.NODE_ENV || 'development',
      },
      session: {
        sessionId,
      },
      user: {
        id: userId,
        email: user.email ?? null,
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
        avatar: user.avatar ?? null,
        employeeId: user.employeeId ?? null,
        role: user.role ?? null,
      },
      tenant: null,
      access: {
        permissions: [],
        roles: [],
      },
      operations: {
        taskAssignment: null,
      },
      context: {
        tenantOptions,
        defaultTeamId: null,
        defaultStoreId: null,
        defaultWarehouseId: null,
        teams: [],
        stores: [],
        warehouses: [],
      },
      readiness: {
        teams: 0,
        stores: 0,
        warehouses: 0,
      },
    };
  }

  private async buildGlobalWmsBootstrap(
    user: BootstrapUser,
    userId: string,
    sessionId: string | null,
    tenantOptions: MobileTenantOption[],
    request?: Request,
  ) {
    const [access, taskAssignment, warehouses] = await Promise.all([
      this.effectiveAccessService.resolveUserAccess({
        userId,
        basePermissions: Array.isArray(user.permissions) ? user.permissions : [],
        workspace: 'wms',
      }),
      this.getWmsTaskAssignment(userId),
      this.prisma.wmsWarehouse.findMany({
        where: {
          status: WmsWarehouseStatus.ACTIVE,
        },
        select: {
          id: true,
          code: true,
          name: true,
          status: true,
        },
        orderBy: [{ name: 'asc' }],
      }),
    ]);

    if (!access.permissions.some((permission) => permission.startsWith('wms.'))) {
      throw new ForbiddenException('This account has no WMS access');
    }

    await this.wmsStaffActivityService.recordFromRequest({
      request,
      actorId: userId,
      sessionId,
      actionType: 'BOOTSTRAP',
      resourceType: 'STOX_APP',
      resourceId: 'phase-1',
      metadata: {
        tenantCount: tenantOptions.length,
        warehouseCount: warehouses.length,
      },
    });

    return {
      tenantReady: true,
      app: {
        key: 'stox',
        phase: 1,
        mode: process.env.NODE_ENV || 'development',
      },
      session: {
        sessionId,
      },
      user: {
        id: userId,
        email: user.email ?? null,
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
        avatar: user.avatar ?? null,
        employeeId: user.employeeId ?? null,
        role: user.role ?? null,
      },
      tenant: null,
      access: {
        permissions: access.permissions,
        roles: access.roles.map((role) => ({
          id: role.id,
          key: role.key,
          name: role.name,
          scope: role.scope,
          workspace: role.workspace,
          tenantId: role.tenantId,
          teamId: role.teamId,
        })),
      },
      operations: {
        taskAssignment,
      },
      context: {
        tenantOptions,
        defaultTeamId: null,
        defaultStoreId: null,
        defaultWarehouseId: warehouses[0]?.id ?? null,
        teams: [],
        stores: [],
        warehouses: warehouses.map((warehouse) => ({
          id: warehouse.id,
          code: warehouse.code,
          name: warehouse.name,
          status: warehouse.status,
        })),
      },
      readiness: {
        teams: 0,
        stores: 0,
        warehouses: warehouses.length,
      },
    };
  }

  private async resolveMobileStockContext(
    user: BootstrapUser,
    query: GetWmsMobileStockDto,
    request?: Request,
  ) {
    const userTenantId =
      (this.cls.get('tenantId') as string | undefined) || user.tenantId || null;

    const tenantOptions = await this.getPlatformTenantOptions();
    const requestedTenantId = query.tenantId ?? this.readRequestedTenantId(request);

    if (user.role !== 'SUPER_ADMIN' && userTenantId) {
      return {
        tenantId: userTenantId,
        tenantOptions,
      };
    }

    if (!requestedTenantId) {
      return {
        tenantId: null,
        tenantOptions,
      };
    }

    const selectedTenant = tenantOptions.find((tenant) => tenant.id === requestedTenantId);
    if (!selectedTenant) {
      throw new ForbiddenException('Selected partner is not available for STOX');
    }

    return {
      tenantId: selectedTenant.id,
      tenantOptions,
    };
  }

  private async resolveMobileTenantContext(
    user: BootstrapUser,
    request?: Request,
    options: { allowMissingPlatformTenant?: boolean } = {},
  ) {
    const userTenantId =
      (this.cls.get('tenantId') as string | undefined) || user.tenantId || null;

    const tenantOptions = await this.getPlatformTenantOptions();
    const requestedTenantId = this.readRequestedTenantId(request);

    if (user.role !== 'SUPER_ADMIN' && userTenantId) {
      return {
        tenantId: userTenantId,
        tenantOptions,
      };
    }

    if (!requestedTenantId) {
      if (options.allowMissingPlatformTenant) {
        return {
          tenantId: null,
          tenantOptions,
        };
      }

      throw new ForbiddenException('Select a tenant before using STOX');
    }

    const selectedTenant = tenantOptions.find((tenant) => tenant.id === requestedTenantId);
    if (!selectedTenant) {
      throw new ForbiddenException('Selected tenant is not available for STOX');
    }

    return {
      tenantId: selectedTenant.id,
      tenantOptions,
    };
  }

  private async getPlatformTenantOptions(): Promise<MobileTenantOption[]> {
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
      },
      orderBy: [{ name: 'asc' }],
    });
  }

  private readRequestedTenantId(request?: Request) {
    const rawTenantId = request?.headers['x-tenant-id'];
    const tenantId = Array.isArray(rawTenantId) ? rawTenantId[0] : rawTenantId;

    return typeof tenantId === 'string' && tenantId.trim().length > 0
      ? tenantId.trim()
      : null;
  }

  private mapLocation(location: {
    id: string;
    code: string;
    name: string;
    kind: WmsLocationKind;
  }) {
    return {
      id: location.id,
      code: location.code,
      name: location.name,
      kind: location.kind,
      label: `${location.code} · ${location.name}`,
    };
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

  private formatEnumLabel(value: string) {
    return value
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}
