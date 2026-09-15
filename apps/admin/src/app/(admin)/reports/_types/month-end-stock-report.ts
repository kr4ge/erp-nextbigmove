export type MonthEndStockPartner = {
  id: string;
  name: string;
  slug: string | null;
};

export type MonthEndStockStore = {
  id: string;
  tenantId: string;
  tenantName: string;
  shopId: string;
  name: string;
};

export type MonthEndStockRow = {
  rowId: string;
  tenantId: string;
  tenantName: string;
  storeId: string;
  storeName: string;
  shopId: string;
  productId: string;
  variationId: string | null;
  variantCode: string | null;
  variantDisplayId: string | null;
  variantName: string;
  receivedQty: number;
  stagedQty: number;
  awaitingPutAwayQty: number;
  putAwayQty: number;
  reservedQty: number;
  inBinQty: number;
};

export type MonthEndStockTotals = {
  variantCount: number;
  receivedQty: number;
  stagedQty: number;
  awaitingPutAwayQty: number;
  putAwayQty: number;
  reservedQty: number;
  inBinQty: number;
};

export type MonthEndStockReportResponse = {
  report: {
    key: 'MONTH_END_STOCK';
    label: string;
    generatedAt: string;
    basis: 'CURRENT_WMS_SNAPSHOT';
  };
  filters: {
    partners: MonthEndStockPartner[];
    stores: MonthEndStockStore[];
    selectedTenantIds: string[];
    selectedStoreIds: string[];
    effectiveStoreIds: string[];
  };
  totals: MonthEndStockTotals;
  rows: MonthEndStockRow[];
};
