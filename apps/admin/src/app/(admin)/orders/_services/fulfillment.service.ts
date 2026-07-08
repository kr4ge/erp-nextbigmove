import apiClient from '@/lib/api-client';
import type {
  WmsFulfillmentBasketPackCompleteResponse,
  WmsFulfillmentBasketPackPlanResponse,
  WmsFulfillmentBasketPackUnitResponse,
  WmsFulfillmentBasketPackWaybillResponse,
  WmsFulfillmentPackStatus,
  WmsFulfillmentPickStatus,
  WmsFulfillmentPriorityPreviewResponse,
  WmsFulfillmentQueueTask,
  WmsFulfillmentQueueResponse,
} from '../_types/fulfillment';

export async function fetchWmsPickQueue(params: {
  tenantId?: string;
  storeId?: string;
  status?: WmsFulfillmentPickStatus | '';
  search?: string;
  page?: number;
  pageSize?: number;
  ownedOnly?: boolean;
}) {
  const response = await apiClient.get('/wms/mobile/picking/tasks', {
    params: {
      ...(params.tenantId ? { tenantId: params.tenantId } : {}),
      ...(params.storeId ? { storeId: params.storeId } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.search ? { search: params.search } : {}),
      ...(params.page ? { page: params.page } : {}),
      ...(params.pageSize ? { pageSize: params.pageSize } : {}),
      ...(params.ownedOnly ? { ownedOnly: true } : {}),
    },
  });

  return response.data as WmsFulfillmentQueueResponse;
}

export async function resyncWmsPickQueue(params: {
  tenantId?: string;
  storeId?: string;
}) {
  const response = await apiClient.post('/wms/mobile/picking/tasks/resync', {
    ...(params.tenantId ? { tenantId: params.tenantId } : {}),
    ...(params.storeId ? { storeId: params.storeId } : {}),
  });

  return response.data as {
    success: boolean;
    syncedOrders: number;
    tenantId: string | null;
    storeId: string | null;
    storeName: string | null;
    storeCount: number;
  };
}

export async function reallocateWmsPickQueue(params: {
  tenantId?: string;
  storeId?: string;
}) {
  const response = await apiClient.post('/wms/mobile/picking/tasks/reallocate', {
    ...(params.tenantId ? { tenantId: params.tenantId } : {}),
    ...(params.storeId ? { storeId: params.storeId } : {}),
  });

  return response.data as {
    success: boolean;
    checkedOrders: number;
    tenantId: string | null;
    storeId: string | null;
    storeName: string | null;
    storeCount: number;
  };
}

export async function voidWmsPickBasket(params: {
  basketId: string;
  tenantId?: string | null;
}) {
  const response = await apiClient.post(`/wms/mobile/picking/baskets/${params.basketId}/void`, {
    tenantId: params.tenantId,
  });

  return response.data as {
    success: boolean;
    basket: {
      id: string;
      barcode: string;
    };
    releasedOrders: number;
    releasedUnits: number;
    detachedPackedUnits: number;
    detachedPackedOrders: number;
    resetOrders: number;
    canceledOrders: number;
    refreshedScopes: number;
  };
}

export async function fetchWmsFulfillmentPriorityPreview(params: {
  orderId: string;
  tenantId?: string | null;
}) {
  const response = await apiClient.get('/wms/fulfillment/ops/priority-preview', {
    params: {
      orderId: params.orderId,
      ...(params.tenantId ? { tenantId: params.tenantId } : {}),
    },
  });

  return response.data as WmsFulfillmentPriorityPreviewResponse;
}

export async function prioritizeWmsFulfillmentOrder(params: {
  orderId: string;
  donorOrderIds: string[];
  tenantId?: string | null;
  reason?: string | null;
}) {
  const response = await apiClient.post('/wms/fulfillment/ops/prioritize-order', {
    orderId: params.orderId,
    donorOrderIds: params.donorOrderIds,
    tenantId: params.tenantId,
    reason: params.reason,
  });

  return response.data as {
    success: boolean;
    targetOrderId: string;
    targetPosOrderId: string;
    donorOrderIds: string[];
    donorPosOrderIds: string[];
    summary: {
      donorOrders: number;
      targetShortage: number;
      totalSuggestedQty: number;
      canFullyPrioritize: boolean;
      remainingShortage: number;
    };
  };
}

export async function releaseWmsFulfillmentPriority(params: {
  orderId: string;
  tenantId?: string | null;
}) {
  const response = await apiClient.post('/wms/fulfillment/ops/release-priority', {
    orderId: params.orderId,
    tenantId: params.tenantId,
  });

  return response.data as {
    success: boolean;
    targetOrderId: string;
    targetPosOrderId: string;
    clearedTargets: number;
    clearedDonors: number;
  };
}

export async function fetchWmsPackQueue(params: {
  tenantId?: string;
  storeId?: string;
  status?: WmsFulfillmentPackStatus | '';
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const response = await apiClient.get('/wms/mobile/packing/tasks', {
    params: {
      ...(params.tenantId ? { tenantId: params.tenantId } : {}),
      ...(params.storeId ? { storeId: params.storeId } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.search ? { search: params.search } : {}),
      ...(params.page ? { page: params.page } : {}),
      ...(params.pageSize ? { pageSize: params.pageSize } : {}),
    },
  });

  return response.data as WmsFulfillmentQueueResponse;
}

export async function startWmsPackTask(params: {
  taskId: string;
  tenantId?: string | null;
}) {
  const response = await apiClient.post(`/wms/mobile/packing/tasks/${params.taskId}/start`, {
    tenantId: params.tenantId,
  });

  return response.data as {
    success: boolean;
    task: WmsFulfillmentQueueTask;
  };
}

export async function fetchWmsPackBasketPlan(params: {
  basketId: string;
  tenantId?: string | null;
}) {
  const response = await apiClient.get(`/wms/mobile/packing/baskets/${params.basketId}/plan`, {
    params: {
      ...(params.tenantId ? { tenantId: params.tenantId } : {}),
    },
  });

  return response.data as WmsFulfillmentBasketPackPlanResponse;
}

export async function scanWmsPackBasketWaybill(params: {
  basketId: string;
  tenantId?: string | null;
  code: string;
}) {
  const response = await apiClient.post(`/wms/mobile/packing/baskets/${params.basketId}/scan-waybill`, {
    tenantId: params.tenantId,
    code: params.code,
  });

  return response.data as WmsFulfillmentBasketPackWaybillResponse;
}

export async function scanWmsPackBasketOrderUnit(params: {
  basketId: string;
  orderId: string;
  tenantId?: string | null;
  code: string;
}) {
  const response = await apiClient.post(
    `/wms/mobile/packing/baskets/${params.basketId}/orders/${params.orderId}/scan-unit`,
    {
      tenantId: params.tenantId,
      code: params.code,
    },
  );

  return response.data as WmsFulfillmentBasketPackUnitResponse;
}

export async function completeWmsPackBasketOrder(params: {
  basketId: string;
  orderId: string;
  tenantId?: string | null;
}) {
  const response = await apiClient.post(
    `/wms/mobile/packing/baskets/${params.basketId}/orders/${params.orderId}/complete`,
    {
      tenantId: params.tenantId,
    },
  );

  return response.data as WmsFulfillmentBasketPackCompleteResponse;
}

export async function scanWmsPackUnit(params: {
  taskId: string;
  tenantId?: string | null;
  code: string;
}) {
  const response = await apiClient.post(`/wms/mobile/packing/tasks/${params.taskId}/scan-unit`, {
    tenantId: params.tenantId,
    code: params.code,
  });

  return response.data as {
    success: boolean;
    task: WmsFulfillmentQueueTask;
  };
}

export async function verifyWmsPackTracking(params: {
  taskId: string;
  tenantId?: string | null;
  code: string;
}) {
  const response = await apiClient.post(`/wms/mobile/packing/tasks/${params.taskId}/verify-tracking`, {
    tenantId: params.tenantId,
    code: params.code,
  });

  return response.data as {
    success: boolean;
    tracking: string;
    task: WmsFulfillmentQueueTask;
  };
}

export async function completeWmsPackTask(params: {
  taskId: string;
  tenantId?: string | null;
  trackingCode: string;
}) {
  const response = await apiClient.post(`/wms/mobile/packing/tasks/${params.taskId}/complete`, {
    tenantId: params.tenantId,
    trackingCode: params.trackingCode,
  });

  return response.data as {
    success: boolean;
    task: WmsFulfillmentQueueTask;
  };
}

export async function voidWmsPackTask(params: {
  taskId: string;
  tenantId?: string | null;
  reason: string;
  supervisorIdentifier?: string | null;
  supervisorPassword?: string | null;
}) {
  const response = await apiClient.post(`/wms/mobile/packing/tasks/${params.taskId}/void`, {
    tenantId: params.tenantId,
    reason: params.reason,
    supervisorIdentifier: params.supervisorIdentifier,
    supervisorPassword: params.supervisorPassword,
  });

  return response.data as {
    success: boolean;
    task: WmsFulfillmentQueueTask;
  };
}

export async function voidWmsPackBasketOrders(params: {
  basketId: string;
  tenantId?: string | null;
  orderIds: string[];
  reason: string;
  supervisorIdentifier?: string | null;
  supervisorPassword?: string | null;
}) {
  const response = await apiClient.post(`/wms/mobile/packing/baskets/${params.basketId}/void-orders`, {
    tenantId: params.tenantId,
    orderIds: params.orderIds,
    reason: params.reason,
    supervisorIdentifier: params.supervisorIdentifier,
    supervisorPassword: params.supervisorPassword,
  });

  return response.data as {
    success: boolean;
    activeOrderId: string | null;
    activeOrder: WmsFulfillmentQueueTask | null;
    voidedOrderIds: string[];
    basket: WmsFulfillmentBasketPackPlanResponse['basket'];
    tasks: WmsFulfillmentQueueTask[];
    plan: WmsFulfillmentBasketPackPlanResponse['plan'];
  };
}
