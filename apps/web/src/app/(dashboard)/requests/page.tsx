'use client';

import { AlertBanner, LoadingCard } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page-header';
import { RequestCreatePanel } from './_components/request-create-panel';
import { RequestDetailPanel } from './_components/request-detail-panel';
import { RequestsQueuePanel } from './_components/requests-queue-panel';
import { RequestsSummaryStrip } from './_components/requests-summary-strip';
import { useRequestsController } from './_hooks/use-requests-controller';

export default function RequestsPage() {
  const {
    isLoadingOverview,
    overviewError,
    stores,
    createStoreScopeId,
    setCreateStoreScopeId,
    createRequestType,
    setCreateRequestType,
    createPartnerNotes,
    setCreatePartnerNotes,
    cartLines,
    cartTotals,
    removeCartLine,
    updateCartLineQuantity,
    submitRequest,
    isSubmitting,
    isProductPickerOpen,
    productSearchText,
    productOptions,
    isLoadingProductOptions,
    productOptionsError,
    productOptionsPage,
    setProductSearchText,
    setProductOptionsPage,
    openProductPicker,
    closeProductPicker,
    addProductToCart,
    effectiveStoreId,
    overview,
    queueRows,
    queueFilters,
    queuePagination,
    selectedStoreId,
    selectedRequestType,
    selectedStatus,
    search,
    setSelectedStoreId,
    setSelectedRequestType,
    setSelectedStatus,
    setSearch,
    setOverviewPage,
    selectedBatchId,
    setSelectedBatchId,
    selectedBatch,
    isLoadingBatch,
    batchError,
    submitPaymentProof,
    isSubmittingPaymentProof,
    respondToRevision,
    isRespondingToRevision,
  } = useRequestsController();

  if (isLoadingOverview) {
    return <LoadingCard label="Loading stock requests..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Requests"
        description="Create procurement or self-buy requests using a cart flow"
      />

      {overviewError && <AlertBanner tone="error" message={overviewError} />}

      {overview?.summary ? <RequestsSummaryStrip summary={overview.summary} /> : null}

      <RequestCreatePanel
        stores={stores}
        createStoreScopeId={createStoreScopeId}
        createRequestType={createRequestType}
        createPartnerNotes={createPartnerNotes}
        cartLines={cartLines}
        cartTotals={cartTotals}
        isSubmitting={isSubmitting}
        isProductPickerOpen={isProductPickerOpen}
        productSearchText={productSearchText}
        productOptions={productOptions}
        isLoadingProductOptions={isLoadingProductOptions}
        productOptionsError={productOptionsError}
        productOptionsPage={productOptionsPage}
        effectiveStoreId={effectiveStoreId}
        onStoreScopeChange={setCreateStoreScopeId}
        onRequestTypeChange={setCreateRequestType}
        onPartnerNotesChange={setCreatePartnerNotes}
        onOpenProductPicker={openProductPicker}
        onCloseProductPicker={closeProductPicker}
        onProductSearchChange={setProductSearchText}
        onProductOptionsPageChange={setProductOptionsPage}
        onAddProduct={addProductToCart}
        onRemoveLine={removeCartLine}
        onQuantityChange={updateCartLineQuantity}
        onSubmit={submitRequest}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
        <RequestsQueuePanel
          rows={queueRows}
          stores={queueFilters?.stores ?? []}
          requestTypes={queueFilters?.requestTypes ?? []}
          statuses={queueFilters?.statuses ?? []}
          selectedStoreId={selectedStoreId}
          selectedRequestType={selectedRequestType}
          selectedStatus={selectedStatus}
          search={search}
          page={queuePagination.page}
          totalPages={queuePagination.totalPages}
          total={queuePagination.total}
          selectedBatchId={selectedBatchId}
          onStoreChange={setSelectedStoreId}
          onRequestTypeChange={setSelectedRequestType}
          onStatusChange={setSelectedStatus}
          onSearchChange={setSearch}
          onPageChange={setOverviewPage}
          onSelectBatch={setSelectedBatchId}
        />

        <RequestDetailPanel
          batch={selectedBatch}
          isLoading={isLoadingBatch}
          error={batchError}
          canSubmitPaymentProof={selectedBatch?.status === 'PENDING_PAYMENT'}
          isSubmittingPaymentProof={isSubmittingPaymentProof}
          onSubmitPaymentProof={submitPaymentProof}
          canRespondToRevision={selectedBatch?.status === 'REVISION'}
          isRespondingToRevision={isRespondingToRevision}
          onRespondToRevision={respondToRevision}
        />
      </div>
    </div>
  );
}
