'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import apiClient from '@/lib/api-client';
import { PageHeader } from '@/components/ui/page-header';
import { Card, MetricCard } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/emptystate';
import { StatusBadge } from '@/components/ui/status-badge';
import { ArrowLeft, BarChart3, Building2, Calendar, ClipboardList, Copy, DollarSign, Eye, EyeOff, Key, Package, RefreshCcw, Search, ShoppingBag, Store, Tags, X } from 'lucide-react';
import { DataTable } from '@/components/data-table/data-table';
import { useDataTable } from '@/hooks/use-data-table';
import { getProductColumns, type Product } from './product-columns';
import { getOrderColumns, type Order } from './order-columns';
import { CogsModal } from '@/components/cogs/cogs-modal';
import { BulkMappingModal } from '@/components/products/bulk-mapping-modal';
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
  initialValueOffer?: number | null;
}

const tabIds = ['products', 'orders'] as const;

export default function StoreDetailPage() {
  const router = useRouter();
  const params = useParams();
  const storeId = params?.id as string;
  const { addToast } = useToast();

  const [store, setStore] = useState<PosStore | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<string>(tabIds[0]);

  const [products, setProducts] = useState<Product[]>([]);
  const [isSyncingProducts, setIsSyncingProducts] = useState(false);
  const [isSyncingTags, setIsSyncingTags] = useState(false);
  const [isSyncingWarehouses, setIsSyncingWarehouses] = useState(false);
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
  const [initialOfferModalOpen, setInitialOfferModalOpen] = useState(false);
  const [initialOfferInput, setInitialOfferInput] = useState('');
  const [initialOfferSaving, setInitialOfferSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);

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
      if (response.data?.initialValueOffer !== undefined && response.data?.initialValueOffer !== null) {
        setInitialOfferInput(String(response.data.initialValueOffer));
      }
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

      const syncedRows: Product[] = response.data || [];
      setProducts(syncedRows);

      const variationCount = syncedRows.length;
      const uniqueProductCount = new Set(
        syncedRows
          .map((row) => row.productId)
          .filter((value) => typeof value === 'string' && value.trim().length > 0),
      ).size;

      if (variationCount > 0 && uniqueProductCount > 0 && variationCount !== uniqueProductCount) {
        addToast(
          'success',
          `Successfully synced ${variationCount} variation rows across ${uniqueProductCount} products.`,
        );
      } else {
        addToast(
          'success',
          `Successfully synced ${variationCount} product${variationCount !== 1 ? 's' : ''}.`,
        );
      }
    } catch (err: any) {
      const msg = parseErrorMessage(err);
      addToast('error', msg);
    } finally {
      setIsSyncingProducts(false);
    }
  };

  const handleSaveInitialOffer = async () => {
    if (!storeId) return;
    const token = localStorage.getItem('access_token');
    if (!token) {
      addToast('error', 'Session expired. Please log in again.');
      return;
    }

    const trimmed = initialOfferInput.trim();
    const value = trimmed === '' ? null : Number(trimmed);
    if (trimmed !== '' && !Number.isFinite(value)) {
      addToast('error', 'Please enter a valid amount.');
      return;
    }

    try {
      setInitialOfferSaving(true);
      await apiClient.patch(
        `/integrations/pos-stores/${storeId}`,
        { initialValueOffer: value },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      await fetchStore(storeId);
      addToast('success', 'Initial offer updated.');
      setInitialOfferModalOpen(false);
    } catch (err: any) {
      const msg = parseErrorMessage(err);
      addToast('error', msg);
    } finally {
      setInitialOfferSaving(false);
    }
  };

  const handleSyncTags = async () => {
    try {
      setIsSyncingTags(true);
      const token = localStorage.getItem('access_token');
      if (!token) {
        addToast('error', 'Session expired. Please log in again.');
        return;
      }

      const response = await apiClient.post(
        `/integrations/pos-stores/${storeId}/tags/sync`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const synced = Number(response?.data?.synced || 0);
      const grouped = Number(response?.data?.grouped || 0);
      const individual = Number(response?.data?.individual || 0);

      addToast(
        'success',
        `Successfully synced ${synced} tag${synced !== 1 ? 's' : ''} (${grouped} grouped, ${individual} individual).`,
      );
    } catch (err: any) {
      const msg = parseErrorMessage(err);
      addToast('error', msg);
    } finally {
      setIsSyncingTags(false);
    }
  };

  const handleSyncWarehouses = async () => {
    try {
      setIsSyncingWarehouses(true);
      const token = localStorage.getItem('access_token');
      if (!token) {
        addToast('error', 'Session expired. Please log in again.');
        return;
      }

      const response = await apiClient.post(
        `/integrations/pos-stores/${storeId}/warehouses/sync`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const synced = Number(response?.data?.synced || 0);
      addToast(
        'success',
        `Successfully synced ${synced} warehouse${synced !== 1 ? 's' : ''}.`,
      );
    } catch (err: any) {
      const msg = parseErrorMessage(err);
      addToast('error', msg);
    } finally {
      setIsSyncingWarehouses(false);
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
      sorting: [{ id: 'retailPrice', desc: false }],
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
    <section className="overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
        <Package className="h-3.5 w-3.5 text-indigo-500" />
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-700">Products</h4>
        {filteredProducts.length > 0 && (
          <div className="ml-auto flex items-center gap-2 text-[10px] text-slate-500">
            <span>{filteredProducts.length} variation{filteredProducts.length !== 1 ? 's' : ''}</span>
            {productSearchTerm && products.length !== filteredProducts.length && (
              <>
                <span className="text-slate-300">|</span>
                <span>{products.length} total</span>
              </>
            )}
          </div>
        )}
      </div>
      <div className="space-y-3 p-3">
        {selectedCount > 0 && (
          <div className="flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2">
            <p className="text-xs text-indigo-800">
              <span className="font-semibold">{selectedCount}</span> product{selectedCount !== 1 ? 's' : ''} selected
            </p>
            <Button
              variant="primary"
              size="sm"
              iconLeft={<Tags className="h-3.5 w-3.5" />}
              onClick={() => setBulkMappingModalOpen(true)}
            >
              Update Mapping
            </Button>
          </div>
        )}

        <div className="relative ml-auto w-full max-w-sm">
          <input
            value={productSearchInput}
            onChange={(e) => setProductSearchInput(e.target.value)}
            placeholder="Search products..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-3 pr-9 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
          <Search className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        </div>

        {isSyncingProducts && (
          <div className="py-6 text-center text-xs text-slate-500">Syncing products...</div>
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
    </section>
  );

  const renderOrdersTab = () => (
    <section className="overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
        <ClipboardList className="h-3.5 w-3.5 text-blue-500" />
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-700">Orders</h4>
        {orders.length > 0 && (
          <span className="ml-auto text-[10px] text-slate-500">
            {orders.length} order{orders.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div className="space-y-3 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <Calendar className="h-3 w-3" />
            <span>Filter by date range</span>
          </div>
          <div className="relative w-full max-w-sm">
            <Datepicker
              value={orderDateRange as any}
              onChange={(value: any) => {
                setOrderDateRange(value);
              }}
              inputClassName="w-full rounded-lg border border-slate-200 bg-slate-50 pl-3 pr-10 py-1.5 text-xs focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              containerClassName="w-full"
              displayFormat="YYYY-MM-DD"
              toggleClassName="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 cursor-pointer"
              placeholder=""
            />
          </div>
        </div>

        {ordersLoading ? (
          <div className="py-6 text-center text-xs text-slate-500">Loading orders...</div>
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
    </section>
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
    <div className="space-y-4">
      <button
        onClick={() => router.push('/integrations/store')}
        className="group inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
      >
        <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" /> Back to Stores
      </button>

      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {/* Store Details */}
          <section className="overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
              <Store className="h-3.5 w-3.5 text-indigo-500" />
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-700">Store Details</h4>
              <div className="ml-auto">
                <StatusBadge status={(store.status as any) || 'ACTIVE'} />
              </div>
            </div>
            <div className="flex items-start gap-3 p-3">
              {getAvatar() ? (
                <img
                  src={getAvatar()}
                  alt={getStoreName()}
                  className="h-12 w-12 rounded-full object-cover border border-slate-200 shadow-sm"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-base font-semibold text-slate-500">
                  {getStoreName()
                    .split(' ')
                    .map((word) => word.charAt(0))
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-semibold text-slate-900 truncate">{getStoreName()}</h2>
                <p className="mt-0.5 text-xs text-slate-500">Shop ID: {store.shopId}</p>
                <p className="mt-0.5 text-[10px] text-slate-400">Created: {formatDate(store.createdAt)}</p>
              </div>
            </div>
          </section>

          {/* API Key */}
          <section className="overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
              <Key className="h-3.5 w-3.5 text-amber-500" />
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-700">API Key</h4>
            </div>
            <div className="p-3">
              <div className="relative">
                <input
                  readOnly
                  value={showApiKey ? (store.apiKey || '') : '•'.repeat(store.apiKey?.length || 8)}
                  onClick={() => {
                    if (!store.apiKey) return;
                    navigator.clipboard.writeText(store.apiKey);
                    setApiKeyCopied(true);
                    setTimeout(() => setApiKeyCopied(false), 1500);
                  }}
                  className="w-full cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 pr-16 font-mono text-xs text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100/30"
                />
                <div className="absolute inset-y-0 right-2 flex items-center gap-1.5">
                  {store.apiKey && (
                    <button
                      type="button"
                      onClick={() => setShowApiKey((prev) => !prev)}
                      className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  )}
                  {store.apiKey && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(store.apiKey!);
                        setApiKeyCopied(true);
                        setTimeout(() => setApiKeyCopied(false), 1500);
                      }}
                      className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-1 text-[10px] text-slate-400">
                {apiKeyCopied ? <span className="text-emerald-600">Copied!</span> : 'Click to copy'}
              </p>
            </div>
          </section>
        </div>

        {/* Quick Actions */}
        <section className="overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
            <RefreshCcw className="h-3.5 w-3.5 text-blue-500" />
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-700">Quick Actions</h4>
          </div>
          <div className="flex flex-wrap items-center gap-2 p-3">
            <Button
              variant="outline"
              size="sm"
              iconLeft={<DollarSign className="h-3.5 w-3.5" />}
              onClick={() => setInitialOfferModalOpen(true)}
            >
              Set Initial Offer
            </Button>
            <Button
              variant="outline"
              size="sm"
              iconLeft={<RefreshCcw className="h-3.5 w-3.5" />}
              onClick={handleSyncProducts}
              disabled={isSyncingProducts}
              loading={isSyncingProducts}
            >
              {isSyncingProducts ? 'Syncing...' : 'Sync Products'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              iconLeft={<Tags className="h-3.5 w-3.5" />}
              onClick={handleSyncTags}
              disabled={isSyncingTags}
              loading={isSyncingTags}
            >
              {isSyncingTags ? 'Syncing...' : 'Sync Tags'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              iconLeft={<Building2 className="h-3.5 w-3.5" />}
              onClick={handleSyncWarehouses}
              disabled={isSyncingWarehouses}
              loading={isSyncingWarehouses}
            >
              {isSyncingWarehouses ? 'Syncing...' : 'Sync Warehouses'}
            </Button>
          </div>
        </section>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard
          label="Products"
          value={products.length}
          helper="Synced variations"
          icon={<Package className="h-5 w-5" />}
          tone="default"
        />
        <MetricCard
          label="Orders"
          value={orders.length}
          helper="In date range"
          icon={<ClipboardList className="h-5 w-5" />}
          tone="default"
        />
        <MetricCard
          label="Initial Offer"
          value={
            store.initialValueOffer !== undefined && store.initialValueOffer !== null
              ? `₱${Number(store.initialValueOffer).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`
              : '—'
          }
          helper="Per order"
          icon={<DollarSign className="h-5 w-5" />}
          tone="success"
        />
        <MetricCard
          label="Status"
          value={store.status || 'ACTIVE'}
          helper={`Created ${formatDate(store.createdAt)}`}
          icon={<BarChart3 className="h-5 w-5" />}
          tone="default"
        />
      </div>

      <div className="border-b border-slate-200">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('products')}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition ${
              activeTab === 'products'
                ? 'border-b-2 border-indigo-500 text-indigo-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Package className="h-3.5 w-3.5" />
            Products
            {products.length > 0 && (
              <span className={`rounded-full px-1.5 py-px text-[10px] font-medium tabular-nums ${
                activeTab === 'products'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-slate-100 text-slate-500'
              }`}>
                {products.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition ${
              activeTab === 'orders'
                ? 'border-b-2 border-indigo-500 text-indigo-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ClipboardList className="h-3.5 w-3.5" />
            Orders
            {orders.length > 0 && (
              <span className={`rounded-full px-1.5 py-px text-[10px] font-medium tabular-nums ${
                activeTab === 'orders'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-slate-100 text-slate-500'
              }`}>
                {orders.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {initialOfferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              <h4 className="text-sm font-semibold text-slate-800">Set Initial Offer</h4>
              <button
                onClick={() => setInitialOfferModalOpen(false)}
                className="ml-auto rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 p-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">Initial offer amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">₱</span>
                  <input
                    value={initialOfferInput}
                    onChange={(e) => setInitialOfferInput(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-7 pr-3 text-sm tabular-nums text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
                <p className="text-[10px] text-slate-400">
                  Leave blank to clear the initial offer.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-4 py-3">
              <Button variant="outline" size="sm" onClick={() => setInitialOfferModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveInitialOffer}
                loading={initialOfferSaving}
                disabled={initialOfferSaving}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

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
