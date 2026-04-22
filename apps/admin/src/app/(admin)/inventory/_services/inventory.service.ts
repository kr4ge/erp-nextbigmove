import apiClient from '@/lib/api-client';
import type {
  CreateWmsInventoryTransferInput,
  GetWmsInventoryOverviewParams,
  WmsInventoryMovementRecord,
  WmsInventoryOverviewResponse,
  WmsInventoryTransferOptionsResponse,
} from '../_types/inventory';

export async function fetchWmsInventoryOverview(params: GetWmsInventoryOverviewParams = {}) {
  const response = await apiClient.get('/wms/inventory/overview', {
    params: {
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
