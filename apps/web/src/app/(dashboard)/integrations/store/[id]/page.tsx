'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import apiClient from '@/lib/api-client';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/emptystate';
import { StatusBadge } from '@/components/ui/status-badge';
import { ArrowLeft, RefreshCcw, ShoppingBag, StoreIcon, Search } from 'lucide-react';
import { ApiKeyCard } from '@/components/ui/api-key-card';
import { DataTable } from '@/components/data-table/data-table';
import { useDataTable } from '@/hooks/use-data-table';
import { getProductColumns, type Product } from './product-columns';
import { getOrderColumns, type Order } from './order-columns';
import { CogsModal } from '@/components/cogs/cogs-modal';
import { BulkMappingModal } from '@/components/products/bulk-mapping-modal';
import { Tags } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import dynamic from 'next/dynamic';
const Datepicker = dynamic(() => import('react-tailwindcss-datepicker'), { ssr: false });

/**
 * Parse API error responses and return user-friendly messages
 */
const parseErrorMessage = (error: any): string => {
  const data = error?.response?.data || error?.data;

  let parsed = data;
  if (typeof data === 'string') {
    try {
      parsed = JSON.parse(data);
    } catch {
      // Not JSON, use as-is
    }
  }

  if (parsed && typeof parsed === 'object') {
    if (parsed.error_code === 105 || parsed.message?.toLowerCase().includes('api_key is invalid')) {
      return 'Invalid API key. Please check your API key and try again.';
    }
    if (parsed.error_code === 101 || parsed.message?.toLowerCase().includes('unauthorized')) {
      return 'Unauthorized. Please check your credentials.';
    }
    if (parsed.message) {
      const msg = parsed.message;
      if (msg.toLowerCase().includes('missing api key')) {
        return 'Missing API key for this store. Please check your integration settings.';
      }
      if (msg.toLowerCase().includes('not found')) {
        return 'Resource not found. Please verify your settings.';
      }
      if (msg.toLowerCase().includes('rate limit')) {
        return 'Too many requests. Please wait a moment and try again.';
      }
      return msg;
    }
  }

  if (typeof error === 'string') {
    try {
      const jsonError = JSON.parse(error);
      if (jsonError.message) {
        return parseErrorMessage({ data: jsonError });
      }
    } catch {
      return error;
    }
  }

  if (error?.message) {
    try {
      const jsonMsg = JSON.parse(error.message);
      return parseErrorMessage({ data: jsonMsg });
    } catch {
      return error.message;
    }
  }

  return 'An unexpected error occurred. Please try again.';
};

interface PosStore {
  id: string;
  name: string;
  shopId: string;
  shopName?: string;
  shopAvatarUrl?: string;
  description?: string;
  status?: string;
  enabled?: boolean;
  apiKey?: string;
  createdAt?: string;
}

const tabs = [
  { id: 'products', label: 'Products' },
  { id: 'orders', label: 'Orders' },
];

export default function StoreDetailPage() {
  const router = useRouter();
  const params = useParams();
  const storeId = params?.id as string;
  const { addToast } = useToast();

  const [store, setStore] = useState<PosStore | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(tabs[0].id);

  const [products, setProducts] = useState<Product[]>([]);
  const [isSyncingProducts, setIsSyncingProducts] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderDateRange, setOrderDateRange] = useState<{
    startDate: string | Date | null;
    endDate: string | Date | null;
  }>({ startDate: null, endDate: null });

  const [cogsModalOpen, setCogsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [bulkMappingModalOpen, setBulkMappingModalOpen] = useState(false);
  const [productSearchInput, setProductSearchInput] = useState('');
  const [productSearchTerm, setProductSearchTerm] = useState('');

  useEffect(() => {
    if (storeId) {
      fetchStore(storeId);
      fetchStoredProducts(storeId);
      fetchOrders(storeId);
    }
  }, [storeId]);

  useEffect(() => {
    if (storeId) {
      fetchOrders(storeId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderDateRange.startDate, orderDateRange.endDate]);

  const fetchStore = async (id: string) => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setError('Unauthorized');
        setIsLoading(false);
        return;
      }

      const response = await apiClient.get(`/integrations/pos-stores/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setStore(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load store details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncProducts = async () => {
    try {
      setIsSyncingProducts(true);
      if (!store?.shopId) {
        addToast('error', 'Missing shop ID for this store.');
        return;
      }
      const token = localStorage.getItem('access_token');
      if (!token) {
        addToast('error', 'Session expired. Please log in again.');
        return;
      }

      const response = await apiClient.get(
        `/integrations/shops/${store.shopId}/products`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      setProducts(response.data || []);
      const count = response.data?.length || 0;
      addToast('success', `Successfully synced ${count} product${count !== 1 ? 's' : ''}.`);
    } catch (err: any) {
      const msg = parseErrorMessage(err);
      addToast('error', msg);
    } finally {
      setIsSyncingProducts(false);
    }
  };

  const getStoreName = () => store?.shopName || store?.name || 'Store';
  const getAvatar = () => store?.shopAvatarUrl;
  const formatDate = (dateString?: string) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const fetchStoredProducts = async (storeId: string) => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        return;
      }

      const response = await apiClient.get(
        `/integrations/pos-stores/${storeId}/products`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      setProducts(response.data || []);
    } catch (err: any) {
      // silent fail for stored fetch
    }
  };

  const fetchOrders = async (storeId: string) => {
    try {
      setOrdersLoading(true);
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const params: Record<string, string> = {};
      if (orderDateRange.startDate) {
        params.dateFrom =
          typeof orderDateRange.startDate === 'string'
            ? orderDateRange.startDate
            : orderDateRange.startDate.toISOString().slice(0, 10);
      }
      if (orderDateRange.endDate) {
        params.dateTo =
          typeof orderDateRange.endDate === 'string'
            ? orderDateRange.endDate
            : orderDateRange.endDate.toISOString().slice(0, 10);
      }

      const response = await apiClient.get(`/integrations/pos-stores/${storeId}/orders`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });

      setOrders(response.data || []);
    } catch (err: any) {
      const msg = parseErrorMessage(err);
      addToast('error', msg);
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleManageCogs = (product: Product) => {
    setSelectedProduct(product);
    setCogsModalOpen(true);
  };

  useEffect(() => {
    const id = setTimeout(() => {
      setProductSearchTerm(productSearchInput.trim());
    }, 350);
    return () => clearTimeout(id);
  }, [productSearchInput]);

  const filteredProducts = useMemo(() => {
    if (!productSearchTerm) return products;
    const term = productSearchTerm.toLowerCase();
    return products.filter((product) => {
      const name = product.name?.toLowerCase() || '';
      const mapping = product.mapping?.toLowerCase() || '';
      const productId = product.productId?.toLowerCase() || '';
      const customId = product.customId?.toLowerCase() || '';
      return (
        name.includes(term) ||
        mapping.includes(term) ||
        productId.includes(term) ||
        customId.includes(term)
      );
    });
  }, [products, productSearchTerm]);

  const columns = useMemo(() => getProductColumns(storeId, handleManageCogs), [storeId]);
  const orderColumns = useMemo(() => getOrderColumns(), []);

  const { table } = useDataTable({
    data: filteredProducts,
    columns,
    pageCount: Math.ceil(filteredProducts.length / 10),
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: 10,
      },
    },
    manualPagination: false,
    manualSorting: false,
    manualFiltering: false,
    enableRowSelection: true,
  });

  const selectedRows = table.getSelectedRowModel().rows;
  const selectedCount = selectedRows.length;

  useEffect(() => {
    table.setPageIndex(0);
  }, [productSearchTerm, table]);

  const { table: orderTable } = useDataTable({
    data: orders,
    columns: orderColumns,
    pageCount: Math.ceil(orders.length / 10),
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: 10,
      },
    },
    manualPagination: false,
    manualSorting: false,
    manualFiltering: false,
    enableRowSelection: false,
  });

  const handleBulkMapping = async (mapping: string) => {
    const selectedProductIds = selectedRows.map((row) => row.original.id);

    const token = localStorage.getItem('access_token');
    if (!token) {
      throw new Error('Unauthorized');
    }

    await apiClient.patch(
      `/integrations/pos-stores/${storeId}/products/mapping`,
      {
        productIds: selectedProductIds,
        mapping,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    // Refresh products after update
    await fetchStoredProducts(storeId);
    table.resetRowSelection();
  };

  const renderProductsTab = () => (
    <div className="space-y-4">
      {selectedCount > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
          <p className="text-sm text-[#0F172A]">
            <span className="font-semibold">{selectedCount}</span> product{selectedCount !== 1 ? 's' : ''} selected
          </p>
          <Button
            variant="primary"
            size="sm"
            iconLeft={<Tags className="h-4 w-4" />}
            onClick={() => setBulkMappingModalOpen(true)}
          >
            Update Mapping
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-[#475569]">
          {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
        </div>
        <div className="relative w-full max-w-sm">
          <input
            value={productSearchInput}
            onChange={(e) => setProductSearchInput(e.target.value)}
            placeholder="Search products"
            className="w-full rounded-lg border border-slate-200 pl-3 pr-10 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          />
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
        </div>
      </div>

      {isSyncingProducts && (
        <Card className="text-center text-[#475569]">Syncing products...</Card>
      )}

      {!isSyncingProducts && products.length === 0 ? (
        <EmptyState
          title="No products synced yet"
          description='Click "Sync Products" to load them from Pancake POS.'
          actionLabel="Sync Products"
          onAction={handleSyncProducts}
          icon={<ShoppingBag className="h-8 w-8" />}
        />
      ) : (
        <DataTable table={table} />
      )}
    </div>
  );

  const renderOrdersTab = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-[#475569]">Filter by date range</div>
        <div className="relative w-full max-w-sm">
          <Datepicker
            value={orderDateRange as any}
            onChange={(value: any) => {
              setOrderDateRange(value);
            }}
            inputClassName="w-full rounded-lg border border-slate-200 pl-3 pr-10 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            containerClassName="w-full"
            displayFormat="YYYY-MM-DD"
            toggleClassName="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 cursor-pointer"
            placeholder=""
          />
        </div>
      </div>

      {ordersLoading ? (
        <Card className="text-center text-[#475569]">Loading orders...</Card>
      ) : orders.length === 0 ? (
        <EmptyState
          title="No orders found"
          description="Adjust the date range or sync workflows to load POS orders."
          icon={<ShoppingBag className="h-8 w-8" />}
        />
      ) : (
        <DataTable table={orderTable} />
      )}
    </div>
  );

  if (isLoading) {
    return (
      <Card className="text-center text-[#475569]">Loading store...</Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50 text-red-700">{error}</Card>
    );
  }

  if (!store) {
    return (
      <Card className="text-center text-[#475569]">Store not found.</Card>
    );
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.push('/integrations/store')}
        className="inline-flex items-center gap-2 text-sm text-[#475569] hover:text-[#0F172A]"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Stores
      </button>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="flex items-center gap-4">
          {getAvatar() ? (
            <img
              src={getAvatar()}
              alt={getStoreName()}
              className="h-16 w-16 rounded-full object-cover border border-[#E2E8F0] shadow-sm"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#F1F5F9] text-xl font-semibold text-[#475569]">
              {getStoreName()
                .split(' ')
                .map((word) => word.charAt(0))
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </div>
          )}
          <div>
            <h2 className="text-lg font-semibold text-[#0F172A]">{getStoreName()}</h2>
            <p className="text-sm text-[#475569]">Shop ID: {store.shopId}</p>
            <p className="text-xs text-[#94A3B8]">Created: {formatDate(store.createdAt)}</p>
          </div>
        </Card>

        <ApiKeyCard
          label="API Key"
          apiKey={store.apiKey}
          status={(store.status as any) || 'ACTIVE'}
          action={
            <Button
              variant="outline"
              size="sm"
              iconLeft={<RefreshCcw className="h-4 w-4" />}
              onClick={handleSyncProducts}
              disabled={isSyncingProducts}
              loading={isSyncingProducts}
            >
              {isSyncingProducts ? 'Syncing...' : 'Sync Products'}
            </Button>
          }
        />
      </div>

      <div className="border-b border-[#E2E8F0]">
        <div className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? 'border-b-2 border-[#2563EB] text-[#2563EB]'
                  : 'text-[#475569] hover:text-[#0F172A]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'products' ? renderProductsTab() : renderOrdersTab()}

      {cogsModalOpen && selectedProduct && (
        <CogsModal
          product={selectedProduct}
          storeId={storeId}
          isOpen={cogsModalOpen}
          onClose={() => {
            setCogsModalOpen(false);
            setSelectedProduct(null);
          }}
        />
      )}

      <BulkMappingModal
        isOpen={bulkMappingModalOpen}
        onClose={() => setBulkMappingModalOpen(false)}
        selectedCount={selectedCount}
        onSubmit={handleBulkMapping}
      />
    </div>
  );
}
