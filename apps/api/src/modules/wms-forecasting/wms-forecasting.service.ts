import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import {
  IntegrationStatus,
  Prisma,
  TenantStatus,
  WmsInventoryUnitStatus,
} from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GetWmsForecastingDto } from './dto/get-wms-forecasting.dto';
import {
  aggregateForecastPosOrderItems,
  ForecastCatalogProduct,
  ForecastItemAggregate,
  ForecastPosOrderSource,
  ForecastStoreRef,
} from './utils/pos-order-item-aggregator';

const DEFAULT_SAFETY_STOCK_PCT = 20;
const DEFAULT_REORDER_TRIGGER_DAYS = 4;
const PENDING_POS_STATUSES = [0, 1, 12];
const RETURNING_POS_STATUS = 4;
const STOCK_STATUSES = [
  WmsInventoryUnitStatus.PUTAWAY,
  WmsInventoryUnitStatus.PICKED,
  WmsInventoryUnitStatus.PACKED,
];

type ForecastCycle = {
  cycleDate: string;
  cycleWeekday: 'MONDAY' | 'WEDNESDAY' | 'FRIDAY';
  daysForecasted: number;
  forecastDates: string[];
  salesWindow: {
    startDate: string;
    endDate: string;
  };
};

type ForecastScopeStore = ForecastStoreRef & {
  name: string;
  shopName: string;
  tenant: {
    name: string;
    slug: string | null;
  };
};

type ForecastScope = {
  activeTenantId: string | null;
  stores: ForecastScopeStore[];
};

type ForecastRowDraft = {
  rowId: string;
  storeId: string;
  storeName: string;
  tenantId: string;
  tenantName: string;
  shopId: string;
  variationId: string;
  productId: string | null;
  productName: string;
  productDisplayId: string | null;
  actualStock: number;
  pendingOrders: number;
  past3DaySales: number;
  returning: number;
};

@Injectable()
export class WmsForecastingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async getForecast(query: GetWmsForecastingDto) {
    const safetyStockPct = query.safetyStockPct ?? DEFAULT_SAFETY_STOCK_PCT;
    const reorderTriggerDays = query.reorderTriggerDays ?? DEFAULT_REORDER_TRIGGER_DAYS;
    const cycle = this.resolveForecastCycle(query.cycleDate);
    const scope = await this.resolveScope(query);
    const selectedStoreIds = Array.from(new Set(query.storeIds ?? []));

    if (selectedStoreIds.length === 0) {
      return {
        context: {
          activeTenantId: scope.activeTenantId,
          activeTenantName: this.resolveActiveTenantName(scope),
          selectedStoreIds: [],
          stores: scope.stores.map((store) => ({
            id: store.id,
            tenantId: store.tenantId,
            tenantName: store.tenant.name,
            tenantSlug: store.tenant.slug,
            shopId: store.shopId,
            name: store.shopName || store.name,
          })),
          cycleDate: cycle.cycleDate,
          cycleWeekday: cycle.cycleWeekday,
          forecastDates: cycle.forecastDates,
          daysForecasted: cycle.daysForecasted,
          salesWindow: cycle.salesWindow,
          safetyStockPct,
          reorderTriggerDays,
        },
        rows: [],
        totals: this.buildTotals([]),
        generatedAt: new Date().toISOString(),
      };
    }

    const storeIds = scope.stores.map((store) => store.id);
    const catalogProductsPromise = this.prisma.posProduct.findMany({
      where: {
        storeId: { in: storeIds },
      },
      select: {
        storeId: true,
        productId: true,
        variationId: true,
        customId: true,
        name: true,
      },
    });

    const [
      catalogProducts,
      stockGroups,
      pendingOrders,
      pastSalesOrders,
      returningOrders,
    ] = await Promise.all([
      catalogProductsPromise,
      this.getActualStockGroups(scope),
      this.getScopedPosOrders(scope, {
        status: { in: PENDING_POS_STATUSES },
        dateLocal: cycle.cycleDate,
      }),
      this.getScopedPosOrders(scope, {
        dateLocal: {
          gte: cycle.salesWindow.startDate,
          lte: cycle.salesWindow.endDate,
        },
      }),
      this.getScopedPosOrders(scope, {
        status: RETURNING_POS_STATUS,
      }),
    ]);

    const products = catalogProducts satisfies ForecastCatalogProduct[];
    const pendingByVariation = aggregateForecastPosOrderItems({
      orders: pendingOrders,
      stores: scope.stores,
      catalogProducts: products,
    });
    const pastSalesByVariation = aggregateForecastPosOrderItems({
      orders: pastSalesOrders,
      stores: scope.stores,
      catalogProducts: products,
    });
    const returningByVariation = aggregateForecastPosOrderItems({
      orders: returningOrders,
      stores: scope.stores,
      catalogProducts: products,
    });

    const rows = this.buildRows({
      scope,
      catalogProducts: products,
      stockGroups,
      pendingByVariation,
      pastSalesByVariation,
      returningByVariation,
      daysForecasted: cycle.daysForecasted,
      safetyStockPct,
      reorderTriggerDays,
    });

    return {
        context: {
          activeTenantId: scope.activeTenantId,
          activeTenantName: this.resolveActiveTenantName(scope),
          selectedStoreIds,
          stores: scope.stores.map((store) => ({
            id: store.id,
            tenantId: store.tenantId,
          tenantName: store.tenant.name,
          tenantSlug: store.tenant.slug,
          shopId: store.shopId,
          name: store.shopName || store.name,
        })),
        cycleDate: cycle.cycleDate,
        cycleWeekday: cycle.cycleWeekday,
        forecastDates: cycle.forecastDates,
        daysForecasted: cycle.daysForecasted,
        salesWindow: cycle.salesWindow,
        safetyStockPct,
        reorderTriggerDays,
      },
      rows,
      totals: this.buildTotals(rows),
      generatedAt: new Date().toISOString(),
    };
  }

  private async resolveScope(query: GetWmsForecastingDto): Promise<ForecastScope> {
    const clsTenantId = this.cls.get('tenantId') as string | undefined;
    const userRole = this.cls.get('userRole') as string | undefined;
    const hasGlobalWmsAccess = this.cls.get('wmsGlobalAccess') === true;
    const isGlobalUser = userRole === 'SUPER_ADMIN' || hasGlobalWmsAccess;
    const requestedTenantId = query.tenantId ?? clsTenantId ?? null;
    const requestedStoreIds = Array.from(new Set(query.storeIds ?? []));

    if (!isGlobalUser && !clsTenantId) {
      throw new ForbiddenException('Tenant context is required for WMS forecasting');
    }

    if (!isGlobalUser && requestedTenantId && requestedTenantId !== clsTenantId) {
      throw new ForbiddenException('Selected tenant is outside your WMS scope');
    }

    const stores = await this.prisma.posStore.findMany({
      where: {
        status: IntegrationStatus.ACTIVE,
        ...(requestedTenantId ? { tenantId: requestedTenantId } : {}),
        ...(requestedStoreIds.length > 0 ? { id: { in: requestedStoreIds } } : {}),
        tenant: {
          status: {
            in: [TenantStatus.ACTIVE, TenantStatus.TRIAL],
          },
        },
      },
      select: {
        id: true,
        tenantId: true,
        shopId: true,
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

    if (requestedStoreIds.length > 0 && stores.length !== requestedStoreIds.length) {
      throw new ForbiddenException('One or more selected stores are outside your WMS scope');
    }

    const tenantIds = Array.from(new Set(stores.map((store) => store.tenantId)));

    return {
      activeTenantId: requestedTenantId ?? (tenantIds.length === 1 ? tenantIds[0] : null),
      stores,
    };
  }

  private async getActualStockGroups(scope: ForecastScope) {
    return this.prisma.wmsInventoryUnit.groupBy({
      by: ['variationId', 'storeId'],
      where: {
        storeId: { in: scope.stores.map((store) => store.id) },
        status: { in: STOCK_STATUSES },
        ...(scope.activeTenantId ? { tenantId: scope.activeTenantId } : {}),
      },
      _count: {
        _all: true,
      },
    });
  }

  private async getScopedPosOrders(
    scope: ForecastScope,
    extraWhere: Prisma.PosOrderWhereInput,
  ): Promise<ForecastPosOrderSource[]> {
    const orderStoreScopes = scope.stores.map((store) => ({
      tenantId: store.tenantId,
      shopId: store.shopId,
    }));

    if (orderStoreScopes.length === 0) {
      return [];
    }

    return this.prisma.posOrder.findMany({
      where: {
        OR: orderStoreScopes,
        ...extraWhere,
      },
      select: {
        tenantId: true,
        shopId: true,
        orderSnapshot: true,
        itemData: true,
      },
    });
  }

  private buildRows(params: {
    scope: ForecastScope;
    catalogProducts: ForecastCatalogProduct[];
    stockGroups: Array<{
      variationId: string;
      storeId: string;
      _count: {
        _all: number;
      };
    }>;
    pendingByVariation: Map<string, ForecastItemAggregate>;
    pastSalesByVariation: Map<string, ForecastItemAggregate>;
    returningByVariation: Map<string, ForecastItemAggregate>;
    daysForecasted: number;
    safetyStockPct: number;
    reorderTriggerDays: number;
  }) {
    const productByStoreVariation = this.buildProductByStoreVariation(params.catalogProducts);
    const storeById = this.buildStoreById(params.scope.stores);
    const rowsByStoreVariation = new Map<string, ForecastRowDraft>();

    for (const group of params.stockGroups) {
      const row = this.ensureRow(
        rowsByStoreVariation,
        group.storeId,
        group.variationId,
        storeById,
        productByStoreVariation,
      );
      row.actualStock += group._count._all;
    }

    this.applyAggregate(
      rowsByStoreVariation,
      productByStoreVariation,
      storeById,
      params.pendingByVariation,
      'pendingOrders',
    );
    this.applyAggregate(
      rowsByStoreVariation,
      productByStoreVariation,
      storeById,
      params.pastSalesByVariation,
      'past3DaySales',
    );
    this.applyAggregate(
      rowsByStoreVariation,
      productByStoreVariation,
      storeById,
      params.returningByVariation,
      'returning',
    );

    return Array.from(rowsByStoreVariation.values())
      .map((row) => this.mapForecastRow(row, params))
      .sort((left, right) => {
        const tenantCompare = (left.tenantName ?? '').localeCompare(right.tenantName ?? '');
        if (tenantCompare !== 0) {
          return tenantCompare;
        }

        const storeCompare = left.storeName.localeCompare(right.storeName);
        if (storeCompare !== 0) {
          return storeCompare;
        }

        if (right.suggestedOrderQty !== left.suggestedOrderQty) {
          return right.suggestedOrderQty - left.suggestedOrderQty;
        }

        return left.productName.localeCompare(right.productName);
      });
  }

  private applyAggregate(
    rowsByStoreVariation: Map<string, ForecastRowDraft>,
    productByStoreVariation: Map<string, ForecastCatalogProduct>,
    storeById: Map<string, ForecastScopeStore>,
    aggregate: Map<string, ForecastItemAggregate>,
    field: 'pendingOrders' | 'past3DaySales' | 'returning',
  ) {
    for (const item of aggregate.values()) {
      const row = this.ensureRow(
        rowsByStoreVariation,
        item.storeId,
        item.variationId,
        storeById,
        productByStoreVariation,
        item,
      );
      row[field] += item.quantity;
    }
  }

  private ensureRow(
    rowsByStoreVariation: Map<string, ForecastRowDraft>,
    storeId: string,
    variationId: string,
    storeById: Map<string, ForecastScopeStore>,
    productByStoreVariation: Map<string, ForecastCatalogProduct>,
    aggregate?: ForecastItemAggregate,
  ) {
    const rowId = this.buildRowId(storeId, variationId);
    const existing = rowsByStoreVariation.get(rowId);
    if (existing) {
      return existing;
    }

    const store = storeById.get(storeId);
    if (!store) {
      throw new BadRequestException(`Forecast store ${storeId} is outside scope`);
    }

    const product = productByStoreVariation.get(rowId);
    const row: ForecastRowDraft = {
      rowId,
      storeId,
      storeName: store.shopName || store.name,
      tenantId: store.tenantId,
      tenantName: store.tenant.name,
      shopId: store.shopId,
      variationId,
      productId: aggregate?.productId ?? product?.productId ?? null,
      productName: aggregate?.productName ?? product?.name ?? `Variation ${variationId}`,
      productDisplayId: aggregate?.productDisplayId ?? product?.customId ?? null,
      actualStock: 0,
      pendingOrders: 0,
      past3DaySales: 0,
      returning: 0,
    };

    rowsByStoreVariation.set(rowId, row);
    return row;
  }

  private mapForecastRow(row: ForecastRowDraft, params: {
    daysForecasted: number;
    safetyStockPct: number;
    reorderTriggerDays: number;
  }) {
    const grossPendingOrders = row.pendingOrders;
    const remainingStocks = Math.max(0, row.actualStock - grossPendingOrders);
    const uncoveredPendingOrders = Math.max(0, grossPendingOrders - row.actualStock);
    const avgDailySales = row.past3DaySales / 3;
    const forecastedDemand = avgDailySales * params.daysForecasted;
    const safetyStock = forecastedDemand * (params.safetyStockPct / 100);
    const suggestedOrderQty = Math.max(
      0,
      Math.ceil(forecastedDemand + safetyStock + uncoveredPendingOrders - remainingStocks),
    );
    const daysOfStockLeft = avgDailySales > 0 ? remainingStocks / avgDailySales : null;
    const status = this.resolveForecastStatus(daysOfStockLeft, avgDailySales, params.reorderTriggerDays);

    return {
      rowId: row.rowId,
      storeId: row.storeId,
      storeName: row.storeName,
      tenantId: row.tenantId,
      tenantName: row.tenantName,
      shopId: row.shopId,
      variationId: row.variationId,
      productId: row.productId,
      productName: row.productName,
      productDisplayId: row.productDisplayId,
      actualStock: row.actualStock,
      pendingOrders: uncoveredPendingOrders,
      remainingStocks,
      past3DaySales: row.past3DaySales,
      avgDailySales: this.roundTo(avgDailySales, 2),
      forecastedDemand: this.roundTo(forecastedDemand, 2),
      safetyStock: this.roundTo(safetyStock, 2),
      suggestedOrderQty,
      daysOfStockLeft: daysOfStockLeft === null ? null : this.roundTo(daysOfStockLeft, 2),
      status,
      returning: row.returning,
    };
  }

  private resolveForecastStatus(
    daysOfStockLeft: number | null,
    avgDailySales: number,
    reorderTriggerDays: number,
  ) {
    if (avgDailySales <= 0 || daysOfStockLeft === null) {
      return {
        key: 'NO_SALES',
        label: 'No Sales',
      };
    }

    if (daysOfStockLeft <= reorderTriggerDays) {
      return {
        key: 'REORDER_NOW',
        label: 'Reorder now',
      };
    }

    if (daysOfStockLeft <= reorderTriggerDays * 2) {
      return {
        key: 'LOW_STOCK',
        label: 'Low stock',
      };
    }

    return {
      key: 'ADEQUATE',
      label: 'Adequate',
    };
  }

  private buildTotals(rows: ReturnType<WmsForecastingService['mapForecastRow']>[]) {
    return rows.reduce(
      (totals, row) => ({
        actualStock: totals.actualStock + row.actualStock,
        pendingOrders: totals.pendingOrders + row.pendingOrders,
        remainingStocks: totals.remainingStocks + row.remainingStocks,
        past3DaySales: totals.past3DaySales + row.past3DaySales,
        avgDailySales: this.roundTo(totals.avgDailySales + row.avgDailySales, 2),
        forecastedDemand: this.roundTo(totals.forecastedDemand + row.forecastedDemand, 2),
        safetyStock: this.roundTo(totals.safetyStock + row.safetyStock, 2),
        suggestedOrderQty: totals.suggestedOrderQty + row.suggestedOrderQty,
        returning: totals.returning + row.returning,
      }),
      {
        actualStock: 0,
        pendingOrders: 0,
        remainingStocks: 0,
        past3DaySales: 0,
        avgDailySales: 0,
        forecastedDemand: 0,
        safetyStock: 0,
        suggestedOrderQty: 0,
        returning: 0,
      },
    );
  }

  private buildProductByStoreVariation(products: ForecastCatalogProduct[]) {
    const productByStoreVariation = new Map<string, ForecastCatalogProduct>();
    for (const product of products) {
      if (product.variationId) {
        const rowId = this.buildRowId(product.storeId, product.variationId);
        if (!productByStoreVariation.has(rowId)) {
          productByStoreVariation.set(rowId, product);
        }
      }
    }

    return productByStoreVariation;
  }

  private buildStoreById(stores: ForecastScopeStore[]) {
    return new Map(stores.map((store) => [store.id, store] as const));
  }

  private buildRowId(storeId: string, variationId: string) {
    return `${storeId}:${variationId}`;
  }

  private resolveActiveTenantName(scope: ForecastScope) {
    if (!scope.activeTenantId) {
      return null;
    }

    return scope.stores.find((store) => store.tenantId === scope.activeTenantId)?.tenant.name ?? null;
  }

  private resolveForecastCycle(cycleDate: string): ForecastCycle {
    const date = this.parseDateOnly(cycleDate);
    const weekday = date.getUTCDay();

    if (weekday === 1) {
      return {
        cycleDate,
        cycleWeekday: 'MONDAY',
        daysForecasted: 2,
        forecastDates: [
          this.addDays(cycleDate, 2),
          this.addDays(cycleDate, 3),
        ],
        salesWindow: {
          startDate: this.addDays(cycleDate, -3),
          endDate: this.addDays(cycleDate, -1),
        },
      };
    }

    if (weekday === 3) {
      return {
        cycleDate,
        cycleWeekday: 'WEDNESDAY',
        daysForecasted: 3,
        forecastDates: [
          this.addDays(cycleDate, 2),
          this.addDays(cycleDate, 3),
          this.addDays(cycleDate, 4),
        ],
        salesWindow: {
          startDate: this.addDays(cycleDate, -3),
          endDate: this.addDays(cycleDate, -1),
        },
      };
    }

    if (weekday === 5) {
      return {
        cycleDate,
        cycleWeekday: 'FRIDAY',
        daysForecasted: 2,
        forecastDates: [
          this.addDays(cycleDate, 3),
          this.addDays(cycleDate, 4),
        ],
        salesWindow: {
          startDate: this.addDays(cycleDate, -3),
          endDate: this.addDays(cycleDate, -1),
        },
      };
    }

    throw new BadRequestException('cycleDate must be a Monday, Wednesday, or Friday');
  }

  private parseDateOnly(value: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
      throw new BadRequestException('cycleDate must be in YYYY-MM-DD format');
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year
      || date.getUTCMonth() !== month - 1
      || date.getUTCDate() !== day
    ) {
      throw new BadRequestException('cycleDate must be a valid calendar date');
    }

    return date;
  }

  private addDays(value: string, days: number) {
    const date = this.parseDateOnly(value);
    date.setUTCDate(date.getUTCDate() + days);
    return [
      date.getUTCFullYear(),
      String(date.getUTCMonth() + 1).padStart(2, '0'),
      String(date.getUTCDate()).padStart(2, '0'),
    ].join('-');
  }

  private roundTo(value: number, digits: number) {
    const factor = 10 ** digits;
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }
}
