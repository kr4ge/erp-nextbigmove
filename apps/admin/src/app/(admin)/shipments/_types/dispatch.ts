export type WmsDispatchTab = 'outbound' | 'returns' | 'reports';
export type WmsDispatchOutboundStatusFilter = '' | 'PACKED' | 'SHIPPED' | 'DELIVERED';
export type WmsDispatchReturnStatusFilter =
  | ''
  | 'RETURNING'
  | 'RETURNED'
  | 'READY_TO_VERIFY'
  | 'AWAITING_PLACEMENT'
  | 'PARTIAL'
  | 'VERIFIED';

export type WmsDispatchSummaryResponse = {
  serverTime: string;
  context: {
    activeTenantId: string | null;
    activeStoreId: string | null;
    tenantOptions: Array<{
      id: string;
      name: string;
      slug: string;
      status: string | null;
    }>;
    stores: Array<{
      id: string;
      tenantId: string | null;
      name: string;
      tenantName: string | null;
      tenantSlug: string | null;
    }>;
  };
  summary: {
    orders: {
      packed: number;
      shipped: number;
      delivered: number;
      returning: number;
      returned: number;
    };
    units: {
      packed: number;
      dispatched: number;
      rts: number;
    };
  };
};

export type WmsDispatchTaskListItem = {
  id: string;
  posOrderId: string;
  status: string;
  statusLabel: string;
  customer: {
    name: string | null;
  };
  totals: {
    required: number;
    packed: number;
  };
  store: {
    id: string;
    tenantId: string;
    name: string;
    tenantName: string | null;
    tenantSlug: string | null;
  } | null;
  orderDate: string;
  orderDateLocal: string | null;
  tracking: string | null;
  delivery: {
    posStatus: number | null;
    status: 'PACKED' | 'SHIPPED' | 'DELIVERED' | 'RETURNING' | 'RETURNED';
    label: string | null;
    deliveredAt: string | null;
    rtsAt: string | null;
  } | null;
};

export type WmsDispatchTask = {
  id: string;
  posOrderId: string;
  shopId: string;
  status: string;
  assignmentMode: 'SERIAL_RESERVED' | 'BASKET_DEMAND';
  statusLabel: string;
  issueReason: string | null;
  customer: {
    name: string | null;
    phone: string | null;
  };
  totals: {
    required: number;
    picked: number;
    packed: number;
    remaining: number;
  };
  store: {
    id: string;
    tenantId: string;
    name: string;
    tenantName: string | null;
    tenantSlug: string | null;
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
    status: 'PACKED' | 'SHIPPED' | 'DELIVERED' | 'RETURNING' | 'RETURNED';
    label: string | null;
    deliveredAt: string | null;
    rtsAt: string | null;
  } | null;
  createdAt: string;
  basket: {
    id: string;
    barcode: string;
    status: string;
    statusLabel: string;
    maxFulfillmentOrders: number;
    currentFulfillmentOrders: number;
    claimedAt: string | null;
    fullAt: string | null;
    readyForPackAt: string | null;
    assignedPicker: {
      name: string;
      email: string;
    } | null;
    assignedPacker: {
      name: string;
      email: string;
    } | null;
    warehouse: {
      id: string;
      code: string;
      name: string;
    } | null;
  } | null;
  unitRecords: Array<{
    id: string;
    code: string;
    barcode: string;
    status: string;
    statusLabel: string;
    name: string;
    customId: string | null;
    pickedAt: string | null;
    packedAt: string | null;
    pickedBy: {
      name: string;
      email: string;
    } | null;
    packedBy: {
      name: string;
      email: string;
    } | null;
  }>;
  lines: Array<{
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
  }>;
};

export type WmsDispatchReturnUnit = {
  id: string;
  code: string;
  barcode: string;
  status: string;
  statusLabel: string;
  name: string;
  customId: string | null;
  currentLocation: {
    id: string;
    code: string;
    name: string;
  } | null;
};

export type WmsDispatchReturnFlow = {
  eligible: boolean;
  posStatus: number | null;
  posStatusLabel: string | null;
  state: 'NONE' | 'RETURNING' | 'READY_TO_VERIFY' | 'PARTIAL' | 'VERIFIED' | 'AWAITING_PLACEMENT';
  label: string | null;
  canVerify: boolean;
  expectedUnits: number;
  awaitingPlacementUnits: number;
  placedUnits: number;
  verifiedUnits: WmsDispatchReturnUnit[];
  pendingUnits: WmsDispatchReturnUnit[];
  lastActionAt: string | null;
  lastActionBy: {
    name: string;
    email: string;
  } | null;
  history: Array<{
    id: string;
    actionType: string;
    label: string;
    detail: string | null;
    createdAt: string;
    actor: {
      name: string;
      email: string;
    } | null;
  }>;
  lastVerifiedAt: string | null;
  lastVerifiedBy: {
    name: string;
    email: string;
  } | null;
};

export type WmsDispatchReturnTask = {
  task: WmsDispatchTask;
  returnFlow: WmsDispatchReturnFlow;
};

export type WmsDispatchReturnListItem = {
  task: WmsDispatchTaskListItem;
  returnSummary: {
    posStatus: number | null;
    posStatusLabel: string | null;
    state: 'NONE' | 'RETURNING' | 'READY_TO_VERIFY' | 'PARTIAL' | 'VERIFIED' | 'AWAITING_PLACEMENT';
    label: string | null;
    expectedUnits: number;
    verifiedUnits: number;
    pendingUnits: number;
    awaitingPlacementUnits: number;
    placedUnits: number;
  };
};

export type WmsDispatchOutboundResponse = {
  tenantReady: boolean;
  serverTime: string;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
  context: {
    activeTenantId: string | null;
    activeStoreId: string | null;
  };
  tasks: WmsDispatchTaskListItem[];
};

export type WmsDispatchReturnsResponse = {
  tenantReady: boolean;
  serverTime: string;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
  context: {
    activeTenantId: string | null;
    activeStoreId: string | null;
  };
  tasks: WmsDispatchReturnListItem[];
};

export type WmsDispatchOutboundTaskResponse = {
  tenantReady: boolean;
  serverTime: string;
  task: WmsDispatchTask;
};

export type WmsDispatchReturnTaskResponse = {
  tenantReady: boolean;
  serverTime: string;
  task: WmsDispatchReturnTask;
};

export type WmsDispatchReconcileResponse = {
  reconciledAt: string;
  scope: {
    tenantId: string;
    storeId: string | null;
    targetedOrders: number;
  };
  result: {
    dispatchedUnits: number;
    deliveredOrders: number;
    cogsUpdatedOrders: number;
  };
};

export type WmsDispatchReportsResponse = {
  serverTime: string;
  context: WmsDispatchSummaryResponse['context'];
  window: {
    days: number;
    startDate: string | null;
    endDate: string | null;
  };
  trend: Array<{
    date: string;
    packedOrders: number;
    shippedOrders: number;
    deliveredOrders: number;
    returnedOrders: number;
  }>;
  stores: Array<{
    storeId: string;
    tenantId: string | null;
    storeName: string;
    tenantName: string | null;
    packedOrders: number;
    shippedOrders: number;
    deliveredOrders: number;
    returningOrders: number;
    returnedOrders: number;
    dispatchedUnits: number;
    rtsUnits: number;
  }>;
  recentActivity: Array<{
    id: string;
    actionType: string;
    label: string;
    detail: string | null;
    createdAt: string;
    storeName: string | null;
    tenantName: string | null;
    actor: {
      name: string;
      email: string;
    } | null;
  }>;
};
