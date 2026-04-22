import apiClient from '@/lib/api-client';
import type {
  GetWmsProductsOverviewParams,
  SyncWmsProductsStoreResponse,
  UpdateWmsProductProfileInput,
  WmsProductsOverviewResponse,
} from '../_types/product';

export async function fetchWmsProductsOverview(params: GetWmsProductsOverviewParams = {}) {
  const response = await apiClient.get('/wms/products/overview', {
    params: {
      ...(params.tenantId ? { tenantId: params.tenantId } : {}),
      ...(params.storeId ? { storeId: params.storeId } : {}),
      ...(params.posWarehouseId ? { posWarehouseId: params.posWarehouseId } : {}),
      ...(params.search ? { search: params.search } : {}),
      ...(params.status ? { status: params.status } : {}),
    },
  });

  return response.data as WmsProductsOverviewResponse;
}

export async function updateWmsProductProfile(
  id: string,
  input: UpdateWmsProductProfileInput,
  tenantId?: string,
) {
  const response = await apiClient.patch(
    `/wms/products/${id}`,
    input,
    {
      params: tenantId ? { tenantId } : undefined,
    },
  );
  return response.data as { profile: WmsProductsOverviewResponse['products'][number] };
}

export async function syncWmsProductsStore(storeId: string, tenantId?: string) {
  const response = await apiClient.post(`/wms/products/stores/${storeId}/sync`, undefined, {
    params: tenantId ? { tenantId } : undefined,
  });

  return response.data as SyncWmsProductsStoreResponse;
}
