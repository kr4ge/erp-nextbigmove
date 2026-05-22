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
    status: 'PACKED' | 'SHIPPED' | 'DELIVERED' | null;
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

export type WmsMobilePickingPackerOption = {
  id: string;
  name: string;
  email: string;
  employeeId: string | null;
};

export type WmsMobileHeldBasket = WmsMobilePickBasket & {
  task: WmsMobilePickingTask | null;
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

export type WmsMobileBasketLookupResponse = {
  found: boolean;
  basket: (WmsMobilePickBasket & {
    task: WmsMobilePickingTask | null;
  }) | null;
};
