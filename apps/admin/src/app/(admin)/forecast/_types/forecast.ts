export type WmsForecastStatusKey =
  | 'NO_SALES'
  | 'REORDER_NOW'
  | 'LOW_STOCK'
  | 'ADEQUATE';

export type WmsForecastStoreOption = {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string | null;
  shopId: string;
  name: string;
};

export type WmsForecastTenantOption = {
  id: string;
  name: string;
  slug: string | null;
};

export type WmsForecastStatus = {
  key: WmsForecastStatusKey;
  label: string;
};

export type WmsForecastingContext = {
  activeTenantId: string | null;
  activeTenantName: string | null;
  selectedStoreIds: string[];
  stores: WmsForecastStoreOption[];
  cycleDate: string;
  cycleWeekday: 'MONDAY' | 'WEDNESDAY' | 'FRIDAY';
  forecastDates: string[];
  daysForecasted: number;
  pastSalesWindowDays: number;
  salesWindow: {
    startDate: string;
    endDate: string;
  };
  safetyStockPct: number;
  reorderTriggerDays: number;
};

export type WmsForecastingRow = {
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
  status: WmsForecastStatus;
  returning: number;
};

export type WmsForecastingTotals = {
  actualStock: number;
  pendingOrders: number;
  remainingStocks: number;
  past3DaySales: number;
  avgDailySales: number;
  forecastedDemand: number;
  safetyStock: number;
  suggestedOrderQty: number;
  returning: number;
};

export type WmsForecastingResponse = {
  context: WmsForecastingContext;
  rows: WmsForecastingRow[];
  totals: WmsForecastingTotals;
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

export type GetWmsForecastingParams = {
  tenantId?: string;
  storeIds?: string[];
  cycleDate: string;
  safetyStockPct?: number;
  reorderTriggerDays?: number;
  pastSalesWindowDays?: number;
};
