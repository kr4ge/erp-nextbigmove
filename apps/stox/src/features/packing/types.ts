import type {
  PickingAssignmentMode,
  WmsMobilePickBasket,
  WmsMobilePickingTask,
} from '@/src/features/picking/types';

export type PackingFilters = {
  tenantId: string | null;
  storeId: string | null;
};

export type PackingStatusFilter =
  | 'PICKED'
  | 'PACKING'
  | 'AWAITING_TRACKING'
  | 'PACKED';

export type WmsMobilePackingResponse = {
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
  };
  summary: {
    held: number;
    packing: number;
    awaitingTracking: number;
  };
  tasks: WmsMobilePickingTask[];
};

export type WmsMobileBasketPackPlanLine = {
  id: string;
  variationId: string;
  productId: string | null;
  productName: string;
  productDisplayId: string | null;
  required: number;
  packed: number;
  remaining: number;
  availableInBasket: number;
};

export type WmsMobileBasketPackPlanOrder = {
  id: string;
  posOrderId: string;
  status: string;
  statusLabel: string;
  customerName: string | null;
  tracking: string | null;
  trackingReady: boolean;
  totals: {
    required: number;
    packed: number;
    remaining: number;
  };
  lines: WmsMobileBasketPackPlanLine[];
};

export type WmsMobileBasketPackPlan = {
  basketId: string;
  basketCode: string;
  mode: PickingAssignmentMode;
  status: string;
  statusLabel: string;
  totals: {
    required: number;
    packed: number;
    remaining: number;
  };
  orderProgress: {
    total: number;
    packed: number;
    remaining: number;
  };
  availableUnits: Array<{
    variationId: string;
    productId: string | null;
    productName: string;
    productDisplayId: string | null;
    unitCount: number;
  }>;
  orders: WmsMobileBasketPackPlanOrder[];
  activeOrder: WmsMobileBasketPackPlanOrder | null;
};

export type WmsMobileBasketPackPlanResponse = {
  success: boolean;
  basket: WmsMobilePickBasket;
  tasks: WmsMobilePickingTask[];
  plan: WmsMobileBasketPackPlan;
};

export type WmsMobileBasketPackWaybillResponse = WmsMobileBasketPackPlanResponse & {
  tracking: string;
  activeOrderId: string;
  activeOrder: WmsMobilePickingTask;
};

export type WmsMobileBasketPackUnitResponse = WmsMobileBasketPackPlanResponse & {
  activeOrderId: string | null;
  activeOrder: WmsMobilePickingTask | null;
  completedOrder: WmsMobilePickingTask | null;
};
