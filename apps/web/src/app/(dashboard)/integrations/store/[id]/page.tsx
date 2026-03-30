'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useDataTable } from '@/hooks/use-data-table';
import { getProductColumns, type Product } from './product-columns';
import { getOrderColumns } from './order-columns';
import { CogsModal } from '@/components/cogs/cogs-modal';
import { BulkMappingModal } from '@/components/products/bulk-mapping-modal';
import { useToast } from '@/components/ui/toast';
import { AlertBanner, LoadingCard } from '@/components/ui/feedback';
import { parseIntegrationErrorMessage } from '../../_utils/integration-error';
import { StoreDetailBackButton } from './_components/store-detail-back-button';
import { StoreDetailOverview } from './_components/store-detail-overview';
import { StoreDetailQuickActions } from './_components/store-detail-quick-actions';
import { StoreDetailMetrics } from './_components/store-detail-metrics';
import { StoreDetailTabSwitcher, type StoreDetailTab } from './_components/store-detail-tab-switcher';
import { StoreInitialOfferModal } from './_components/store-initial-offer-modal';
import { StoreProductsTab } from './_components/store-products-tab';
import { StoreOrdersTab } from './_components/store-orders-tab';
import { useStoreDetailController } from './_hooks/use-store-detail-controller';

export default function StoreDetailPage() {
  const router = useRouter();
  const params = useParams();
  const storeId = params?.id as string;
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<StoreDetailTab>('products');
  const [cogsModalOpen, setCogsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [bulkMappingModalOpen, setBulkMappingModalOpen] = useState(false);

  const {
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
    handleBulkMapping: submitBulkMapping,
    storeName,
    avatarUrl,
    formatDate,
  } = useStoreDetailController(storeId);

  const handleManageCogs = useCallback((product: Product) => {
    setSelectedProduct(product);
    setCogsModalOpen(true);
  }, []);

  const columns = useMemo(
    () => getProductColumns(storeId, handleManageCogs),
    [handleManageCogs, storeId],
  );
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

  const handleBulkMappingSubmit = async (mapping: string) => {
    const selectedProductIds = selectedRows.map((row) => row.original.id);
    if (selectedProductIds.length === 0) return;
    try {
      await submitBulkMapping(selectedProductIds, mapping);
      table.resetRowSelection();
      addToast('success', 'Product mapping updated.');
    } catch (mappingError) {
      throw new Error(parseIntegrationErrorMessage(mappingError));
    }
  };

  if (isLoading) {
    return <LoadingCard label="Loading store..." className="py-8" />;
  }

  if (error) {
    return <AlertBanner tone="error" message={error} className="text-base" />;
  }

  if (!store) {
    return <LoadingCard label="Store not found." className="py-8" />;
  }

  return (
    <div className="space-y-4">
      <StoreDetailBackButton onBack={() => router.push('/integrations/store')} />

      <div className="space-y-3">
        <StoreDetailOverview
          store={store}
          storeName={storeName}
          avatarUrl={avatarUrl}
          createdAtLabel={formatDate(store.createdAt)}
          showApiKey={showApiKey}
          apiKeyCopied={apiKeyCopied}
          onToggleApiKey={() => setShowApiKey((prev) => !prev)}
          onCopyApiKey={handleCopyApiKey}
        />
        <StoreDetailQuickActions
          isSyncingProducts={isSyncingProducts}
          isSyncingTags={isSyncingTags}
          isSyncingWarehouses={isSyncingWarehouses}
          onSetInitialOffer={() => setInitialOfferModalOpen(true)}
          onSyncProducts={handleSyncProducts}
          onSyncTags={handleSyncTags}
          onSyncWarehouses={handleSyncWarehouses}
        />
      </div>

      <StoreDetailMetrics
        store={store}
        productsCount={products.length}
        ordersCount={orders.length}
        createdAtLabel={formatDate(store.createdAt)}
      />

      <StoreDetailTabSwitcher
        activeTab={activeTab}
        productsCount={products.length}
        ordersCount={orders.length}
        onTabChange={setActiveTab}
      />

      <StoreInitialOfferModal
        isOpen={initialOfferModalOpen}
        value={initialOfferInput}
        isSaving={initialOfferSaving}
        onChange={setInitialOfferInput}
        onClose={() => setInitialOfferModalOpen(false)}
        onSave={handleSaveInitialOffer}
      />

      {activeTab === 'products' ? (
        <StoreProductsTab
          products={products}
          filteredProducts={filteredProducts}
          table={table}
          selectedCount={selectedCount}
          searchInput={productSearchInput}
          searchTerm={productSearchTerm}
          isSyncingProducts={isSyncingProducts}
          onSearchInputChange={setProductSearchInput}
          onSyncProducts={handleSyncProducts}
          onOpenBulkMapping={() => setBulkMappingModalOpen(true)}
        />
      ) : (
        <StoreOrdersTab
          orders={orders}
          ordersLoading={ordersLoading}
          table={orderTable}
          dateRange={orderDateRange}
          onDateRangeChange={setOrderDateRange}
        />
      )}

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
        onSubmit={handleBulkMappingSubmit}
      />
    </div>
  );
}
