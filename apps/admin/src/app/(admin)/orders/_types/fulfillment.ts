export type WmsTaskAssignmentType = 'PICK' | 'PACK' | 'INVENTORY' | null;

export type WmsFulfillmentQueueMode = 'pick' | 'pack';

export type WmsFulfillmentQueueScope = 'all' | 'own';

export type WmsFulfillmentPickStatus =
  | 'READY'
  | 'PARTIAL'
  | 'RESTOCKING'
  | 'ISSUE'
  | 'IN_PICKING'
  | 'READY_FOR_PACK'
  | 'PICKED';

export type WmsFulfillmentPackStatus =
  | 'PICKED'
  | 'PACKING'
  | 'AWAITING_TRACKING'
  | 'PACKED';

export type WmsFulfillmentQueueTask = {
  id: string;
  posOrderId: string;
  shopId: string;
  status: string;
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
  basket: {
    id: string;
    barcode: string;
    status: string;
    statusLabel: string;
    maxFulfillmentOrders: number;
    activeFulfillmentOrders: number;
    orders: Array<{
      id: string;
      posOrderId: string | null;
      status: string | null;
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
    }>;
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
  } | null;
  lines: WmsFulfillmentQueueLine[];
  nextPick: WmsFulfillmentQueueReservation | null;
};

export type WmsFulfillmentHeldBasket = NonNullable<WmsFulfillmentQueueTask['basket']> & {
  task: WmsFulfillmentQueueTask | null;
  tasks: WmsFulfillmentQueueTask[];
};

export type WmsFulfillmentQueueLine = {
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
  reservations: WmsFulfillmentQueueReservation[];
};

export type WmsFulfillmentQueueReservation = {
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

export type WmsFulfillmentQueueResponse = {
  tenantReady: boolean;
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
    canViewAllQueue?: boolean;
    taskAssignment?: WmsTaskAssignmentType;
    stores: Array<{
      id: string;
      tenantId?: string | null;
      name: string;
      tenantName?: string | null;
      tenantSlug?: string | null;
    }>;
  };
  summary: Record<string, number>;
  heldBaskets?: WmsFulfillmentHeldBasket[];
  tasks: WmsFulfillmentQueueTask[];
};
