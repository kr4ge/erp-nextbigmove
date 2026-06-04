import type { DeviceIdentity } from '@/src/features/auth/types';
import { apiRequest } from '@/src/shared/services/http';

export type WmsMobileHomeInventorySummaryResponse = {
  tenantReady: boolean;
  context: {
    activeTenantId: string | null;
    activeStoreId: string | null;
    activeWarehouseId: string | null;
  };
  summary: {
    totalUnits: number;
    locatedUnits: number;
    unitsOnHand: number;
    dispatchedUnits: number;
    warehouseCapacity: {
      usedUnits: number;
      totalUnits: number;
      utilizationPercent: number;
    };
  };
};

export type WmsMobileHomeTaskSummaryResponse = {
  tenantReady: boolean;
  context: {
    activeTenantId: string | null;
    activeStoreId: string | null;
  };
  summary: {
    pick: {
      ready: number;
      partial: number;
      inPicking: number;
      total: number;
    };
    pack: {
      picked: number;
      packing: number;
      total: number;
    };
    groups: {
      restocking: number;
      packingWithoutTracking: number;
      delivered: number;
      rts: number;
    };
    completedToday: {
      picked: number;
      packed: number;
    };
  };
};

export type WmsMobileActiveStoxReleaseResponse = {
  scope: {
    isPlatformAdmin: boolean;
    tenantId: string | null;
  };
  release: {
    id: string;
    platform: 'ANDROID';
    channel: 'INTERNAL';
    version: string;
    buildNumber: number;
    releaseNotes: string | null;
    isActive: boolean;
    contentType: string;
    byteSize: number;
    originalFileName: string | null;
    downloadFileName: string;
    downloadUrl: string | null;
    createdAt: string;
    updatedAt: string;
    activatedAt: string | null;
    createdBy: {
      id: string;
      email: string;
      displayName: string;
    } | null;
    activatedBy: {
      id: string;
      email: string;
      displayName: string;
    } | null;
  } | null;
};

export function fetchMobileHomeInventorySummary(params: {
  accessToken: string;
  device: DeviceIdentity;
  tenantId?: string | null;
  storeId?: string | null;
  warehouseId?: string | null;
}) {
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

  return apiRequest<WmsMobileHomeInventorySummaryResponse>(
    `/wms/mobile/home/inventory-summary${query.length ? `?${query.join('&')}` : ''}`,
    {
      method: 'GET',
      token: params.accessToken,
      device: params.device,
    },
  );
}

export function fetchMobileHomeTaskSummary(params: {
  accessToken: string;
  device: DeviceIdentity;
  tenantId?: string | null;
  storeId?: string | null;
}) {
  const query: string[] = [];

  if (params.tenantId) {
    query.push(`tenantId=${encodeURIComponent(params.tenantId)}`);
  }

  if (params.storeId) {
    query.push(`storeId=${encodeURIComponent(params.storeId)}`);
  }

  return apiRequest<WmsMobileHomeTaskSummaryResponse>(
    `/wms/mobile/home/task-summary${query.length ? `?${query.join('&')}` : ''}`,
    {
      method: 'GET',
      token: params.accessToken,
      device: params.device,
    },
  );
}

export function fetchActiveStoxRelease(params: {
  accessToken: string;
  device: DeviceIdentity;
}) {
  return apiRequest<WmsMobileActiveStoxReleaseResponse>('/wms/mobile/stox/release', {
    method: 'GET',
    token: params.accessToken,
    device: params.device,
  });
}
