'use client';

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, ClipboardList, DollarSign, Package } from 'lucide-react';
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
import { StoreDetailTabSwitcher, type StoreDetailTab } from './_components/store-detail-tab-switcher';
import { StoreInitialOfferModal } from './_components/store-initial-offer-modal';
import { StoreProductsTab } from './_components/store-products-tab';
import { StoreOrdersTab } from './_components/store-orders-tab';
import { useStoreDetailController } from './_hooks/use-store-detail-controller';

function formatCurrency(value: number) {
  return `PHP ${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

type StoreExecutiveCardTone = 'default' | 'success' | 'warning';

const STORE_CARD_TONE_MAP: Record<StoreExecutiveCardTone, string> = {
  default: 'bg-orange-50 text-orange-600 ring-orange-100',
  success: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  warning: 'bg-amber-50 text-amber-600 ring-amber-100',
};

function StoreExecutiveOverviewCard({
  label,
  value,
  icon,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
  tone?: StoreExecutiveCardTone;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {label}
          </p>
          <p className="text-[1.75rem] font-semibold tracking-tight text-slate-950 tabular-nums">
            {value}
          </p>
        </div>
        <div
          className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ring-1 ${STORE_CARD_TONE_MAP[tone]}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

const panelThemeClass = [
  '[&_section]:bg-gradient-to-br',
  '[&_section]:from-white',
  '[&_section]:via-orange-50/35',
  '[&_section]:to-amber-50/25',
  '[&_svg.text-indigo-500]:text-orange-500',
  '[&_svg.text-blue-500]:text-orange-500',
  '[&_svg.text-amber-500]:text-orange-500',
].join(' ');

const softOrangeButtonsClass = [
  '[&_button]:!border-orange-200',
  '[&_button]:!bg-orange-50',
  '[&_button]:!text-orange-700',
  '[&_button:hover]:!bg-orange-100',
  '[&_button:hover]:!text-orange-800',
  '[&_button:focus-visible]:!ring-orange-200',
].join(' ');

const orangeTabsClass = [
  '[&_button.border-indigo-500]:!border-orange-500',
  '[&_button.text-indigo-600]:!text-orange-600',
  '[&_button:hover]:!text-orange-700',
  '[&_button_svg]:text-orange-500',
  '[&_span.bg-indigo-100]:!bg-orange-100',
  '[&_span.text-indigo-700]:!text-orange-700',
].join(' ');

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

      <div className={`space-y-3 ${panelThemeClass}`}>
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
        <div className={softOrangeButtonsClass}>
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
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StoreExecutiveOverviewCard
          label="Products"
          value={products.length}
          icon={<Package className="h-4 w-4" />}
          tone="default"
        />
        <StoreExecutiveOverviewCard
          label="Orders"
          value={orders.length}
          icon={<ClipboardList className="h-4 w-4" />}
          tone="default"
        />
        <StoreExecutiveOverviewCard
          label="Initial Offer"
          value={formatCurrency(Number(store.initialValueOffer || 0))}
          icon={<DollarSign className="h-4 w-4" />}
          tone="success"
        />
        <StoreExecutiveOverviewCard
          label="Status"
          value={store.status || 'ACTIVE'}
          icon={<BarChart3 className="h-4 w-4" />}
          tone="warning"
        />
      </div>

      <div className={orangeTabsClass}>
        <StoreDetailTabSwitcher
          activeTab={activeTab}
          productsCount={products.length}
          ordersCount={orders.length}
          onTabChange={setActiveTab}
        />
      </div>

      <StoreInitialOfferModal
        isOpen={initialOfferModalOpen}
        value={initialOfferInput}
        isSaving={initialOfferSaving}
        onChange={setInitialOfferInput}
        onClose={() => setInitialOfferModalOpen(false)}
        onSave={handleSaveInitialOffer}
      />

      {activeTab === 'products' ? (
        <div
          className={`${panelThemeClass} [&_input:focus]:!border-orange-300 [&_input:focus]:!ring-orange-100`}
        >
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
        </div>
      ) : (
        <div
          className={`${panelThemeClass} [&_input:focus]:!border-orange-300 [&_input:focus]:!ring-orange-100 [&_select:focus]:!border-orange-300 [&_select:focus]:!ring-orange-100`}
        >
          <StoreOrdersTab
            orders={orders}
            ordersLoading={ordersLoading}
            table={orderTable}
            dateRange={orderDateRange}
            onDateRangeChange={setOrderDateRange}
          />
        </div>
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
