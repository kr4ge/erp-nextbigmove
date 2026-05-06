export type StockMode = 'putaway' | 'move' | 'bins' | 'recent';

export type StockFilters = {
  tenantId: string | null;
  storeId: string | null;
  warehouseId: string | null;
};

export type WmsMobileStockLocation = {
  id: string;
  code: string;
  name: string;
  kind: string;
  label: string;
};

export type WmsMobileStockResponse = {
  tenantReady: boolean;
  serverTime: string;
  pagination: {
    mode: StockMode;
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
  context: {
    tenantOptions?: Array<{
      id: string;
      name: string;
      slug: string;
      status?: string | null;
    }>;
    activeTenantId: string | null;
    activeStoreId: string | null;
    activeWarehouseId: string | null;
    stores: Array<{
      id: string;
      tenantId?: string | null;
      name: string;
      tenantName?: string | null;
      tenantSlug?: string | null;
    }>;
    warehouses: Array<{
      id: string;
      code: string;
      name: string;
    }>;
  };
  summary: {
    totalUnits: number;
    locatedUnits: number;
    unlocatedUnits: number;
    stagedUnits: number;
    movableUnits: number;
    putawayBatches: number;
    transfers: number;
    bins: number;
  };
  putawayQueue: WmsMobilePutawayBatch[];
  movableUnits: WmsMobileMovableUnit[];
  recentTransfers: WmsMobileRecentTransfer[];
  bins: WmsMobileBin[];
};

export type WmsMobilePutawayBatch = {
  id: string;
  code: string;
  status: string;
  statusLabel: string;
  unitCount: number;
  store: {
    id: string;
    name: string;
  };
  warehouse: {
    id: string;
    code: string;
    name: string;
  };
  stagingLocation: WmsMobileStockLocation | null;
  updatedAt: string;
};

export type WmsMobileMovableUnit = {
  id: string;
  code: string;
  barcode: string;
  status: string;
  statusLabel: string;
  productId: string;
  variationId: string;
  name: string;
  customId: string | null;
  warehouse: {
    id: string;
    code: string;
    name: string;
  };
  currentLocation: WmsMobileStockLocation | null;
  updatedAt: string;
};

export type WmsMobileRecentTransfer = {
  id: string;
  code: string;
  status: string;
  statusLabel: string;
  itemCount: number;
  warehouse: {
    id: string;
    code: string;
    name: string;
  };
  fromLocation: WmsMobileStockLocation | null;
  toLocation: WmsMobileStockLocation;
  actor: {
    name: string;
    email: string;
  } | null;
  createdAt: string;
};

export type WmsMobileBin = {
  id: string;
  code: string;
  name: string;
  label: string;
  warehouse: {
    id: string;
    code: string;
    name: string;
  };
  capacity: number | null;
  occupiedUnits: number;
  availableUnits: number | null;
  isFull: boolean;
};

export type WmsMobileStockMovement = {
  id: string;
  movementType: string;
  fromStatus: string | null;
  fromStatusLabel: string | null;
  toStatus: string | null;
  toStatusLabel: string | null;
  referenceType: string | null;
  referenceId: string | null;
  referenceCode: string | null;
  notes: string | null;
  fromLocation: WmsMobileStockLocation | null;
  toLocation: WmsMobileStockLocation | null;
  actor: {
    name: string;
    email: string;
  } | null;
  createdAt: string;
};

export type WmsMobileStockUnitDetail = {
  id: string;
  tenantId: string;
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
  store: {
    id: string;
    name: string;
  };
  warehouse: {
    id: string;
    code: string;
    name: string;
  };
  code: string;
  barcode: string;
  status: string;
  statusLabel: string;
  productId: string;
  variationId: string;
  name: string;
  customId: string | null;
  receivingBatch: {
    id: string;
    code: string;
    status: string;
    statusLabel: string;
  } | null;
  currentLocation: WmsMobileStockLocation | null;
  allowedActions: {
    putaway: boolean;
    move: boolean;
  };
  movements: WmsMobileStockMovement[];
  updatedAt: string;
};

export type WmsMobileStockBinDetail = {
  id: string;
  code: string;
  barcode: string;
  name: string;
  kind: string;
  label: string;
  warehouse: {
    id: string;
    code: string;
    name: string;
  };
  capacity: number | null;
  occupiedUnits: number;
  availableUnits: number | null;
  isFull: boolean;
  units: Array<{
    id: string;
    code: string;
    barcode: string;
    status: string;
    statusLabel: string;
    name: string;
    customId: string | null;
    updatedAt: string;
  }>;
};

export type WmsMobileStockBatchDetail = {
  id: string;
  tenantId: string;
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
  code: string;
  status: string;
  statusLabel: string;
  store: {
    id: string;
    name: string;
  };
  warehouse: {
    id: string;
    code: string;
    name: string;
  };
  stagingLocation: WmsMobileStockLocation | null;
  unitCount: number;
  units: Array<{
    id: string;
    code: string;
    barcode: string;
    status: string;
    statusLabel: string;
    name: string;
    customId: string | null;
    currentLocation: WmsMobileStockLocation | null;
    updatedAt: string;
  }>;
  updatedAt: string;
};

export type WmsMobileStockScanResult =
  | {
      found: true;
      type: 'unit';
      unit: WmsMobileStockUnitDetail;
    }
  | {
      found: true;
      type: 'bin' | 'location';
      bin: WmsMobileStockBinDetail;
    }
  | {
      found: true;
      type: 'batch';
      batch: WmsMobileStockBatchDetail;
    }
  | {
      found: false;
      type: 'none';
      code: string;
    };
