import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  IntegrationStatus,
  TenantStatus,
  WmsInventoryUnitStatus,
  WmsLocationKind,
} from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GetWmsMonthEndStockReportDto } from './dto/get-wms-month-end-stock-report.dto';

const ACTIVE_TENANT_STATUSES = [TenantStatus.ACTIVE, TenantStatus.TRIAL] as const;
const NON_PHYSICAL_BIN_STATUSES = new Set<WmsInventoryUnitStatus>([
  WmsInventoryUnitStatus.DISPATCHED,
  WmsInventoryUnitStatus.LOST,
  WmsInventoryUnitStatus.ARCHIVED,
]);

type StockAccumulator = {
  receivedQty: number;
  stagedQty: number;
  putAwayQty: number;
  reservedQty: number;
  inBinQty: number;
};

type StockReportTotals = StockAccumulator & {
  variantCount: number;
  awaitingPutAwayQty: number;
};

@Injectable()
export class WmsReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async getMonthEndStockReport(query: GetWmsMonthEndStockReportDto) {
    const scope = await this.resolveScope(query);
    const reportStoreIds = scope.reportStores.map((store) => store.id);

    if (reportStoreIds.length === 0) {
      return this.buildResponse(scope, [], new Date());
    }

    const [products, groupedUnits, inBinGroups] = await Promise.all([
      this.prisma.posProduct.findMany({
        where: {
          storeId: { in: reportStoreIds },
          wmsProductProfile: { isNot: null },
        },
        select: {
          id: true,
          storeId: true,
          productId: true,
          variationId: true,
          customId: true,
          name: true,
          productSnapshot: true,
        },
        orderBy: [{ storeId: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.wmsInventoryUnit.groupBy({
        by: ['posProductId', 'status'],
        where: { storeId: { in: reportStoreIds } },
        _count: { _all: true },
      }),
      this.prisma.wmsInventoryUnit.groupBy({
        by: ['posProductId'],
        where: {
          storeId: { in: reportStoreIds },
          currentLocation: { is: { kind: WmsLocationKind.BIN } },
          status: { notIn: Array.from(NON_PHYSICAL_BIN_STATUSES) },
        },
        _count: { _all: true },
      }),
    ]);

    const inBinQtyByProduct = new Map(
      inBinGroups.map((group) => [group.posProductId, group._count._all]),
    );

    const quantitiesByProduct = new Map<string, StockAccumulator>();
    for (const group of groupedUnits) {
      const quantities = quantitiesByProduct.get(group.posProductId) ?? {
        receivedQty: 0,
        stagedQty: 0,
        putAwayQty: 0,
        reservedQty: 0,
        inBinQty: 0,
      };
      const quantity = group._count._all;

      if (group.status === WmsInventoryUnitStatus.RECEIVED) quantities.receivedQty += quantity;
      if (group.status === WmsInventoryUnitStatus.STAGED) quantities.stagedQty += quantity;
      if (group.status === WmsInventoryUnitStatus.PUTAWAY) quantities.putAwayQty += quantity;
      if (group.status === WmsInventoryUnitStatus.RESERVED) quantities.reservedQty += quantity;
      quantitiesByProduct.set(group.posProductId, quantities);
    }

    for (const [posProductId, inBinQty] of inBinQtyByProduct) {
      const quantities = quantitiesByProduct.get(posProductId) ?? {
        receivedQty: 0,
        stagedQty: 0,
        putAwayQty: 0,
        reservedQty: 0,
        inBinQty: 0,
      };
      quantities.inBinQty = inBinQty;
      quantitiesByProduct.set(posProductId, quantities);
    }

    const storeById = new Map(scope.reportStores.map((store) => [store.id, store]));
    const rows = products.map((product) => {
      const store = storeById.get(product.storeId)!;
      const quantities = quantitiesByProduct.get(product.id) ?? {
        receivedQty: 0,
        stagedQty: 0,
        putAwayQty: 0,
        reservedQty: 0,
        inBinQty: 0,
      };
      const snapshot = product.productSnapshot as {
        display_id?: string | null;
        product?: { display_id?: string | null } | null;
      } | null;

      return {
        rowId: `${product.storeId}:${product.id}`,
        tenantId: store.tenantId,
        tenantName: store.tenant.name,
        storeId: store.id,
        storeName: store.shopName || store.name,
        shopId: store.shopId,
        productId: product.productId,
        variationId: product.variationId,
        variantCode: product.customId,
        variantDisplayId: snapshot?.display_id ?? snapshot?.product?.display_id ?? null,
        variantName: product.name,
        ...quantities,
        awaitingPutAwayQty: quantities.receivedQty + quantities.stagedQty,
      };
    });

    rows.sort((left, right) => (
      left.tenantName.localeCompare(right.tenantName)
      || left.storeName.localeCompare(right.storeName)
      || left.variantName.localeCompare(right.variantName)
    ));

    return this.buildResponse(scope, rows, new Date());
  }

  private async resolveScope(query: GetWmsMonthEndStockReportDto) {
    const clsTenantId = this.cls.get('tenantId') as string | undefined;
    const userRole = this.cls.get('userRole') as string | undefined;
    const isGlobalUser = userRole === 'SUPER_ADMIN' || this.cls.get('wmsGlobalAccess') === true;
    const requestedTenantIds = Array.from(new Set(query.tenantIds ?? []));
    const requestedStoreIds = Array.from(new Set(query.storeIds ?? []));

    if (!isGlobalUser && !clsTenantId) {
      throw new ForbiddenException('Partner context is required for WMS reports');
    }
    if (!isGlobalUser && requestedTenantIds.some((tenantId) => tenantId !== clsTenantId)) {
      throw new ForbiddenException('One or more selected partners are outside your WMS scope');
    }

    const accessibleTenantWhere = isGlobalUser ? {} : { id: clsTenantId };
    const partners = await this.prisma.tenant.findMany({
      where: {
        ...accessibleTenantWhere,
        status: { in: [...ACTIVE_TENANT_STATUSES] },
      },
      select: { id: true, name: true, slug: true },
      orderBy: [{ name: 'asc' }],
    });
    const accessibleTenantIds = new Set(partners.map((partner) => partner.id));

    if (requestedTenantIds.some((tenantId) => !accessibleTenantIds.has(tenantId))) {
      throw new ForbiddenException('One or more selected partners are outside your WMS scope');
    }

    const stores = await this.prisma.posStore.findMany({
      where: {
        tenantId: { in: partners.map((partner) => partner.id) },
        status: IntegrationStatus.ACTIVE,
      },
      select: {
        id: true,
        tenantId: true,
        shopId: true,
        name: true,
        shopName: true,
        tenant: { select: { name: true } },
      },
      orderBy: [{ tenant: { name: 'asc' } }, { shopName: 'asc' }, { name: 'asc' }],
    });

    const selectedTenantIds = requestedTenantIds.length > 0
      ? new Set(requestedTenantIds)
      : accessibleTenantIds;
    const storesInSelectedPartners = stores.filter((store) => selectedTenantIds.has(store.tenantId));
    const storesInSelectedPartnersById = new Map(
      storesInSelectedPartners.map((store) => [store.id, store]),
    );

    if (requestedStoreIds.some((storeId) => !storesInSelectedPartnersById.has(storeId))) {
      throw new ForbiddenException('One or more selected stores are outside the selected partner scope');
    }

    return {
      partners,
      stores,
      selectedTenantIds: requestedTenantIds,
      selectedStoreIds: requestedStoreIds,
      reportStores: requestedStoreIds.length > 0
        ? requestedStoreIds.map((storeId) => storesInSelectedPartnersById.get(storeId)!)
        : storesInSelectedPartners,
    };
  }

  private buildResponse(
    scope: Awaited<ReturnType<WmsReportsService['resolveScope']>>,
    rows: Array<{
      receivedQty: number;
      stagedQty: number;
      putAwayQty: number;
      reservedQty: number;
      inBinQty: number;
      awaitingPutAwayQty: number;
      [key: string]: unknown;
    }>,
    generatedAt: Date,
  ) {
    const totals = rows.reduce<StockReportTotals>(
      (total, row) => ({
        variantCount: total.variantCount + 1,
        receivedQty: total.receivedQty + row.receivedQty,
        stagedQty: total.stagedQty + row.stagedQty,
        awaitingPutAwayQty: total.awaitingPutAwayQty + row.awaitingPutAwayQty,
        putAwayQty: total.putAwayQty + row.putAwayQty,
        reservedQty: total.reservedQty + row.reservedQty,
        inBinQty: total.inBinQty + row.inBinQty,
      }),
      {
        variantCount: 0,
        receivedQty: 0,
        stagedQty: 0,
        awaitingPutAwayQty: 0,
        putAwayQty: 0,
        reservedQty: 0,
        inBinQty: 0,
      },
    );

    return {
      report: {
        key: 'MONTH_END_STOCK',
        label: 'Month-End Stock Report',
        generatedAt: generatedAt.toISOString(),
        basis: 'CURRENT_WMS_SNAPSHOT',
      },
      filters: {
        partners: scope.partners.map((partner) => ({
          id: partner.id,
          name: partner.name,
          slug: partner.slug,
        })),
        stores: scope.stores.map((store) => ({
          id: store.id,
          tenantId: store.tenantId,
          tenantName: store.tenant.name,
          shopId: store.shopId,
          name: store.shopName || store.name,
        })),
        selectedTenantIds: scope.selectedTenantIds,
        selectedStoreIds: scope.selectedStoreIds,
        effectiveStoreIds: scope.reportStores.map((store) => store.id),
      },
      totals,
      rows,
    };
  }
}
