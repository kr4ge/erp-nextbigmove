import apiClient from '@/lib/api-client';
import type {
  CreateWmsBasketInput,
  CreateWmsLocationInput,
  CreateWmsWarehouseInput,
  UpdateWmsBasketInput,
  UpdateWmsLocationInput,
  UpdateWmsWarehouseInput,
  WmsWarehouseBinDetailResponse,
  WmsWarehousesOverviewResponse,
} from '../_types/warehouse';

export async function fetchWmsWarehousesOverview(warehouseId?: string) {
  const response = await apiClient.get('/wms/warehouses/overview', {
    params: warehouseId ? { warehouseId } : undefined,
  });

  return response.data as WmsWarehousesOverviewResponse;
}

export async function createWmsWarehouse(input: CreateWmsWarehouseInput) {
  const response = await apiClient.post('/wms/warehouses', input);
  return response.data as WmsWarehousesOverviewResponse;
}

export async function updateWmsWarehouse(id: string, input: UpdateWmsWarehouseInput) {
  const response = await apiClient.patch(`/wms/warehouses/${id}`, input);
  return response.data as WmsWarehousesOverviewResponse;
}

export async function createWmsLocation(warehouseId: string, input: CreateWmsLocationInput) {
  const response = await apiClient.post(`/wms/warehouses/${warehouseId}/locations`, input);
  return response.data as WmsWarehousesOverviewResponse;
}

export async function updateWmsLocation(id: string, input: UpdateWmsLocationInput) {
  const response = await apiClient.patch(`/wms/warehouses/locations/${id}`, input);
  return response.data as WmsWarehousesOverviewResponse;
}

export async function createWmsBasket(warehouseId: string, input: CreateWmsBasketInput) {
  const response = await apiClient.post(`/wms/warehouses/${warehouseId}/baskets`, input);
  return response.data as WmsWarehousesOverviewResponse;
}

export async function updateWmsBasket(id: string, input: UpdateWmsBasketInput) {
  const response = await apiClient.patch(`/wms/warehouses/baskets/${id}`, input);
  return response.data as WmsWarehousesOverviewResponse;
}

export async function fetchWmsBinDetail(id: string) {
  const response = await apiClient.get(`/wms/warehouses/locations/${id}/bin-detail`);
  return response.data as WmsWarehouseBinDetailResponse;
}
