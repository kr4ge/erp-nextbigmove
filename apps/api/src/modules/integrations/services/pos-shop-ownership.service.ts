import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  WmsBasketUnitStatus,
  WmsFulfillmentOrderStatus,
  WmsPickReservationStatus,
} from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { WmsFulfillmentSyncService } from '../../wms-fulfillment/wms-fulfillment-sync.service';

const TRANSFERABLE_POS_STATUSES = [0, 1, 11];
const CONFIRMED_POS_STATUS = 1;
const TRANSFERABLE_FULFILLMENT_STATUSES = new Set<WmsFulfillmentOrderStatus>([
  WmsFulfillmentOrderStatus.READY,
  WmsFulfillmentOrderStatus.PARTIAL,
  WmsFulfillmentOrderStatus.RESTOCKING,
  WmsFulfillmentOrderStatus.ISSUE,
]);

type RoutableStore = {
  id: string;
  tenantId: string;
  shopId: string;
  teamId: string | null;
  integrationId: string | null;
  apiKey: string;
  status: string;
  enabled: boolean | null;
  updatedAt: Date;
};

export type PosShopOrderRoute = {
  tenantId: string;
  shopId: string;
  store: RoutableStore;
  orders: any[];
};

export type PosShopOrderRoutingIssue = {
  order: any;
  shopId: string | null;
  orderId: string | null;
  reason: string;
  warning: string;
};

@Injectable()
export class PosShopOwnershipService {
  private readonly logger = new Logger(PosShopOwnershipService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wmsFulfillmentSyncService: WmsFulfillmentSyncService,
  ) {}

  private getShopId(order: any): string | null {
    const value = order?.shop_id ?? order?.shopId;
    const normalized = value?.toString?.().trim?.() || '';
    return normalized || null;
  }

  private getOrderId(order: any): string | null {
    const value = order?.id ?? order?.order_id ?? order?.orderId;
    const normalized = value?.toString?.().trim?.() || '';
    return normalized || null;
  }

  async claimShopOwnership(params: {
    storeId: string;
    claimedById?: string | null;
    reason?: string | null;
  }) {
    const store = await this.prisma.posStore.findUnique({
      where: { id: params.storeId },
      select: {
        id: true,
        tenantId: true,
        shopId: true,
        shopName: true,
        integrationId: true,
      },
    });

    if (!store) {
      throw new NotFoundException('POS store not found');
    }
    if (!store.shopId.trim()) {
      throw new ConflictException('POS store does not have a shop ID');
    }

    const activatedAt = new Date();
    const reason = params.reason?.trim() || null;

    const result = await this.prisma.$transaction(async (tx) => {
      const previous = await tx.posShopOwnership.findUnique({
        where: { shopId: store.shopId },
        select: {
          tenantId: true,
          storeId: true,
          activatedAt: true,
        },
      });

      const ownership = await tx.posShopOwnership.upsert({
        where: { shopId: store.shopId },
        update: {
          tenantId: store.tenantId,
          storeId: store.id,
          activatedAt,
          reason,
          claimedById: params.claimedById || null,
        },
        create: {
          shopId: store.shopId,
          tenantId: store.tenantId,
          storeId: store.id,
          activatedAt,
          reason,
          claimedById: params.claimedById || null,
        },
      });

      await tx.posStore.updateMany({
        where: {
          shopId: store.shopId,
          id: { not: store.id },
        },
        data: {
          status: 'DISABLED',
          enabled: false,
        },
      });

      await tx.posStore.update({
        where: { id: store.id },
        data: {
          status: 'ACTIVE',
          enabled: true,
        },
      });

      if (store.integrationId) {
        await tx.integration.update({
          where: { id: store.integrationId },
          data: {
            status: 'ACTIVE',
            enabled: true,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId: store.tenantId,
          userId: params.claimedById || null,
          action: 'POS_SHOP_OWNERSHIP_CLAIMED',
          resource: 'pos_shop',
          resourceId: store.shopId,
          changes: {
            previousOwner: previous,
            newOwner: {
              tenantId: store.tenantId,
              storeId: store.id,
            },
            activatedAt: activatedAt.toISOString(),
            reason,
            historicalOrdersMoved: false,
          },
        },
      });

      return { ownership, previous };
    });

    return {
      shopId: store.shopId,
      shopName: store.shopName,
      tenantId: store.tenantId,
      storeId: store.id,
      activatedAt: result.ownership.activatedAt,
      previousOwner: result.previous,
      historicalOrdersMoved: false,
    };
  }

  async transferOpenOrders(params: {
    sourceStoreId: string;
    targetStoreId: string;
    requestedById?: string | null;
    reason?: string | null;
    dryRun?: boolean;
  }) {
    const dryRun = params.dryRun !== false;
    const reason = params.reason?.trim() || null;
    const [sourceStore, targetStore] = await Promise.all([
      this.prisma.posStore.findUnique({
        where: { id: params.sourceStoreId },
        select: {
          id: true,
          tenantId: true,
          shopId: true,
          shopName: true,
        },
      }),
      this.prisma.posStore.findUnique({
        where: { id: params.targetStoreId },
        select: {
          id: true,
          tenantId: true,
          teamId: true,
          shopId: true,
          shopName: true,
          status: true,
          enabled: true,
        },
      }),
    ]);

    if (!sourceStore) {
      throw new NotFoundException('Source POS store not found');
    }
    if (!targetStore) {
      throw new NotFoundException('Target POS store not found');
    }
    if (sourceStore.id === targetStore.id) {
      throw new ConflictException(
        'Source and target POS stores must be different',
      );
    }
    if (sourceStore.tenantId === targetStore.tenantId) {
      throw new ConflictException(
        'Source and target POS stores must belong to different partners',
      );
    }
    if (sourceStore.shopId !== targetStore.shopId) {
      throw new ConflictException(
        'Source and target POS stores must represent the same POS shop',
      );
    }
    if (targetStore.status !== 'ACTIVE' || targetStore.enabled === false) {
      throw new ConflictException('Target POS store is not active');
    }

    const ownership = await this.prisma.posShopOwnership.findUnique({
      where: { shopId: targetStore.shopId },
      select: { tenantId: true, storeId: true },
    });
    if (
      !ownership ||
      ownership.tenantId !== targetStore.tenantId ||
      ownership.storeId !== targetStore.id
    ) {
      throw new ConflictException(
        'Target store must claim POS shop ownership before open orders can be transferred',
      );
    }

    const sourceOrders = await this.prisma.posOrder.findMany({
      where: {
        tenantId: sourceStore.tenantId,
        shopId: sourceStore.shopId,
        isVoid: false,
        status: { in: TRANSFERABLE_POS_STATUSES },
      },
      select: {
        id: true,
        posOrderId: true,
        status: true,
        statusName: true,
        dateLocal: true,
        wmsFulfillmentOrders: {
          select: {
            id: true,
            status: true,
            claimedById: true,
            packedById: true,
            basketId: true,
            pickedQuantity: true,
            legacyBasket: { select: { id: true } },
            reservations: {
              where: { status: WmsPickReservationStatus.PICKED },
              select: { id: true },
              take: 1,
            },
            basketPickDemands: {
              select: { id: true },
              take: 1,
            },
            basketUnits: {
              where: {
                status: {
                  in: [WmsBasketUnitStatus.PICKED, WmsBasketUnitStatus.PACKED],
                },
              },
              select: { id: true },
              take: 1,
            },
            lines: {
              where: { quantityPicked: { gt: 0 } },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
      orderBy: [{ insertedAt: 'asc' }, { id: 'asc' }],
    });

    const targetCollisions = sourceOrders.length
      ? await this.prisma.posOrder.findMany({
          where: {
            tenantId: targetStore.tenantId,
            shopId: targetStore.shopId,
            posOrderId: { in: sourceOrders.map((order) => order.posOrderId) },
          },
          select: { posOrderId: true },
        })
      : [];
    const collisionOrderIds = new Set(
      targetCollisions.map((order) => order.posOrderId),
    );

    const transferableOrders: Array<{
      id: string;
      posOrderId: string;
      posStatus: number | null;
      posStatusName: string | null;
      fulfillmentOrderId: string | null;
      fulfillmentStatus: WmsFulfillmentOrderStatus | null;
    }> = [];
    const blockedOrders: Array<{
      posOrderId: string;
      posStatus: number | null;
      posStatusName: string | null;
      fulfillmentStatus: WmsFulfillmentOrderStatus | null;
      reasons: string[];
    }> = [];

    for (const order of sourceOrders) {
      const fulfillmentOrder = order.wmsFulfillmentOrders[0] || null;
      const reasons: string[] = [];

      if (collisionOrderIds.has(order.posOrderId)) {
        reasons.push('ORDER_ALREADY_EXISTS_IN_TARGET_PARTNER');
      }
      if (order.wmsFulfillmentOrders.length > 1) {
        reasons.push('MULTIPLE_FULFILLMENT_ORDERS');
      }
      if (
        fulfillmentOrder &&
        !TRANSFERABLE_FULFILLMENT_STATUSES.has(fulfillmentOrder.status)
      ) {
        reasons.push(`FULFILLMENT_IN_EXECUTION_${fulfillmentOrder.status}`);
      }
      if (
        fulfillmentOrder?.claimedById ||
        fulfillmentOrder?.basketId ||
        fulfillmentOrder?.legacyBasket
      ) {
        reasons.push('FULFILLMENT_IS_CLAIMED_OR_BASKET_LINKED');
      }
      if (fulfillmentOrder?.packedById) {
        reasons.push('FULFILLMENT_HAS_PACKER');
      }
      if (
        (fulfillmentOrder?.pickedQuantity || 0) > 0 ||
        fulfillmentOrder?.lines.length
      ) {
        reasons.push('FULFILLMENT_HAS_PICKED_QUANTITY');
      }
      if (fulfillmentOrder?.reservations.length) {
        reasons.push('FULFILLMENT_HAS_PICKED_RESERVATION');
      }
      if (fulfillmentOrder?.basketPickDemands.length) {
        reasons.push('FULFILLMENT_HAS_BASKET_DEMAND');
      }
      if (fulfillmentOrder?.basketUnits.length) {
        reasons.push('FULFILLMENT_HAS_ACTIVE_BASKET_UNIT');
      }

      if (reasons.length > 0) {
        blockedOrders.push({
          posOrderId: order.posOrderId,
          posStatus: order.status,
          posStatusName: order.statusName,
          fulfillmentStatus: fulfillmentOrder?.status || null,
          reasons: Array.from(new Set(reasons)),
        });
        continue;
      }

      transferableOrders.push({
        id: order.id,
        posOrderId: order.posOrderId,
        posStatus: order.status,
        posStatusName: order.statusName,
        fulfillmentOrderId: fulfillmentOrder?.id || null,
        fulfillmentStatus: fulfillmentOrder?.status || null,
      });
    }

    const baseResult = {
      dryRun,
      shop: {
        shopId: targetStore.shopId,
        shopName: targetStore.shopName,
      },
      source: {
        tenantId: sourceStore.tenantId,
        storeId: sourceStore.id,
      },
      target: {
        tenantId: targetStore.tenantId,
        storeId: targetStore.id,
      },
      includedPosStatuses: {
        NEW: 0,
        CONFIRMED: 1,
        RESTOCKING: 11,
      },
      summary: {
        candidates: sourceOrders.length,
        transferable: transferableOrders.length,
        blocked: blockedOrders.length,
      },
      transferableOrders: transferableOrders.map(
        ({ id: _id, ...order }) => order,
      ),
      blockedOrders,
    };

    if (dryRun || transferableOrders.length === 0) {
      return {
        ...baseResult,
        execution: {
          movedOrders: 0,
          rebuiltConfirmedOrders: 0,
          fulfillmentSyncStatus: 'NOT_RUN',
        },
      };
    }

    const movedOrderIds = transferableOrders.map((order) => order.id);
    const fulfillmentOrderIds = transferableOrders
      .map((order) => order.fulfillmentOrderId)
      .filter((id): id is string => Boolean(id));
    const confirmedOrderRefs = transferableOrders
      .filter((order) => order.posStatus === CONFIRMED_POS_STATUS)
      .map((order) => ({
        shopId: targetStore.shopId,
        posOrderId: order.posOrderId,
      }));

    await this.prisma.$transaction(
      async (tx) => {
        const stillOwnedCount = await tx.posOrder.count({
          where: {
            id: { in: movedOrderIds },
            tenantId: sourceStore.tenantId,
            shopId: sourceStore.shopId,
            isVoid: false,
            status: { in: TRANSFERABLE_POS_STATUSES },
          },
        });
        if (stillOwnedCount !== movedOrderIds.length) {
          throw new ConflictException(
            'One or more orders changed while the transfer was being prepared. Run the dry-run again.',
          );
        }

        const targetCollisionCount = await tx.posOrder.count({
          where: {
            tenantId: targetStore.tenantId,
            shopId: targetStore.shopId,
            posOrderId: {
              in: transferableOrders.map((order) => order.posOrderId),
            },
          },
        });
        if (targetCollisionCount > 0) {
          throw new ConflictException(
            'One or more orders now exist in the target partner. Run the dry-run again.',
          );
        }

        if (fulfillmentOrderIds.length > 0) {
          const stillTransferableFulfillmentCount =
            await tx.wmsFulfillmentOrder.count({
              where: {
                id: { in: fulfillmentOrderIds },
                status: { in: Array.from(TRANSFERABLE_FULFILLMENT_STATUSES) },
                claimedById: null,
                packedById: null,
                basketId: null,
                pickedQuantity: 0,
                legacyBasket: { is: null },
                reservations: {
                  none: { status: WmsPickReservationStatus.PICKED },
                },
                basketPickDemands: { none: {} },
                basketUnits: {
                  none: {
                    status: {
                      in: [
                        WmsBasketUnitStatus.PICKED,
                        WmsBasketUnitStatus.PACKED,
                      ],
                    },
                  },
                },
                lines: { none: { quantityPicked: { gt: 0 } } },
              },
            });
          if (
            stillTransferableFulfillmentCount !== fulfillmentOrderIds.length
          ) {
            throw new ConflictException(
              'One or more fulfillment orders entered pick or pack execution. Run the dry-run again.',
            );
          }

          await tx.wmsFulfillmentOrder.deleteMany({
            where: { id: { in: fulfillmentOrderIds } },
          });
        }

        await tx.undeliverableAttempt.updateMany({
          where: { orderId: { in: movedOrderIds } },
          data: {
            tenantId: targetStore.tenantId,
            storeId: targetStore.id,
          },
        });
        await tx.undeliverableOrderRemark.updateMany({
          where: { orderId: { in: movedOrderIds } },
          data: {
            tenantId: targetStore.tenantId,
            storeId: targetStore.id,
          },
        });
        const moved = await tx.posOrder.updateMany({
          where: {
            id: { in: movedOrderIds },
            tenantId: sourceStore.tenantId,
          },
          data: {
            tenantId: targetStore.tenantId,
            teamId: targetStore.teamId,
          },
        });
        if (moved.count !== movedOrderIds.length) {
          throw new ConflictException(
            'Not all open orders could be transferred. No changes were committed.',
          );
        }

        await tx.auditLog.create({
          data: {
            tenantId: targetStore.tenantId,
            userId: params.requestedById || null,
            action: 'POS_SHOP_OPEN_ORDERS_TRANSFERRED',
            resource: 'pos_shop',
            resourceId: targetStore.shopId,
            changes: {
              sourceTenantId: sourceStore.tenantId,
              sourceStoreId: sourceStore.id,
              targetTenantId: targetStore.tenantId,
              targetStoreId: targetStore.id,
              movedOrderCount: moved.count,
              removedFulfillmentOrderCount: fulfillmentOrderIds.length,
              blockedOrderCount: blockedOrders.length,
              movedPosOrderIds: transferableOrders.map(
                (order) => order.posOrderId,
              ),
              reason,
            },
          },
        });
      },
      {
        maxWait: 10_000,
        timeout: 60_000,
      },
    );

    let fulfillmentSyncStatus: 'NOT_REQUIRED' | 'SUCCEEDED' | 'FAILED' =
      'NOT_REQUIRED';
    let rebuiltConfirmedOrders = 0;
    let fulfillmentSyncError: string | null = null;
    if (confirmedOrderRefs.length > 0) {
      try {
        const syncResult =
          await this.wmsFulfillmentSyncService.syncConfirmedPickingOrders({
            tenantId: targetStore.tenantId,
            storeId: targetStore.id,
            actorId: params.requestedById || null,
            stores: [
              {
                id: targetStore.id,
                tenantId: targetStore.tenantId,
                shopId: targetStore.shopId,
              },
            ],
            posOrderRefs: confirmedOrderRefs,
          });
        fulfillmentSyncStatus = 'SUCCEEDED';
        rebuiltConfirmedOrders = syncResult.syncedOrders;
      } catch (error) {
        fulfillmentSyncStatus = 'FAILED';
        fulfillmentSyncError =
          error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Transferred ${movedOrderIds.length} open orders for shop ${targetStore.shopId}, but target fulfillment rebuild failed: ${fulfillmentSyncError}`,
        );
      }
    }

    return {
      ...baseResult,
      execution: {
        movedOrders: movedOrderIds.length,
        confirmedOrdersQueuedForRebuild: confirmedOrderRefs.length,
        rebuiltConfirmedOrders,
        fulfillmentSyncStatus,
        fulfillmentSyncError,
      },
    };
  }

  async assertShopCanBeRegistered(
    tenantId: string,
    shopId: string,
  ): Promise<void> {
    const normalizedShopId = shopId.trim();
    if (!normalizedShopId) return;

    const [ownership, activeStore] = await Promise.all([
      this.prisma.posShopOwnership.findUnique({
        where: { shopId: normalizedShopId },
        select: { tenantId: true, storeId: true },
      }),
      this.prisma.posStore.findFirst({
        where: {
          shopId: normalizedShopId,
          tenantId: { not: tenantId },
          status: 'ACTIVE',
          OR: [{ enabled: true }, { enabled: null }],
        },
        select: { tenantId: true, id: true },
      }),
    ]);

    if (ownership && ownership.tenantId !== tenantId) {
      throw new ConflictException(
        'This POS shop is actively owned by another partner. Use the controlled shop cutover instead.',
      );
    }
    if (activeStore) {
      throw new ConflictException(
        'This POS shop is active under another partner. A super administrator must perform a controlled shop cutover.',
      );
    }
  }

  async filterOwnedStores<T extends { id: string; shopId: string }>(
    stores: T[],
  ): Promise<T[]> {
    if (stores.length === 0) return stores;

    const ownerships = await this.prisma.posShopOwnership.findMany({
      where: {
        shopId: {
          in: Array.from(new Set(stores.map((store) => store.shopId))),
        },
      },
      select: { shopId: true, storeId: true },
    });
    const ownerByShopId = new Map(
      ownerships.map((row) => [row.shopId, row.storeId]),
    );

    return stores.filter((store) => {
      const ownerStoreId = ownerByShopId.get(store.shopId);
      return !ownerStoreId || ownerStoreId === store.id;
    });
  }

  async resolveOrderRoutes(
    requestTenantId: string,
    orders: any[],
  ): Promise<{
    routes: PosShopOrderRoute[];
    issues: PosShopOrderRoutingIssue[];
  }> {
    const issues: PosShopOrderRoutingIssue[] = [];
    const validOrders = orders
      .map((order) => ({
        order,
        shopId: this.getShopId(order),
        orderId: this.getOrderId(order),
      }))
      .filter((entry) => {
        if (entry.shopId && entry.orderId) return true;
        issues.push({
          order: entry.order,
          shopId: entry.shopId,
          orderId: entry.orderId,
          reason: 'MISSING_ORDER_REFERENCE',
          warning: 'Skipped POS order with missing shop ID or order ID',
        });
        return false;
      }) as Array<{ order: any; shopId: string; orderId: string }>;

    if (validOrders.length === 0) {
      return { routes: [], issues };
    }

    const shopIds = Array.from(
      new Set(validOrders.map((entry) => entry.shopId)),
    );
    const orderIds = Array.from(
      new Set(validOrders.map((entry) => entry.orderId)),
    );

    const [ownerships, existingOrders, stores] = await Promise.all([
      this.prisma.posShopOwnership.findMany({
        where: { shopId: { in: shopIds } },
        select: { shopId: true, tenantId: true, storeId: true },
      }),
      this.prisma.posOrder.findMany({
        where: {
          shopId: { in: shopIds },
          posOrderId: { in: orderIds },
        },
        select: { tenantId: true, shopId: true, posOrderId: true },
      }),
      this.prisma.posStore.findMany({
        where: { shopId: { in: shopIds } },
        select: {
          id: true,
          tenantId: true,
          shopId: true,
          teamId: true,
          integrationId: true,
          apiKey: true,
          status: true,
          enabled: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    const ownershipByShopId = new Map(
      ownerships.map((row) => [row.shopId, row]),
    );
    const existingTenantsByOrder = new Map<string, Set<string>>();
    for (const row of existingOrders) {
      const key = `${row.shopId}:${row.posOrderId}`;
      const tenants = existingTenantsByOrder.get(key) || new Set<string>();
      tenants.add(row.tenantId);
      existingTenantsByOrder.set(key, tenants);
    }

    const storeByTenantShop = new Map<string, RoutableStore>();
    const storeById = new Map<string, RoutableStore>();
    for (const store of stores) {
      storeById.set(store.id, store);
      const key = `${store.tenantId}:${store.shopId}`;
      if (!storeByTenantShop.has(key)) {
        storeByTenantShop.set(key, store);
      }
    }

    const groupedRoutes = new Map<string, PosShopOrderRoute>();
    for (const entry of validOrders) {
      const orderKey = `${entry.shopId}:${entry.orderId}`;
      const ownership = ownershipByShopId.get(entry.shopId);
      const existingTenants = Array.from(
        existingTenantsByOrder.get(orderKey) || [],
      );

      let targetTenantId: string | null = null;
      let targetStore: RoutableStore | null = null;

      if (existingTenants.length === 1) {
        targetTenantId = existingTenants[0];
        targetStore =
          storeByTenantShop.get(`${targetTenantId}:${entry.shopId}`) || null;
      } else if (existingTenants.length > 1) {
        if (ownership && existingTenants.includes(ownership.tenantId)) {
          targetTenantId = ownership.tenantId;
          targetStore = storeById.get(ownership.storeId) || null;
        } else {
          issues.push({
            order: entry.order,
            shopId: entry.shopId,
            orderId: entry.orderId,
            reason: 'AMBIGUOUS_HISTORICAL_OWNER',
            warning: `Order ${entry.orderId} exists under multiple partners and has no matching active owner`,
          });
          continue;
        }
      } else if (ownership) {
        targetTenantId = ownership.tenantId;
        targetStore = storeById.get(ownership.storeId) || null;
      } else {
        targetTenantId = requestTenantId;
        targetStore =
          storeByTenantShop.get(`${requestTenantId}:${entry.shopId}`) || null;
      }

      if (
        !targetTenantId ||
        !targetStore ||
        targetStore.tenantId !== targetTenantId
      ) {
        issues.push({
          order: entry.order,
          shopId: entry.shopId,
          orderId: entry.orderId,
          reason: 'ROUTING_STORE_NOT_FOUND',
          warning: `No valid routing store found for shop ${entry.shopId} order ${entry.orderId}`,
        });
        continue;
      }

      if (existingTenants.length === 0 && ownership) {
        const activeOwner =
          targetStore.status === 'ACTIVE' && targetStore.enabled !== false;
        if (!activeOwner) {
          issues.push({
            order: entry.order,
            shopId: entry.shopId,
            orderId: entry.orderId,
            reason: 'ACTIVE_OWNER_DISABLED',
            warning: `Active owner for shop ${entry.shopId} is disabled`,
          });
          continue;
        }
      }

      const routeKey = `${targetTenantId}:${targetStore.id}`;
      const route = groupedRoutes.get(routeKey) || {
        tenantId: targetTenantId,
        shopId: entry.shopId,
        store: targetStore,
        orders: [],
      };
      route.orders.push(entry.order);
      groupedRoutes.set(routeKey, route);
    }

    return { routes: Array.from(groupedRoutes.values()), issues };
  }
}
