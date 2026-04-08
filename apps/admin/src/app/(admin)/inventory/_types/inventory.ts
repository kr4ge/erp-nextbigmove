export type WmsInventoryOverviewWarehouse = {
  id: string;
  code: string;
  name: string;
  status: string;
  locationsCount: number;
  lotsCount: number;
  balancesCount: number;
  ledgerCount: number;
};

export type WmsInventoryOverview = {
  warehousesCount: number;
  locationsCount: number;
  lotsCount: number;
  balancesCount: number;
  ledgerCount: number;
  defaultWarehouse: WmsInventoryOverviewWarehouse | null;
};

export type WmsInventoryAdjustmentType =
  | "OPENING"
  | "INCREASE"
  | "DECREASE"
  | "WRITE_OFF";

export type WmsInventoryBalance = {
  id: string;
  sku: string;
  productName: string;
  variationId: string | null;
  variationName: string | null;
  barcode: string | null;
  onHandQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  latestUnitCost: number | null;
  inventoryValue: number | null;
  updatedAt: string;
  warehouse: {
    id: string;
    code: string;
    name: string;
  };
  location: {
    id: string;
    code: string;
    name: string;
    type: string;
  };
};

export type WmsInventoryLot = {
  id: string;
  lotCode: string;
  sku: string;
  productName: string;
  variationId: string | null;
  variationName: string | null;
  barcode: string | null;
  supplierBatchNo: string | null;
  status: string;
  receivedAt: string;
  expiresAt: string | null;
  initialQuantity: number;
  remainingQuantity: number;
  unitCost: number;
  currency: string;
  costLayerCount: number;
  ledgerEntryCount: number;
  warehouse: {
    id: string;
    code: string;
    name: string;
  };
  receivedLocation: {
    id: string;
    code: string;
    name: string;
    type: string;
  } | null;
};

export type WmsInventoryUnitStatus =
  | "AVAILABLE"
  | "RESERVED"
  | "PICKED"
  | "PACKED"
  | "DISPATCHED"
  | "RETURNED"
  | "DAMAGED"
  | "ADJUSTED_OUT";

export type WmsInventoryUnit = {
  id: string;
  serialNo: string;
  batchSequence: number;
  unitBarcode: string;
  sku: string;
  productName: string;
  variationId: string | null;
  variationName: string | null;
  barcode: string | null;
  status: WmsInventoryUnitStatus;
  lastMovementType: string;
  lastReferenceType: string | null;
  lastReferenceId: string | null;
  receivedAt: string;
  consumedAt: string | null;
  warehouse: {
    id: string;
    code: string;
    name: string;
  };
  location: {
    id: string;
    code: string;
    name: string;
    type: string;
  };
  lot: {
    id: string;
    lotCode: string;
    unitCost: number;
    supplierBatchNo: string | null;
  };
  skuProfile: {
    id: string;
    code: string | null;
    barcode: string | null;
    isSerialized: boolean;
  } | null;
  receiptSource: {
    id: string;
    receiptCode: string;
    lineNo: number;
  } | null;
  adjustmentSource: {
    id: string;
    adjustmentCode: string;
    lineNo: number;
  } | null;
};

export type ListWmsInventoryUnitsParams = {
  warehouseId?: string;
  locationId?: string;
  status?: WmsInventoryUnitStatus;
  search?: string;
};

export type WmsInventoryLedgerEntry = {
  id: string;
  movementType: string;
  sku: string;
  productName: string;
  variationId: string | null;
  variationName: string | null;
  barcode: string | null;
  quantityDelta: number;
  quantityBefore: number;
  quantityAfter: number;
  reservedDelta: number;
  unitCost: number | null;
  totalCost: number | null;
  currency: string | null;
  referenceType: string | null;
  referenceId: string | null;
  notes: string | null;
  happenedAt: string;
  warehouse: {
    id: string;
    code: string;
    name: string;
  };
  location: {
    id: string;
    code: string;
    name: string;
    type: string;
  };
  lot: {
    id: string;
    lotCode: string;
  } | null;
  actorUser: {
    id: string;
    name: string;
    email: string;
  } | null;
};

export type CreateWmsInventoryAdjustmentItemInput = {
  sourceProductId?: string;
  sku: string;
  productName: string;
  variationId?: string;
  variationName?: string;
  barcode?: string;
  quantity: number;
  unitCost?: number;
  lotCode?: string;
  notes?: string;
};

export type CreateWmsInventoryAdjustmentInput = {
  warehouseId: string;
  locationId: string;
  adjustmentType: WmsInventoryAdjustmentType;
  reason: string;
  happenedAt?: string;
  currency?: string;
  notes?: string;
  items: CreateWmsInventoryAdjustmentItemInput[];
};

export type WmsInventoryAdjustmentItem = {
  id: string;
  lineNo: number;
  sku: string;
  productName: string;
  variationName?: string | null;
  quantity: number;
  quantityDelta: number;
  unitCost?: number | null;
  totalCostDelta: number;
  resultLotCode?: string | null;
};

export type WmsInventoryAdjustment = {
  id: string;
  adjustmentCode: string;
  adjustmentType: WmsInventoryAdjustmentType;
  status: string;
  reason: string;
  notes?: string | null;
  happenedAt: string;
  totalItems: number;
  totalQuantityDelta: number;
  totalCostDelta: number;
  currency: string;
  warehouse: {
    id: string;
    code: string;
    name: string;
  };
  location: {
    id: string;
    code: string;
    name: string;
    type: string;
  };
  actorUser?: {
    id: string;
    name: string;
    email: string;
  } | null;
  items: WmsInventoryAdjustmentItem[];
};

export type WmsInventoryTransferType = "PUT_AWAY" | "RELOCATION";

export type WmsInventoryTransferItem = {
  id: string;
  unitId: string;
  serialNo: string;
  batchSequence: number;
  unitBarcode: string;
  sku: string;
  productName: string;
  variationName: string | null;
  lotCode: string | null;
  unitCost: number | null;
};

export type WmsInventoryTransfer = {
  id: string;
  transferCode: string;
  transferType: WmsInventoryTransferType;
  notes: string | null;
  happenedAt: string;
  totalUnits: number;
  warehouse: {
    id: string;
    code: string;
    name: string;
  };
  fromLocation: {
    id: string;
    code: string;
    name: string;
    type: string;
  };
  toLocation: {
    id: string;
    code: string;
    name: string;
    type: string;
  };
  actorUser: {
    id: string;
    name: string;
    email: string;
  } | null;
  items: WmsInventoryTransferItem[];
};

export type CreateWmsInventoryTransferInput = {
  warehouseId: string;
  fromLocationId: string;
  toLocationId: string;
  notes?: string;
  unitIds: string[];
};

export type ListWmsInventoryTransfersParams = {
  warehouseId?: string;
  fromLocationId?: string;
  toLocationId?: string;
  limit?: number;
};

export type WmsPosProductCatalogItem = {
  id: string;
  variationId: string | null;
  variationCustomId: string | null;
  name: string;
  customId: string | null;
  mapping: string | null;
  retailPrice: number | null;
  updatedAt: string;
  imageUrl: string | null;
  store: {
    id: string;
    name: string;
    shopId: string;
    shopName: string;
    tenant: {
      id: string;
      name: string;
      slug: string;
    };
  };
  skuProfile: WmsSkuProfile | null;
};

export type ListWmsPosProductsParams = {
  search?: string;
  tenantId?: string;
  storeId?: string;
  profiledOnly?: boolean;
  limit?: number;
};

export type WmsPosProductFilterTenant = {
  id: string;
  name: string;
  slug: string;
};

export type WmsPosProductFilterShop = {
  id: string;
  name: string;
  shopId: string;
  shopName: string;
  tenantId: string;
  tenantName: string;
};

export type WmsPosProductFilters = {
  tenants: WmsPosProductFilterTenant[];
  shops: WmsPosProductFilterShop[];
};

export type WmsSkuProfileStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";

export type WmsSkuProfile = {
  id: string;
  code: string | null;
  category: string | null;
  unit: string | null;
  packSize: string | null;
  barcode: string | null;
  description: string | null;
  status: WmsSkuProfileStatus;
  isSerialized: boolean;
  isLotTracked: boolean;
  isExpiryTracked: boolean;
  supplierCost: number | null;
  wmsUnitPrice: number | null;
  isRequestable: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UpsertWmsSkuProfileInput = {
  code?: string;
  category?: string;
  unit?: string;
  packSize?: string;
  barcode?: string;
  description?: string;
  status?: WmsSkuProfileStatus;
  isSerialized?: boolean;
  isLotTracked?: boolean;
  isExpiryTracked?: boolean;
  supplierCost?: number;
  wmsUnitPrice?: number;
  isRequestable?: boolean;
};
