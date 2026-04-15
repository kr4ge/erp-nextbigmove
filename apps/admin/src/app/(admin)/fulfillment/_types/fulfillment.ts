export type WmsFulfillmentView = "PICKING" | "PACKING" | "DISPATCH";

export type WmsFulfillmentOrderStatus =
  | "PENDING"
  | "WAITING_FOR_STOCK"
  | "PICKING"
  | "PICKED"
  | "PACKING_PENDING"
  | "PACKING_ASSIGNED"
  | "PACKING"
  | "PACKED"
  | "DISPATCHED"
  | "HOLD"
  | "CANCELED";

export type WmsPackingStationStatus = "ACTIVE" | "INACTIVE";

export type WmsFulfillmentScanStage = "PICKING" | "PACKING" | "DISPATCH";

export type WmsFulfillmentScanResult = "ACCEPTED" | "REJECTED";

export type WmsFulfillmentOperator = {
  id: string;
  name: string | null;
  email: string;
  roleName: string | null;
};

export type WmsFulfillmentStationOperator = {
  id: string;
  name: string | null;
  email: string;
};

export type WmsPackingStation = {
  id: string;
  code: string;
  name: string;
  status: WmsPackingStationStatus;
  notes: string | null;
  warehouse: {
    id: string;
    code: string;
    name: string;
  };
  activeOrders: number;
  assignedUsers: WmsFulfillmentStationOperator[];
};

export type CreateWmsPackingStationInput = {
  warehouseId: string;
  code: string;
  name: string;
  status?: WmsPackingStationStatus;
  notes?: string;
  assignedUserIds?: string[];
};

export type UpdateWmsPackingStationInput = Partial<CreateWmsPackingStationInput>;

export type ListWmsFulfillmentOrdersParams = {
  view: WmsFulfillmentView;
  tenantId?: string;
  storeId?: string;
  warehouseId?: string;
  status?: WmsFulfillmentOrderStatus;
  search?: string;
  limit?: number;
};

export type WmsFulfillmentAssignedUnit = {
  id: string;
  pickedAt: string | null;
  packedAt: string | null;
  unit: {
    id: string;
    serialNo: string;
    batchSequence: number;
    unitBarcode: string;
    sku: string;
    productName: string;
    variationName: string | null;
    status: string;
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
    };
  };
};

export type WmsFulfillmentOrderItem = {
  id: string;
  lineNo: number;
  sourceProductId: string | null;
  variationId: string | null;
  productName: string;
  variationName: string | null;
  displayCode: string | null;
  quantity: number;
  pickedQuantity: number;
  packedQuantity: number;
  remainingToPick: number;
  remainingToPack: number;
  availableUnits: number;
  shortageQuantity: number;
  assignedUnits: WmsFulfillmentAssignedUnit[];
};

export type WmsFulfillmentScanLog = {
  id: string;
  stage: WmsFulfillmentScanStage;
  result: WmsFulfillmentScanResult;
  action: string;
  scannedValue: string;
  message: string | null;
  createdAt: string;
  actorUser: {
    id: string;
    name: string | null;
    email: string;
  } | null;
};

export type WmsFulfillmentOrder = {
  id: string;
  fulfillmentCode: string;
  status: WmsFulfillmentOrderStatus;
  trackingNumber: string;
  posStatus: number | null;
  posStatusName: string | null;
  orderDateLocal: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  totalLines: number;
  totalQuantity: number;
  pickedAt: string | null;
  packedAt: string | null;
  dispatchedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  tenant: {
    id: string;
    name: string;
    slug: string;
  } | null;
  store: {
    id: string;
    name: string;
    shopId: string;
    shopName: string | null;
  } | null;
  warehouse: {
    id: string;
    code: string;
    name: string;
  } | null;
  pickerUser: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  packerUser: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  packingStation: WmsPackingStation | null;
  progress: {
    picked: number;
    packed: number;
    required: number;
  };
  shortageQuantity: number;
  items: WmsFulfillmentOrderItem[];
  scans: WmsFulfillmentScanLog[];
};
