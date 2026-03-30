'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { parseIntegrationErrorMessage } from '../../../_utils/integration-error';
import type { PosStore, StoreOrderDateRange } from '../../../_types/store-detail';
import type { Product } from '../product-columns';
import type { Order } from '../order-columns';
import { storeDetailService } from '../_services/store-detail.service';

export function useStoreDetailController(storeId: string) {
  const { addToast } = useToast();

  const [store, setStore] = useState<PosStore | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderDateRange, setOrderDateRange] = useState<StoreOrderDateRange>({
    startDate: null,
    endDate: null,
  });
  const [isSyncingProducts, setIsSyncingProducts] = useState(false);
  const [isSyncingTags, setIsSyncingTags] = useState(false);
  const [isSyncingWarehouses, setIsSyncingWarehouses] = useState(false);
  const [productSearchInput, setProductSearchInput] = useState('');
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [initialOfferModalOpen, setInitialOfferModalOpen] = useState(false);
  const [initialOfferInput, setInitialOfferInput] = useState('');
  const [initialOfferSaving, setInitialOfferSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);

  const fetchStore = useCallback(async () => {
    try {
      const data = await storeDetailService.fetchStore(storeId);
      setStore(data);
      if (data?.initialValueOffer !== undefined && data?.initialValueOffer !== null) {
        setInitialOfferInput(String(data.initialValueOffer));
      }
    } catch (fetchError) {
      const message = parseIntegrationErrorMessage(fetchError);
      if (message.toLowerCase().includes('unauthorized')) {
        setError('Unauthorized');
        return;
      }
      setError(message || 'Failed to load store details');
    } finally {
      setIsLoading(false);
    }
  }, [storeId]);

  const fetchStoredProducts = useCallback(async () => {
    try {
      const rows = await storeDetailService.fetchStoredProducts(storeId);
      setProducts(rows);
    } catch {
      // silent fetch fail for initial product pull
    }
  }, [storeId]);

  const fetchOrders = useCallback(async (range: StoreOrderDateRange) => {
    try {
      setOrdersLoading(true);
      const rows = await storeDetailService.fetchOrders(storeId, range);
      setOrders(rows);
    } catch (fetchError) {
      addToast('error', parseIntegrationErrorMessage(fetchError));
    } finally {
      setOrdersLoading(false);
    }
  }, [addToast, storeId]);

  useEffect(() => {
    if (!storeId) return;
    void fetchStore();
    void fetchStoredProducts();
  }, [fetchStore, fetchStoredProducts, storeId]);

  useEffect(() => {
    if (!storeId) return;
    void fetchOrders(orderDateRange);
  }, [fetchOrders, orderDateRange, storeId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setProductSearchTerm(productSearchInput.trim());
    }, 350);
    return () => clearTimeout(timer);
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
  }, [productSearchTerm, products]);

  const handleSyncProducts = useCallback(async () => {
    try {
      setIsSyncingProducts(true);
      if (!store?.shopId) {
        addToast('error', 'Missing shop ID for this store.');
        return;
      }

      const syncedRows = await storeDetailService.syncProducts(store.shopId);
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
    } catch (syncError) {
      addToast('error', parseIntegrationErrorMessage(syncError));
    } finally {
      setIsSyncingProducts(false);
    }
  }, [addToast, store?.shopId]);

  const handleSyncTags = useCallback(async () => {
    try {
      setIsSyncingTags(true);
      const response = await storeDetailService.syncTags(storeId);
      const synced = Number(response?.synced || 0);
      const grouped = Number(response?.grouped || 0);
      const individual = Number(response?.individual || 0);

      addToast(
        'success',
        `Successfully synced ${synced} tag${synced !== 1 ? 's' : ''} (${grouped} grouped, ${individual} individual).`,
      );
    } catch (syncError) {
      addToast('error', parseIntegrationErrorMessage(syncError));
    } finally {
      setIsSyncingTags(false);
    }
  }, [addToast, storeId]);

  const handleSyncWarehouses = useCallback(async () => {
    try {
      setIsSyncingWarehouses(true);
      const response = await storeDetailService.syncWarehouses(storeId);
      const synced = Number(response?.synced || 0);
      addToast(
        'success',
        `Successfully synced ${synced} warehouse${synced !== 1 ? 's' : ''}.`,
      );
    } catch (syncError) {
      addToast('error', parseIntegrationErrorMessage(syncError));
    } finally {
      setIsSyncingWarehouses(false);
    }
  }, [addToast, storeId]);

  const handleSaveInitialOffer = useCallback(async () => {
    const trimmed = initialOfferInput.trim();
    const value = trimmed === '' ? null : Number(trimmed);
    if (trimmed !== '' && !Number.isFinite(value)) {
      addToast('error', 'Please enter a valid amount.');
      return;
    }

    try {
      setInitialOfferSaving(true);
      await storeDetailService.updateInitialOffer(storeId, value);
      await fetchStore();
      addToast('success', 'Initial offer updated.');
      setInitialOfferModalOpen(false);
    } catch (saveError) {
      addToast('error', parseIntegrationErrorMessage(saveError));
    } finally {
      setInitialOfferSaving(false);
    }
  }, [addToast, fetchStore, initialOfferInput, storeId]);

  const handleCopyApiKey = useCallback(() => {
    if (!store?.apiKey) return;
    navigator.clipboard.writeText(store.apiKey);
    setApiKeyCopied(true);
    setTimeout(() => setApiKeyCopied(false), 1500);
  }, [store?.apiKey]);

  const handleBulkMapping = useCallback(
    async (selectedProductIds: string[], mapping: string) => {
      await storeDetailService.updateProductsMapping({
        storeId,
        productIds: selectedProductIds,
        mapping,
      });
      await fetchStoredProducts();
    },
    [fetchStoredProducts, storeId],
  );

  const storeName = store?.shopName || store?.name || 'Store';
  const avatarUrl = store?.shopAvatarUrl;

  const formatDate = useCallback((dateString?: string) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }, []);

  return {
    store,
    isLoading,
    error,
    products,
    orders,
    ordersLoading,
    orderDateRange,
    setOrderDateRange,
    isSyncingProducts,
    isSyncingTags,
    isSyncingWarehouses,
    productSearchInput,
    setProductSearchInput,
    productSearchTerm,
    filteredProducts,
    initialOfferModalOpen,
    setInitialOfferModalOpen,
    initialOfferInput,
    setInitialOfferInput,
    initialOfferSaving,
    showApiKey,
    setShowApiKey,
    apiKeyCopied,
    handleSyncProducts,
    handleSyncTags,
    handleSyncWarehouses,
    handleSaveInitialOffer,
    handleCopyApiKey,
    handleBulkMapping,
    storeName,
    avatarUrl,
    formatDate,
  };
}
