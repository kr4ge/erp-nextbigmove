import type { DeviceIdentity } from '@/src/features/auth/types';
import { apiRequest } from '@/src/shared/services/http';
import type {
  WmsMobileBasketLookupResponse,
  PickingFilters,
  PickingStatus,
  WmsMobilePickingBinScanResult,
  WmsMobilePickingResponse,
  WmsMobilePickingTask,
} from '../types';

type PickingRequestParams = {
  accessToken: string;
  device: DeviceIdentity;
  tenantId?: string | null;
};

export function fetchMobilePickingTasks(params: PickingRequestParams & {
  filters: PickingFilters;
  status?: PickingStatus | null;
  page?: number;
  pageSize?: number;
}) {
  return apiRequest<WmsMobilePickingResponse>(buildPickingPath(params), {
    method: 'GET',
    token: params.accessToken,
    device: params.device,
  });
}

export function claimMobilePickingTask(params: PickingRequestParams & { taskId: string }) {
  return apiRequest<{ success: boolean; task: WmsMobilePickingTask }>(
    `/wms/mobile/picking/tasks/${params.taskId}/claim`,
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

export function scanMobilePickingBin(params: PickingRequestParams & {
  taskId: string;
  code: string;
}) {
  return apiRequest<WmsMobilePickingBinScanResult>(
    `/wms/mobile/picking/tasks/${params.taskId}/scan-bin`,
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

export function scanMobilePickingBasket(params: PickingRequestParams & {
  taskId: string;
  code: string;
}) {
  return apiRequest<{ success: boolean; task: WmsMobilePickingTask }>(
    `/wms/mobile/picking/tasks/${params.taskId}/scan-basket`,
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

export function scanMobilePickingUnit(params: PickingRequestParams & {
  taskId: string;
  code: string;
}) {
  return apiRequest<{ success: boolean; task: WmsMobilePickingTask }>(
    `/wms/mobile/picking/tasks/${params.taskId}/scan-unit`,
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

export function handoffMobilePickingTask(params: PickingRequestParams & {
  taskId: string;
  packerId: string;
}) {
  return apiRequest<{ success: boolean; task: WmsMobilePickingTask }>(
    `/wms/mobile/picking/tasks/${params.taskId}/handoff`,
    {
      method: 'POST',
      token: params.accessToken,
      device: params.device,
      body: {
        tenantId: params.tenantId,
        packerId: params.packerId,
      },
    },
  );
}

export function lookupMobilePickingBasket(params: PickingRequestParams & {
  code: string;
}) {
  const query: string[] = [`code=${encodeURIComponent(params.code)}`];

  if (params.tenantId) {
    query.push(`tenantId=${encodeURIComponent(params.tenantId)}`);
  }

  return apiRequest<WmsMobileBasketLookupResponse>(
    `/wms/mobile/picking/baskets/lookup?${query.join('&')}`,
    {
      method: 'GET',
      token: params.accessToken,
      device: params.device,
    },
  );
}

function buildPickingPath(params: {
  filters: PickingFilters;
  status?: PickingStatus | null;
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

  return `/wms/mobile/picking/tasks${query.length ? `?${query.join('&')}` : ''}`;
}
