import apiClient from '@/lib/api-client';
import type { Product } from '../product-columns';
import type { Order } from '../order-columns';
import type { PosStore, StoreOrderDateRange } from '../../../_types/store-detail';

function getAuthHeaders() {
  const token = localStorage.getItem('access_token');
  if (!token) return null;
  return { Authorization: `Bearer ${token}` };
}

function toDateParam(value: string | Date | null) {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  return value.toISOString().slice(0, 10);
}

export const storeDetailService = {
  async fetchStore(storeId: string) {
    const headers = getAuthHeaders();
    if (!headers) throw new Error('UNAUTHORIZED');

    const response = await apiClient.get<PosStore>(`/integrations/pos-stores/${storeId}`, {
      headers,
    });
    return response.data;
  },

  async fetchStoredProducts(storeId: string) {
    const headers = getAuthHeaders();
    if (!headers) throw new Error('UNAUTHORIZED');

    const response = await apiClient.get<Product[]>(
      `/integrations/pos-stores/${storeId}/products`,
      { headers },
    );
    return Array.isArray(response.data) ? response.data : [];
  },

  async fetchOrders(storeId: string, range: StoreOrderDateRange) {
    const headers = getAuthHeaders();
    if (!headers) throw new Error('UNAUTHORIZED');

    const params: Record<string, string> = {};
    const from = toDateParam(range.startDate);
    if (from) params.dateFrom = from;
    const to = toDateParam(range.endDate);
    if (to) params.dateTo = to;

    const response = await apiClient.get<Order[]>(
      `/integrations/pos-stores/${storeId}/orders`,
      { headers, params },
    );
    return Array.isArray(response.data) ? response.data : [];
  },

  async syncProducts(shopId: string) {
    const headers = getAuthHeaders();
    if (!headers) throw new Error('UNAUTHORIZED');

    const response = await apiClient.get<Product[]>(
      `/integrations/shops/${shopId}/products`,
      { headers },
    );
    return Array.isArray(response.data) ? response.data : [];
  },

  async syncTags(storeId: string) {
    const headers = getAuthHeaders();
    if (!headers) throw new Error('UNAUTHORIZED');

    const response = await apiClient.post(
      `/integrations/pos-stores/${storeId}/tags/sync`,
      {},
      { headers },
    );
    return response.data as {
      synced?: number;
      grouped?: number;
      individual?: number;
    };
  },

  async syncWarehouses(storeId: string) {
    const headers = getAuthHeaders();
    if (!headers) throw new Error('UNAUTHORIZED');

    const response = await apiClient.post(
      `/integrations/pos-stores/${storeId}/warehouses/sync`,
      {},
      { headers },
    );
    return response.data as { synced?: number };
  },

  async updateInitialOffer(storeId: string, value: number | null) {
    const headers = getAuthHeaders();
    if (!headers) throw new Error('UNAUTHORIZED');

    await apiClient.patch(
      `/integrations/pos-stores/${storeId}`,
      { initialValueOffer: value },
      { headers },
    );
  },

  async updateProductsMapping(params: {
    storeId: string;
    productIds: string[];
    mapping: string;
  }) {
    const headers = getAuthHeaders();
    if (!headers) throw new Error('UNAUTHORIZED');

    await apiClient.patch(
      `/integrations/pos-stores/${params.storeId}/products/mapping`,
      {
        productIds: params.productIds,
        mapping: params.mapping,
      },
      { headers },
    );
  },
};
