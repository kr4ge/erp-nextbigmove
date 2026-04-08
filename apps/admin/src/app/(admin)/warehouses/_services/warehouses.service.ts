import apiClient from '@/lib/api-client';
import type {
  LocationFormState,
  WmsLocation,
  WarehouseFormState,
  WmsWarehouse,
} from '../_types/warehouses';

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string | string[] } } }).response;
    const message = response?.data?.message;
    if (typeof message === 'string') {
      return message;
    }
    if (Array.isArray(message) && message.length > 0) {
      return message.join(', ');
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export async function fetchWarehouses() {
  const response = await apiClient.get<WmsWarehouse[]>('/wms/warehouses');
  return response.data;
}

export async function createWarehouse(payload: WarehouseFormState) {
  try {
    const response = await apiClient.post<WmsWarehouse>('/wms/warehouses', payload);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to create warehouse.'));
  }
}

export async function updateWarehouse(warehouseId: string, payload: WarehouseFormState) {
  try {
    const response = await apiClient.patch<WmsWarehouse>(`/wms/warehouses/${warehouseId}`, payload);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to update warehouse.'));
  }
}

export async function deleteWarehouse(warehouseId: string) {
  try {
    const response = await apiClient.delete<{ success: boolean }>(`/wms/warehouses/${warehouseId}`);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to delete warehouse.'));
  }
}

function normalizeLocationPayload(payload: LocationFormState) {
  return {
    ...payload,
    parentId: payload.parentId || null,
    barcode: payload.barcode || undefined,
    capacityUnits: payload.capacityUnits ? Number(payload.capacityUnits) : undefined,
    sortOrder: payload.sortOrder ? Number(payload.sortOrder) : undefined,
  };
}

export async function createLocation(warehouseId: string, payload: LocationFormState) {
  try {
    const response = await apiClient.post<WmsLocation>(
      `/wms/warehouses/${warehouseId}/locations`,
      normalizeLocationPayload(payload),
    );
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to create location.'));
  }
}

export async function updateLocation(
  warehouseId: string,
  locationId: string,
  payload: LocationFormState,
) {
  try {
    const response = await apiClient.patch<WmsLocation>(
      `/wms/warehouses/${warehouseId}/locations/${locationId}`,
      normalizeLocationPayload(payload),
    );
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to update location.'));
  }
}

export async function deleteLocation(warehouseId: string, locationId: string) {
  try {
    const response = await apiClient.delete<{ success: boolean }>(
      `/wms/warehouses/${warehouseId}/locations/${locationId}`,
    );
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to delete location.'));
  }
}
