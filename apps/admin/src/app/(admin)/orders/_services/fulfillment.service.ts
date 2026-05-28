import apiClient from '@/lib/api-client';
import type {
  WmsFulfillmentPackStatus,
  WmsFulfillmentPickStatus,
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
