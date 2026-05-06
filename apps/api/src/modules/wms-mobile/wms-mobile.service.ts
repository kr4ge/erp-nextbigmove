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
  TenantStatus,
  WmsInventoryMovementType,
  WmsInventoryUnitStatus,
  WmsLocationKind,
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

    const [tenant, access, teamMemberships, stores, warehouses] = await Promise.all([
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
    const [access, warehouses] = await Promise.all([
      this.effectiveAccessService.resolveUserAccess({
        userId,
        basePermissions: Array.isArray(user.permissions) ? user.permissions : [],
        workspace: 'wms',
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
