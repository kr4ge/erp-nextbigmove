import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

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
  constructor(private readonly prisma: PrismaService) {}

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
