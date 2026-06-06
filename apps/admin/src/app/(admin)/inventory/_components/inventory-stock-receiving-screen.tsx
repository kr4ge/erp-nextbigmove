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
import { Package } from 'lucide-react';

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
    router.replace(nextUrl, { scroll: false });
  }, [
    labelsModal.open,
    openLabelsModal,
    pathname,
    printBatchId,
    receivingBatches,
    router,
    searchParams,
  ]);

  function openTransfer(batchId: string) {
    router.push(`/inventory/transfer?batch=${batchId}`);
  }

  const manualInputDisabled = !receiving.canManualInput || !receiving.manualStoreId;
  const manualInputTitle = !receiving.canManualInput
    ? 'This account does not have manual stock input permission.'
    : !receiving.manualStoreId
      ? 'Select a store to enable manual stock input.'
      : undefined;

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
          icon={<Package className='panel-icon' />}
          actions={(
            <button
              type="button"
              onClick={() => receiving.openManualReceiveModal()}
              disabled={manualInputDisabled}
              title={manualInputTitle}
              className="pill pill-ghost flex gap-1.5 rounded-lg disabled:cursor-not-allowed disabled:opacity-50"
            >
              Manual Input
            </button>
          )}
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
        onUnitCostChange={receiving.setManualLineUnitCost}
        onSubmit={receiving.submitManualReceive}
      />
    </div>
  );
}
