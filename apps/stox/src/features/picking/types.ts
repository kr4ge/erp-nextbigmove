export type PickingFilters = {
  tenantId: string | null;
  storeId: string | null;
};

export type PickingStatus =
  | 'READY'
  | 'PARTIAL'
  | 'RESTOCKING'
  | 'ISSUE'
  | 'IN_PICKING'
  | 'READY_FOR_PACK'
  | 'PICKED'
  | 'PACKING'
  | 'PACKED'
  | 'CANCELED';

export type PickingAssignmentMode =
  | 'SERIAL_RESERVED'
  | 'BASKET_DEMAND';

export type WmsMobilePickingResponse = {
  tenantReady: boolean;
  serverTime: string;
  pagination: {
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
    stores: Array<{
      id: string;
      tenantId?: string | null;
      name: string;
      tenantName?: string | null;
      tenantSlug?: string | null;
    }>;
    packerOptions: WmsMobilePickingPackerOption[];
  };
  summary: {
    ready: number;
    partial: number;
    restocking: number;
    issue: number;
    inPicking: number;
    readyForPack: number;
    picked: number;
  };
  picker: {
    registeredBaskets: number;
    activeLoad: number;
    availableSlots: number;
    heldBaskets: number;
    fullHeldBaskets: number;
  };
  availableBaskets: WmsMobilePickBasket[];
  heldBaskets: WmsMobileHeldBasket[];
  pickedHistory: WmsMobilePickingTask[];
  tasks: WmsMobilePickingTask[];
};

export type WmsMobilePickingTask = {
  id: string;
  posOrderId: string;
  shopId: string;
  status: PickingStatus;
  assignmentMode: PickingAssignmentMode;
  statusLabel: string;
  issueReason: string | null;
  customer: {
    name: string | null;
    phone: string | null;
  };
  totals: {
    required: number;
    allocated: number;
    picked: number;
    packed: number;
    remaining: number;
  };
  store: {
    id: string;
    tenantId: string;
    name: string;
    tenantName: string | null;
  } | null;
  warehouse: {
    id: string;
    code: string;
    name: string;
  } | null;
  claimedBy: {
    name: string;
    email: string;
  } | null;
  packedBy: {
    name: string;
    email: string;
  } | null;
  claimedAt: string | null;
  completedAt: string | null;
  orderDate: string;
  orderDateLocal: string | null;
  tracking: string | null;
  delivery: {
    posStatus: number | null;
    status: 'PACKED' | 'SHIPPED' | 'DELIVERED' | 'RETURNING' | 'RETURNED' | null;
    label: string | null;
    deliveredAt: string | null;
  } | null;
  createdAt: string;
  basket: WmsMobilePickBasket | null;
  lines: WmsMobilePickingLine[];
  nextPick: WmsMobilePickReservation | null;
};

export type WmsMobilePickBasket = {
  id: string;
  barcode: string;
  status: string;
  statusLabel: string;
  maxFulfillmentOrders: number;
  activeFulfillmentOrders: number;
  orders: WmsMobileBasketOrder[];
  warehouse: {
    id: string;
    code: string;
    name: string;
  } | null;
  assignedPicker: {
    name: string;
    email: string;
  } | null;
  assignedPacker: {
    name: string;
    email: string;
  } | null;
  claimedAt: string | null;
  fullAt: string | null;
  readyForPackAt: string | null;
};

export type WmsMobileBasketOrder = {
  id: string;
  posOrderId: string | null;
  tracking: string | null;
  status: PickingStatus | null;
  statusLabel: string | null;
  customerName: string | null;
  totals: {
    required: number;
    picked: number;
  };
  store: {
    id: string;
    tenantId: string | null;
    name: string;
    tenantName: string | null;
  } | null;
};

export type WmsMobilePickingPackerOption = {
  id: string;
  name: string;
  email: string;
  employeeId: string | null;
};

export type WmsMobileHeldBasket = WmsMobilePickBasket & {
  task: WmsMobilePickingTask | null;
  tasks: WmsMobilePickingTask[];
};

export type WmsMobilePickingLine = {
  id: string;
  variationId: string;
  productId: string | null;
  productName: string;
  productDisplayId: string | null;
  status: string;
  statusLabel: string;
  issueReason: string | null;
  required: number;
  allocated: number;
  picked: number;
  packed: number;
  shortage: number;
  reservations: WmsMobilePickReservation[];
};

export type WmsMobilePickReservation = {
  id: string;
  status: string;
  statusLabel: string;
  sequence: number;
  lineId: string;
  unit: {
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
    currentLocation: {
      id: string;
      code: string;
      name: string;
      kind: string;
      label: string;
    } | null;
  };
  pickedAt: string | null;
};

export type WmsMobilePickingBinScanResult = {
  success: boolean;
  bin: {
    id: string;
    code: string;
    name: string;
    kind: string;
    warehouse: {
      id: string;
      code: string;
      name: string;
    };
  };
  pendingUnits: WmsMobilePickReservation[];
};

export type WmsMobileBasketPickUnit = {
  id: string;
  mode: PickingAssignmentMode;
  displayCode: string;
  displayLabel: string;
  remainingUnits: number;
  pickedUnits: number;
  requiredUnits: number;
  reservation: WmsMobilePickReservation | null;
  order: {
    id: string;
    posOrderId: string;
    storeName: string | null;
    tenantName: string | null;
  };
  line: {
    id: string;
    productName: string;
    productDisplayId: string | null;
    variationId: string;
  };
};

export type WmsMobileBasketPickPlan = {
  basketId: string;
  basketCode: string;
  mode: PickingAssignmentMode;
  status: string;
  statusLabel: string;
  totalOrders: number;
  totalRequiredUnits: number;
  totalPickedUnits: number;
  totalPendingUnits: number;
  totalPickedReservations: number;
  unbinnedPendingUnits: number;
  currentBin: WmsMobilePickReservation['unit']['currentLocation'];
  bins: Array<{
    bin: NonNullable<WmsMobilePickReservation['unit']['currentLocation']>;
    pendingUnits: number;
    pickedUnits: number;
    requiredUnits: number;
    orderCount: number;
    orders: Array<{
      id: string;
      posOrderId: string;
      storeName: string | null;
      tenantName: string | null;
      pendingUnits: number;
    }>;
    units: WmsMobileBasketPickUnit[];
  }>;
};

export type WmsMobileBasketPickPlanResponse = {
  success: boolean;
  basket: WmsMobilePickBasket;
  tasks: WmsMobilePickingTask[];
  plan: WmsMobileBasketPickPlan;
};

export type WmsMobileBasketBinScanResult = {
  success: boolean;
  bin: WmsMobilePickingBinScanResult['bin'];
  pendingUnits: WmsMobileBasketPickUnit[];
  units: WmsMobileBasketPickUnit[];
  plan: WmsMobileBasketPickPlan;
};

export type WmsMobileBasketUnitScanResult = {
  success: boolean;
  basket: WmsMobilePickBasket;
  task: WmsMobilePickingTask | null;
  tasks: WmsMobilePickingTask[];
  pickedUnit: WmsMobileBasketPickUnit;
  plan: WmsMobileBasketPickPlan;
};

export type WmsMobileBasketLookupResponse = {
  found: boolean;
  basket: (WmsMobilePickBasket & {
    task: WmsMobilePickingTask | null;
    tasks: WmsMobilePickingTask[];
  }) | null;
};

export type WmsMobilePickingBatchAssignResponse = {
  success: boolean;
  assignedCount: number;
  basket: WmsMobilePickBasket;
  tasks: WmsMobilePickingTask[];
};

export type WmsMobilePickingHandoffResponse = {
  success: boolean;
  task: WmsMobilePickingTask;
  posStatusUpdate?: {
    targetStatus: number;
    queued: number;
    skipped: number;
    failed: number;
    results: Array<{
      posOrderId: string;
      outcome: 'queued' | 'skipped' | 'failed';
      reason: string;
      currentStatus?: number | null;
    }>;
  };
};
