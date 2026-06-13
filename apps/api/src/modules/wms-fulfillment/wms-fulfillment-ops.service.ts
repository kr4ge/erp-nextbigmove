import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  Prisma,
  WmsBasketStatus,
  WmsBasketUnitStatus,
  WmsFulfillmentAssignmentMode,
  WmsFulfillmentLineStatus,
  WmsFulfillmentOrderStatus,
  WmsInventoryMovementType,
  WmsInventoryUnitStatus,
  WmsLocationKind,
  WmsPickReservationStatus,
} from '@prisma/client';
import type { Request } from 'express';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WmsStaffActivityService } from '../../common/services/wms-staff-activity.service';
import { GetWmsFulfillmentOpsSnapshotDto } from './dto/get-wms-fulfillment-ops-snapshot.dto';
import { RecalculateWmsDemandCountsDto } from './dto/recalculate-wms-demand-counts.dto';
import { RepairWmsDemandBasketsDto } from './dto/repair-wms-demand-baskets.dto';

const DEFAULT_OPS_LIMIT = 25;
const DEFAULT_STALE_MINUTES = 180;
const ACTIVE_PICK_RESERVATION_STATUSES = [
  WmsPickReservationStatus.RESERVED,
  WmsPickReservationStatus.PICKED,
] as const;
const ACTIVE_BASKET_UNIT_STATUSES = [
  WmsBasketUnitStatus.PICKED,
  WmsBasketUnitStatus.PACKED,
] as const;
const ACTIVE_DEMAND_HOLD_BASKET_STATUSES = [
  WmsBasketStatus.ASSIGNED,
  WmsBasketStatus.IN_PICKING,
  WmsBasketStatus.FULL_HELD,
] as const;
const ACTIVE_DEMAND_MONITOR_BASKET_STATUSES = [
  ...ACTIVE_DEMAND_HOLD_BASKET_STATUSES,
  WmsBasketStatus.PACKING,
] as const;
const ACTIVE_BASKET_ORDER_STATUSES = [
  WmsFulfillmentOrderStatus.IN_PICKING,
  WmsFulfillmentOrderStatus.READY_FOR_PACK,
  WmsFulfillmentOrderStatus.PICKED,
  WmsFulfillmentOrderStatus.PACKING,
] as const;
const FULFILLABLE_UNIT_STATUSES = [
  WmsInventoryUnitStatus.PUTAWAY,
  WmsInventoryUnitStatus.DEADSTOCK,
] as const;
const CONFIRMED_POS_ORDER_STATUS = 1;

type DemandHealthDemandRecord = Prisma.WmsBasketPickDemandGetPayload<{
  include: {
    basket: {
      select: {
        id: true;
        barcode: true;
        status: true;
        updatedAt: true;
      };
    };
    fulfillmentOrder: {
      select: {
        id: true;
        posOrderId: true;
        status: true;
      };
    };
    bins: {
      include: {
        location: {
          select: {
            id: true;
            code: true;
            name: true;
          };
        };
      };
    };
  };
}>;

type DemandHealthBasketUnitRecord = Prisma.WmsBasketUnitGetPayload<{
  select: {
    id: true;
    basketId: true;
    tenantId: true;
    storeId: true;
    variationId: true;
    sourceLocationId: true;
    status: true;
    fulfillmentLineId: true;
  };
}>;

type DemandMismatchRecord = {
  basketId: string;
  basketCode: string;
  basketStatus: WmsBasketStatus;
  basketUpdatedAt: Date;
  demandId: string;
  fulfillmentOrderId: string;
  fulfillmentLineId: string;
  posOrderId: string;
  tenantId: string;
  storeId: string;
  variationId: string;
  productName: string;
  productDisplayId: string | null;
  quantityRequired: number;
  storedPicked: number;
  actualPicked: number;
  storedPacked: number;
  actualPacked: number;
  binMismatches: Array<{
    binId: string;
    binCode: string;
    quantityTarget: number;
    storedPicked: number;
    actualPicked: number;
  }>;
};

type DemandActualCountState = {
  actualPickedByDemandId: Map<string, number>;
  actualPackedByDemandId: Map<string, number>;
  actualPickedByBinId: Map<string, number>;
  mismatches: DemandMismatchRecord[];
};

type RepairResultRecord = {
  basketId: string;
  basketCode: string;
  status: 'released' | 'removed' | 'recalculated' | 'skipped' | 'error';
  reason?: string;
  releasedOrders?: number;
  releasedUnits?: number;
  removedUnits?: number;
  updatedDemands?: number;
  updatedBins?: number;
};

@Injectable()
export class WmsFulfillmentOpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    private readonly wmsStaffActivityService: WmsStaffActivityService,
  ) {}

  async getOpsHealth(query: GetWmsFulfillmentOpsSnapshotDto) {
    const scope = await this.resolveTenantScope(query.tenantId, query.allTenants === true);
    const limit = query.limit ?? DEFAULT_OPS_LIMIT;
    const staleMinutes = query.staleMinutes ?? DEFAULT_STALE_MINUTES;
    const staleThreshold = new Date(Date.now() - staleMinutes * 60_000);

    if (!scope.activeTenantId && !scope.canAccessAllTenants) {
      return this.buildEmptyOpsHealth(scope, limit, staleMinutes);
    }

    const demandBasketWhere: Prisma.WmsBasketWhereInput = {
      status: {
        in: [...ACTIVE_DEMAND_MONITOR_BASKET_STATUSES],
      },
      pickDemands: {
        some: scope.activeTenantId ? { tenantId: scope.activeTenantId } : {},
      },
    };

    const [legacyReservationCount, demandBasketCount, pickedNotPackedCount, legacyReservations, activeDemandBaskets, pickedNotPackedBasketUnits, activeDemandBasketIds] =
      await Promise.all([
        this.prisma.wmsPickReservation.count({
          where: {
            status: {
              in: [...ACTIVE_PICK_RESERVATION_STATUSES],
            },
            ...(scope.activeTenantId ? { tenantId: scope.activeTenantId } : {}),
            fulfillmentOrder: {
              assignmentMode: WmsFulfillmentAssignmentMode.SERIAL_RESERVED,
            },
          },
        }),
        this.prisma.wmsBasket.count({
          where: demandBasketWhere,
        }),
        this.prisma.wmsBasketUnit.count({
          where: {
            status: WmsBasketUnitStatus.PICKED,
            ...(scope.activeTenantId ? { tenantId: scope.activeTenantId } : {}),
          },
        }),
        this.prisma.wmsPickReservation.findMany({
          where: {
            status: {
              in: [...ACTIVE_PICK_RESERVATION_STATUSES],
            },
            ...(scope.activeTenantId ? { tenantId: scope.activeTenantId } : {}),
            fulfillmentOrder: {
              assignmentMode: WmsFulfillmentAssignmentMode.SERIAL_RESERVED,
            },
          },
          select: {
            id: true,
            status: true,
            createdAt: true,
            fulfillmentOrder: {
              select: {
                id: true,
                posOrderId: true,
                status: true,
                basket: {
                  select: {
                    id: true,
                    barcode: true,
                  },
                },
              },
            },
            fulfillmentLine: {
              select: {
                id: true,
                variationId: true,
                productName: true,
                quantityRequired: true,
              },
            },
            inventoryUnit: {
              select: {
                id: true,
                code: true,
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
                  },
                },
              },
            },
          },
          orderBy: [
            { createdAt: 'asc' },
            { id: 'asc' },
          ],
          take: limit,
        }),
        this.prisma.wmsBasket.findMany({
          where: demandBasketWhere,
          select: {
            id: true,
            barcode: true,
            status: true,
            tenantId: true,
            warehouseId: true,
            claimedAt: true,
            fullAt: true,
            readyForPackAt: true,
            updatedAt: true,
            warehouse: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
            assignedPicker: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            assignedPacker: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            fulfillmentOrders: {
              where: {
                assignmentMode: WmsFulfillmentAssignmentMode.BASKET_DEMAND,
                status: {
                  in: [...ACTIVE_BASKET_ORDER_STATUSES],
                },
                ...(scope.activeTenantId ? { tenantId: scope.activeTenantId } : {}),
              },
              select: {
                id: true,
                tenantId: true,
                storeId: true,
                posOrderId: true,
                status: true,
              },
            },
            pickDemands: {
              where: scope.activeTenantId ? { tenantId: scope.activeTenantId } : {},
              select: {
                id: true,
                tenantId: true,
                quantityRequired: true,
                quantityPicked: true,
                quantityPacked: true,
              },
            },
            basketUnits: {
              where: scope.activeTenantId ? { tenantId: scope.activeTenantId } : {},
              select: {
                id: true,
                status: true,
              },
            },
          },
          orderBy: [
            { updatedAt: 'asc' },
            { claimedAt: 'asc' },
          ],
          take: limit,
        }),
        this.prisma.wmsBasketUnit.findMany({
          where: {
            status: WmsBasketUnitStatus.PICKED,
            ...(scope.activeTenantId ? { tenantId: scope.activeTenantId } : {}),
          },
          select: {
            id: true,
            tenantId: true,
            storeId: true,
            basketId: true,
            pickedAt: true,
            variationId: true,
            basket: {
              select: {
                id: true,
                barcode: true,
                status: true,
              },
            },
            sourceLocation: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
            inventoryUnit: {
              select: {
                id: true,
                code: true,
              },
            },
          },
          orderBy: [
            { pickedAt: 'asc' },
            { id: 'asc' },
          ],
          take: limit,
        }),
        this.prisma.wmsBasket.findMany({
          where: demandBasketWhere,
          select: {
            id: true,
          },
        }),
      ]);

    const mismatchState = await this.computeDemandActualCountState({
      basketIds: activeDemandBasketIds.map((basket) => basket.id),
      tenantId: scope.activeTenantId ?? null,
    });

    return {
      tenantReady: Boolean(scope.activeTenantId || scope.canAccessAllTenants),
      filters: {
        tenants: scope.tenants,
        activeTenantId: scope.activeTenantId,
        limit,
        staleMinutes,
      },
      summary: {
        activeLegacyReservations: legacyReservationCount,
        activeDemandBaskets: demandBasketCount,
        pickedNotPackedBasketUnits: pickedNotPackedCount,
        demandQuantityMismatches: mismatchState.mismatches.length,
      },
      legacyReservations: legacyReservations.map((reservation) => ({
        id: reservation.id,
        status: reservation.status,
        createdAt: reservation.createdAt,
        fulfillmentOrderId: reservation.fulfillmentOrder.id,
        posOrderId: reservation.fulfillmentOrder.posOrderId,
        fulfillmentOrderStatus: reservation.fulfillmentOrder.status,
        basketId: reservation.fulfillmentOrder.basket?.id ?? null,
        basketCode: reservation.fulfillmentOrder.basket?.barcode ?? null,
        fulfillmentLineId: reservation.fulfillmentLine.id,
        variationId: reservation.fulfillmentLine.variationId,
        productName: reservation.fulfillmentLine.productName,
        quantityRequired: reservation.fulfillmentLine.quantityRequired,
        inventoryUnitId: reservation.inventoryUnit.id,
        inventoryUnitCode: reservation.inventoryUnit.code,
        warehouse: reservation.inventoryUnit.warehouse,
        currentLocation: reservation.inventoryUnit.currentLocation,
      })),
      activeDemandBaskets: activeDemandBaskets.map((basket) => {
        const tenantIds = Array.from(
          new Set([
            ...basket.fulfillmentOrders.map((order) => order.tenantId),
            ...basket.pickDemands.map((demand) => demand.tenantId),
          ]),
        );
        const pickedUnits = basket.basketUnits.filter((unit) => unit.status === WmsBasketUnitStatus.PICKED).length;
        const packedUnits = basket.basketUnits.filter((unit) => unit.status === WmsBasketUnitStatus.PACKED).length;

        return {
          id: basket.id,
          barcode: basket.barcode,
          status: basket.status,
          tenantId: basket.tenantId,
          warehouse: basket.warehouse,
          assignedPicker: this.mapActor(basket.assignedPicker),
          assignedPacker: this.mapActor(basket.assignedPacker),
          claimedAt: basket.claimedAt,
          fullAt: basket.fullAt,
          readyForPackAt: basket.readyForPackAt,
          updatedAt: basket.updatedAt,
          mixedTenant: tenantIds.length > 1,
          releaseCandidate: packedUnits === 0 && basket.updatedAt <= staleThreshold && tenantIds.length <= 1,
          orderCount: basket.fulfillmentOrders.length,
          demandRequired: basket.pickDemands.reduce((sum, demand) => sum + Math.max(demand.quantityRequired, 0), 0),
          demandPicked: basket.pickDemands.reduce((sum, demand) => sum + Math.max(demand.quantityPicked, 0), 0),
          demandPacked: basket.pickDemands.reduce((sum, demand) => sum + Math.max(demand.quantityPacked, 0), 0),
          pickedUnits,
          packedUnits,
          orders: basket.fulfillmentOrders.map((order) => ({
            id: order.id,
            tenantId: order.tenantId,
            storeId: order.storeId,
            posOrderId: order.posOrderId,
            status: order.status,
          })),
        };
      }),
      pickedNotPackedBasketUnits: pickedNotPackedBasketUnits.map((unit) => ({
        id: unit.id,
        tenantId: unit.tenantId,
        storeId: unit.storeId,
        basketId: unit.basket.id,
        basketCode: unit.basket.barcode,
        basketStatus: unit.basket.status,
        pickedAt: unit.pickedAt,
        variationId: unit.variationId,
        inventoryUnitId: unit.inventoryUnit.id,
        inventoryUnitCode: unit.inventoryUnit.code,
        sourceLocation: unit.sourceLocation,
      })),
      demandMismatches: mismatchState.mismatches
        .sort((left, right) => left.basketUpdatedAt.getTime() - right.basketUpdatedAt.getTime())
        .slice(0, limit),
    };
  }

  async releaseAbandonedDemandBaskets(
    user: { userId?: string; id?: string; sessionId?: string | null },
    body: RepairWmsDemandBasketsDto,
    request?: Request,
  ) {
    if (!body.tenantId && !body.basketId) {
      throw new BadRequestException('Select a tenant or basket before releasing abandoned demand baskets');
    }

    const scope = await this.resolveTenantScope(body.tenantId);
    const limit = body.limit ?? DEFAULT_OPS_LIMIT;
    const olderThanMinutes = body.olderThanMinutes ?? DEFAULT_STALE_MINUTES;
    const staleThreshold = new Date(Date.now() - olderThanMinutes * 60_000);
    const where: Prisma.WmsBasketWhereInput = {
      status: {
        in: [...ACTIVE_DEMAND_MONITOR_BASKET_STATUSES],
      },
      ...(body.basketId ? { id: body.basketId } : {}),
      ...(body.basketId
        ? {
            pickDemands: {
              some: scope.activeTenantId ? { tenantId: scope.activeTenantId } : {},
            },
          }
        : {
            updatedAt: {
              lte: staleThreshold,
            },
            pickDemands: {
              some: scope.activeTenantId ? { tenantId: scope.activeTenantId } : {},
            },
          }),
    };

    const baskets = await this.prisma.wmsBasket.findMany({
      where,
      select: {
        id: true,
        barcode: true,
      },
      orderBy: [
        { updatedAt: 'asc' },
        { claimedAt: 'asc' },
      ],
      take: limit,
    });

    const actorId = this.resolveActorId(user);
    const results: RepairResultRecord[] = [];

    for (const basket of baskets) {
      try {
        const result = await this.prisma.$transaction(async (tx) => (
          this.releaseDemandBasketTx(tx, {
            basketId: basket.id,
            scopedTenantId: body.basketId ? null : (scope.activeTenantId ?? null),
            actorId,
            now: new Date(),
            request,
            sessionId: this.resolveSessionId(user),
          })
        ));
        results.push(result);
      } catch (error) {
        results.push({
          basketId: basket.id,
          basketCode: basket.barcode,
          status: 'error',
          reason: error instanceof Error ? error.message : 'Unknown repair error',
        });
      }
    }

    return {
      success: true,
      processedCount: results.length,
      releasedCount: results.filter((result) => result.status === 'released').length,
      results,
    };
  }

  async removeStaleBasketUnits(
    user: { userId?: string; id?: string; sessionId?: string | null },
    body: RepairWmsDemandBasketsDto,
    request?: Request,
  ) {
    if (!body.tenantId && !body.basketId) {
      throw new BadRequestException('Select a tenant or basket before removing stale basket units');
    }

    const scope = await this.resolveTenantScope(body.tenantId);
    const limit = body.limit ?? DEFAULT_OPS_LIMIT;
    const olderThanMinutes = body.olderThanMinutes ?? DEFAULT_STALE_MINUTES;
    const staleThreshold = new Date(Date.now() - olderThanMinutes * 60_000);
    const basketUnits = await this.prisma.wmsBasketUnit.findMany({
      where: {
        status: WmsBasketUnitStatus.PICKED,
        ...(body.basketId ? { basketId: body.basketId } : {}),
        ...(scope.activeTenantId ? { tenantId: scope.activeTenantId } : {}),
        ...(!body.basketId
          ? {
              pickedAt: {
                lte: staleThreshold,
              },
            }
          : {}),
        basket: {
          pickDemands: {
            some: {},
          },
        },
      },
      select: {
        id: true,
        basketId: true,
        basket: {
          select: {
            barcode: true,
          },
        },
      },
      orderBy: [
        { pickedAt: 'asc' },
        { id: 'asc' },
      ],
      take: limit,
    });

    const unitIdsByBasketId = new Map<string, string[]>();
    for (const basketUnit of basketUnits) {
      const existing = unitIdsByBasketId.get(basketUnit.basketId) ?? [];
      existing.push(basketUnit.id);
      unitIdsByBasketId.set(basketUnit.basketId, existing);
    }

    const actorId = this.resolveActorId(user);
    const results: RepairResultRecord[] = [];

    for (const [basketId, basketUnitIds] of unitIdsByBasketId.entries()) {
      const basketCode = basketUnits.find((unit) => unit.basketId === basketId)?.basket.barcode ?? basketId;
      try {
        const result = await this.prisma.$transaction(async (tx) => (
          this.removeStaleBasketUnitsTx(tx, {
            basketId,
            basketUnitIds,
            actorId,
            now: new Date(),
            request,
            sessionId: this.resolveSessionId(user),
          })
        ));
        results.push(result);
      } catch (error) {
        results.push({
          basketId,
          basketCode,
          status: 'error',
          reason: error instanceof Error ? error.message : 'Unknown repair error',
        });
      }
    }

    return {
      success: true,
      processedCount: results.length,
      removedCount: results.reduce((sum, result) => sum + (result.removedUnits ?? 0), 0),
      results,
    };
  }

  async recalculateDemandCounts(
    user: { userId?: string; id?: string; sessionId?: string | null },
    body: RecalculateWmsDemandCountsDto,
    request?: Request,
  ) {
    if (!body.tenantId && !body.basketId) {
      throw new BadRequestException('Select a tenant or basket before recalculating demand counts');
    }

    const scope = await this.resolveTenantScope(body.tenantId);
    const limit = body.limit ?? DEFAULT_OPS_LIMIT;
    const baskets = await this.prisma.wmsBasket.findMany({
      where: {
        ...(body.basketId ? { id: body.basketId } : {}),
        pickDemands: {
          some: scope.activeTenantId ? { tenantId: scope.activeTenantId } : {},
        },
      },
      select: {
        id: true,
        barcode: true,
      },
      orderBy: [
        { updatedAt: 'asc' },
        { claimedAt: 'asc' },
      ],
      take: limit,
    });

    const actorId = this.resolveActorId(user);
    const results: RepairResultRecord[] = [];

    for (const basket of baskets) {
      try {
        const result = await this.prisma.$transaction(async (tx) => (
          this.recalculateDemandCountsForBasketTx(tx, {
            basketId: basket.id,
            actorId,
            now: new Date(),
            request,
            sessionId: this.resolveSessionId(user),
          })
        ));
        results.push(result);
      } catch (error) {
        results.push({
          basketId: basket.id,
          basketCode: basket.barcode,
          status: 'error',
          reason: error instanceof Error ? error.message : 'Unknown repair error',
        });
      }
    }

    return {
      success: true,
      processedCount: results.length,
      recalculatedCount: results.filter((result) => result.status === 'recalculated').length,
      results,
    };
  }

  private async recalculateDemandCountsForBasketTx(
    tx: Prisma.TransactionClient,
    params: {
      basketId: string;
      actorId: string | null;
      now: Date;
      request?: Request;
      sessionId?: string | null;
    },
  ) {
    await this.lockBasketForUpdate(tx, params.basketId);
    const basket = await tx.wmsBasket.findUnique({
      where: { id: params.basketId },
      select: {
        id: true,
        barcode: true,
      },
    });

    if (!basket) {
      throw new BadRequestException('Demand basket was not found');
    }

    const state = await this.computeDemandActualCountState({
      basketIds: [basket.id],
      tx,
    });
    const demands = await this.loadDemandHealthDemands({
      basketIds: [basket.id],
      tx,
    });

    let updatedDemands = 0;
    let updatedBins = 0;

    for (const demand of demands) {
      const nextPicked = state.actualPickedByDemandId.get(demand.id) ?? 0;
      const nextPacked = state.actualPackedByDemandId.get(demand.id) ?? 0;
      if (demand.quantityPicked !== nextPicked || demand.quantityPacked !== nextPacked) {
        await tx.wmsBasketPickDemand.update({
          where: { id: demand.id },
          data: {
            quantityPicked: nextPicked,
            quantityPacked: nextPacked,
          },
        });
        updatedDemands += 1;
      }

      for (const bin of demand.bins) {
        const nextBinPicked = state.actualPickedByBinId.get(bin.id) ?? 0;
        if (bin.quantityPicked !== nextBinPicked) {
          await tx.wmsBasketPickDemandBin.update({
            where: { id: bin.id },
            data: {
              quantityPicked: nextBinPicked,
            },
          });
          updatedBins += 1;
        }
      }
    }

    const orderIds = Array.from(new Set(demands.map((demand) => demand.fulfillmentOrderId)));
    for (const orderId of orderIds) {
      await this.refreshFulfillmentOrderProgressState(tx, orderId, params.now);
    }

    await this.refreshBasketState(tx, basket.id, params.now);

    await this.wmsStaffActivityService.recordFromRequest({
      request: params.request,
      tenantId: demands[0]?.tenantId ?? null,
      actorId: params.actorId,
      sessionId: params.sessionId ?? null,
      actionType: 'FULFILLMENT_DEMAND_RECALCULATE',
      resourceType: 'WMS_BASKET',
      resourceId: basket.id,
      metadata: {
        basketCode: basket.barcode,
        mode: 'BASKET_DEMAND',
        updatedDemands,
        updatedBins,
      } as Prisma.InputJsonValue,
    });

    return {
      basketId: basket.id,
      basketCode: basket.barcode,
      status: 'recalculated' as const,
      updatedDemands,
      updatedBins,
    };
  }

  private async removeStaleBasketUnitsTx(
    tx: Prisma.TransactionClient,
    params: {
      basketId: string;
      basketUnitIds: string[];
      actorId: string | null;
      now: Date;
      request?: Request;
      sessionId?: string | null;
    },
  ) {
    await this.lockBasketForUpdate(tx, params.basketId);

    const basket = await tx.wmsBasket.findUnique({
      where: { id: params.basketId },
      select: {
        id: true,
        barcode: true,
      },
    });

    if (!basket) {
      throw new BadRequestException('Demand basket was not found');
    }

    const basketUnits = await tx.wmsBasketUnit.findMany({
      where: {
        basketId: basket.id,
        id: {
          in: params.basketUnitIds,
        },
        status: WmsBasketUnitStatus.PICKED,
      },
      select: {
        id: true,
        tenantId: true,
        inventoryUnitId: true,
        sourceLocationId: true,
        inventoryUnit: {
          select: {
            id: true,
            code: true,
            status: true,
          },
        },
      },
    });

    if (basketUnits.length === 0) {
      return {
        basketId: basket.id,
        basketCode: basket.barcode,
        status: 'skipped' as const,
        reason: 'No stale picked basket units matched the repair scope',
      };
    }

    const restoreStateByInventoryUnitId = await this.loadBasketUnitRestoreStates(
      tx,
      basket.id,
      basketUnits.map((basketUnit) => basketUnit.inventoryUnitId),
    );

    for (const basketUnit of basketUnits) {
      const restoreState = restoreStateByInventoryUnitId.get(basketUnit.inventoryUnitId);
      if (!restoreState?.fromLocationId || !restoreState.fromStatus || !restoreState.warehouseId) {
        throw new ConflictException(`Unable to restore original bin state for unit ${basketUnit.inventoryUnit.code}`);
      }

      const inventoryUpdate = await tx.wmsInventoryUnit.updateMany({
        where: {
          id: basketUnit.inventoryUnitId,
          status: WmsInventoryUnitStatus.PICKED,
        },
        data: {
          currentLocationId: restoreState.fromLocationId,
          status: restoreState.fromStatus,
          updatedById: params.actorId ?? undefined,
        },
      });

      if (inventoryUpdate.count !== 1) {
        throw new ConflictException(`Unit ${basketUnit.inventoryUnit.code} changed before the stale removal completed`);
      }

      const basketUnitUpdate = await tx.wmsBasketUnit.updateMany({
        where: {
          id: basketUnit.id,
          status: WmsBasketUnitStatus.PICKED,
        },
        data: {
          status: WmsBasketUnitStatus.REMOVED,
          removedById: params.actorId ?? undefined,
          removedAt: params.now,
        },
      });

      if (basketUnitUpdate.count !== 1) {
        throw new ConflictException(`Basket record for unit ${basketUnit.inventoryUnit.code} changed before removal completed`);
      }
    }

    const movementRows: Prisma.WmsInventoryMovementCreateManyInput[] = basketUnits.map((basketUnit) => {
      const restoreState = restoreStateByInventoryUnitId.get(basketUnit.inventoryUnitId);
      if (!restoreState?.fromLocationId || !restoreState.fromStatus || !restoreState.warehouseId) {
        throw new ConflictException(`Unable to restore original movement state for unit ${basketUnit.inventoryUnit.code}`);
      }

      return {
        tenantId: basketUnit.tenantId,
        inventoryUnitId: basketUnit.inventoryUnitId,
        warehouseId: restoreState.warehouseId,
        fromLocationId: null,
        toLocationId: restoreState.fromLocationId,
        fromStatus: WmsInventoryUnitStatus.PICKED,
        toStatus: restoreState.fromStatus,
        movementType: WmsInventoryMovementType.TRANSFER,
        referenceType: 'WMS_BASKET_REPAIR',
        referenceId: basket.id,
        referenceCode: basket.barcode,
        notes: `Released stale STOX basket unit from ${basket.barcode}`,
        actorId: params.actorId,
        createdAt: params.now,
      };
    });

    await tx.wmsInventoryMovement.createMany({
      data: movementRows,
    });

    const activeDemands = await tx.wmsBasketPickDemand.findMany({
      where: {
        basketId: basket.id,
      },
      select: {
        fulfillmentOrderId: true,
      },
    });

    await this.recalculateDemandCountsForBasketTx(tx, {
      basketId: basket.id,
      actorId: params.actorId,
      now: params.now,
      request: params.request,
      sessionId: params.sessionId,
    });

    await this.wmsStaffActivityService.recordFromRequest({
      request: params.request,
      tenantId: basketUnits[0]?.tenantId ?? null,
      actorId: params.actorId,
      sessionId: params.sessionId ?? null,
      actionType: 'FULFILLMENT_DEMAND_STALE_UNIT_REMOVE',
      resourceType: 'WMS_BASKET',
      resourceId: basket.id,
      metadata: {
        basketCode: basket.barcode,
        mode: 'BASKET_DEMAND',
        removedUnits: basketUnits.length,
        fulfillmentOrderIds: Array.from(new Set(activeDemands.map((demand) => demand.fulfillmentOrderId))),
      } as Prisma.InputJsonValue,
    });

    return {
      basketId: basket.id,
      basketCode: basket.barcode,
      status: 'removed' as const,
      removedUnits: basketUnits.length,
    };
  }

  private async releaseDemandBasketTx(
    tx: Prisma.TransactionClient,
    params: {
      basketId: string;
      scopedTenantId: string | null;
      actorId: string | null;
      now: Date;
      request?: Request;
      sessionId?: string | null;
    },
  ) {
    await this.lockBasketForUpdate(tx, params.basketId);

    const basket = await tx.wmsBasket.findUnique({
      where: { id: params.basketId },
      select: {
        id: true,
        barcode: true,
        status: true,
        tenantId: true,
        updatedAt: true,
        fulfillmentOrders: {
          where: {
            assignmentMode: WmsFulfillmentAssignmentMode.BASKET_DEMAND,
            status: {
              in: [...ACTIVE_BASKET_ORDER_STATUSES],
            },
          },
          select: {
            id: true,
            tenantId: true,
            posOrderId: true,
          },
        },
        pickDemands: {
          select: {
            id: true,
            tenantId: true,
            fulfillmentOrderId: true,
          },
        },
        basketUnits: {
          where: {
            status: {
              in: [...ACTIVE_BASKET_UNIT_STATUSES],
            },
          },
          select: {
            id: true,
            tenantId: true,
            inventoryUnitId: true,
            sourceLocationId: true,
            status: true,
            inventoryUnit: {
              select: {
                id: true,
                code: true,
              },
            },
          },
        },
      },
    });

    if (!basket) {
      throw new BadRequestException('Demand basket was not found');
    }

    const activeTenantIds = Array.from(
      new Set([
        ...basket.fulfillmentOrders.map((order) => order.tenantId),
        ...basket.pickDemands.map((demand) => demand.tenantId),
      ]),
    );
    if (params.scopedTenantId && activeTenantIds.length > 1) {
      return {
        basketId: basket.id,
        basketCode: basket.barcode,
        status: 'skipped' as const,
        reason: 'Basket contains demand work from multiple tenants and needs an explicit basket repair',
      };
    }

    const packedUnits = basket.basketUnits.filter((basketUnit) => basketUnit.status === WmsBasketUnitStatus.PACKED);
    if (packedUnits.length > 0) {
      return {
        basketId: basket.id,
        basketCode: basket.barcode,
        status: 'skipped' as const,
        reason: 'Basket already contains packed units and cannot be safely released',
      };
    }

    const pickedUnits = basket.basketUnits.filter((basketUnit) => basketUnit.status === WmsBasketUnitStatus.PICKED);
    const restoreStateByInventoryUnitId = await this.loadBasketUnitRestoreStates(
      tx,
      basket.id,
      pickedUnits.map((basketUnit) => basketUnit.inventoryUnitId),
    );

    for (const basketUnit of pickedUnits) {
      const restoreState = restoreStateByInventoryUnitId.get(basketUnit.inventoryUnitId);
      if (!restoreState?.fromLocationId || !restoreState.fromStatus || !restoreState.warehouseId) {
        throw new ConflictException(`Unable to restore original bin state for unit ${basketUnit.inventoryUnit.code}`);
      }

      const inventoryUpdate = await tx.wmsInventoryUnit.updateMany({
        where: {
          id: basketUnit.inventoryUnitId,
          status: WmsInventoryUnitStatus.PICKED,
        },
        data: {
          currentLocationId: restoreState.fromLocationId,
          status: restoreState.fromStatus,
          updatedById: params.actorId ?? undefined,
        },
      });

      if (inventoryUpdate.count !== 1) {
        throw new ConflictException(`Unit ${basketUnit.inventoryUnit.code} changed before basket release completed`);
      }

      const basketUnitUpdate = await tx.wmsBasketUnit.updateMany({
        where: {
          id: basketUnit.id,
          status: WmsBasketUnitStatus.PICKED,
        },
        data: {
          status: WmsBasketUnitStatus.REMOVED,
          removedById: params.actorId ?? undefined,
          removedAt: params.now,
        },
      });

      if (basketUnitUpdate.count !== 1) {
        throw new ConflictException(`Basket record for unit ${basketUnit.inventoryUnit.code} changed before release completed`);
      }
    }

    if (pickedUnits.length > 0) {
      const movementRows: Prisma.WmsInventoryMovementCreateManyInput[] = pickedUnits.map((basketUnit) => {
        const restoreState = restoreStateByInventoryUnitId.get(basketUnit.inventoryUnitId);
        if (!restoreState?.fromLocationId || !restoreState.fromStatus || !restoreState.warehouseId) {
          throw new ConflictException(`Unable to restore original movement state for unit ${basketUnit.inventoryUnit.code}`);
        }

        return {
          tenantId: basketUnit.tenantId,
          inventoryUnitId: basketUnit.inventoryUnitId,
          warehouseId: restoreState.warehouseId,
          fromLocationId: null,
          toLocationId: restoreState.fromLocationId,
          fromStatus: WmsInventoryUnitStatus.PICKED,
          toStatus: restoreState.fromStatus,
          movementType: WmsInventoryMovementType.TRANSFER,
          referenceType: 'WMS_BASKET_RELEASE',
          referenceId: basket.id,
          referenceCode: basket.barcode,
          notes: `Released abandoned STOX basket ${basket.barcode}`,
          actorId: params.actorId,
          createdAt: params.now,
        };
      });

      await tx.wmsInventoryMovement.createMany({
        data: movementRows,
      });
    }

    await tx.wmsBasketPickDemand.deleteMany({
      where: {
        basketId: basket.id,
      },
    });

    await tx.wmsFulfillmentOrder.updateMany({
      where: {
        basketId: basket.id,
        assignmentMode: WmsFulfillmentAssignmentMode.BASKET_DEMAND,
      },
      data: {
        basketId: null,
        claimedById: null,
        claimedAt: null,
        packedById: null,
        completedAt: null,
      },
    });

    const orderIds = Array.from(new Set(basket.fulfillmentOrders.map((order) => order.id)));
    for (const orderId of orderIds) {
      await this.refreshDemandOrderAvailabilityState(tx, orderId, params.now);
    }

    await this.refreshBasketState(tx, basket.id, params.now);

    await this.wmsStaffActivityService.recordFromRequest({
      request: params.request,
      tenantId: activeTenantIds.length === 1 ? activeTenantIds[0] : null,
      actorId: params.actorId,
      sessionId: params.sessionId ?? null,
      actionType: 'FULFILLMENT_DEMAND_BASKET_RELEASE',
      resourceType: 'WMS_BASKET',
      resourceId: basket.id,
      metadata: {
        basketCode: basket.barcode,
        mode: 'BASKET_DEMAND',
        releasedOrders: orderIds.length,
        releasedUnits: pickedUnits.length,
        tenantIds: activeTenantIds,
      } as Prisma.InputJsonValue,
    });

    return {
      basketId: basket.id,
      basketCode: basket.barcode,
      status: 'released' as const,
      releasedOrders: orderIds.length,
      releasedUnits: pickedUnits.length,
    };
  }

  private async computeDemandActualCountState(params: {
    basketIds: string[];
    tenantId?: string | null;
    tx?: Prisma.TransactionClient;
  }): Promise<DemandActualCountState> {
    if (params.basketIds.length === 0) {
      return {
        actualPickedByDemandId: new Map<string, number>(),
        actualPackedByDemandId: new Map<string, number>(),
        actualPickedByBinId: new Map<string, number>(),
        mismatches: [],
      };
    }

    const [demands, basketUnits] = await Promise.all([
      this.loadDemandHealthDemands({
        basketIds: params.basketIds,
        tenantId: params.tenantId ?? null,
        tx: params.tx,
      }),
      this.loadDemandHealthBasketUnits({
        basketIds: params.basketIds,
        tenantId: params.tenantId ?? null,
        tx: params.tx,
      }),
    ]);

    const pickedCountByDemandId = new Map<string, number>();
    const packedCountByDemandId = new Map<string, number>();
    const pickedCountByBinId = new Map<string, number>();
    const packedCountByDemandBinKey = new Map<string, number>();
    const pickedPoolByVariationKey = new Map<string, number>();
    const pickedPoolByLocationKey = new Map<string, number>();

    for (const basketUnit of basketUnits) {
      if (
        basketUnit.status !== WmsBasketUnitStatus.PICKED
        && basketUnit.status !== WmsBasketUnitStatus.PACKED
      ) {
        continue;
      }

      const variationKey = this.buildDemandVariationKey({
        basketId: basketUnit.basketId,
        tenantId: basketUnit.tenantId,
        storeId: basketUnit.storeId,
        variationId: basketUnit.variationId,
      });
      pickedPoolByVariationKey.set(
        variationKey,
        (pickedPoolByVariationKey.get(variationKey) ?? 0) + 1,
      );

      if (basketUnit.sourceLocationId) {
        const locationKey = this.buildDemandLocationKey({
          basketId: basketUnit.basketId,
          tenantId: basketUnit.tenantId,
          storeId: basketUnit.storeId,
          variationId: basketUnit.variationId,
          locationId: basketUnit.sourceLocationId,
        });
        pickedPoolByLocationKey.set(
          locationKey,
          (pickedPoolByLocationKey.get(locationKey) ?? 0) + 1,
        );
      }

      if (
        basketUnit.status === WmsBasketUnitStatus.PACKED
        && basketUnit.fulfillmentLineId
      ) {
        const demand = demands.find(
          (candidate) => candidate.fulfillmentLineId === basketUnit.fulfillmentLineId && candidate.basketId === basketUnit.basketId,
        );
        if (!demand) {
          continue;
        }

        packedCountByDemandId.set(
          demand.id,
          (packedCountByDemandId.get(demand.id) ?? 0) + 1,
        );

        if (basketUnit.sourceLocationId) {
          const demandBinKey = `${demand.id}:${basketUnit.sourceLocationId}`;
          packedCountByDemandBinKey.set(
            demandBinKey,
            (packedCountByDemandBinKey.get(demandBinKey) ?? 0) + 1,
          );
        }
      }
    }

    const demandsByVariationKey = new Map<string, DemandHealthDemandRecord[]>();
    for (const demand of demands) {
      const variationKey = this.buildDemandVariationKey({
        basketId: demand.basketId,
        tenantId: demand.tenantId,
        storeId: demand.storeId,
        variationId: demand.variationId,
      });
      const existing = demandsByVariationKey.get(variationKey) ?? [];
      existing.push(demand);
      demandsByVariationKey.set(variationKey, existing);
    }

    for (const group of demandsByVariationKey.values()) {
      const sortedGroup = [...group].sort((left, right) => (
        left.createdAt.getTime() - right.createdAt.getTime()
        || left.id.localeCompare(right.id)
      ));
      const variationKey = this.buildDemandVariationKey({
        basketId: sortedGroup[0].basketId,
        tenantId: sortedGroup[0].tenantId,
        storeId: sortedGroup[0].storeId,
        variationId: sortedGroup[0].variationId,
      });
      let remainingPicked = pickedPoolByVariationKey.get(variationKey) ?? 0;
      let reservedPacked = 0;

      for (const demand of sortedGroup) {
        const packed = packedCountByDemandId.get(demand.id) ?? 0;
        reservedPacked += packed;
      }

      remainingPicked = Math.max(remainingPicked - reservedPacked, 0);

      for (const demand of sortedGroup) {
        const packed = packedCountByDemandId.get(demand.id) ?? 0;
        const additionalCapacity = Math.max(demand.quantityRequired - packed, 0);
        const additionalPicked = Math.min(additionalCapacity, remainingPicked);
        const actualPicked = packed + additionalPicked;
        pickedCountByDemandId.set(demand.id, actualPicked);
        remainingPicked -= additionalPicked;
      }
    }

    const binContextsByLocationKey = new Map<string, Array<{
      demand: DemandHealthDemandRecord;
      bin: DemandHealthDemandRecord['bins'][number];
    }>>();
    const remainingDemandCapacity = new Map<string, number>();

    for (const demand of demands) {
      let packedAcrossBins = 0;

      for (const bin of demand.bins) {
        const packedBaseline = packedCountByDemandBinKey.get(`${demand.id}:${bin.locationId}`) ?? 0;
        pickedCountByBinId.set(bin.id, packedBaseline);
        packedAcrossBins += packedBaseline;

        const locationKey = this.buildDemandLocationKey({
          basketId: demand.basketId,
          tenantId: demand.tenantId,
          storeId: demand.storeId,
          variationId: demand.variationId,
          locationId: bin.locationId,
        });
        const existing = binContextsByLocationKey.get(locationKey) ?? [];
        existing.push({ demand, bin });
        binContextsByLocationKey.set(locationKey, existing);
      }

      const demandPicked = pickedCountByDemandId.get(demand.id) ?? 0;
      remainingDemandCapacity.set(demand.id, Math.max(demandPicked - packedAcrossBins, 0));
    }

    for (const [locationKey, contexts] of binContextsByLocationKey.entries()) {
      const sortedContexts = [...contexts].sort((left, right) => (
        left.bin.routeSequence - right.bin.routeSequence
        || left.demand.createdAt.getTime() - right.demand.createdAt.getTime()
        || left.bin.id.localeCompare(right.bin.id)
      ));
      let remainingLocationPool = pickedPoolByLocationKey.get(locationKey) ?? 0;
      let reservedPacked = 0;

      for (const context of sortedContexts) {
        reservedPacked += pickedCountByBinId.get(context.bin.id) ?? 0;
      }

      remainingLocationPool = Math.max(remainingLocationPool - reservedPacked, 0);

      for (const context of sortedContexts) {
        const baseline = pickedCountByBinId.get(context.bin.id) ?? 0;
        const remainingDemand = remainingDemandCapacity.get(context.demand.id) ?? 0;
        const additionalCapacity = Math.max(context.bin.quantityTarget - baseline, 0);
        const additionalPicked = Math.min(additionalCapacity, remainingDemand, remainingLocationPool);
        const actualBinPicked = baseline + additionalPicked;
        pickedCountByBinId.set(context.bin.id, actualBinPicked);
        remainingDemandCapacity.set(context.demand.id, Math.max(remainingDemand - additionalPicked, 0));
        remainingLocationPool -= additionalPicked;
      }
    }

    const mismatches: DemandMismatchRecord[] = [];
    for (const demand of demands) {
      const actualPicked = pickedCountByDemandId.get(demand.id) ?? 0;
      const actualPacked = packedCountByDemandId.get(demand.id) ?? 0;
      const binMismatches = demand.bins
        .map((bin) => ({
          binId: bin.id,
          binCode: bin.location.code,
          quantityTarget: bin.quantityTarget,
          storedPicked: bin.quantityPicked,
          actualPicked: pickedCountByBinId.get(bin.id) ?? 0,
        }))
        .filter((bin) => bin.storedPicked !== bin.actualPicked);

      if (
        demand.quantityPicked !== actualPicked
        || demand.quantityPacked !== actualPacked
        || binMismatches.length > 0
      ) {
        mismatches.push({
          basketId: demand.basketId,
          basketCode: demand.basket.barcode,
          basketStatus: demand.basket.status,
          basketUpdatedAt: demand.basket.updatedAt,
          demandId: demand.id,
          fulfillmentOrderId: demand.fulfillmentOrderId,
          fulfillmentLineId: demand.fulfillmentLineId,
          posOrderId: demand.fulfillmentOrder.posOrderId,
          tenantId: demand.tenantId,
          storeId: demand.storeId,
          variationId: demand.variationId,
          productName: demand.productName,
          productDisplayId: demand.productDisplayId,
          quantityRequired: demand.quantityRequired,
          storedPicked: demand.quantityPicked,
          actualPicked,
          storedPacked: demand.quantityPacked,
          actualPacked,
          binMismatches,
        });
      }
    }

    return {
      actualPickedByDemandId: pickedCountByDemandId,
      actualPackedByDemandId: packedCountByDemandId,
      actualPickedByBinId: pickedCountByBinId,
      mismatches,
    };
  }

  private async loadDemandHealthDemands(params: {
    basketIds: string[];
    tenantId?: string | null;
    tx?: Prisma.TransactionClient;
  }) {
    const client = params.tx ?? this.prisma;
    return client.wmsBasketPickDemand.findMany({
      where: {
        basketId: {
          in: params.basketIds,
        },
        ...(params.tenantId ? { tenantId: params.tenantId } : {}),
      },
      include: {
        basket: {
          select: {
            id: true,
            barcode: true,
            status: true,
            updatedAt: true,
          },
        },
        fulfillmentOrder: {
          select: {
            id: true,
            posOrderId: true,
            status: true,
          },
        },
        bins: {
          include: {
            location: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: [
        { createdAt: 'asc' },
        { id: 'asc' },
      ],
    });
  }

  private async loadDemandHealthBasketUnits(params: {
    basketIds: string[];
    tenantId?: string | null;
    tx?: Prisma.TransactionClient;
  }) {
    const client = params.tx ?? this.prisma;
    return client.wmsBasketUnit.findMany({
      where: {
        basketId: {
          in: params.basketIds,
        },
        status: {
          in: [...ACTIVE_BASKET_UNIT_STATUSES],
        },
        ...(params.tenantId ? { tenantId: params.tenantId } : {}),
      },
      select: {
        id: true,
        basketId: true,
        tenantId: true,
        storeId: true,
        variationId: true,
        sourceLocationId: true,
        status: true,
        fulfillmentLineId: true,
      },
    });
  }

  private async loadBasketUnitRestoreStates(
    tx: Prisma.TransactionClient,
    basketId: string,
    inventoryUnitIds: string[],
  ) {
    if (inventoryUnitIds.length === 0) {
      return new Map<string, {
        fromLocationId: string | null;
        fromStatus: WmsInventoryUnitStatus | null;
        warehouseId: string | null;
      }>();
    }

    const movements = await tx.wmsInventoryMovement.findMany({
      where: {
        inventoryUnitId: {
          in: inventoryUnitIds,
        },
        movementType: WmsInventoryMovementType.PICK,
        referenceType: 'WMS_BASKET',
        referenceId: basketId,
      },
      select: {
        inventoryUnitId: true,
        warehouseId: true,
        fromLocationId: true,
        fromStatus: true,
        createdAt: true,
      },
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
    });

    const restoreStateByInventoryUnitId = new Map<string, {
      fromLocationId: string | null;
      fromStatus: WmsInventoryUnitStatus | null;
      warehouseId: string | null;
    }>();
    for (const movement of movements) {
      if (restoreStateByInventoryUnitId.has(movement.inventoryUnitId)) {
        continue;
      }
      restoreStateByInventoryUnitId.set(movement.inventoryUnitId, {
        fromLocationId: movement.fromLocationId ?? null,
        fromStatus: movement.fromStatus ?? null,
        warehouseId: movement.warehouseId ?? null,
      });
    }

    return restoreStateByInventoryUnitId;
  }

  private async refreshDemandOrderAvailabilityState(
    tx: Prisma.TransactionClient,
    fulfillmentOrderId: string,
    now: Date,
  ) {
    const order = await tx.wmsFulfillmentOrder.findUnique({
      where: { id: fulfillmentOrderId },
      include: {
        posOrder: {
          select: {
            status: true,
            isVoid: true,
          },
        },
        lines: true,
      },
    });

    if (
      !order
      || order.assignmentMode !== WmsFulfillmentAssignmentMode.BASKET_DEMAND
      || order.status === WmsFulfillmentOrderStatus.PACKED
      || order.status === WmsFulfillmentOrderStatus.CANCELED
      || order.posOrder.status !== CONFIRMED_POS_ORDER_STATUS
      || order.posOrder.isVoid
    ) {
      return;
    }

    const warehouseLocked = this.isDemandWarehouseLocked(order) && Boolean(order.warehouseId);
    const lockedWarehouseId = warehouseLocked ? order.warehouseId : null;
    let totalQuantity = 0;
    let allocatedQuantity = 0;
    let pickedQuantity = 0;
    let hasIssue = false;
    const candidateWarehouseIds = new Set<string>();
    const eligibleLines: Array<{
      id: string;
      required: number;
      availabilityByWarehouse: Map<string, number>;
      totalAvailableAcrossWarehouses: number;
    }> = [];

    for (const line of order.lines) {
      if (line.status === WmsFulfillmentLineStatus.CANCELED) {
        if (line.quantityAllocated !== 0 || line.quantityPicked !== 0 || line.issueReason) {
          await tx.wmsFulfillmentLine.update({
            where: { id: line.id },
            data: {
              quantityAllocated: 0,
              quantityPicked: 0,
              issueReason: null,
            },
          });
        }
        continue;
      }

      const required = Math.max(line.quantityRequired, 0);
      if (required <= 0) {
        hasIssue = true;
        await tx.wmsFulfillmentLine.update({
          where: { id: line.id },
          data: {
            quantityAllocated: 0,
            quantityPicked: 0,
            status: WmsFulfillmentLineStatus.ISSUE,
            issueReason: 'Order line has no required quantity.',
          },
        });
        continue;
      }

      const availabilityByWarehouse = await this.listDemandAvailableQuantityByWarehouse(tx, {
        tenantId: order.tenantId,
        storeId: order.storeId,
        warehouseId: lockedWarehouseId,
        posWarehouseRef: order.posWarehouseRef,
        variationId: line.variationId,
        excludeFulfillmentOrderId: order.id,
      });
      for (const warehouseId of availabilityByWarehouse.keys()) {
        candidateWarehouseIds.add(warehouseId);
      }

      eligibleLines.push({
        id: line.id,
        required,
        availabilityByWarehouse,
        totalAvailableAcrossWarehouses: Array.from(availabilityByWarehouse.values())
          .reduce((sum, quantity) => sum + quantity, 0),
      });
    }

    if (lockedWarehouseId) {
      candidateWarehouseIds.add(lockedWarehouseId);
    }

    let selectedWarehouseId: string | null = lockedWarehouseId;
    const allocatedByLineId = new Map<string, number>();
    const candidateList = Array.from(candidateWarehouseIds.values());

    for (const warehouseId of candidateList) {
      let totalAllocatedForWarehouse = 0;
      let coveredLineCount = 0;
      let fullyReady = true;
      const lineAllocations = new Map<string, number>();

      for (const line of eligibleLines) {
        const availableInWarehouse = line.availabilityByWarehouse.get(warehouseId) ?? 0;
        const allocated = Math.min(availableInWarehouse, line.required);
        lineAllocations.set(line.id, allocated);
        totalAllocatedForWarehouse += allocated;
        if (allocated > 0) {
          coveredLineCount += 1;
        }
        if (allocated < line.required) {
          fullyReady = false;
        }
      }

      const currentTotalAllocated = Array.from(allocatedByLineId.values())
        .reduce((sum, quantity) => sum + quantity, 0);
      const currentCoveredLineCount = eligibleLines.reduce((sum, line) => (
        sum + ((allocatedByLineId.get(line.id) ?? 0) > 0 ? 1 : 0)
      ), 0);
      const currentFullyReady = eligibleLines.length > 0
        && eligibleLines.every((line) => (allocatedByLineId.get(line.id) ?? 0) >= line.required);

      const shouldReplaceSelection = selectedWarehouseId === null
        || Number(fullyReady) > Number(currentFullyReady)
        || (
          fullyReady === currentFullyReady
          && totalAllocatedForWarehouse > currentTotalAllocated
        )
        || (
          fullyReady === currentFullyReady
          && totalAllocatedForWarehouse === currentTotalAllocated
          && coveredLineCount > currentCoveredLineCount
        )
        || (
          fullyReady === currentFullyReady
          && totalAllocatedForWarehouse === currentTotalAllocated
          && coveredLineCount === currentCoveredLineCount
          && selectedWarehouseId !== null
          && warehouseId.localeCompare(selectedWarehouseId) < 0
        );

      if (shouldReplaceSelection) {
        selectedWarehouseId = warehouseId;
        allocatedByLineId.clear();
        for (const [lineId, quantity] of lineAllocations.entries()) {
          allocatedByLineId.set(lineId, quantity);
        }
      }
    }

    for (const line of order.lines) {
      if (line.status === WmsFulfillmentLineStatus.CANCELED) {
        continue;
      }

      const required = Math.max(line.quantityRequired, 0);
      if (required <= 0) {
        continue;
      }

      const eligibleLine = eligibleLines.find((entry) => entry.id === line.id);
      const nextAllocated = Math.min(allocatedByLineId.get(line.id) ?? 0, required);
      const nextLineStatus = this.resolveFulfillmentLineStatus(required, nextAllocated, 0, WmsFulfillmentLineStatus.RESTOCKING);
      const availableInSelectedWarehouse = selectedWarehouseId && eligibleLine
        ? eligibleLine.availabilityByWarehouse.get(selectedWarehouseId) ?? 0
        : 0;

      totalQuantity += required;
      allocatedQuantity += nextAllocated;
      hasIssue = hasIssue || nextLineStatus === WmsFulfillmentLineStatus.ISSUE;

      await tx.wmsFulfillmentLine.update({
        where: { id: line.id },
        data: {
          quantityAllocated: nextAllocated,
          quantityPicked: 0,
          status: nextLineStatus,
          issueReason: nextLineStatus === WmsFulfillmentLineStatus.READY
            ? null
            : this.buildDemandAvailabilityIssueReason({
                required,
                availableInSelectedWarehouse,
                totalAvailableAcrossWarehouses: eligibleLine?.totalAvailableAcrossWarehouses ?? 0,
                warehouseLocked,
              }),
        },
      });
    }

    const nextOrderStatus = this.resolveFulfillmentOrderStatus({
      currentStatus: WmsFulfillmentOrderStatus.RESTOCKING,
      claimedById: null,
      totalQuantity,
      allocatedQuantity,
      pickedQuantity,
      hasIssue,
    });

    await tx.wmsFulfillmentOrder.update({
      where: { id: order.id },
      data: {
        warehouseId: null,
        totalQuantity,
        allocatedQuantity,
        pickedQuantity,
        status: nextOrderStatus,
        issueReason: totalQuantity === 0 ? order.issueReason ?? 'Order has no pickable variation items' : null,
        claimedById: null,
        claimedAt: null,
        basketId: null,
        completedAt: nextOrderStatus === WmsFulfillmentOrderStatus.READY_FOR_PACK ? order.completedAt ?? now : null,
      },
    });
  }

  private isDemandWarehouseLocked(order: {
    basketId: string | null;
    status: WmsFulfillmentOrderStatus;
  }) {
    return Boolean(order.basketId)
      || order.status === WmsFulfillmentOrderStatus.IN_PICKING
      || order.status === WmsFulfillmentOrderStatus.READY_FOR_PACK
      || order.status === WmsFulfillmentOrderStatus.PICKED
      || order.status === WmsFulfillmentOrderStatus.PACKING
      || order.status === WmsFulfillmentOrderStatus.PACKED;
  }

  private buildDemandAvailabilityIssueReason(params: {
    required: number;
    availableInSelectedWarehouse: number;
    totalAvailableAcrossWarehouses: number;
    warehouseLocked: boolean;
  }) {
    if (params.warehouseLocked) {
      if (params.totalAvailableAcrossWarehouses <= 0) {
        return 'No eligible unit is currently available in the assigned warehouse.';
      }

      if (params.availableInSelectedWarehouse <= 0) {
        return 'Matching units exist in other warehouses, but not in the assigned warehouse.';
      }

      return `Only ${params.availableInSelectedWarehouse} of ${params.required} units are currently available in the assigned warehouse.`;
    }

    if (params.totalAvailableAcrossWarehouses <= 0) {
      return 'No eligible unit is currently available in any warehouse.';
    }

    if (params.availableInSelectedWarehouse <= 0) {
      return 'Stock exists, but no single warehouse can fulfill this order yet.';
    }

    return `Only ${params.availableInSelectedWarehouse} of ${params.required} units are currently available together in one warehouse.`;
  }

  private async listDemandAvailableQuantityByWarehouse(
    tx: Prisma.TransactionClient,
    params: {
      tenantId: string;
      storeId: string;
      warehouseId: string | null;
      posWarehouseRef: string | null;
      variationId: string;
      excludeFulfillmentOrderId?: string | null;
    },
  ) {
    const [freeUnitGroups, heldBins] = await Promise.all([
      tx.wmsInventoryUnit.groupBy({
        by: ['warehouseId'],
        where: this.buildFreeDemandPickUnitWhere(params),
        _count: {
          _all: true,
        },
      }),
      tx.wmsBasketPickDemandBin.findMany({
        where: {
          tenantId: params.tenantId,
          variationId: params.variationId,
          ...(params.warehouseId ? { warehouseId: params.warehouseId } : {}),
          basket: {
            status: {
              in: [...ACTIVE_DEMAND_HOLD_BASKET_STATUSES],
            },
          },
          demand: {
            storeId: params.storeId,
            ...(params.excludeFulfillmentOrderId
              ? { fulfillmentOrderId: { not: params.excludeFulfillmentOrderId } }
              : {}),
            fulfillmentOrder: {
              status: {
                in: [
                  WmsFulfillmentOrderStatus.IN_PICKING,
                  WmsFulfillmentOrderStatus.READY_FOR_PACK,
                  WmsFulfillmentOrderStatus.PICKED,
                ],
              },
            },
          },
        },
        select: {
          warehouseId: true,
          quantityTarget: true,
          quantityPicked: true,
        },
      }),
    ]);

    const availableByWarehouse = new Map<string, number>();
    for (const group of freeUnitGroups) {
      availableByWarehouse.set(group.warehouseId, group._count._all);
    }

    for (const hold of heldBins) {
      const nextAvailable = Math.max(
        (availableByWarehouse.get(hold.warehouseId) ?? 0)
          - Math.max((hold.quantityTarget ?? 0) - (hold.quantityPicked ?? 0), 0),
        0,
      );
      if (nextAvailable > 0) {
        availableByWarehouse.set(hold.warehouseId, nextAvailable);
      } else {
        availableByWarehouse.delete(hold.warehouseId);
      }
    }

    return availableByWarehouse;
  }

  private async refreshFulfillmentOrderProgressState(
    tx: Prisma.TransactionClient,
    fulfillmentOrderId: string,
    now: Date,
  ) {
    const order = await tx.wmsFulfillmentOrder.findUnique({
      where: { id: fulfillmentOrderId },
      include: {
        lines: {
          include: {
            basketPickDemands: true,
            reservations: {
              where: {
                status: {
                  in: [...ACTIVE_PICK_RESERVATION_STATUSES],
                },
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
      if (line.status === WmsFulfillmentLineStatus.CANCELED) {
        if (line.quantityAllocated !== 0 || line.quantityPicked !== 0 || line.issueReason) {
          await tx.wmsFulfillmentLine.update({
            where: { id: line.id },
            data: {
              quantityAllocated: 0,
              quantityPicked: 0,
              issueReason: null,
            },
          });
        }
        continue;
      }

      const required = Math.max(line.quantityRequired, 0);
      const allocated = order.assignmentMode === WmsFulfillmentAssignmentMode.BASKET_DEMAND
        ? (line.basketPickDemands.length > 0
            ? line.basketPickDemands.reduce(
                (sum, demand) => sum + Math.max(demand.quantityRequired ?? 0, 0),
                0,
              )
            : Math.min(line.quantityAllocated ?? 0, required))
        : line.reservations.length;
      const picked = order.assignmentMode === WmsFulfillmentAssignmentMode.BASKET_DEMAND
        ? line.basketPickDemands.reduce(
            (sum, demand) => sum + Math.max(demand.quantityPicked ?? 0, 0),
            0,
          )
        : line.reservations.filter((reservation) => reservation.status === WmsPickReservationStatus.PICKED).length;
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
          issueReason: nextLineStatus === WmsFulfillmentLineStatus.READY || nextLineStatus === WmsFulfillmentLineStatus.PICKED
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

  private async refreshBasketState(
    tx: Prisma.TransactionClient,
    basketId: string,
    now: Date,
  ) {
    const basket = await tx.wmsBasket.findUnique({
      where: { id: basketId },
      select: {
        id: true,
        status: true,
        assignedPackerId: true,
        fullAt: true,
        readyForPackAt: true,
        fulfillmentOrders: {
          where: {
            status: {
              in: [...ACTIVE_BASKET_ORDER_STATUSES],
            },
          },
          select: {
            id: true,
            status: true,
            pickedQuantity: true,
            tenantId: true,
            claimedById: true,
          },
          orderBy: [
            { updatedAt: 'desc' },
            { createdAt: 'desc' },
          ],
        },
      },
    });

    if (!basket) {
      return;
    }

    const activeOrders = basket.fulfillmentOrders;
    if (activeOrders.length === 0) {
      await tx.wmsBasket.update({
        where: { id: basket.id },
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
      return;
    }

    const hasPackingOrder = activeOrders.some((order) => order.status === WmsFulfillmentOrderStatus.PACKING);
    const allReadyForPack = activeOrders.every((order) => (
      order.status === WmsFulfillmentOrderStatus.READY_FOR_PACK
      || order.status === WmsFulfillmentOrderStatus.PICKED
    ));
    const hasPickedWork = activeOrders.some((order) => (
      order.pickedQuantity > 0
      || order.status === WmsFulfillmentOrderStatus.IN_PICKING
    ));
    const activeTenantIds = Array.from(new Set(activeOrders.map((order) => order.tenantId)));
    const nextStatus = hasPackingOrder
      ? WmsBasketStatus.PACKING
      : allReadyForPack
        ? WmsBasketStatus.FULL_HELD
        : hasPickedWork
          ? WmsBasketStatus.IN_PICKING
          : WmsBasketStatus.ASSIGNED;

    await tx.wmsBasket.update({
      where: { id: basket.id },
      data: {
        status: nextStatus,
        tenantId: activeTenantIds.length === 1 ? activeTenantIds[0] : null,
        assignedPickerId: activeOrders[0]?.claimedById ?? null,
        assignedPackerId: nextStatus === WmsBasketStatus.FULL_HELD || nextStatus === WmsBasketStatus.PACKING
          ? basket.assignedPackerId
          : null,
        fullAt: nextStatus === WmsBasketStatus.FULL_HELD || nextStatus === WmsBasketStatus.PACKING
          ? basket.fullAt ?? now
          : null,
        readyForPackAt: nextStatus === WmsBasketStatus.FULL_HELD || nextStatus === WmsBasketStatus.PACKING
          ? basket.readyForPackAt ?? now
          : null,
      },
    });
  }

  private async countFreeDemandPickUnits(
    tx: Prisma.TransactionClient,
    params: {
      tenantId: string;
      storeId: string;
      warehouseId: string | null;
      posWarehouseRef: string | null;
      variationId: string;
    },
  ) {
    return tx.wmsInventoryUnit.count({
      where: this.buildFreeDemandPickUnitWhere(params),
    });
  }

  private buildFreeDemandPickUnitWhere(params: {
    tenantId: string;
    storeId: string;
    warehouseId: string | null;
    posWarehouseRef: string | null;
    variationId: string;
  }): Prisma.WmsInventoryUnitWhereInput {
    const baseWhere: Prisma.WmsInventoryUnitWhereInput = {
      tenantId: params.tenantId,
      storeId: params.storeId,
      ...(params.warehouseId ? { warehouseId: params.warehouseId } : {}),
      variationId: params.variationId,
      status: {
        in: [...FULFILLABLE_UNIT_STATUSES],
      },
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
      basketUnits: {
        none: {
          status: { in: [...ACTIVE_BASKET_UNIT_STATUSES] },
        },
      },
    };

    if (!params.posWarehouseRef) {
      return baseWhere;
    }

    return {
      ...baseWhere,
      OR: [
        { posWarehouseRef: params.posWarehouseRef },
        { posWarehouseRef: null },
      ],
    };
  }

  private async countActiveDemandHeldQuantity(
    tx: Prisma.TransactionClient,
    params: {
      tenantId: string;
      storeId: string;
      warehouseId: string | null;
      variationId: string;
      locationId?: string | null;
      excludeFulfillmentOrderId?: string | null;
    },
  ) {
    const holds = await tx.wmsBasketPickDemandBin.findMany({
      where: {
        tenantId: params.tenantId,
        variationId: params.variationId,
        ...(params.warehouseId ? { warehouseId: params.warehouseId } : {}),
        ...(params.locationId ? { locationId: params.locationId } : {}),
        basket: {
          status: {
            in: [...ACTIVE_DEMAND_HOLD_BASKET_STATUSES],
          },
        },
        demand: {
          storeId: params.storeId,
          ...(params.excludeFulfillmentOrderId
            ? { fulfillmentOrderId: { not: params.excludeFulfillmentOrderId } }
            : {}),
          fulfillmentOrder: {
            status: {
              in: [
                WmsFulfillmentOrderStatus.IN_PICKING,
                WmsFulfillmentOrderStatus.READY_FOR_PACK,
                WmsFulfillmentOrderStatus.PICKED,
              ],
            },
          },
        },
      },
      select: {
        quantityTarget: true,
        quantityPicked: true,
      },
    });

    return holds.reduce((sum, hold) => (
      sum + Math.max((hold.quantityTarget ?? 0) - (hold.quantityPicked ?? 0), 0)
    ), 0);
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

    if (params.currentStatus === WmsFulfillmentOrderStatus.PACKED) {
      return WmsFulfillmentOrderStatus.PACKED;
    }

    if (params.currentStatus === WmsFulfillmentOrderStatus.PACKING) {
      return WmsFulfillmentOrderStatus.PACKING;
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

  private async resolveTenantScope(requestedTenantId?: string, forceAllTenants = false) {
    const clsTenantId = this.cls.get('tenantId') as string | undefined;
    const userRole = this.cls.get('userRole') as string | undefined;
    const isPlatformUser = userRole === 'SUPER_ADMIN';
    const hasGlobalWmsAccess = this.cls.get('wmsGlobalAccess') === true;

    if (isPlatformUser || hasGlobalWmsAccess) {
      const tenants = await this.prisma.tenant.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
        },
        orderBy: [{ name: 'asc' }],
      });

      const activeTenantId =
        requestedTenantId && tenants.some((tenant) => tenant.id === requestedTenantId)
          ? requestedTenantId
          : forceAllTenants
            ? null
            : clsTenantId && tenants.some((tenant) => tenant.id === clsTenantId)
              ? clsTenantId
              : null;

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
      return {
        activeTenantId: null,
        canAccessAllTenants: false,
        tenants: [],
      };
    }

    if (requestedTenantId && requestedTenantId !== clsTenantId) {
      throw new ForbiddenException('Selected tenant is outside your WMS scope');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: clsTenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
      },
    });

    return {
      activeTenantId: clsTenantId,
      canAccessAllTenants: false,
      tenants: tenant
        ? [
            {
              id: tenant.id,
              label: tenant.name,
              slug: tenant.slug,
              status: tenant.status,
            },
          ]
        : [],
    };
  }

  private buildDemandVariationKey(params: {
    basketId: string;
    tenantId: string;
    storeId: string;
    variationId: string;
  }) {
    return `${params.basketId}:${params.tenantId}:${params.storeId}:${params.variationId}`;
  }

  private buildDemandLocationKey(params: {
    basketId: string;
    tenantId: string;
    storeId: string;
    variationId: string;
    locationId: string;
  }) {
    return `${this.buildDemandVariationKey(params)}:${params.locationId}`;
  }

  private resolveActorId(user: { userId?: string; id?: string }) {
    return user.userId || user.id || null;
  }

  private resolveSessionId(user: { sessionId?: string | null }) {
    return user.sessionId ?? null;
  }

  private mapActor(actor: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null) {
    if (!actor) {
      return null;
    }

    const name = [actor.firstName, actor.lastName].filter(Boolean).join(' ').trim() || actor.email;
    return {
      id: actor.id,
      name,
      email: actor.email,
    };
  }

  private buildEmptyOpsHealth(
    scope: {
      activeTenantId: string | null;
      tenants: Array<{ id: string; label: string; slug: string; status: string }>;
    },
    limit: number,
    staleMinutes: number,
  ) {
    return {
      tenantReady: false,
      filters: {
        tenants: scope.tenants,
        activeTenantId: scope.activeTenantId,
        limit,
        staleMinutes,
      },
      summary: {
        activeLegacyReservations: 0,
        activeDemandBaskets: 0,
        pickedNotPackedBasketUnits: 0,
        demandQuantityMismatches: 0,
      },
      legacyReservations: [],
      activeDemandBaskets: [],
      pickedNotPackedBasketUnits: [],
      demandMismatches: [],
    };
  }

  private async lockBasketForUpdate(tx: Prisma.TransactionClient, basketId: string) {
    await tx.$queryRaw`SELECT "id" FROM "wms_baskets" WHERE "id" = ${basketId}::uuid FOR UPDATE`;
  }
}
