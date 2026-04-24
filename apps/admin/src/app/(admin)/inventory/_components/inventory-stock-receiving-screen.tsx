'use client';

import { useEffect, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { WmsPageShell } from '../../_components/wms-page-shell';
import { WmsInlineNotice } from '../../_components/wms-inline-notice';
import { WmsWorkspaceCard } from '../../_components/wms-workspace-card';
import { ManualReceivingModal } from '../../receiving/_components/manual-receiving-modal';
import { ReceivingBatchLabelsModal } from '../../receiving/_components/receiving-batch-labels-modal';
import { ReceivingBatchesTable } from '../../receiving/_components/receiving-batches-table';
import { useReceivingController } from '../../receiving/_hooks/use-receiving-controller';
import { InventoryOperationsFilterBar } from './inventory-operations-filter-bar';

export function InventoryStockReceivingScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const receiving = useReceivingController();
  const { labelsModal, openLabelsModal } = receiving;
  const receivingBatches = useMemo(
    () => receiving.overview?.receivingBatches ?? [],
    [receiving.overview?.receivingBatches],
  );
  const printBatchId = searchParams.get('printBatch');

  useEffect(() => {
    if (!printBatchId || labelsModal.open) {
      return;
    }

    const targetBatch = receivingBatches.find((batch) => batch.id === printBatchId);

    if (!targetBatch) {
      return;
    }

    openLabelsModal(targetBatch);

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('printBatch');
    const nextUrl = nextParams.toString() ? `${pathname}?${nextParams.toString()}` : pathname;
    window.history.replaceState(window.history.state, '', nextUrl);
  }, [
    labelsModal.open,
    openLabelsModal,
    pathname,
    printBatchId,
    receivingBatches,
    searchParams,
  ]);

  function openTransfer(batchId: string) {
    router.push(`/inventory/transfer?batch=${batchId}`);
  }

  return (
    <div className="space-y-5">
      <WmsPageShell title="Stock Receiving">
        {receiving.banner ? (
          <WmsInlineNotice tone={receiving.banner.tone}>
            {receiving.banner.message}
          </WmsInlineNotice>
        ) : null}

        {receiving.errorMessage ? (
          <WmsInlineNotice tone="error">
            {receiving.errorMessage}
          </WmsInlineNotice>
        ) : null}

        <WmsWorkspaceCard
          title="Batches"
          actions={receiving.canManualInput ? (
            <button
              type="button"
              onClick={() => receiving.openManualReceiveModal()}
              disabled={!receiving.manualStoreId}
              className="inline-flex h-9 items-center rounded-[12px] border border-[#d7e0e7] bg-white px-3.5 text-[12px] font-semibold text-[#12384b] transition hover:border-[#c6d4dd] hover:bg-[#f8fafb] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Manual Input
            </button>
          ) : null}
          filters={(
            <InventoryOperationsFilterBar
              filters={receiving.overview?.filters}
              searchText={receiving.searchText}
              onSearchTextChange={receiving.setSearchText}
              selectedTenantId={receiving.selectedTenantId}
              onTenantChange={receiving.setSelectedTenantId}
              selectedStoreId={receiving.selectedStoreId}
              onStoreChange={receiving.setSelectedStoreId}
              selectedWarehouseId={receiving.selectedWarehouseId}
              onWarehouseChange={receiving.setSelectedWarehouseId}
            />
          )}
        >
          <ReceivingBatchesTable
            batches={receivingBatches}
            isLoading={receiving.isLoading}
            onViewBatch={receiving.openLabelsModal}
            canTransferBatch={receiving.canPutAway}
            onTransferBatch={(batch) => openTransfer(batch.id)}
          />
        </WmsWorkspaceCard>
      </WmsPageShell>

      <ReceivingBatchLabelsModal
        open={receiving.labelsModal.open}
        isLoading={receiving.isLoadingLabelsBatch}
        isRecordingPrint={receiving.isRecordingBatchLabelPrint}
        batch={receiving.labelsModal.batch}
        canPrintLabels={receiving.canPrintLabels}
        canOpenTransfer={receiving.canPutAway}
        onRecordPrint={receiving.recordBatchLabelPrint}
        onOpenTransfer={openTransfer}
        onClose={receiving.closeLabelsModal}
      />

      <ManualReceivingModal
        open={receiving.manualReceiveModal.open}
        storeName={receiving.manualStoreName}
        warehouseOptions={receiving.overview?.warehouseOptions ?? []}
        warehouseId={receiving.manualWarehouseId}
        stagingLocationId={receiving.manualStagingLocationId}
        notes={receiving.manualNotes}
        lines={receiving.manualLines}
        productOptions={receiving.manualProductOptions}
        isLoadingProducts={receiving.isLoadingManualProducts}
        isSubmitting={receiving.isSubmitting}
        totalUnits={receiving.manualModalTotalUnits}
        onClose={receiving.closeManualReceiveModal}
        onWarehouseChange={receiving.setManualWarehouseId}
        onStagingLocationChange={receiving.setManualStagingLocationId}
        onNotesChange={receiving.setManualNotes}
        onAddProduct={receiving.addManualProduct}
        onRemoveLine={receiving.removeManualLine}
        onQuantityChange={receiving.setManualLineQuantity}
        onSubmit={receiving.submitManualReceive}
      />
    </div>
  );
}
