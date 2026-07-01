import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import {
  IntegrationStatus,
  Prisma,
  TenantStatus,
  WmsInventoryUnitStatus,
} from '@prisma/client';
import { createHash } from 'crypto';
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
const DEFAULT_PAST_SALES_WINDOW_DAYS = 3;
const PENDING_POS_STATUSES = [0, 1, 12];
const RETURNING_POS_STATUS = 4;
const EXCLUDED_PAST_SALES_POS_STATUSES = [7];
const STOCK_STATUSES = [
  WmsInventoryUnitStatus.PUTAWAY,
  WmsInventoryUnitStatus.PICKED,
  WmsInventoryUnitStatus.PACKED,
];

type ForecastCycle = {
  mode: 'CYCLE' | 'CUSTOM';
  cycleDate: string;
  cycleWeekday: 'MONDAY' | 'WEDNESDAY' | 'FRIDAY' | 'CUSTOM';
  forecastStartDate: string;
  forecastEndDate: string;
  daysForecasted: number;
  pastSalesWindowDays: number;
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

type ForecastRow = {
  rowId: string;
  storeId: string | null;
  storeName: string;
  tenantId: string | null;
  tenantName: string | null;
  shopId: string | null;
  variationId: string;
  productId: string | null;
  productName: string;
  productDisplayId: string | null;
  actualStock: number;
  pendingOrders: number;
  remainingStocks: number;
  past3DaySales: number;
  avgDailySales: number;
  forecastedDemand: number;
  safetyStock: number;
  suggestedOrderQty: number;
  daysOfStockLeft: number | null;
  status: {
    key: 'NO_SALES' | 'REORDER_NOW' | 'LOW_STOCK' | 'ADEQUATE';
    label: string;
  };
  returning: number;
};

type ForecastContextStore = {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string | null;
  shopId: string;
  name: string;
};

type ForecastResponse = {
  context: {
    mode: 'CYCLE' | 'CUSTOM';
    activeTenantId: string | null;
    activeTenantName: string | null;
    selectedStoreIds: string[];
    stores: ForecastContextStore[];
    cycleDate: string;
    cycleWeekday: ForecastCycle['cycleWeekday'];
    forecastStartDate: string;
    forecastEndDate: string;
    forecastDates: string[];
    daysForecasted: number;
    pastSalesWindowDays: number;
    salesWindow: ForecastCycle['salesWindow'];
    safetyStockPct: number;
    reorderTriggerDays: number;
  };
  rows: ForecastRow[];
  totals: ReturnType<WmsForecastingService['buildTotals']>;
  generatedAt: string;
  snapshot: {
    id: string;
    version: number;
    generatedAt: string;
    generatedBy: {
      id: string;
      email: string;
      name: string | null;
    } | null;
  } | null;
};

@Injectable()
export class WmsForecastingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async getForecast(query: GetWmsForecastingDto) {
    const snapshotLookup = await this.resolveSnapshotLookup(query);

    if (snapshotLookup.selectedStoreIds.length === 0) {
      return this.buildEmptyResponse(snapshotLookup);
    }

    const snapshot = await this.prisma.wmsForecastSnapshot.findFirst({
      where: {
        scopeKey: snapshotLookup.scopeKey,
        mode: snapshotLookup.cycle.mode,
        cycleDate: snapshotLookup.cycle.cycleDate,
        forecastStartDate: snapshotLookup.cycle.forecastStartDate,
        forecastEndDate: snapshotLookup.cycle.forecastEndDate,
        pastSalesWindowDays: snapshotLookup.pastSalesWindowDays,
        safetyStockPct: snapshotLookup.safetyStockPct,
        reorderTriggerDays: snapshotLookup.reorderTriggerDays,
      },
      include: {
        rows: {
          orderBy: [
            { tenantName: 'asc' },
            { storeName: 'asc' },
            { suggestedOrderQty: 'desc' },
            { productName: 'asc' },
          ],
        },
        generatedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [
        { version: 'desc' },
        { generatedAt: 'desc' },
      ],
    });

    if (!snapshot) {
      return this.buildEmptyResponse(snapshotLookup);
    }

    return this.mapSnapshotToResponse(snapshot, snapshotLookup);
  }

  async generateForecast(query: GetWmsForecastingDto) {
    const liveForecast = await this.calculateLiveForecast(query);

    if (liveForecast.context.selectedStoreIds.length === 0) {
      throw new BadRequestException('Select at least one store before generating a forecast snapshot');
    }

    const scopeKey = this.buildScopeKey(liveForecast.context.selectedStoreIds);
    const actorId = (this.cls.get('userId') as string | undefined) ?? null;

    const snapshot = await this.prisma.$transaction(async (tx) => {
      const latest = await tx.wmsForecastSnapshot.findFirst({
        where: {
          scopeKey,
          mode: liveForecast.context.mode,
          cycleDate: liveForecast.context.cycleDate,
        },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      const version = (latest?.version ?? 0) + 1;

      return tx.wmsForecastSnapshot.create({
        data: {
          tenantId: liveForecast.context.activeTenantId,
          scopeKey,
          storeIds: liveForecast.context.selectedStoreIds,
          selectedStores: liveForecast.context.stores,
          mode: liveForecast.context.mode,
          cycleDate: liveForecast.context.cycleDate,
          cycleWeekday: liveForecast.context.cycleWeekday,
          forecastStartDate: liveForecast.context.forecastStartDate,
          forecastEndDate: liveForecast.context.forecastEndDate,
          forecastDates: liveForecast.context.forecastDates,
          salesWindowStartDate: liveForecast.context.salesWindow.startDate,
          salesWindowEndDate: liveForecast.context.salesWindow.endDate,
          pastSalesWindowDays: liveForecast.context.pastSalesWindowDays,
          daysForecasted: liveForecast.context.daysForecasted,
          safetyStockPct: liveForecast.context.safetyStockPct,
          reorderTriggerDays: liveForecast.context.reorderTriggerDays,
          version,
          totalActualStock: liveForecast.totals.actualStock,
          totalPendingOrders: liveForecast.totals.pendingOrders,
          totalRemainingStocks: liveForecast.totals.remainingStocks,
          totalPast3DaySales: liveForecast.totals.past3DaySales,
          totalAvgDailySales: liveForecast.totals.avgDailySales,
          totalForecastDemand: liveForecast.totals.forecastedDemand,
          totalSafetyStock: liveForecast.totals.safetyStock,
          totalSuggestedOrder: liveForecast.totals.suggestedOrderQty,
          totalReturning: liveForecast.totals.returning,
          generatedById: actorId,
          rows: {
            create: liveForecast.rows.map((row) => ({
              tenantId: row.tenantId,
              storeId: row.storeId,
              storeName: row.storeName,
              tenantName: row.tenantName,
              shopId: row.shopId,
              rowId: row.rowId,
              variationId: row.variationId,
              productId: row.productId,
              productName: row.productName,
              productDisplayId: row.productDisplayId,
              actualStock: row.actualStock,
              pendingOrders: row.pendingOrders,
              remainingStocks: row.remainingStocks,
              past3DaySales: row.past3DaySales,
              avgDailySales: row.avgDailySales,
              forecastedDemand: row.forecastedDemand,
              safetyStock: row.safetyStock,
              suggestedOrderQty: row.suggestedOrderQty,
              daysOfStockLeft: row.daysOfStockLeft,
              statusKey: row.status.key,
              statusLabel: row.status.label,
              returning: row.returning,
            })),
          },
        },
        include: {
          rows: {
            orderBy: [
              { tenantName: 'asc' },
              { storeName: 'asc' },
              { suggestedOrderQty: 'desc' },
              { productName: 'asc' },
            ],
          },
          generatedBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
    });

    return this.mapSnapshotToResponse(snapshot, {
      cycle: this.resolveForecastWindow(
        {
          mode: liveForecast.context.mode,
          cycleDate: liveForecast.context.cycleDate,
          forecastStartDate: liveForecast.context.forecastStartDate,
          forecastEndDate: liveForecast.context.forecastEndDate,
        },
        liveForecast.context.pastSalesWindowDays,
      ),
      pastSalesWindowDays: liveForecast.context.pastSalesWindowDays,
      safetyStockPct: liveForecast.context.safetyStockPct,
      reorderTriggerDays: liveForecast.context.reorderTriggerDays,
      scope: {
        activeTenantId: liveForecast.context.activeTenantId,
        stores: [],
      },
      selectedStoreIds: liveForecast.context.selectedStoreIds,
      scopeKey,
    });
  }

  private async calculateLiveForecast(query: GetWmsForecastingDto): Promise<ForecastResponse> {
    const safetyStockPct = query.safetyStockPct ?? DEFAULT_SAFETY_STOCK_PCT;
    const reorderTriggerDays = query.reorderTriggerDays ?? DEFAULT_REORDER_TRIGGER_DAYS;
    const pastSalesWindowDays = query.pastSalesWindowDays ?? DEFAULT_PAST_SALES_WINDOW_DAYS;
    const cycle = this.resolveForecastWindow(query, pastSalesWindowDays);
    const scope = await this.resolveScope(query);
    const selectedStoreIds = Array.from(new Set(query.storeIds ?? []));

    if (selectedStoreIds.length === 0) {
      return this.buildEmptyResponse({
        cycle,
        pastSalesWindowDays,
        safetyStockPct,
        reorderTriggerDays,
        scope,
        selectedStoreIds,
        scopeKey: this.buildScopeKey(selectedStoreIds),
      });
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
      }),
      this.getScopedPosOrders(scope, {
        status: { notIn: EXCLUDED_PAST_SALES_POS_STATUSES },
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
      pastSalesWindowDays: cycle.pastSalesWindowDays,
      safetyStockPct,
      reorderTriggerDays,
    });

    return {
      context: {
        mode: cycle.mode,
        activeTenantId: scope.activeTenantId,
        activeTenantName: this.resolveActiveTenantName(scope),
        selectedStoreIds,
        stores: this.mapScopeStores(scope.stores),
        cycleDate: cycle.cycleDate,
        cycleWeekday: cycle.cycleWeekday,
        forecastStartDate: cycle.forecastStartDate,
        forecastEndDate: cycle.forecastEndDate,
        forecastDates: cycle.forecastDates,
        daysForecasted: cycle.daysForecasted,
        pastSalesWindowDays: cycle.pastSalesWindowDays,
        salesWindow: cycle.salesWindow,
        safetyStockPct,
        reorderTriggerDays,
      },
      rows,
      totals: this.buildTotals(rows),
      generatedAt: new Date().toISOString(),
      snapshot: null,
    };
  }

  private async resolveSnapshotLookup(query: GetWmsForecastingDto) {
    const safetyStockPct = query.safetyStockPct ?? DEFAULT_SAFETY_STOCK_PCT;
    const reorderTriggerDays = query.reorderTriggerDays ?? DEFAULT_REORDER_TRIGGER_DAYS;
    const pastSalesWindowDays = query.pastSalesWindowDays ?? DEFAULT_PAST_SALES_WINDOW_DAYS;
    const cycle = this.resolveForecastWindow(query, pastSalesWindowDays);
    const scope = await this.resolveScope(query);
    const selectedStoreIds = Array.from(new Set(query.storeIds ?? []));

    return {
      cycle,
      pastSalesWindowDays,
      safetyStockPct,
      reorderTriggerDays,
      scope,
      selectedStoreIds,
      scopeKey: this.buildScopeKey(selectedStoreIds),
    };
  }

  private buildEmptyResponse(params: Awaited<ReturnType<WmsForecastingService['resolveSnapshotLookup']>>): ForecastResponse {
    return {
      context: {
        mode: params.cycle.mode,
        activeTenantId: params.scope.activeTenantId,
        activeTenantName: this.resolveActiveTenantName(params.scope),
        selectedStoreIds: params.selectedStoreIds,
        stores: this.mapScopeStores(params.scope.stores),
        cycleDate: params.cycle.cycleDate,
        cycleWeekday: params.cycle.cycleWeekday,
        forecastStartDate: params.cycle.forecastStartDate,
        forecastEndDate: params.cycle.forecastEndDate,
        forecastDates: params.cycle.forecastDates,
        daysForecasted: params.cycle.daysForecasted,
        pastSalesWindowDays: params.cycle.pastSalesWindowDays,
        salesWindow: params.cycle.salesWindow,
        safetyStockPct: params.safetyStockPct,
        reorderTriggerDays: params.reorderTriggerDays,
      },
      rows: [],
      totals: this.buildTotals([]),
      generatedAt: new Date().toISOString(),
      snapshot: null,
    };
  }

  private mapSnapshotToResponse(
    snapshot: Prisma.WmsForecastSnapshotGetPayload<{
      include: {
        rows: true;
        generatedBy: {
          select: {
            id: true;
            email: true;
            firstName: true;
            lastName: true;
          };
        };
      };
    }>,
    params: Awaited<ReturnType<WmsForecastingService['resolveSnapshotLookup']>>,
  ): ForecastResponse {
    const selectedStores = this.parseSnapshotStores(snapshot.selectedStores, params.scope.stores);
    const rows = snapshot.rows.map((row) => ({
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
      pendingOrders: row.pendingOrders,
      remainingStocks: row.remainingStocks,
      past3DaySales: row.past3DaySales,
      avgDailySales: row.avgDailySales,
      forecastedDemand: row.forecastedDemand,
      safetyStock: row.safetyStock,
      suggestedOrderQty: row.suggestedOrderQty,
      daysOfStockLeft: row.daysOfStockLeft,
      status: {
        key: row.statusKey as ForecastRow['status']['key'],
        label: row.statusLabel,
      },
      returning: row.returning,
    }));

    return {
      context: {
        mode: snapshot.mode as ForecastCycle['mode'],
        activeTenantId: snapshot.tenantId,
        activeTenantName: this.resolveActiveTenantNameFromStores(snapshot.tenantId, selectedStores),
        selectedStoreIds: snapshot.storeIds,
        stores: selectedStores,
        cycleDate: snapshot.cycleDate,
        cycleWeekday: snapshot.cycleWeekday as ForecastCycle['cycleWeekday'],
        forecastStartDate: snapshot.forecastStartDate,
        forecastEndDate: snapshot.forecastEndDate,
        forecastDates: snapshot.forecastDates,
        daysForecasted: snapshot.daysForecasted,
        pastSalesWindowDays: snapshot.pastSalesWindowDays,
        salesWindow: {
          startDate: snapshot.salesWindowStartDate,
          endDate: snapshot.salesWindowEndDate,
        },
        safetyStockPct: snapshot.safetyStockPct,
        reorderTriggerDays: snapshot.reorderTriggerDays,
      },
      rows,
      totals: {
        actualStock: snapshot.totalActualStock,
        pendingOrders: snapshot.totalPendingOrders,
        remainingStocks: snapshot.totalRemainingStocks,
        past3DaySales: snapshot.totalPast3DaySales,
        avgDailySales: snapshot.totalAvgDailySales,
        forecastedDemand: snapshot.totalForecastDemand,
        safetyStock: snapshot.totalSafetyStock,
        suggestedOrderQty: snapshot.totalSuggestedOrder,
        returning: snapshot.totalReturning,
      },
      generatedAt: snapshot.generatedAt.toISOString(),
      snapshot: {
        id: snapshot.id,
        version: snapshot.version,
        generatedAt: snapshot.generatedAt.toISOString(),
        generatedBy: snapshot.generatedBy
          ? {
              id: snapshot.generatedBy.id,
              email: snapshot.generatedBy.email,
              name: this.formatUserName(snapshot.generatedBy.firstName, snapshot.generatedBy.lastName),
            }
          : null,
      },
    };
  }

  private parseSnapshotStores(value: Prisma.JsonValue, fallbackStores: ForecastScopeStore[]) {
    if (Array.isArray(value)) {
      return value.filter((entry): entry is ForecastContextStore => (
        typeof entry === 'object'
        && entry !== null
        && 'id' in entry
        && 'tenantId' in entry
        && 'name' in entry
      ));
    }

    return this.mapScopeStores(fallbackStores);
  }

  private mapScopeStores(stores: ForecastScopeStore[]): ForecastContextStore[] {
    return stores.map((store) => ({
      id: store.id,
      tenantId: store.tenantId,
      tenantName: store.tenant.name,
      tenantSlug: store.tenant.slug,
      shopId: store.shopId,
      name: store.shopName || store.name,
    }));
  }

  private buildScopeKey(storeIds: string[]) {
    const normalizedStoreIds = Array.from(new Set(storeIds)).sort();
    return createHash('sha256').update(normalizedStoreIds.join('|')).digest('hex');
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
    pastSalesWindowDays: number;
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
    pastSalesWindowDays: number;
    safetyStockPct: number;
    reorderTriggerDays: number;
  }) {
    const grossPendingOrders = row.pendingOrders;
    const remainingStocks = Math.max(0, row.actualStock - grossPendingOrders);
    const uncoveredPendingOrders = Math.max(0, grossPendingOrders - row.actualStock);
    const avgDailySales = row.past3DaySales / params.pastSalesWindowDays;
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
  ): ForecastRow['status'] {
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

  private buildTotals(rows: ForecastRow[]) {
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

  private resolveActiveTenantNameFromStores(tenantId: string | null, stores: ForecastContextStore[]) {
    if (!tenantId) {
      return null;
    }

    return stores.find((store) => store.tenantId === tenantId)?.tenantName ?? null;
  }

  private formatUserName(firstName: string | null, lastName: string | null) {
    const name = [firstName, lastName].filter(Boolean).join(' ').trim();
    return name.length > 0 ? name : null;
  }

  private resolveForecastWindow(
    query: Pick<GetWmsForecastingDto, 'mode' | 'cycleDate' | 'forecastStartDate' | 'forecastEndDate'>,
    pastSalesWindowDays: number,
  ): ForecastCycle {
    const mode = query.mode ?? 'CYCLE';

    if (mode === 'CUSTOM') {
      const cycleDate = this.getManilaDateValue();
      const forecastStartDate = query.forecastStartDate;
      const forecastEndDate = query.forecastEndDate;

      if (!forecastStartDate || !forecastEndDate) {
        throw new BadRequestException('Custom forecast requires forecastStartDate and forecastEndDate');
      }

      this.parseDateOnly(forecastStartDate);
      this.parseDateOnly(forecastEndDate);

      if (forecastEndDate < forecastStartDate) {
        throw new BadRequestException('forecastEndDate must be on or after forecastStartDate');
      }

      const forecastDates = this.buildDateRange(forecastStartDate, forecastEndDate);
      const daysForecasted = forecastDates.length;

      if (daysForecasted <= 0) {
        throw new BadRequestException('Custom forecast must include at least one forecast day');
      }

      return {
        mode: 'CUSTOM',
        cycleDate,
        cycleWeekday: 'CUSTOM',
        forecastStartDate,
        forecastEndDate,
        daysForecasted,
        pastSalesWindowDays,
        forecastDates,
        salesWindow: {
          startDate: this.addDays(cycleDate, -pastSalesWindowDays),
          endDate: this.addDays(cycleDate, -1),
        },
      };
    }

    const cycleDate = query.cycleDate;
    const date = this.parseDateOnly(cycleDate);
    const weekday = date.getUTCDay();

    if (weekday === 1) {
      return this.buildCycleForecastWindow(cycleDate, 'MONDAY', pastSalesWindowDays, [2, 3]);
    }

    if (weekday === 3) {
      return this.buildCycleForecastWindow(cycleDate, 'WEDNESDAY', pastSalesWindowDays, [2, 3, 4]);
    }

    if (weekday === 5) {
      return this.buildCycleForecastWindow(cycleDate, 'FRIDAY', pastSalesWindowDays, [3, 4]);
    }

    throw new BadRequestException('cycleDate must be a Monday, Wednesday, or Friday');
  }

  private buildCycleForecastWindow(
    cycleDate: string,
    cycleWeekday: 'MONDAY' | 'WEDNESDAY' | 'FRIDAY',
    pastSalesWindowDays: number,
    offsets: number[],
  ): ForecastCycle {
    const forecastDates = offsets.map((offset) => this.addDays(cycleDate, offset));

    return {
      mode: 'CYCLE',
      cycleDate,
      cycleWeekday,
      forecastStartDate: forecastDates[0] ?? cycleDate,
      forecastEndDate: forecastDates[forecastDates.length - 1] ?? cycleDate,
      daysForecasted: forecastDates.length,
      pastSalesWindowDays,
      forecastDates,
      salesWindow: {
        startDate: this.addDays(cycleDate, -pastSalesWindowDays),
        endDate: this.addDays(cycleDate, -1),
      },
    };
  }

  private buildDateRange(startDate: string, endDate: string) {
    const start = this.parseDateOnly(startDate);
    const end = this.parseDateOnly(endDate);
    const dates: string[] = [];
    const cursor = new Date(start);

    while (cursor.getTime() <= end.getTime()) {
      dates.push([
        cursor.getUTCFullYear(),
        String(cursor.getUTCMonth() + 1).padStart(2, '0'),
        String(cursor.getUTCDate()).padStart(2, '0'),
      ].join('-'));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return dates;
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

  private getManilaDateValue() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;

    if (!year || !month || !day) {
      return new Date().toISOString().slice(0, 10);
    }

    return `${year}-${month}-${day}`;
  }

  private roundTo(value: number, digits: number) {
    const factor = 10 ** digits;
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }
}
