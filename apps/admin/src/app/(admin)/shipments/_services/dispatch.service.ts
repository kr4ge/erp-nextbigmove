import apiClient from '@/lib/api-client';
import type {
  WmsDispatchOutboundResponse,
  WmsDispatchOutboundTaskResponse,
  WmsDispatchReconcileResponse,
  WmsDispatchReportsResponse,
  WmsDispatchReturnTaskResponse,
  WmsDispatchReturnsResponse,
  WmsDispatchSummaryResponse,
} from '../_types/dispatch';

type DispatchListParams = {
  tenantId?: string;
  storeId?: string;
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
};

export async function fetchWmsDispatchSummary(params: {
  tenantId?: string;
  storeId?: string;
}) {
  const response = await apiClient.get('/wms/dispatch/summary', {
    params: {
      ...(params.tenantId ? { tenantId: params.tenantId } : {}),
      ...(params.storeId ? { storeId: params.storeId } : {}),
    },
  });

  return response.data as WmsDispatchSummaryResponse;
}

export async function fetchWmsDispatchOutbound(params: DispatchListParams) {
  const response = await apiClient.get('/wms/dispatch/outbound', {
    params: {
      ...(params.tenantId ? { tenantId: params.tenantId } : {}),
      ...(params.storeId ? { storeId: params.storeId } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.search ? { search: params.search } : {}),
      ...(params.page ? { page: params.page } : {}),
      ...(params.pageSize ? { pageSize: params.pageSize } : {}),
    },
  });

  return response.data as WmsDispatchOutboundResponse;
}

export async function fetchWmsDispatchOutboundTask(params: {
  taskId: string;
  tenantId?: string;
  storeId?: string;
}) {
  const response = await apiClient.get(`/wms/dispatch/outbound/${params.taskId}`, {
    params: {
      ...(params.tenantId ? { tenantId: params.tenantId } : {}),
      ...(params.storeId ? { storeId: params.storeId } : {}),
    },
  });

  return response.data as WmsDispatchOutboundTaskResponse;
}

export async function fetchWmsDispatchReports(params: {
  tenantId?: string;
  storeId?: string;
  days?: number;
}) {
  const response = await apiClient.get('/wms/dispatch/reports', {
    params: {
      ...(params.tenantId ? { tenantId: params.tenantId } : {}),
      ...(params.storeId ? { storeId: params.storeId } : {}),
      ...(params.days ? { days: params.days } : {}),
    },
  });

  return response.data as WmsDispatchReportsResponse;
}

export async function fetchWmsDispatchReturns(params: DispatchListParams) {
  const response = await apiClient.get('/wms/dispatch/returns', {
    params: {
      ...(params.tenantId ? { tenantId: params.tenantId } : {}),
      ...(params.storeId ? { storeId: params.storeId } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.search ? { search: params.search } : {}),
      ...(params.page ? { page: params.page } : {}),
      ...(params.pageSize ? { pageSize: params.pageSize } : {}),
    },
  });

  return response.data as WmsDispatchReturnsResponse;
}

export async function fetchWmsDispatchReturnTask(params: {
  taskId: string;
  tenantId?: string;
  storeId?: string;
}) {
  const response = await apiClient.get(`/wms/dispatch/returns/${params.taskId}`, {
    params: {
      ...(params.tenantId ? { tenantId: params.tenantId } : {}),
      ...(params.storeId ? { storeId: params.storeId } : {}),
    },
  });

  return response.data as WmsDispatchReturnTaskResponse;
}

export async function reconcileWmsDispatchOutbound(params: {
  tenantId?: string;
  storeId?: string;
  taskIds?: string[];
}) {
  const response = await apiClient.post('/wms/dispatch/outbound/reconcile', {
    ...(params.tenantId ? { tenantId: params.tenantId } : {}),
    ...(params.storeId ? { storeId: params.storeId } : {}),
    ...(params.taskIds && params.taskIds.length > 0 ? { taskIds: params.taskIds } : {}),
  });

  return response.data as WmsDispatchReconcileResponse;
}
