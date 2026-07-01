import { Injectable } from '@nestjs/common';
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
import { PrismaService } from '../../common/prisma/prisma.service';
import { WmsInventoryService } from '../wms-inventory/wms-inventory.service';

type FulfillmentLineDraft = {
  variationId: string;
  productId: string | null;
  productName: string;
  productDisplayId: string | null;
  quantityRequired: number;
  lineSnapshot: Prisma.InputJsonValue;
};

type FulfillmentSyncStore = {
  id: string;
  tenantId: string;
  shopId: string;
};

const CONFIRMED_POS_ORDER_STATUS = 1;
const CANCELED_POS_ORDER_STATUS = 6;
const PICKING_SYNC_ORDER_LIMIT = 80;
const ACTIVE_PICK_RESERVATION_STATUSES = [
  WmsPickReservationStatus.RESERVED,
  WmsPickReservationStatus.PICKED,
] as const;
const ACTIVE_DEMAND_BASKET_STATUSES = [
  WmsBasketStatus.ASSIGNED,
  WmsBasketStatus.IN_PICKING,
  WmsBasketStatus.FULL_HELD,
] as const;
const ACTIVE_BASKET_UNIT_STATUSES = [
  WmsBasketUnitStatus.PICKED,
  WmsBasketUnitStatus.PACKED,
] as const;
const ACTIVE_BASKET_ORDER_STATUSES = [
  WmsFulfillmentOrderStatus.IN_PICKING,
  WmsFulfillmentOrderStatus.READY_FOR_PACK,
  WmsFulfillmentOrderStatus.PICKED,
  WmsFulfillmentOrderStatus.PACKING,
] as const;
const AUTO_REALLOCATION_ORDER_STATUSES = [
  WmsFulfillmentOrderStatus.RESTOCKING,
  WmsFulfillmentOrderStatus.PARTIAL,
] as const;
const DEMAND_QUEUE_ORDER_STATUSES = [
  WmsFulfillmentOrderStatus.READY,
  WmsFulfillmentOrderStatus.RESTOCKING,
  WmsFulfillmentOrderStatus.PARTIAL,
] as const;
const FINALIZED_FULFILLMENT_ORDER_STATUSES = [
  WmsFulfillmentOrderStatus.IN_PICKING,
  WmsFulfillmentOrderStatus.READY_FOR_PACK,
  WmsFulfillmentOrderStatus.PICKED,
  WmsFulfillmentOrderStatus.PACKING,
  WmsFulfillmentOrderStatus.PACKED,
  WmsFulfillmentOrderStatus.CANCELED,
] as const;
const PUTAWAY_REALLOCATION_ORDER_LIMIT = 80;
const MANUAL_REALLOCATION_ORDER_LIMIT = 200;
const FULFILLABLE_UNIT_STATUSES = [
  WmsInventoryUnitStatus.PUTAWAY,
  WmsInventoryUnitStatus.DEADSTOCK,
] as const;

type DemandFulfillmentReadinessRecord = Prisma.WmsFulfillmentOrderGetPayload<{
  include: {
    posOrder: {
      select: {
        status: true;
        isVoid: true;
      };
    };
    lines: true;
  };
}>;

@Injectable()
export class WmsFulfillmentSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wmsInventoryService: WmsInventoryService,
  ) {}

  private isBasketDemandPickingEnabled() {
    return process.env.WMS_BASKET_DEMAND_PICKING_ENABLED === 'true';
  }

  private getDemandQueueRefreshChunkSize() {
    const configuredSize = Number(process.env.WMS_DEMAND_QUEUE_REFRESH_CHUNK_SIZE ?? 25);
    if (!Number.isFinite(configuredSize) || configuredSize < 1) {
      return 25;
    }

    return Math.floor(configuredSize);
  }

  private getDemandQueueRefreshTransactionOptions(): Prisma.TransactionOptions {
    const configuredTimeout = Number(process.env.WMS_DEMAND_QUEUE_REFRESH_TX_TIMEOUT_MS ?? 90000);
    const configuredMaxWait = Number(process.env.WMS_DEMAND_QUEUE_REFRESH_TX_MAX_WAIT_MS ?? 10000);

    return {
      timeout: Number.isFinite(configuredTimeout) && configuredTimeout >= 1000
        ? Math.floor(configuredTimeout)
        : 90000,
      maxWait: Number.isFinite(configuredMaxWait) && configuredMaxWait >= 1000
        ? Math.floor(configuredMaxWait)
        : 10000,
    };
  }

  private resolveNewFulfillmentAssignmentMode() {
    return this.isBasketDemandPickingEnabled()
      ? WmsFulfillmentAssignmentMode.BASKET_DEMAND
      : WmsFulfillmentAssignmentMode.SERIAL_RESERVED;
  }

  async syncConfirmedPickingOrders(params: {
    tenantId: string | null;
    storeId: string | null;
    stores: FulfillmentSyncStore[];
    actorId: string | null;
    limit?: number | null;
    posOrderRefs?: Array<{
      shopId: string;
      posOrderId: string;
    }>;
  }) {
    const scopedStores = params.storeId
      ? params.stores.filter((store) => store.id === params.storeId)
      : params.stores;

    if (scopedStores.length === 0) {
      return { syncedOrders: 0 };
    }

    await this.syncCanceledPickingOrders(params, scopedStores);

    const refs = Array.from(
      new Map(
        (params.posOrderRefs ?? [])
          .filter((ref) => ref.shopId && ref.posOrderId)
          .map((ref) => [`${ref.shopId}::${ref.posOrderId}`, ref] as const),
      ).values(),
    );
    const storeByTenantShop = new Map(scopedStores.map((store) => [`${store.tenantId}:${store.shopId}`, store]));
    const shopIds = Array.from(new Set(scopedStores.map((store) => store.shopId)));
    const tenantIds = Array.from(new Set(scopedStores.map((store) => store.tenantId)));
    const tenantGoLiveFilters = await this.buildTenantGoLiveOrderFilters(tenantIds);
    const shouldLimit = refs.length === 0 && params.limit !== null;
    const effectiveLimit = shouldLimit
      ? (typeof params.limit === 'number' ? params.limit : PICKING_SYNC_ORDER_LIMIT)
      : null;

    const confirmedOrders = await this.prisma.posOrder.findMany({
      where: {
        status: CONFIRMED_POS_ORDER_STATUS,
        isVoid: false,
        shopId: { in: shopIds },
        tenantId: params.tenantId ? params.tenantId : { in: tenantIds },
        AND: [
          {
            OR: tenantGoLiveFilters,
          },
          ...(refs.length > 0
            ? [{
                OR: refs.map((ref) => ({
                  shopId: ref.shopId,
                  posOrderId: ref.posOrderId,
                })),
              }]
            : []),
        ],
        wmsFulfillmentOrders: {
          none: {
            status: {
              in: [...FINALIZED_FULFILLMENT_ORDER_STATUSES],
            },
          },
        },
      },
      select: {
        id: true,
        tenantId: true,
        shopId: true,
        posOrderId: true,
        insertedAt: true,
        customerName: true,
        customerPhone: true,
        orderSnapshot: true,
      },
      orderBy: [{ insertedAt: 'asc' }],
      ...(effectiveLimit && effectiveLimit > 0 ? { take: effectiveLimit } : {}),
    });

    let syncedOrders = 0;
    const demandQueueScopeKeys = new Set<string>();

    for (const posOrder of confirmedOrders) {
      const store = storeByTenantShop.get(`${posOrder.tenantId}:${posOrder.shopId}`);
      if (!store) {
        continue;
      }

      const lines = await this.extractFulfillmentLinesFromOrderSnapshot(posOrder.orderSnapshot, store.id);
      const posWarehouseRef = this.extractPosWarehouseRef(posOrder.orderSnapshot);
      const assignmentMode = this.resolveNewFulfillmentAssignmentMode();
      const warehouseId = assignmentMode === WmsFulfillmentAssignmentMode.SERIAL_RESERVED
        ? await this.resolveFulfillmentWarehouseId({
            tenantId: posOrder.tenantId,
            storeId: store.id,
            posWarehouseRef,
          })
        : null;
      const totalQuantity = lines.reduce((sum, line) => sum + line.quantityRequired, 0);

      const fulfillmentOrder = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.wmsFulfillmentOrder.findUnique({
          where: { posOrderDbId: posOrder.id },
          select: {
            id: true,
            status: true,
            assignmentMode: true,
          },
        });

        if (!existing) {
          return tx.wmsFulfillmentOrder.create({
            data: {
              tenantId: posOrder.tenantId,
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
              assignmentMode,
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
              assignmentMode: true,
            },
          });
        }

        if ((FINALIZED_FULFILLMENT_ORDER_STATUSES as readonly WmsFulfillmentOrderStatus[]).includes(existing.status)) {
          return existing;
        }

        await tx.wmsFulfillmentOrder.update({
          where: { id: existing.id },
          data: {
            posWarehouseRef,
            ...(existing.assignmentMode === WmsFulfillmentAssignmentMode.SERIAL_RESERVED
              ? { warehouseId }
              : {}),
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
              status: WmsFulfillmentLineStatus.RESTOCKING,
              issueReason: null,
            },
          })
        )));

        await this.reconcileLegacyFulfillmentLines(tx, {
          fulfillmentOrderId: existing.id,
          canonicalVariationIds: lines.map((line) => line.variationId),
        });

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

      syncedOrders += 1;

      if (!(FINALIZED_FULFILLMENT_ORDER_STATUSES as readonly WmsFulfillmentOrderStatus[]).includes(fulfillmentOrder.status)) {
        if (fulfillmentOrder.assignmentMode === WmsFulfillmentAssignmentMode.BASKET_DEMAND) {
          demandQueueScopeKeys.add(`${posOrder.tenantId}::${store.id}`);
        } else {
          await this.allocateFulfillmentOrder(fulfillmentOrder.id, params.actorId);
        }
      }
    }

    for (const scopeKey of demandQueueScopeKeys) {
      const [tenantId, storeId] = scopeKey.split('::');
      if (!tenantId || !storeId) {
        continue;
      }

      await this.refreshDemandFulfillmentQueue({
        tenantId,
        storeId,
      });
    }

    return { syncedOrders };
  }

  private async syncCanceledPickingOrders(
    params: {
      tenantId: string | null;
      storeId: string | null;
      stores: FulfillmentSyncStore[];
      actorId: string | null;
      posOrderRefs?: Array<{
        shopId: string;
        posOrderId: string;
      }>;
    },
    scopedStores: FulfillmentSyncStore[],
  ) {
    const refs = Array.from(
      new Map(
        (params.posOrderRefs ?? [])
          .filter((ref) => ref.shopId && ref.posOrderId)
          .map((ref) => [`${ref.shopId}::${ref.posOrderId}`, ref] as const),
      ).values(),
    );
    const shopIds = Array.from(new Set(scopedStores.map((store) => store.shopId)));
    const tenantIds = Array.from(new Set(scopedStores.map((store) => store.tenantId)));
    const tenantGoLiveFilters = await this.buildTenantGoLiveOrderFilters(tenantIds);
    const canceledPosOrders = await this.prisma.posOrder.findMany({
      where: {
        shopId: { in: shopIds },
        tenantId: params.tenantId ? params.tenantId : { in: tenantIds },
        OR: [
          { status: CANCELED_POS_ORDER_STATUS },
          { isVoid: true },
        ],
        AND: [
          {
            OR: tenantGoLiveFilters,
          },
          ...(refs.length > 0
            ? [{
                OR: refs.map((ref) => ({
                  shopId: ref.shopId,
                  posOrderId: ref.posOrderId,
                })),
              }]
            : []),
        ],
        wmsFulfillmentOrders: {
          some: {
            status: {
              in: [
                WmsFulfillmentOrderStatus.READY,
                WmsFulfillmentOrderStatus.RESTOCKING,
                WmsFulfillmentOrderStatus.PARTIAL,
                WmsFulfillmentOrderStatus.IN_PICKING,
                WmsFulfillmentOrderStatus.READY_FOR_PACK,
                WmsFulfillmentOrderStatus.PICKED,
                WmsFulfillmentOrderStatus.PACKING,
                WmsFulfillmentOrderStatus.PACKED,
              ],
            },
          },
        },
      },
      select: {
        id: true,
      },
    });

    if (canceledPosOrders.length === 0) {
      return { cleanedOrders: 0 };
    }

    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const fulfillmentOrders = await tx.wmsFulfillmentOrder.findMany({
        where: {
          posOrderDbId: {
            in: canceledPosOrders.map((order) => order.id),
          },
          status: {
            not: WmsFulfillmentOrderStatus.CANCELED,
          },
        },
        include: {
          posOrder: {
            select: {
              status: true,
              isVoid: true,
            },
          },
          lines: true,
          basketUnits: {
            where: {
              status: {
                in: [...ACTIVE_BASKET_UNIT_STATUSES],
              },
            },
            select: {
              id: true,
              basketId: true,
              tenantId: true,
              inventoryUnitId: true,
              sourceLocationId: true,
              status: true,
              inventoryUnit: {
                select: {
                  id: true,
                  code: true,
                  status: true,
                },
              },
            },
          },
        },
      });

      const affectedBasketIds = new Set<string>();
      const scopeKeys = new Set<string>();

      for (const order of fulfillmentOrders) {
        if ((order.posOrder?.status ?? null) !== CANCELED_POS_ORDER_STATUS && !order.posOrder?.isVoid) {
          continue;
        }

        if (order.assignmentMode === WmsFulfillmentAssignmentMode.BASKET_DEMAND) {
          await this.releaseCanceledDemandOrderTx(tx, {
            order,
            actorId: params.actorId,
            now,
          });

          if (order.basketId) {
            affectedBasketIds.add(order.basketId);
          }
          for (const basketUnit of order.basketUnits ?? []) {
            if (basketUnit.basketId) {
              affectedBasketIds.add(basketUnit.basketId);
            }
          }
          scopeKeys.add(`${order.tenantId}::${order.storeId}`);
          continue;
        }

        await tx.wmsFulfillmentLine.updateMany({
          where: {
            fulfillmentOrderId: order.id,
          },
          data: {
            quantityAllocated: 0,
            quantityPicked: 0,
            status: WmsFulfillmentLineStatus.CANCELED,
            issueReason: 'Order was canceled in POS.',
          },
        });

        await tx.wmsFulfillmentOrder.update({
          where: { id: order.id },
          data: {
            status: WmsFulfillmentOrderStatus.CANCELED,
            issueReason: 'Order was canceled in POS.',
            allocatedQuantity: 0,
            pickedQuantity: 0,
            claimedById: null,
            claimedAt: null,
            packedById: null,
            basketId: null,
            completedAt: now,
            lastSyncedAt: now,
          },
        });
      }

      for (const basketId of affectedBasketIds) {
        await this.refreshDemandBasketStateTx(tx, basketId, now);
      }

      for (const scopeKey of scopeKeys) {
        const [tenantId, storeId] = scopeKey.split('::');
        if (!tenantId || !storeId) {
          continue;
        }

        await this.refreshDemandFulfillmentQueueTx(tx, {
          tenantId,
          storeId,
        }, now);
      }

      return {
        cleanedOrders: fulfillmentOrders.length,
      };
    });
  }

  private async buildTenantGoLiveOrderFilters(tenantIds: string[]): Promise<Prisma.PosOrderWhereInput[]> {
    const uniqueTenantIds = Array.from(new Set(
      tenantIds
        .map((tenantId) => tenantId?.trim())
        .filter((tenantId): tenantId is string => Boolean(tenantId)),
    ));

    if (uniqueTenantIds.length === 0) {
      return [];
    }

    const tenants = await this.prisma.tenant.findMany({
      where: {
        id: {
          in: uniqueTenantIds,
        },
      },
      select: {
        id: true,
        wmsFulfillmentGoLiveAt: true,
      },
    });
    const goLiveByTenantId = new Map(
      tenants.map((tenant) => [tenant.id, tenant.wmsFulfillmentGoLiveAt] as const),
    );

    return uniqueTenantIds.map((tenantId) => {
      const goLiveAt = goLiveByTenantId.get(tenantId) ?? null;

      return goLiveAt
        ? {
            tenantId,
            insertedAt: {
              gte: goLiveAt,
            },
          }
        : {
            tenantId,
          };
    });
  }

  async allocateFulfillmentOrder(fulfillmentOrderId: string, actorId: string | null) {
    const demandOrderScope = await this.prisma.wmsFulfillmentOrder.findUnique({
      where: { id: fulfillmentOrderId },
      select: {
        tenantId: true,
        storeId: true,
        assignmentMode: true,
      },
    });

    if (demandOrderScope?.assignmentMode === WmsFulfillmentAssignmentMode.BASKET_DEMAND) {
      await this.refreshDemandFulfillmentQueue({
        tenantId: demandOrderScope.tenantId,
        storeId: demandOrderScope.storeId,
      });
      return;
    }

    await this.allocateFulfillmentOrderWithOptions(fulfillmentOrderId, actorId, {
      preferredWarehouseId: null,
    });
  }

  async reallocateWaitingOrdersForRestockedVariations(params: {
    tenantId: string;
    storeId: string;
    warehouseId: string;
    variationIds: string[];
    actorId: string | null;
  }) {
    const variationIds = Array.from(new Set(
      params.variationIds
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ));

    if (variationIds.length === 0) {
      return { reallocatedOrders: 0 };
    }

    const candidateOrders = await this.prisma.wmsFulfillmentOrder.findMany({
      where: {
        tenantId: params.tenantId,
        storeId: params.storeId,
        assignmentMode: WmsFulfillmentAssignmentMode.SERIAL_RESERVED,
        status: {
          in: [...AUTO_REALLOCATION_ORDER_STATUSES],
        },
        posOrder: {
          is: {
            status: CONFIRMED_POS_ORDER_STATUS,
            isVoid: false,
          },
        },
        OR: [
          { warehouseId: params.warehouseId },
          { warehouseId: null },
        ],
        lines: {
          some: {
            variationId: {
              in: variationIds,
            },
            quantityRequired: {
              gt: 0,
            },
            status: {
              in: [
                WmsFulfillmentLineStatus.RESTOCKING,
                WmsFulfillmentLineStatus.PARTIAL,
              ],
            },
          },
        },
      },
      select: {
        id: true,
      },
      orderBy: [
        { posOrder: { dateLocal: 'asc' } },
        { id: 'asc' },
      ],
      take: PUTAWAY_REALLOCATION_ORDER_LIMIT,
    });

    for (const order of candidateOrders) {
      await this.allocateFulfillmentOrderWithOptions(order.id, params.actorId, {
        preferredWarehouseId: params.warehouseId,
      });
    }

    const demandCandidateOrders = await this.prisma.wmsFulfillmentOrder.findMany({
      where: {
        tenantId: params.tenantId,
        storeId: params.storeId,
        assignmentMode: WmsFulfillmentAssignmentMode.BASKET_DEMAND,
        status: {
          in: [...DEMAND_QUEUE_ORDER_STATUSES],
        },
        posOrder: {
          is: {
            status: CONFIRMED_POS_ORDER_STATUS,
            isVoid: false,
          },
        },
        OR: [
          { warehouseId: null },
          { warehouseId: params.warehouseId },
        ],
        lines: {
          some: {
            variationId: {
              in: variationIds,
            },
            quantityRequired: {
              gt: 0,
            },
          },
        },
      },
      select: {
        id: true,
      },
      orderBy: [
        { posOrder: { dateLocal: 'asc' } },
        { id: 'asc' },
      ],
      take: PUTAWAY_REALLOCATION_ORDER_LIMIT,
    });

    if (demandCandidateOrders.length > 0) {
      await this.refreshDemandFulfillmentQueue({
        tenantId: params.tenantId,
        storeId: params.storeId,
        variationIds,
        limit: PUTAWAY_REALLOCATION_ORDER_LIMIT,
      });
    }

    return {
      reallocatedOrders: candidateOrders.length + demandCandidateOrders.length,
    };
  }

  async reallocateWaitingOrders(params: {
    tenantId: string | null;
    storeId: string | null;
    warehouseId?: string | null;
    actorId: string | null;
    limit?: number | null;
  }) {
    const availableRestockVariations = await this.prisma.wmsInventoryUnit.findMany({
      where: {
        ...(params.tenantId ? { tenantId: params.tenantId } : {}),
        ...(params.storeId ? { storeId: params.storeId } : {}),
        ...(params.warehouseId ? { warehouseId: params.warehouseId } : {}),
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
      },
      select: {
        storeId: true,
        variationId: true,
      },
      distinct: ['storeId', 'variationId'],
    });

    if (availableRestockVariations.length === 0) {
      return {
        checkedOrders: 0,
      };
    }

    const variationIdsByStore = availableRestockVariations.reduce((map, unit) => {
      const current = map.get(unit.storeId);
      if (current) {
        current.add(unit.variationId);
        return map;
      }

      map.set(unit.storeId, new Set([unit.variationId]));
      return map;
    }, new Map<string, Set<string>>());
    const candidateStoreIds = Array.from(variationIdsByStore.keys());
    const candidateVariationIds = Array.from(new Set(
      availableRestockVariations.map((unit) => unit.variationId),
    ));

    const candidateOrders = await this.prisma.wmsFulfillmentOrder.findMany({
      where: {
        ...(params.tenantId ? { tenantId: params.tenantId } : {}),
        ...(params.storeId
          ? { storeId: params.storeId }
          : { storeId: { in: candidateStoreIds } }),
        assignmentMode: WmsFulfillmentAssignmentMode.SERIAL_RESERVED,
        status: {
          in: [...AUTO_REALLOCATION_ORDER_STATUSES],
        },
        posOrder: {
          is: {
            status: CONFIRMED_POS_ORDER_STATUS,
            isVoid: false,
          },
        },
        ...(params.warehouseId
          ? {
              OR: [
                { warehouseId: params.warehouseId },
                { warehouseId: null },
              ],
            }
          : {}),
        lines: {
          some: {
            quantityRequired: {
              gt: 0,
            },
            variationId: {
              in: candidateVariationIds,
            },
            status: {
              in: [
                WmsFulfillmentLineStatus.RESTOCKING,
                WmsFulfillmentLineStatus.PARTIAL,
              ],
            },
          },
        },
      },
      select: {
        id: true,
        warehouseId: true,
        storeId: true,
        lines: {
          where: {
            quantityRequired: {
              gt: 0,
            },
            status: {
              in: [
                WmsFulfillmentLineStatus.RESTOCKING,
                WmsFulfillmentLineStatus.PARTIAL,
              ],
            },
            variationId: {
              in: candidateVariationIds,
            },
          },
          select: {
            variationId: true,
          },
        },
      },
      orderBy: [
        { posOrder: { dateLocal: 'asc' } },
        { id: 'asc' },
      ],
      take: params.limit === null ? undefined : (params.limit ?? MANUAL_REALLOCATION_ORDER_LIMIT),
    });

    const filteredOrders = candidateOrders.filter((order) => {
      const availableVariations = variationIdsByStore.get(order.storeId);
      if (!availableVariations) {
        return false;
      }

      return order.lines.some((line) => availableVariations.has(line.variationId));
    });

    for (const order of filteredOrders) {
      await this.allocateFulfillmentOrderWithOptions(order.id, params.actorId, {
        preferredWarehouseId: order.warehouseId ?? params.warehouseId ?? null,
      });
    }

    const demandCandidateOrders = await this.prisma.wmsFulfillmentOrder.findMany({
      where: {
        ...(params.tenantId ? { tenantId: params.tenantId } : {}),
        ...(params.storeId
          ? { storeId: params.storeId }
          : { storeId: { in: candidateStoreIds } }),
        assignmentMode: WmsFulfillmentAssignmentMode.BASKET_DEMAND,
        status: {
          in: [...DEMAND_QUEUE_ORDER_STATUSES],
        },
        posOrder: {
          is: {
            status: CONFIRMED_POS_ORDER_STATUS,
            isVoid: false,
          },
        },
        ...(params.warehouseId
          ? {
              OR: [
                { warehouseId: params.warehouseId },
                { warehouseId: null },
              ],
            }
          : {}),
        lines: {
          some: {
            quantityRequired: {
              gt: 0,
            },
            variationId: {
              in: candidateVariationIds,
            },
          },
        },
      },
      select: {
        id: true,
        tenantId: true,
        storeId: true,
        lines: {
          where: {
            quantityRequired: {
              gt: 0,
            },
            variationId: {
              in: candidateVariationIds,
            },
          },
          select: {
            variationId: true,
          },
        },
      },
      orderBy: [
        { posOrder: { dateLocal: 'asc' } },
        { id: 'asc' },
      ],
      take: params.limit === null ? undefined : (params.limit ?? MANUAL_REALLOCATION_ORDER_LIMIT),
    });

    const filteredDemandOrders = demandCandidateOrders.filter((order) => {
      const availableVariations = variationIdsByStore.get(order.storeId);
      if (!availableVariations) {
        return false;
      }

      return order.lines.some((line) => availableVariations.has(line.variationId));
    });

    const demandQueueStoreKeys = new Set(filteredDemandOrders.map((order) => (
      `${order.tenantId}::${order.storeId}`
    )));

    for (const scopeKey of demandQueueStoreKeys) {
      const [tenantId, storeId] = scopeKey.split('::');
      if (!storeId) {
        continue;
      }

      await this.refreshDemandFulfillmentQueue({
        tenantId: tenantId || null,
        storeId,
        variationIds: Array.from(variationIdsByStore.get(storeId) ?? []),
        limit: params.limit === null ? null : (params.limit ?? MANUAL_REALLOCATION_ORDER_LIMIT),
      });
    }

    return {
      checkedOrders: filteredOrders.length + filteredDemandOrders.length,
    };
  }

  async retryAllocationForFulfillmentOrder(fulfillmentOrderId: string, actorId: string | null) {
    await this.allocateFulfillmentOrder(fulfillmentOrderId, actorId);
  }

  async refreshDemandQueueForScope(params: {
    tenantId: string | null;
    storeId: string;
    variationIds?: string[] | null;
    limit?: number | null;
  }) {
    await this.refreshDemandFulfillmentQueue(params);
  }

  async repairReleasedDemandOrders(params: {
    orderIds: string[];
    actorId: string | null;
    reason?: string | null;
  }) {
    const orderIds = Array.from(new Set(
      params.orderIds
        .map((orderId) => orderId?.trim())
        .filter((orderId): orderId is string => Boolean(orderId)),
    ));
    if (orderIds.length === 0) {
      return {
        repairedOrders: 0,
        resetOrders: 0,
        canceledOrders: 0,
        refreshedScopes: 0,
      };
    }

    const reason = params.reason?.trim() || 'Pick basket was voided from WMS.';
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const orders = await tx.wmsFulfillmentOrder.findMany({
        where: {
          id: {
            in: orderIds,
          },
        },
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

      const demandOrders = orders.filter((order) => (
        order.assignmentMode === WmsFulfillmentAssignmentMode.BASKET_DEMAND
        && order.status !== WmsFulfillmentOrderStatus.PACKED
        && order.status !== WmsFulfillmentOrderStatus.CANCELED
      ));
      const scopeKeys = new Set(demandOrders.map((order) => `${order.tenantId}::${order.storeId}`));
      let resetOrders = 0;
      let canceledOrders = 0;

      for (const order of demandOrders) {
        const isConfirmed = order.posOrder.status === CONFIRMED_POS_ORDER_STATUS && !order.posOrder.isVoid;

        await tx.wmsFulfillmentLine.updateMany({
          where: {
            fulfillmentOrderId: order.id,
            status: {
              not: WmsFulfillmentLineStatus.CANCELED,
            },
          },
          data: {
            quantityAllocated: 0,
            quantityPicked: 0,
            status: isConfirmed ? WmsFulfillmentLineStatus.RESTOCKING : WmsFulfillmentLineStatus.CANCELED,
            issueReason: isConfirmed ? null : reason,
          },
        });

        await tx.wmsFulfillmentOrder.update({
          where: { id: order.id },
          data: {
            warehouseId: null,
            status: isConfirmed ? WmsFulfillmentOrderStatus.RESTOCKING : WmsFulfillmentOrderStatus.CANCELED,
            issueReason: isConfirmed ? null : reason,
            allocatedQuantity: 0,
            pickedQuantity: 0,
            claimedById: null,
            claimedAt: null,
            packedById: null,
            basketId: null,
            completedAt: isConfirmed ? null : now,
            lastSyncedAt: now,
          },
        });

        if (isConfirmed) {
          resetOrders += 1;
        } else {
          canceledOrders += 1;
        }
      }

      for (const scopeKey of scopeKeys) {
        const [tenantId, storeId] = scopeKey.split('::');
        if (!tenantId || !storeId) {
          continue;
        }

        await this.refreshDemandFulfillmentQueueTx(tx, {
          tenantId,
          storeId,
        }, now);
      }

      return {
        repairedOrders: demandOrders.length,
        resetOrders,
        canceledOrders,
        refreshedScopes: scopeKeys.size,
      };
    });
  }

  private async refreshDemandFulfillmentQueue(params: {
    tenantId: string | null;
    storeId: string;
    variationIds?: string[] | null;
    limit?: number | null;
  }) {
    const now = new Date();
    const variationIds = Array.from(new Set(
      (params.variationIds ?? [])
        .map((variationId) => variationId?.trim())
        .filter((variationId): variationId is string => Boolean(variationId)),
    ));
    const orderedQueue = await this.prisma.wmsFulfillmentOrder.findMany({
      where: {
        ...(params.tenantId ? { tenantId: params.tenantId } : {}),
        storeId: params.storeId,
        assignmentMode: WmsFulfillmentAssignmentMode.BASKET_DEMAND,
        status: {
          in: [...DEMAND_QUEUE_ORDER_STATUSES],
        },
        posOrder: {
          is: {
            status: CONFIRMED_POS_ORDER_STATUS,
            isVoid: false,
          },
        },
        ...(variationIds.length > 0
          ? {
              lines: {
                some: {
                  variationId: {
                    in: variationIds,
                  },
                  quantityRequired: {
                    gt: 0,
                  },
                },
              },
            }
          : {}),
      },
      select: {
        id: true,
        posOrder: {
          select: {
            dateLocal: true,
          },
        },
      },
      orderBy: [
        { posOrder: { dateLocal: 'asc' } },
        { id: 'asc' },
      ],
      ...(typeof params.limit === 'number' && params.limit > 0 ? { take: params.limit } : {}),
    });
    const orderedQueueIds = orderedQueue
      .sort((left, right) => {
        const leftDateLocal = left.posOrder?.dateLocal ?? '';
        const rightDateLocal = right.posOrder?.dateLocal ?? '';
        if (leftDateLocal !== rightDateLocal) {
          return leftDateLocal.localeCompare(rightDateLocal);
        }

        return left.id.localeCompare(right.id);
      })
      .map((order) => order.id);

    if (orderedQueueIds.length === 0) {
      return;
    }

    const virtualAllocatedByWarehouseVariation = new Map<string, number>();
    const chunkSize = this.getDemandQueueRefreshChunkSize();

    for (let index = 0; index < orderedQueueIds.length; index += chunkSize) {
      const chunkIds = orderedQueueIds.slice(index, index + chunkSize);
      await this.prisma.$transaction(async (tx) => {
        const batchOrders = await tx.wmsFulfillmentOrder.findMany({
          where: {
            id: {
              in: chunkIds,
            },
          },
          include: {
            posOrder: {
              select: {
                status: true,
                isVoid: true,
                dateLocal: true,
              },
            },
            lines: true,
          },
        });
        const orderById = new Map(batchOrders.map((order) => [order.id, order]));

        for (const orderId of chunkIds) {
          const order = orderById.get(orderId);
          if (!order) {
            continue;
          }

          await this.refreshDemandFulfillmentOrderReadinessTx(tx, order.id, now, {
            order,
            virtualAllocatedByWarehouseVariation,
            accumulateVirtualAllocation: true,
          });
        }
      }, this.getDemandQueueRefreshTransactionOptions());
    }
  }

  private async refreshDemandFulfillmentQueueTx(
    tx: Prisma.TransactionClient,
    params: {
      tenantId: string | null;
      storeId: string;
      variationIds?: string[] | null;
      limit?: number | null;
    },
    now: Date,
  ) {
    const variationIds = Array.from(new Set(
      (params.variationIds ?? [])
        .map((variationId) => variationId?.trim())
        .filter((variationId): variationId is string => Boolean(variationId)),
    ));
    const queueOrders = await tx.wmsFulfillmentOrder.findMany({
      where: {
        ...(params.tenantId ? { tenantId: params.tenantId } : {}),
        storeId: params.storeId,
        assignmentMode: WmsFulfillmentAssignmentMode.BASKET_DEMAND,
        status: {
          in: [...DEMAND_QUEUE_ORDER_STATUSES],
        },
        posOrder: {
          is: {
            status: CONFIRMED_POS_ORDER_STATUS,
            isVoid: false,
          },
        },
        ...(variationIds.length > 0
          ? {
              lines: {
                some: {
                  variationId: {
                    in: variationIds,
                  },
                  quantityRequired: {
                    gt: 0,
                  },
                },
              },
            }
          : {}),
      },
      include: {
        posOrder: {
          select: {
            status: true,
            isVoid: true,
            dateLocal: true,
          },
        },
        lines: true,
      },
      orderBy: [
        { posOrder: { dateLocal: 'asc' } },
        { id: 'asc' },
      ],
      ...(typeof params.limit === 'number' && params.limit > 0 ? { take: params.limit } : {}),
    });

    const orderedQueue = queueOrders.sort((left, right) => {
      const leftDateLocal = left.posOrder?.dateLocal ?? '';
      const rightDateLocal = right.posOrder?.dateLocal ?? '';
      if (leftDateLocal !== rightDateLocal) {
        return leftDateLocal.localeCompare(rightDateLocal);
      }

      return left.id.localeCompare(right.id);
    });
    const virtualAllocatedByWarehouseVariation = new Map<string, number>();

    for (const order of orderedQueue) {
      await this.refreshDemandFulfillmentOrderReadinessTx(tx, order.id, now, {
        order,
        virtualAllocatedByWarehouseVariation,
        accumulateVirtualAllocation: true,
      });
    }
  }

  private async releaseCanceledDemandOrderTx(
    tx: Prisma.TransactionClient,
    params: {
      order: any;
      actorId: string | null;
      now: Date;
    },
  ) {
    const basketId = params.order.basketId as string | null;
    const activeBasketUnits = Array.isArray(params.order.basketUnits) ? params.order.basketUnits : [];
    const restorableUnitIds = activeBasketUnits
      .filter((basketUnit: any) => (
        basketUnit.inventoryUnit?.status === WmsInventoryUnitStatus.PICKED
        || basketUnit.inventoryUnit?.status === WmsInventoryUnitStatus.PACKED
      ))
      .map((basketUnit: any) => basketUnit.inventoryUnitId as string);

    const restoreStateByInventoryUnitId = basketId && restorableUnitIds.length > 0
      ? await this.loadBasketUnitRestoreStatesTx(tx, basketId, restorableUnitIds)
      : new Map<string, {
          fromLocationId: string | null;
          fromStatus: WmsInventoryUnitStatus | null;
          warehouseId: string | null;
        }>();

    const movementRows: Prisma.WmsInventoryMovementCreateManyInput[] = [];

    for (const basketUnit of activeBasketUnits) {
      const expectedSourceStatus = basketUnit.status === WmsBasketUnitStatus.PACKED
        ? WmsInventoryUnitStatus.PACKED
        : WmsInventoryUnitStatus.PICKED;
      const restoreState = restoreStateByInventoryUnitId.get(basketUnit.inventoryUnitId);

      if (
        restoreState?.fromLocationId
        && restoreState.fromStatus
        && restoreState.warehouseId
        && basketUnit.inventoryUnit?.status === expectedSourceStatus
      ) {
        const restoredNow = await this.restoreInventoryUnitToPriorStateTx(tx, {
          inventoryUnitId: basketUnit.inventoryUnitId,
          expectedSourceStatus,
          restoreState,
          actorId: params.actorId,
        });

        if (restoredNow) {
          movementRows.push({
            tenantId: basketUnit.tenantId,
            inventoryUnitId: basketUnit.inventoryUnitId,
            warehouseId: restoreState.warehouseId,
            fromLocationId: null,
            toLocationId: restoreState.fromLocationId,
            fromStatus: expectedSourceStatus,
            toStatus: restoreState.fromStatus,
            movementType: WmsInventoryMovementType.TRANSFER,
            referenceType: 'WMS_FULFILLMENT_ORDER',
            referenceId: params.order.id,
            referenceCode: params.order.posOrderId,
            notes: `POS canceled order ${params.order.posOrderId} released basket hold`,
            actorId: params.actorId,
            createdAt: params.now,
          });
        }
      }

      await tx.wmsBasketUnit.updateMany({
        where: {
          id: basketUnit.id,
          status: basketUnit.status,
        },
        data: {
          status: WmsBasketUnitStatus.REMOVED,
          removedById: params.actorId ?? undefined,
          removedAt: params.now,
        },
      });
    }

    if (movementRows.length > 0) {
      await tx.wmsInventoryMovement.createMany({
        data: movementRows,
      });
    }

    await tx.wmsBasketPickDemand.deleteMany({
      where: {
        fulfillmentOrderId: params.order.id,
      },
    });

    await tx.wmsFulfillmentLine.updateMany({
      where: {
        fulfillmentOrderId: params.order.id,
      },
      data: {
        quantityAllocated: 0,
        quantityPicked: 0,
        status: WmsFulfillmentLineStatus.CANCELED,
        issueReason: 'Order was canceled in POS.',
      },
    });

    await tx.wmsFulfillmentOrder.update({
      where: { id: params.order.id },
      data: {
        status: WmsFulfillmentOrderStatus.CANCELED,
        issueReason: 'Order was canceled in POS.',
        allocatedQuantity: 0,
        pickedQuantity: 0,
        claimedById: null,
        claimedAt: null,
        packedById: null,
        basketId: null,
        completedAt: params.now,
        lastSyncedAt: params.now,
      },
    });
  }

  private async loadBasketUnitRestoreStatesTx(
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

  private async restoreInventoryUnitToPriorStateTx(
    tx: Prisma.TransactionClient,
    params: {
      inventoryUnitId: string;
      expectedSourceStatus: WmsInventoryUnitStatus;
      restoreState: {
        fromLocationId: string | null;
        fromStatus: WmsInventoryUnitStatus | null;
        warehouseId: string | null;
      };
      actorId: string | null;
    },
  ) {
    const targetStatus = params.restoreState.fromStatus;
    if (!targetStatus) {
      return false;
    }

    const inventoryUpdate = await tx.wmsInventoryUnit.updateMany({
      where: {
        id: params.inventoryUnitId,
        status: params.expectedSourceStatus,
      },
      data: {
        currentLocationId: params.restoreState.fromLocationId,
        status: targetStatus,
        updatedById: params.actorId ?? undefined,
      },
    });

    if (inventoryUpdate.count === 1) {
      return true;
    }

    const currentUnit = await tx.wmsInventoryUnit.findUnique({
      where: { id: params.inventoryUnitId },
      select: {
        id: true,
        status: true,
        currentLocationId: true,
      },
    });

    return Boolean(
      currentUnit
      && currentUnit.status === targetStatus
      && currentUnit.currentLocationId === params.restoreState.fromLocationId,
    );
  }

  private async allocateFulfillmentOrderWithOptions(
    fulfillmentOrderId: string,
    actorId: string | null,
    options: {
      preferredWarehouseId: string | null;
    },
  ) {
    await this.prisma.$transaction(async (tx) => {
      const existingOrder = await tx.wmsFulfillmentOrder.findUnique({
        where: { id: fulfillmentOrderId },
        include: {
          posOrder: {
            select: {
              status: true,
              isVoid: true,
            },
          },
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
        !existingOrder
        || existingOrder.status === WmsFulfillmentOrderStatus.READY_FOR_PACK
        || existingOrder.status === WmsFulfillmentOrderStatus.PICKED
        || existingOrder.status === WmsFulfillmentOrderStatus.PACKING
        || existingOrder.status === WmsFulfillmentOrderStatus.PACKED
        || existingOrder.status === WmsFulfillmentOrderStatus.CANCELED
        || existingOrder.posOrder.status !== CONFIRMED_POS_ORDER_STATUS
        || existingOrder.posOrder.isVoid
      ) {
        return;
      }

      if (existingOrder.assignmentMode === WmsFulfillmentAssignmentMode.BASKET_DEMAND) {
        await this.refreshDemandFulfillmentOrderReadinessTx(tx, existingOrder.id, new Date());
        return;
      }

      const canonicalVariationIds = Array.from(new Set(
        existingOrder.lines.flatMap((line) => {
          const snapshot = this.asJsonRecord(line.lineSnapshot);
          const sourceVariationId = this.readString(snapshot?.sourceVariationId);
          return sourceVariationId ?? line.variationId;
        }),
      ));

      await this.reconcileLegacyFulfillmentLines(tx, {
        fulfillmentOrderId: existingOrder.id,
        canonicalVariationIds,
      });

      const anchoredWarehouseId = await this.resolveAllocationWarehouseId(tx, {
        fulfillmentOrderId: existingOrder.id,
        currentWarehouseId: existingOrder.warehouseId,
        preferredWarehouseId: options.preferredWarehouseId,
      });

      if (anchoredWarehouseId && anchoredWarehouseId !== existingOrder.warehouseId) {
        await tx.wmsFulfillmentOrder.update({
          where: { id: existingOrder.id },
          data: {
            warehouseId: anchoredWarehouseId,
          },
        });
      }

      const order = await tx.wmsFulfillmentOrder.findUniqueOrThrow({
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

        if (!order.warehouseId && availableUnits.length > 0) {
          const anchorWarehouseId = availableUnits[0]?.warehouseId ?? null;
          if (anchorWarehouseId) {
            await tx.wmsFulfillmentOrder.update({
              where: { id: order.id },
              data: {
                warehouseId: anchorWarehouseId,
              },
            });
            order.warehouseId = anchorWarehouseId;
          }
        }

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

    await this.wmsInventoryService.syncPosOrderCogsFromMatchedInventoryUnits({
      fulfillmentOrderIds: [fulfillmentOrderId],
    });
  }

  private async findAvailablePickUnitsForLine(
    tx: Prisma.TransactionClient,
    params: {
      order: {
        tenantId: string;
        storeId: string;
        warehouseId: string | null;
        posWarehouseRef: string | null;
      };
      variationId: string;
      take: number;
    },
  ) {
    const baseWhere: Prisma.WmsInventoryUnitWhereInput = {
      tenantId: params.order.tenantId,
      storeId: params.order.storeId,
      ...(params.order.warehouseId ? { warehouseId: params.order.warehouseId } : {}),
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
    const select = {
      id: true,
      tenantId: true,
      storeId: true,
      warehouseId: true,
      currentLocationId: true,
      status: true,
      code: true,
    } satisfies Prisma.WmsInventoryUnitSelect;
    const orderBy = [
      ...(params.order.warehouseId ? [] : [{ warehouseId: 'asc' as const }]),
      { updatedAt: 'asc' as const },
      { code: 'asc' as const },
    ];

    if (!params.order.posWarehouseRef) {
      const candidates = await tx.wmsInventoryUnit.findMany({
        where: baseWhere,
        select,
        orderBy,
        take: params.order.warehouseId ? params.take : Math.max(params.take, 50),
      });

      return this.limitUnitsToAnchorWarehouse(candidates, params.take, params.order.warehouseId);
    }

    const exactCandidates = await tx.wmsInventoryUnit.findMany({
      where: {
        ...baseWhere,
        posWarehouseRef: params.order.posWarehouseRef,
      },
      select,
      orderBy,
      take: params.order.warehouseId ? params.take : Math.max(params.take, 50),
    });
    const anchoredWarehouseId = params.order.warehouseId ?? exactCandidates[0]?.warehouseId ?? null;
    const exactUnits = this.limitUnitsToAnchorWarehouse(exactCandidates, params.take, anchoredWarehouseId);

    const remainingQuantity = params.take - exactUnits.length;
    if (remainingQuantity <= 0) {
      return exactUnits;
    }

    const fallbackUnits = await tx.wmsInventoryUnit.findMany({
      where: {
        ...baseWhere,
        ...(anchoredWarehouseId ? { warehouseId: anchoredWarehouseId } : {}),
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
        warehouseId: string | null;
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
    const warehouseScopedIdentityWhere: Prisma.WmsInventoryUnitWhereInput = {
      ...identityWhere,
      ...(params.order.warehouseId ? { warehouseId: params.order.warehouseId } : {}),
    };
    const putawayWhere: Prisma.WmsInventoryUnitWhereInput = {
      ...warehouseScopedIdentityWhere,
      status: {
        in: [...FULFILLABLE_UNIT_STATUSES],
      },
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
      basketUnits: {
        none: {
          status: { in: [...ACTIVE_BASKET_UNIT_STATUSES] },
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

    const [matchingUnits, warehouseMatchingUnits, putawayUnits, binnedUnits, freeBinnedUnits, scopedUnits] = await Promise.all([
      tx.wmsInventoryUnit.count({ where: identityWhere }),
      tx.wmsInventoryUnit.count({ where: warehouseScopedIdentityWhere }),
      tx.wmsInventoryUnit.count({ where: putawayWhere }),
      tx.wmsInventoryUnit.count({ where: binnedWhere }),
      tx.wmsInventoryUnit.count({ where: unreservedWhere }),
      tx.wmsInventoryUnit.count({ where: scopedWhere }),
    ]);

    if (matchingUnits === 0) {
      return 'No WMS units match this order item for this store.';
    }

    if (params.order.warehouseId && warehouseMatchingUnits === 0) {
      return 'Matching units exist, but not in the warehouse assigned to this order.';
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

  private async reconcileLegacyFulfillmentLines(
    tx: Prisma.TransactionClient,
    params: {
      fulfillmentOrderId: string;
      canonicalVariationIds: string[];
    },
  ) {
    const order = await tx.wmsFulfillmentOrder.findUnique({
      where: { id: params.fulfillmentOrderId },
      select: {
        warehouseId: true,
      },
    });

    const lines = await tx.wmsFulfillmentLine.findMany({
      where: {
        fulfillmentOrderId: params.fulfillmentOrderId,
      },
      select: {
        id: true,
        variationId: true,
        lineSnapshot: true,
        reservations: {
          where: {
            status: {
              in: [...ACTIVE_PICK_RESERVATION_STATUSES],
            },
          },
          select: {
            id: true,
            inventoryUnitId: true,
            inventoryUnit: {
              select: {
                warehouseId: true,
              },
            },
          },
        },
      },
    });

    const canonicalSet = new Set(params.canonicalVariationIds);
    const lineByVariationId = new Map(lines.map((line) => [line.variationId, line]));
    let resolvedWarehouseId = order?.warehouseId ?? null;

    for (const line of lines) {
      const snapshot = this.asJsonRecord(line.lineSnapshot);
      const sourceVariationId = this.readString(snapshot?.sourceVariationId);

      if (!sourceVariationId || sourceVariationId === line.variationId || !canonicalSet.has(sourceVariationId)) {
        continue;
      }

      const canonicalLine = lineByVariationId.get(sourceVariationId);
      if (!canonicalLine || canonicalLine.id === line.id) {
        continue;
      }

      const canonicalReservationUnitIds = new Set(
        canonicalLine.reservations.map((reservation) => reservation.inventoryUnitId),
      );

      for (const reservation of line.reservations) {
        if (!resolvedWarehouseId && reservation.inventoryUnit.warehouseId) {
          resolvedWarehouseId = reservation.inventoryUnit.warehouseId;
        }

        if (canonicalReservationUnitIds.has(reservation.inventoryUnitId)) {
          await tx.wmsPickReservation.update({
            where: { id: reservation.id },
            data: {
              status: WmsPickReservationStatus.CANCELED,
            },
          });
          continue;
        }

        await tx.wmsPickReservation.update({
          where: { id: reservation.id },
          data: {
            fulfillmentLineId: canonicalLine.id,
          },
        });
        canonicalReservationUnitIds.add(reservation.inventoryUnitId);
      }

      await tx.wmsFulfillmentLine.update({
        where: { id: line.id },
        data: {
          status: WmsFulfillmentLineStatus.CANCELED,
          quantityRequired: 0,
          quantityAllocated: 0,
          quantityPicked: 0,
          issueReason: null,
        },
      });
    }

    if (resolvedWarehouseId && resolvedWarehouseId !== order?.warehouseId) {
      await tx.wmsFulfillmentOrder.update({
        where: { id: params.fulfillmentOrderId },
        data: {
          warehouseId: resolvedWarehouseId,
        },
      });
    }
  }

  private limitUnitsToAnchorWarehouse<
    TUnit extends {
      warehouseId: string;
    },
  >(units: TUnit[], take: number, warehouseId: string | null) {
    const anchorWarehouseId = warehouseId ?? units[0]?.warehouseId ?? null;
    if (!anchorWarehouseId) {
      return units.slice(0, take);
    }

    return units
      .filter((unit) => unit.warehouseId === anchorWarehouseId)
      .slice(0, take);
  }

  private async resolveAllocationWarehouseId(
    tx: Prisma.TransactionClient,
    params: {
      fulfillmentOrderId: string;
      currentWarehouseId: string | null;
      preferredWarehouseId: string | null;
    },
  ) {
    if (params.currentWarehouseId) {
      return params.currentWarehouseId;
    }

    const reservationWarehouses = await tx.wmsPickReservation.findMany({
      where: {
        fulfillmentOrderId: params.fulfillmentOrderId,
        status: {
          in: [...ACTIVE_PICK_RESERVATION_STATUSES],
        },
      },
      select: {
        inventoryUnit: {
          select: {
            warehouseId: true,
          },
        },
      },
    });

    const uniqueReservationWarehouses = Array.from(new Set(
      reservationWarehouses.map((reservation) => reservation.inventoryUnit.warehouseId),
    ));

    if (uniqueReservationWarehouses.length === 1) {
      return uniqueReservationWarehouses[0] ?? null;
    }

    if (uniqueReservationWarehouses.length > 1) {
      return null;
    }

    return params.preferredWarehouseId;
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

  private async refreshDemandBasketStateTx(
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
        tenantId: activeTenantIds.length === 1 ? activeTenantIds[0] : null,
        status: nextStatus,
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

  private async refreshDemandFulfillmentOrderReadiness(fulfillmentOrderId: string) {
    await this.prisma.$transaction(async (tx) => {
      await this.refreshDemandFulfillmentOrderReadinessTx(tx, fulfillmentOrderId, new Date());
    });
  }

  private async refreshDemandFulfillmentOrderReadinessTx(
    tx: Prisma.TransactionClient,
    fulfillmentOrderId: string,
    now: Date,
    options?: {
      order?: DemandFulfillmentReadinessRecord | null;
      virtualAllocatedByWarehouseVariation?: Map<string, number>;
      accumulateVirtualAllocation?: boolean;
    },
  ) {
    const order = options?.order ?? await tx.wmsFulfillmentOrder.findUnique({
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
      || order.status === WmsFulfillmentOrderStatus.READY_FOR_PACK
      || order.status === WmsFulfillmentOrderStatus.PICKED
      || order.status === WmsFulfillmentOrderStatus.PACKING
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
      variationId: string;
      productName: string;
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

      let availabilityByWarehouse = await this.listDemandAvailableQuantityByWarehouse(tx, {
        tenantId: order.tenantId,
        storeId: order.storeId,
        warehouseId: lockedWarehouseId,
        posWarehouseRef: order.posWarehouseRef,
        variationId: line.variationId,
        excludeFulfillmentOrderId: order.id,
      });
      if (options?.virtualAllocatedByWarehouseVariation && options.virtualAllocatedByWarehouseVariation.size > 0) {
        const adjustedAvailability = new Map<string, number>();
        for (const [warehouseId, availableQuantity] of availabilityByWarehouse.entries()) {
          const virtualAllocated = options.virtualAllocatedByWarehouseVariation.get(
            this.buildDemandWarehouseVariationKey(warehouseId, line.variationId),
          ) ?? 0;
          const nextAvailable = Math.max(availableQuantity - virtualAllocated, 0);
          if (nextAvailable > 0) {
            adjustedAvailability.set(warehouseId, nextAvailable);
          }
        }
        availabilityByWarehouse = adjustedAvailability;
      }
      for (const warehouseId of availabilityByWarehouse.keys()) {
        candidateWarehouseIds.add(warehouseId);
      }

      eligibleLines.push({
        id: line.id,
        variationId: line.variationId,
        productName: line.productName,
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
      const nextLineStatus = this.resolveFulfillmentLineStatus(required, nextAllocated, 0, line.status);

      totalQuantity += required;
      allocatedQuantity += nextAllocated;
      hasIssue = hasIssue || nextLineStatus === WmsFulfillmentLineStatus.ISSUE;

      const availableInSelectedWarehouse = selectedWarehouseId && eligibleLine
        ? eligibleLine.availabilityByWarehouse.get(selectedWarehouseId) ?? 0
        : 0;

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
        warehouseId: warehouseLocked ? order.warehouseId : null,
        totalQuantity,
        allocatedQuantity,
        pickedQuantity,
        status: nextOrderStatus,
        completedAt: null,
        issueReason: totalQuantity === 0 ? order.issueReason ?? 'Order has no pickable variation items' : null,
      },
    });

    if (
      options?.accumulateVirtualAllocation
      && options.virtualAllocatedByWarehouseVariation
      && !warehouseLocked
      && selectedWarehouseId
    ) {
      for (const line of eligibleLines) {
        const allocated = Math.min(allocatedByLineId.get(line.id) ?? 0, line.required);
        if (allocated <= 0) {
          continue;
        }

        const key = this.buildDemandWarehouseVariationKey(selectedWarehouseId, line.variationId);
        options.virtualAllocatedByWarehouseVariation.set(
          key,
          (options.virtualAllocatedByWarehouseVariation.get(key) ?? 0) + allocated,
        );
      }
    }
  }

  private buildDemandWarehouseVariationKey(warehouseId: string, variationId: string) {
    return `${warehouseId}::${variationId}`;
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
              in: [...ACTIVE_DEMAND_BASKET_STATUSES],
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
    return baseWhere;
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
            in: [...ACTIVE_DEMAND_BASKET_STATUSES],
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
        ?? (sourceProductId ? productByProductId.get(sourceProductId) : null)
        ?? sourceDisplayIds.map((id) => productByCustomId.get(id)).find(Boolean)
        ?? null;
      const variationId = sourceVariationId ?? resolvedProduct?.variationId ?? null;
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
}
