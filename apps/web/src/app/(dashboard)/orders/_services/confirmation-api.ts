import apiClient from '@/lib/api-client';
import type {
  ConfirmationProductOptionsResponse,
  ConfirmationResponse,
  ConfirmationResponseItemRaw,
  ConfirmationTagOptionsResponse,
  GeoCommunesResponse,
  GeoDistrictsResponse,
  GeoProvincesResponse,
  PhoneHistoryResponse,
} from '../_types/confirmation';
import { normalizeConfirmationRows, parseApiErrorMessage } from '../_utils/confirmation-helpers';

export async function fetchConfirmationOrders(params: URLSearchParams): Promise<ConfirmationResponse> {
  try {
    const response = await apiClient.get<ConfirmationResponse>(`/orders/confirmation?${params.toString()}`);
    const data = response.data;
    return {
      ...data,
      items: normalizeConfirmationRows((data.items || []) as ConfirmationResponseItemRaw[]),
    };
  } catch (err: unknown) {
    throw new Error(parseApiErrorMessage(err, 'Failed to load confirmation orders'));
  }
}

export async function fetchConfirmationPhoneHistory(params: URLSearchParams): Promise<PhoneHistoryResponse> {
  try {
    const response = await apiClient.get<PhoneHistoryResponse>(
      `/orders/confirmation/history-by-phone?${params.toString()}`,
    );
    const data = response.data;
    return {
      ...data,
      items: normalizeConfirmationRows((data.items || []) as ConfirmationResponseItemRaw[]),
    };
  } catch (err: unknown) {
    throw new Error(parseApiErrorMessage(err, 'Failed to load phone history'));
  }
}

export async function fetchConfirmationTagOptions(orderRowId: string): Promise<ConfirmationTagOptionsResponse> {
  try {
    const response = await apiClient.get<ConfirmationTagOptionsResponse>(
      `/orders/confirmation/${orderRowId}/tag-options`,
    );
    const data = response.data;
    return {
      order_id: data.order_id,
      shop_id: data.shop_id,
      groups: Array.isArray(data.groups) ? data.groups : [],
      individual: Array.isArray(data.individual) ? data.individual : [],
      total: Number(data.total || 0),
    };
  } catch (err: unknown) {
    throw new Error(parseApiErrorMessage(err, 'Failed to load tag options'));
  }
}

export async function fetchConfirmationProductOptions(
  orderRowId: string,
  searchTerm: string,
): Promise<ConfirmationProductOptionsResponse> {
  try {
    const params = new URLSearchParams();
    if (searchTerm.trim()) params.set('search', searchTerm.trim());
    params.set('limit', '20');

    const response = await apiClient.get<ConfirmationProductOptionsResponse>(
      `/orders/confirmation/${orderRowId}/product-options?${params.toString()}`,
    );

    return response.data;
  } catch (err: unknown) {
    throw new Error(parseApiErrorMessage(err, 'Failed to load product options'));
  }
}

export async function syncStoreProductsByShop(shopId: string): Promise<number> {
  try {
    const response = await apiClient.get(`/integrations/shops/${encodeURIComponent(shopId)}/products`);
    return Array.isArray(response.data) ? response.data.length : 0;
  } catch (err: unknown) {
    throw new Error(parseApiErrorMessage(err, 'Failed to sync products'));
  }
}

export async function syncStoreTags(storeId: string): Promise<number> {
  try {
    const response = await apiClient.post(
      `/integrations/pos-stores/${encodeURIComponent(storeId)}/tags/sync`,
      {},
    );
    return Number(response?.data?.synced || 0);
  } catch (err: unknown) {
    throw new Error(parseApiErrorMessage(err, 'Failed to sync tags'));
  }
}

export async function syncStoreWarehouses(storeId: string): Promise<number> {
  try {
    const response = await apiClient.post(
      `/integrations/pos-stores/${encodeURIComponent(storeId)}/warehouses/sync`,
      {},
    );
    return Number(response?.data?.synced || 0);
  } catch (err: unknown) {
    throw new Error(parseApiErrorMessage(err, 'Failed to sync warehouses'));
  }
}

export async function fetchGeoProvinces(countryCode: string): Promise<GeoProvincesResponse> {
  try {
    const response = await apiClient.get<GeoProvincesResponse>(
      `/orders/geo/provinces?country_code=${countryCode}`,
    );
    return response.data;
  } catch (err: unknown) {
    throw new Error(parseApiErrorMessage(err, 'Failed to load province options'));
  }
}

export async function fetchGeoDistricts(provinceId: string): Promise<GeoDistrictsResponse> {
  try {
    const response = await apiClient.get<GeoDistrictsResponse>(
      `/orders/geo/districts?province_id=${encodeURIComponent(provinceId)}`,
    );
    return response.data;
  } catch (err: unknown) {
    throw new Error(parseApiErrorMessage(err, 'Failed to load city options'));
  }
}

export async function fetchGeoCommunes(
  provinceId: string,
  districtId: string,
): Promise<GeoCommunesResponse> {
  try {
    const response = await apiClient.get<GeoCommunesResponse>(
      `/orders/geo/communes?province_id=${encodeURIComponent(provinceId)}&district_id=${encodeURIComponent(districtId)}`,
    );
    return response.data;
  } catch (err: unknown) {
    throw new Error(parseApiErrorMessage(err, 'Failed to load barangay options'));
  }
}

export async function updateConfirmationOrder(
  orderRowId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await apiClient.patch(`/orders/confirmation/${orderRowId}/status`, payload);
  } catch (err: unknown) {
    throw new Error(parseApiErrorMessage(err, 'Failed to update order'));
  }
}
