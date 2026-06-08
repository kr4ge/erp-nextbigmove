import apiClient from '@/lib/api-client';
import type {
  CreateWmsInventoryAdjustmentInput,
  CreateWmsInventoryStoreTransferInput,
  CreateWmsInventoryTransferInput,
  GetWmsInventoryOverviewParams,
  GetWmsInventoryStoreTransferOptionsParams,
  GetWmsInventoryTransfersParams,
  VoidWmsInventoryUnitInput,
  WmsInventoryMovementRecord,
  WmsInventoryOverviewResponse,
  WmsInventoryStoreTransferPreviewResponse,
  WmsInventoryStoreTransferOptionsResponse,
  WmsInventoryTransfersResponse,
  WmsInventoryTransferOptionsResponse,
} from '../_types/inventory';

export async function fetchWmsInventoryOverview(params: GetWmsInventoryOverviewParams = {}) {
  const response = await apiClient.get('/wms/inventory/overview', {
    params: {
      ...(params.allTenants ? { allTenants: true } : {}),
      ...(params.tenantId ? { tenantId: params.tenantId } : {}),
      ...(params.storeId ? { storeId: params.storeId } : {}),
      ...(params.warehouseId ? { warehouseId: params.warehouseId } : {}),
      ...(params.search ? { search: params.search } : {}),
      ...(params.status ? { status: params.status } : {}),
    },
  });

  return response.data as WmsInventoryOverviewResponse;
}

export async function recordWmsInventoryUnitLabelPrint(
  id: string,
  input: { action: 'PRINT' | 'REPRINT' },
  tenantId?: string,
) {
  const response = await apiClient.post(`/wms/inventory/${id}/labels/print`, input, {
    params: tenantId ? { tenantId } : undefined,
  });

  return response.data as {
    print: {
      action: 'PRINT' | 'REPRINT';
      itemCount: number;
    };
    unit: WmsInventoryOverviewResponse['units'][number];
  };
}

export async function fetchWmsInventoryUnitMovements(id: string, tenantId?: string) {
  const response = await apiClient.get(`/wms/inventory/${id}/movements`, {
    params: tenantId ? { tenantId } : undefined,
  });

  return response.data as {
    movements: WmsInventoryMovementRecord[];
  };
}

export async function fetchWmsInventoryUnitTransferOptions(id: string, tenantId?: string) {
  const response = await apiClient.get(`/wms/inventory/${id}/transfer-options`, {
    params: tenantId ? { tenantId } : undefined,
  });

  return response.data as WmsInventoryTransferOptionsResponse;
}

export async function fetchWmsInventoryStoreTransferOptions(
  params: GetWmsInventoryStoreTransferOptionsParams = {},
) {
  const response = await apiClient.get('/wms/inventory/store-transfer/options', {
    params: {
      ...(params.tenantId ? { tenantId: params.tenantId } : {}),
      ...(params.targetStoreId ? { targetStoreId: params.targetStoreId } : {}),
      ...(params.sourceProfileId ? { sourceProfileId: params.sourceProfileId } : {}),
      ...(params.search ? { search: params.search } : {}),
    },
  });

  return response.data as WmsInventoryStoreTransferOptionsResponse;
}

export async function createWmsInventoryTransfer(
  input: CreateWmsInventoryTransferInput,
  tenantId?: string,
) {
  const response = await apiClient.post('/wms/inventory/transfers', input, {
    params: tenantId ? { tenantId } : undefined,
  });

  return response.data as {
    transfer: {
      id: string;
      code: string;
      status: 'COMPLETED' | 'CANCELED';
      createdAt: string;
    };
    units: WmsInventoryOverviewResponse['units'];
  };
}

export async function createWmsInventoryStoreTransfer(
  input: CreateWmsInventoryStoreTransferInput,
  tenantId?: string,
) {
  const response = await apiClient.post('/wms/inventory/store-transfers', input, {
    params: tenantId ? { tenantId } : undefined,
  });

  return response.data as {
    transfer: {
      id: string;
      code: string;
      itemCount: number;
      fromStoreId: string;
      toStoreId: string;
      targetProfileId: string;
      notes: string | null;
      createdAt: string;
    };
    units: WmsInventoryOverviewResponse['units'];
  };
}

export async function previewWmsInventoryStoreTransfer(
  input: CreateWmsInventoryStoreTransferInput,
  tenantId?: string,
) {
  const response = await apiClient.post('/wms/inventory/store-transfers/preview', input, {
    params: tenantId ? { tenantId } : undefined,
  });

  return response.data as WmsInventoryStoreTransferPreviewResponse;
}

export async function fetchWmsInventoryTransfers(params: GetWmsInventoryTransfersParams = {}) {
  const response = await apiClient.get('/wms/inventory/transfers', {
    params: {
      ...(params.tenantId ? { tenantId: params.tenantId } : {}),
      ...(params.warehouseId ? { warehouseId: params.warehouseId } : {}),
      ...(params.search ? { search: params.search } : {}),
    },
  });

  return response.data as WmsInventoryTransfersResponse;
}

export async function createWmsInventoryAdjustment(
  input: CreateWmsInventoryAdjustmentInput,
  tenantId?: string,
) {
  const response = await apiClient.post('/wms/inventory/adjustments', input, {
    params: tenantId ? { tenantId } : undefined,
  });

  return response.data as {
    adjustment: {
      code: string;
      unitCount: number;
      targetStatus: CreateWmsInventoryAdjustmentInput['targetStatus'];
      targetLocation: WmsInventoryTransferOptionsResponse['unit']['currentLocation'] | null;
      createdAt: string;
    };
    units: WmsInventoryOverviewResponse['units'];
  };
}

export async function voidWmsInventoryUnit(
  input: VoidWmsInventoryUnitInput,
  tenantId?: string,
) {
  const response = await apiClient.post(
    `/wms/inventory/${input.unitId}/void`,
    {
      reason: input.reason,
      ...(input.notes ? { notes: input.notes } : {}),
    },
    {
      params: tenantId ? { tenantId } : undefined,
    },
  );

  return response.data as {
    voided: {
      unitId: string;
      unitCode: string;
      releasedReservations: number;
      reason: string;
    };
    unit: WmsInventoryOverviewResponse['units'][number];
  };
}
