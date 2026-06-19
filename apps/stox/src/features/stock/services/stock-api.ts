import type { DeviceIdentity } from '@/src/features/auth/types';
import { apiRequest } from '@/src/shared/services/http';
import type {
  StockMode,
  WmsMobileStockBatchDetail,
  WmsMobileStockCountSessionsResponse,
  WmsMobileStockCountSessionDetail,
  WmsMobileStockBinDetail,
  WmsMobileStockScanResult,
  WmsMobileStockUnitLookupResponse,
  WmsMobileStockUnitDetail,
  WmsMobileTrackingReturnDispositionAction,
  WmsMobileTrackingLookupResponse,
  WmsMobileRtsTasksResponse,
  WmsMobileStockResponse,
} from '../types';

type FetchMobileStockParams = {
  accessToken: string;
  device: DeviceIdentity;
  tenantId?: string | null;
  storeId?: string | null;
  warehouseId?: string | null;
  mode?: StockMode;
  page?: number;
  pageSize?: number;
};

export function fetchMobileStock(params: FetchMobileStockParams) {
  return apiRequest<WmsMobileStockResponse>(buildStockPath(params), {
    method: 'GET',
    token: params.accessToken,
    device: params.device,
  });
}

export function scanMobileStockCode(params: {
  accessToken: string;
  device: DeviceIdentity;
  code: string;
  tenantId?: string | null;
}) {
  return apiRequest<WmsMobileStockScanResult>(buildScanPath(params), {
    method: 'GET',
    token: params.accessToken,
    device: params.device,
  });
}

export function putawayMobileStockUnit(params: {
  accessToken: string;
  device: DeviceIdentity;
  unitId: string;
  targetCode: string;
  tenantId?: string | null;
  clientRequestId?: string | null;
  expectedStatus?: string | null;
  expectedCurrentLocationId?: string | null;
  expectedUpdatedAt?: string | null;
  notes?: string | null;
}) {
  return apiRequest<{ success: boolean; unit: WmsMobileStockUnitDetail }>('/wms/mobile/stock/putaway', {
    method: 'POST',
    token: params.accessToken,
    device: params.device,
    body: {
      unitId: params.unitId,
      targetCode: params.targetCode,
      tenantId: params.tenantId,
      clientRequestId: params.clientRequestId,
      expectedStatus: params.expectedStatus,
      expectedCurrentLocationId: params.expectedCurrentLocationId,
      expectedUpdatedAt: params.expectedUpdatedAt,
      notes: params.notes,
    },
  });
}

export function moveMobileStockUnit(params: {
  accessToken: string;
  device: DeviceIdentity;
  unitId: string;
  targetCode: string;
  tenantId?: string | null;
  clientRequestId?: string | null;
  expectedStatus?: string | null;
  expectedCurrentLocationId?: string | null;
  expectedUpdatedAt?: string | null;
  notes?: string | null;
}) {
  return apiRequest<{
    success: boolean;
    transfer: { id: string; code: string; status: string };
    unit: WmsMobileStockUnitDetail;
  }>('/wms/mobile/stock/move', {
    method: 'POST',
    token: params.accessToken,
    device: params.device,
    body: {
      unitId: params.unitId,
      targetCode: params.targetCode,
      tenantId: params.tenantId,
      clientRequestId: params.clientRequestId,
      expectedStatus: params.expectedStatus,
      expectedCurrentLocationId: params.expectedCurrentLocationId,
      expectedUpdatedAt: params.expectedUpdatedAt,
      notes: params.notes,
    },
  });
}

export function fetchMobileStockUnit(params: {
  accessToken: string;
  device: DeviceIdentity;
  unitId: string;
  tenantId?: string | null;
}) {
  const query: string[] = [];

  if (params.tenantId) {
    query.push(`tenantId=${encodeURIComponent(params.tenantId)}`);
  }

  return apiRequest<WmsMobileStockUnitLookupResponse>(
    `/wms/mobile/stock/units/${params.unitId}${query.length ? `?${query.join('&')}` : ''}`,
    {
      method: 'GET',
      token: params.accessToken,
      device: params.device,
    },
  );
}

export function fetchMobileStockBin(params: {
  accessToken: string;
  device: DeviceIdentity;
  binId: string;
  tenantId?: string | null;
}) {
  const query: string[] = [];

  if (params.tenantId) {
    query.push(`tenantId=${encodeURIComponent(params.tenantId)}`);
  }

  return apiRequest<{ bin: WmsMobileStockBinDetail }>(
    `/wms/mobile/stock/bins/${params.binId}${query.length ? `?${query.join('&')}` : ''}`,
    {
      method: 'GET',
      token: params.accessToken,
      device: params.device,
    },
  );
}

export function fetchMobileStockBatch(params: {
  accessToken: string;
  device: DeviceIdentity;
  batchId: string;
  tenantId?: string | null;
}) {
  const query: string[] = [];

  if (params.tenantId) {
    query.push(`tenantId=${encodeURIComponent(params.tenantId)}`);
  }

  return apiRequest<{ batch: WmsMobileStockBatchDetail }>(
    `/wms/mobile/stock/batches/${params.batchId}${query.length ? `?${query.join('&')}` : ''}`,
    {
      method: 'GET',
      token: params.accessToken,
      device: params.device,
    },
  );
}

export function fetchMobileStockCountSessions(params: {
  accessToken: string;
  device: DeviceIdentity;
  tenantId?: string | null;
  warehouseId?: string | null;
  status?: 'OPEN' | 'SUBMITTED' | 'CLOSED' | 'CANCELED';
}) {
  const query: string[] = [];

  if (params.tenantId) {
    query.push(`tenantId=${encodeURIComponent(params.tenantId)}`);
  }

  if (params.warehouseId) {
    query.push(`warehouseId=${encodeURIComponent(params.warehouseId)}`);
  }

  if (params.status) {
    query.push(`status=${encodeURIComponent(params.status)}`);
  }

  return apiRequest<WmsMobileStockCountSessionsResponse>(
    `/wms/mobile/stock/counts${query.length ? `?${query.join('&')}` : ''}`,
    {
      method: 'GET',
      token: params.accessToken,
      device: params.device,
    },
  );
}

export function fetchMobileStockCountSession(params: {
  accessToken: string;
  device: DeviceIdentity;
  sessionId: string;
  tenantId?: string | null;
}) {
  const query: string[] = [];

  if (params.tenantId) {
    query.push(`tenantId=${encodeURIComponent(params.tenantId)}`);
  }

  return apiRequest<{ session: WmsMobileStockCountSessionDetail }>(
    `/wms/mobile/stock/counts/${params.sessionId}${query.length ? `?${query.join('&')}` : ''}`,
    {
      method: 'GET',
      token: params.accessToken,
      device: params.device,
    },
  );
}

export function startMobileStockCountSession(params: {
  accessToken: string;
  device: DeviceIdentity;
  tenantId?: string | null;
  warehouseId?: string | null;
  targetCode: string;
  notes?: string | null;
}) {
  return apiRequest<{ session: WmsMobileStockCountSessionDetail; resumed: boolean }>(
    '/wms/mobile/stock/counts/start',
    {
      method: 'POST',
      token: params.accessToken,
      device: params.device,
      body: {
        tenantId: params.tenantId,
        warehouseId: params.warehouseId,
        targetCode: params.targetCode,
        notes: params.notes,
      },
    },
  );
}

export function scanMobileStockCountUnit(params: {
  accessToken: string;
  device: DeviceIdentity;
  sessionId: string;
  tenantId?: string | null;
  code: string;
}) {
  return apiRequest<{ session: WmsMobileStockCountSessionDetail | null }>(
    `/wms/mobile/stock/counts/${params.sessionId}/scan-unit`,
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

export function submitMobileStockCountSession(params: {
  accessToken: string;
  device: DeviceIdentity;
  sessionId: string;
  tenantId?: string | null;
  notes?: string | null;
}) {
  return apiRequest<{ session: WmsMobileStockCountSessionDetail | null }>(
    `/wms/mobile/stock/counts/${params.sessionId}/submit`,
    {
      method: 'POST',
      token: params.accessToken,
      device: params.device,
      body: {
        tenantId: params.tenantId,
        notes: params.notes,
      },
    },
  );
}

export function reopenMobileStockCountSession(params: {
  accessToken: string;
  device: DeviceIdentity;
  sessionId: string;
  tenantId?: string | null;
  notes?: string | null;
}) {
  return apiRequest<{ session: WmsMobileStockCountSessionDetail | null }>(
    `/wms/mobile/stock/counts/${params.sessionId}/reopen`,
    {
      method: 'POST',
      token: params.accessToken,
      device: params.device,
      body: {
        tenantId: params.tenantId,
        notes: params.notes,
      },
    },
  );
}

export function closeoutMobileStockCountSession(params: {
  accessToken: string;
  device: DeviceIdentity;
  sessionId: string;
  tenantId?: string | null;
  notes?: string | null;
}) {
  return apiRequest<{ session: WmsMobileStockCountSessionDetail | null }>(
    `/wms/mobile/stock/counts/${params.sessionId}/closeout`,
    {
      method: 'POST',
      token: params.accessToken,
      device: params.device,
      body: {
        tenantId: params.tenantId,
        notes: params.notes,
      },
    },
  );
}

export function lookupMobileTrackingOrder(params: {
  accessToken: string;
  device: DeviceIdentity;
  code: string;
  tenantId?: string | null;
}) {
  const query = [`code=${encodeURIComponent(params.code)}`];

  if (params.tenantId) {
    query.push(`tenantId=${encodeURIComponent(params.tenantId)}`);
  }

  return apiRequest<WmsMobileTrackingLookupResponse>(`/wms/mobile/tracking/lookup?${query.join('&')}`, {
    method: 'GET',
    token: params.accessToken,
    device: params.device,
  });
}

export function fetchMobileRtsTasks(params: {
  accessToken: string;
  device: DeviceIdentity;
  tenantId?: string | null;
  storeId?: string | null;
  page?: number;
  pageSize?: number;
}) {
  const query: string[] = [];

  if (params.tenantId) {
    query.push(`tenantId=${encodeURIComponent(params.tenantId)}`);
  }

  if (params.storeId) {
    query.push(`storeId=${encodeURIComponent(params.storeId)}`);
  }

  if (params.page) {
    query.push(`page=${encodeURIComponent(String(params.page))}`);
  }

  if (params.pageSize) {
    query.push(`pageSize=${encodeURIComponent(String(params.pageSize))}`);
  }

  return apiRequest<WmsMobileRtsTasksResponse>(`/wms/mobile/tracking/tasks/rts${query.length ? `?${query.join('&')}` : ''}`, {
    method: 'GET',
    token: params.accessToken,
    device: params.device,
  });
}

export function verifyMobileTrackingReturnUnit(params: {
  accessToken: string;
  device: DeviceIdentity;
  taskId: string;
  code: string;
  tenantId?: string | null;
}) {
  return apiRequest<{
    success: boolean;
    task: WmsMobileTrackingLookupResponse['task'];
    returnFlow: WmsMobileTrackingLookupResponse['returnFlow'];
    unit: {
      id: string;
      code: string;
      status: string;
      statusLabel: string;
    };
  }>(`/wms/mobile/tracking/tasks/${params.taskId}/verify-return-unit`, {
    method: 'POST',
    token: params.accessToken,
    device: params.device,
    body: {
      code: params.code,
      tenantId: params.tenantId,
    },
  });
}

export function dispositionMobileTrackingReturnUnit(params: {
  accessToken: string;
  device: DeviceIdentity;
  taskId: string;
  unitId: string;
  disposition: WmsMobileTrackingReturnDispositionAction;
  targetCode?: string;
  tenantId?: string | null;
}) {
  return apiRequest<{
    success: boolean;
    task: WmsMobileTrackingLookupResponse['task'];
    returnFlow: WmsMobileTrackingLookupResponse['returnFlow'];
    unit: WmsMobileStockUnitDetail;
  }>(`/wms/mobile/tracking/tasks/${params.taskId}/disposition-return-unit`, {
    method: 'POST',
    token: params.accessToken,
    device: params.device,
    body: {
      tenantId: params.tenantId,
      unitId: params.unitId,
      disposition: params.disposition,
      ...(params.targetCode ? { targetCode: params.targetCode } : {}),
    },
  });
}

function buildStockPath(
  params: Pick<
    FetchMobileStockParams,
    'tenantId' | 'storeId' | 'warehouseId' | 'mode' | 'page' | 'pageSize'
  >,
) {
  const query: string[] = [];

  if (params.tenantId) {
    query.push(`tenantId=${encodeURIComponent(params.tenantId)}`);
  }

  if (params.storeId) {
    query.push(`storeId=${encodeURIComponent(params.storeId)}`);
  }

  if (params.warehouseId) {
    query.push(`warehouseId=${encodeURIComponent(params.warehouseId)}`);
  }

  if (params.mode) {
    query.push(`mode=${encodeURIComponent(params.mode)}`);
  }

  if (params.page) {
    query.push(`page=${encodeURIComponent(String(params.page))}`);
  }

  if (params.pageSize) {
    query.push(`pageSize=${encodeURIComponent(String(params.pageSize))}`);
  }

  return `/wms/mobile/stock${query.length ? `?${query.join('&')}` : ''}`;
}

function buildScanPath(params: Pick<FetchMobileStockParams, 'tenantId'> & { code: string }) {
  const query = [`code=${encodeURIComponent(params.code)}`];

  if (params.tenantId) {
    query.push(`tenantId=${encodeURIComponent(params.tenantId)}`);
  }

  return `/wms/mobile/stock/scan?${query.join('&')}`;
}
