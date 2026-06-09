import type { DeviceIdentity } from '@/src/features/auth/types';
import { apiRequest } from '@/src/shared/services/http';
import type {
  WmsMobileBasketLookupResponse,
  WmsMobileBasketBinScanResult,
  WmsMobileBasketPickPlanResponse,
  WmsMobileBasketUnitScanResult,
  PickingFilters,
  PickingStatus,
  WmsMobilePickingBinScanResult,
  WmsMobilePickingBatchAssignResponse,
  WmsMobilePickingHandoffResponse,
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

export function assignMobilePickingTasksToBasket(params: PickingRequestParams & {
  basketCode: string;
  taskIds: string[];
}) {
  return apiRequest<WmsMobilePickingBatchAssignResponse>(
    '/wms/mobile/picking/tasks/batch-assign-basket',
    {
      method: 'POST',
      token: params.accessToken,
      device: params.device,
      body: {
        tenantId: params.tenantId,
        basketCode: params.basketCode,
        taskIds: params.taskIds,
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

export function retryMobilePickingAllocation(params: PickingRequestParams & { taskId: string }) {
  return apiRequest<{ success: boolean; task: WmsMobilePickingTask }>(
    `/wms/mobile/picking/tasks/${params.taskId}/retry-allocation`,
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

export function handoffMobilePickingTask(params: PickingRequestParams & {
  taskId: string;
  packerId: string;
}) {
  return apiRequest<WmsMobilePickingHandoffResponse>(
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

export function fetchMobilePickingBasketPlan(params: PickingRequestParams & {
  basketId: string;
}) {
  const query: string[] = [];

  if (params.tenantId) {
    query.push(`tenantId=${encodeURIComponent(params.tenantId)}`);
  }

  return apiRequest<WmsMobileBasketPickPlanResponse>(
    `/wms/mobile/picking/baskets/${params.basketId}/plan${query.length ? `?${query.join('&')}` : ''}`,
    {
      method: 'GET',
      token: params.accessToken,
      device: params.device,
    },
  );
}

export function scanMobilePickingBasketBin(params: PickingRequestParams & {
  basketId: string;
  code: string;
}) {
  return apiRequest<WmsMobileBasketBinScanResult>(
    `/wms/mobile/picking/baskets/${params.basketId}/scan-bin`,
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

export function scanMobilePickingBasketUnit(params: PickingRequestParams & {
  basketId: string;
  binId: string;
  code: string;
}) {
  return apiRequest<WmsMobileBasketUnitScanResult>(
    `/wms/mobile/picking/baskets/${params.basketId}/scan-unit`,
    {
      method: 'POST',
      token: params.accessToken,
      device: params.device,
      body: {
        tenantId: params.tenantId,
        binId: params.binId,
        code: params.code,
      },
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
