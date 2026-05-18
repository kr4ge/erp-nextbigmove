import type { BootstrapResponse } from '@/src/features/auth/types';
import type { WmsMobileStockResponse } from '../types';

export type StockFilterKey = 'tenant' | 'store' | 'warehouse';

export type StockScopeOption = {
  label: string;
  value: string | null;
  meta?: string;
};

export const stockFilterTitle: Record<StockFilterKey, string> = {
  tenant: 'Partner',
  store: 'Store',
  warehouse: 'Warehouse',
};

export function canFilterStockPartners(bootstrap: BootstrapResponse) {
  return bootstrap.user.role === 'SUPER_ADMIN';
}

export function buildStockFilterOptions(
  activeFilter: StockFilterKey | null,
  stock: WmsMobileStockResponse | null,
  bootstrap: BootstrapResponse,
  canFilterPartners: boolean,
): StockScopeOption[] {
  if (activeFilter === 'tenant' && canFilterPartners) {
    const stockPartners = stock?.context.tenantOptions ?? [];
    const bootstrapPartners = bootstrap.context.tenantOptions ?? [];
    const partners = stockPartners.length > 0 ? stockPartners : bootstrapPartners;

    return [
      { label: 'All partners', value: null },
      ...partners.map((partner) => ({
        label: partner.name,
        value: partner.id,
        meta: partner.slug,
      })),
    ];
  }

  if (activeFilter === 'warehouse') {
    const stockWarehouses = stock?.context.warehouses ?? [];
    const warehouses = stockWarehouses.length > 0 ? stockWarehouses : bootstrap.context.warehouses;

    return [
      { label: 'All warehouses', value: null },
      ...warehouses.map((warehouse) => ({
        label: warehouse.name,
        value: warehouse.id,
        meta: warehouse.code,
      })),
    ];
  }

  const stockStores = stock?.context.stores ?? [];
  const stores = stockStores.length > 0 ? stockStores : bootstrap.context.stores;

  return [
    { label: 'All stores', value: null },
    ...stores.map((store) => ({
      label: store.name,
      value: store.id,
      meta: 'tenantName' in store && typeof store.tenantName === 'string'
        ? store.tenantName
        : undefined,
    })),
  ];
}

export function resolveActivePartnerName(
  stock: WmsMobileStockResponse | null,
  bootstrap: BootstrapResponse,
  activeTenantId: string | null,
) {
  if (!activeTenantId) {
    return 'All partners';
  }

  const stockPartners = stock?.context.tenantOptions ?? [];
  const bootstrapPartners = bootstrap.context.tenantOptions ?? [];
  const partners = stockPartners.length > 0 ? stockPartners : bootstrapPartners;
  const activePartner = partners.find((partner) => partner.id === activeTenantId);

  return activePartner?.name ?? 'Partner';
}

export function resolveActiveStoreName(
  stock: WmsMobileStockResponse | null,
  bootstrap: BootstrapResponse,
) {
  if (stock && !stock.context.activeStoreId) {
    return 'All stores';
  }

  const stockStores = stock?.context.stores ?? [];
  const stores = stockStores.length > 0 ? stockStores : bootstrap.context.stores;
  const activeStoreId = stock?.context.activeStoreId ?? bootstrap.context.defaultStoreId;
  const activeStore = stores.find((store) => store.id === activeStoreId);

  return activeStore?.name ?? resolveEntityName(bootstrap.context.stores, bootstrap.context.defaultStoreId);
}

export function resolveActiveWarehouseName(
  stock: WmsMobileStockResponse | null,
  bootstrap: BootstrapResponse,
) {
  if (stock && !stock.context.activeWarehouseId) {
    return 'All warehouses';
  }

  const stockWarehouses = stock?.context.warehouses ?? [];
  const warehouses = stockWarehouses.length > 0 ? stockWarehouses : bootstrap.context.warehouses;
  const activeWarehouseId = stock?.context.activeWarehouseId ?? bootstrap.context.defaultWarehouseId;
  const activeWarehouse = warehouses.find((warehouse) => warehouse.id === activeWarehouseId);

  return (
    activeWarehouse?.name
    ?? resolveEntityName(bootstrap.context.warehouses, bootstrap.context.defaultWarehouseId, 'name')
  );
}

function resolveEntityName<T extends { id: string }>(
  items: T[],
  id: string | null,
  key: keyof T = 'name' as keyof T,
) {
  if (!id) {
    return 'Not set';
  }

  const match = items.find((item) => item.id === id);
  const rawValue = match?.[key];

  return typeof rawValue === 'string' && rawValue.length > 0 ? rawValue : id;
}
