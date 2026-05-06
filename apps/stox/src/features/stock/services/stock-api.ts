import type { DeviceIdentity } from '@/src/features/auth/types';
import { apiRequest } from '@/src/shared/services/http';
import type {
  StockMode,
  WmsMobileStockScanResult,
  WmsMobileStockUnitDetail,
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
