import type { DeviceIdentity } from '@/src/features/auth/types';
import { apiRequest } from '@/src/shared/services/http';
import type {
  WmsMobileBasketPackCompleteResponse,
  PackingFilters,
  PackingStatusFilter,
  WmsMobileBasketPackPlanResponse,
  WmsMobileBasketPackUnitResponse,
  WmsMobileBasketPackWaybillResponse,
  WmsMobilePackingResponse,
} from '../types';
import type { WmsMobilePickingTask } from '@/src/features/picking/types';

type PackingRequestParams = {
  accessToken: string;
  device: DeviceIdentity;
};

export function fetchMobilePackingTasks(params: PackingRequestParams & {
  filters: PackingFilters;
  status?: PackingStatusFilter | null;
  page?: number;
  pageSize?: number;
}) {
  return apiRequest<WmsMobilePackingResponse>(buildPackingPath(params), {
    method: 'GET',
    token: params.accessToken,
    device: params.device,
  });
}

export function startMobilePackingTask(params: PackingRequestParams & {
  taskId: string;
  tenantId?: string | null;
}) {
  return apiRequest<{ success: boolean; task: WmsMobilePickingTask }>(
    `/wms/mobile/packing/tasks/${params.taskId}/start`,
    {
      method: 'POST',
      token: params.accessToken,
      device: params.device,
      body: {
        tenantId: params.tenantId,
      },
    },
  );
}

export function scanMobilePackingUnit(params: PackingRequestParams & {
  taskId: string;
  tenantId?: string | null;
  code: string;
}) {
  return apiRequest<{ success: boolean; task: WmsMobilePickingTask }>(
    `/wms/mobile/packing/tasks/${params.taskId}/scan-unit`,
    {
      method: 'POST',
      token: params.accessToken,
      device: params.device,
      body: {
        tenantId: params.tenantId,
        code: params.code,
      },
    },
  );
}

export function verifyMobilePackingTracking(params: PackingRequestParams & {
  taskId: string;
  tenantId?: string | null;
  code: string;
}) {
  return apiRequest<{ success: boolean; tracking: string; task: WmsMobilePickingTask }>(
    `/wms/mobile/packing/tasks/${params.taskId}/verify-tracking`,
    {
      method: 'POST',
      token: params.accessToken,
      device: params.device,
      body: {
        tenantId: params.tenantId,
        code: params.code,
      },
    },
  );
}

export function completeMobilePackingTask(params: PackingRequestParams & {
  taskId: string;
  tenantId?: string | null;
  trackingCode: string;
}) {
  return apiRequest<{ success: boolean; task: WmsMobilePickingTask }>(
    `/wms/mobile/packing/tasks/${params.taskId}/complete`,
    {
      method: 'POST',
      token: params.accessToken,
      device: params.device,
      body: {
        tenantId: params.tenantId,
        trackingCode: params.trackingCode,
      },
    },
  );
}

export function voidMobilePackingTask(params: PackingRequestParams & {
  taskId: string;
  tenantId?: string | null;
  reason: string;
  supervisorIdentifier?: string | null;
  supervisorPassword?: string | null;
}) {
  return apiRequest<{ success: boolean; task: WmsMobilePickingTask }>(
    `/wms/mobile/packing/tasks/${params.taskId}/void`,
    {
      method: 'POST',
      token: params.accessToken,
      device: params.device,
      body: {
        tenantId: params.tenantId,
        reason: params.reason,
        supervisorIdentifier: params.supervisorIdentifier,
        supervisorPassword: params.supervisorPassword,
      },
    },
  );
}

export function fetchMobilePackingBasketPlan(params: PackingRequestParams & {
  basketId: string;
  tenantId?: string | null;
}) {
  const query = params.tenantId ? `?tenantId=${encodeURIComponent(params.tenantId)}` : '';
  return apiRequest<WmsMobileBasketPackPlanResponse>(
    `/wms/mobile/packing/baskets/${params.basketId}/plan${query}`,
    {
      method: 'GET',
      token: params.accessToken,
      device: params.device,
    },
  );
}

export function scanMobilePackingBasketWaybill(params: PackingRequestParams & {
  basketId: string;
  tenantId?: string | null;
  code: string;
}) {
  return apiRequest<WmsMobileBasketPackWaybillResponse>(
    `/wms/mobile/packing/baskets/${params.basketId}/scan-waybill`,
    {
      method: 'POST',
      token: params.accessToken,
      device: params.device,
      body: {
        tenantId: params.tenantId,
        code: params.code,
      },
    },
  );
}

export function scanMobilePackingBasketOrderUnit(params: PackingRequestParams & {
  basketId: string;
  orderId: string;
  tenantId?: string | null;
  code: string;
}) {
  return apiRequest<WmsMobileBasketPackUnitResponse>(
    `/wms/mobile/packing/baskets/${params.basketId}/orders/${params.orderId}/scan-unit`,
    {
      method: 'POST',
      token: params.accessToken,
      device: params.device,
      body: {
        tenantId: params.tenantId,
        code: params.code,
      },
    },
  );
}

export function completeMobilePackingBasketOrder(params: PackingRequestParams & {
  basketId: string;
  orderId: string;
  tenantId?: string | null;
}) {
  return apiRequest<WmsMobileBasketPackCompleteResponse>(
    `/wms/mobile/packing/baskets/${params.basketId}/orders/${params.orderId}/complete`,
    {
      method: 'POST',
      token: params.accessToken,
      device: params.device,
      body: {
        tenantId: params.tenantId,
      },
    },
  );
}

function buildPackingPath(params: {
  filters: PackingFilters;
  status?: PackingStatusFilter | null;
  page?: number;
  pageSize?: number;
}) {
  const query: string[] = [];

  if (params.filters.tenantId) {
    query.push(`tenantId=${encodeURIComponent(params.filters.tenantId)}`);
  }

  if (params.filters.storeId) {
    query.push(`storeId=${encodeURIComponent(params.filters.storeId)}`);
  }

  if (params.status) {
    query.push(`status=${encodeURIComponent(params.status)}`);
  }

  if (params.page) {
    query.push(`page=${encodeURIComponent(String(params.page))}`);
  }

  if (params.pageSize) {
    query.push(`pageSize=${encodeURIComponent(String(params.pageSize))}`);
  }

  return `/wms/mobile/packing/tasks${query.length ? `?${query.join('&')}` : ''}`;
}
