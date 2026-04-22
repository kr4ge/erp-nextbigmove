export type WmsReceivingBatchStatus =
  | 'DRAFT'
  | 'ARRIVED'
  | 'COUNTED'
  | 'STAGED'
  | 'PUTAWAY_PENDING'
  | 'COMPLETED'
  | 'CANCELED';

export type WmsReceivablePurchasingBatch = {
  id: string;
  sourceRequestId: string | null;
  requestTitle: string | null;
  requestType: 'PROCUREMENT' | 'SELF_BUY';
  status: 'RECEIVING_READY' | 'RECEIVING';
  store: {
    id: string;
    name: string;
  };
  lineCount: number;
  remainingQuantity: number;
  readyForReceivingAt: string | null;
  lines: Array<{
    id: string;
    lineNo: number;
    requestedProductName: string | null;
    productId: string | null;
    variationId: string | null;
    expectedQuantity: number;
    receivedQuantity: number;
    remainingQuantity: number;
    resolvedPosProduct: {
      id: string;
      name: string;
      customId: string | null;
    } | null;
    resolvedProfile: {
      id: string;
      status: string;
      isSerialized: boolean;
    } | null;
    notes: string | null;
  }>;
};

export type WmsReceivingBatchRow = {
  id: string;
  code: string;
  status: WmsReceivingBatchStatus;
  sourceRequestId: string | null;
  requestTitle: string | null;
  store: {
    id: string;
    name: string;
  };
  warehouse: {
    id: string;
    code: string;
    name: string;
  };
  stagingLocation: {
    id: string;
    code: string;
    name: string;
  } | null;
  lineCount: number;
  expectedQuantity: number;
  receivedQuantity: number;
  unitCount: number;
  labelPrintCount: number;
  firstLabelPrintedAt: string | null;
  lastLabelPrintedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WmsReceivingBatchDetail = {
  id: string;
  code: string;
  status: WmsReceivingBatchStatus;
  notes: string | null;
  labelPrintCount: number;
  firstLabelPrintedAt: string | null;
  lastLabelPrintedAt: string | null;
  receivedAt: string | null;
  completedAt: string | null;
  sourceRequestId: string | null;
  requestTitle: string | null;
  requestType: 'PROCUREMENT' | 'SELF_BUY' | null;
  purchasingStatus: string | null;
  store: {
    id: string;
    name: string;
  };
  warehouse: {
    id: string;
    code: string;
    name: string;
  };
  stagingLocation: {
    id: string;
    code: string;
    name: string;
  } | null;
  lines: Array<{
    id: string;
    lineNo: number;
    requestedProductName: string | null;
    productId: string | null;
    variationId: string | null;
    expectedQuantity: number;
    receivedQuantity: number;
    unitCost: number | null;
    resolvedPosProduct: {
      id: string;
      name: string;
      customId: string | null;
    } | null;
    resolvedProfile: {
      id: string;
      status: string;
      isSerialized: boolean;
    } | null;
    notes: string | null;
  }>;
  units: Array<{
    id: string;
    code: string;
    barcode: string;
    status: string;
    labelPrintCount: number;
    firstLabelPrintedAt: string | null;
    lastLabelPrintedAt: string | null;
    productId: string;
    variationId: string;
    productName: string;
    productCustomId: string | null;
    currentLocation: {
      id: string;
      code: string;
      name: string;
      kind: string;
    } | null;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type WmsReceivingOverviewResponse = {
  tenantReady: boolean;
  summary: {
    receivableBatches: number;
    receivingBatches: number;
    stagedBatches: number;
    stagedUnits: number;
  };
  filters: {
    tenants: Array<{
      id: string;
      label: string;
      slug: string;
      status: string;
    }>;
    stores: Array<{
      id: string;
      label: string;
    }>;
    warehouses: Array<{
      id: string;
      code: string;
      label: string;
    }>;
    activeTenantId: string | null;
    activeStoreId: string | null;
    activeWarehouseId: string | null;
  };
  warehouseOptions: Array<{
    id: string;
    code: string;
    label: string;
    stagingLocations: Array<{
      id: string;
      code: string;
      label: string;
    }>;
  }>;
  receivableBatches: WmsReceivablePurchasingBatch[];
  receivingBatches: WmsReceivingBatchRow[];
};

export type GetWmsReceivingOverviewParams = {
  tenantId?: string;
  storeId?: string;
  warehouseId?: string;
  search?: string;
};

export type CreateWmsReceivingBatchInput = {
  purchasingBatchId?: string;
  storeId?: string;
  warehouseId: string;
  stagingLocationId: string;
  notes?: string;
  lines?: Array<{
    purchasingBatchLineId?: string;
    profileId?: string;
    receiveQuantity: number;
    unitCost?: number;
    notes?: string;
  }>;
};

export type WmsReceivingPutawayOptionsResponse = {
  batch: {
    id: string;
    code: string;
    status: WmsReceivingBatchStatus;
    warehouse: {
      id: string;
      code: string;
      name: string;
    };
    unitCount: number;
  };
  sections: Array<{
    id: string;
    code: string;
    name: string;
    label: string;
    racks: Array<{
      id: string;
      code: string;
      name: string;
      label: string;
      bins: Array<{
      id: string;
      code: string;
      name: string;
      label: string;
      capacity: number | null;
      occupiedUnits: number;
      availableUnits: number | null;
      isFull: boolean;
    }>;
  }>;
  }>;
  units: Array<{
    id: string;
    code: string;
    barcode: string;
    status: string;
    productName: string;
    productCustomId: string | null;
    currentLocation: {
      id: string;
      code: string;
      name: string;
      kind: string;
    } | null;
    defaultSectionId: string | null;
    defaultSectionLabel: string | null;
    currentPlacement: {
      sectionId: string;
      rackId: string | null;
      binId: string | null;
    } | null;
  }>;
};

export type AssignWmsReceivingPutawayInput = {
  assignments: Array<{
    unitId: string;
    sectionId: string;
    rackId: string;
    binId: string;
  }>;
};
