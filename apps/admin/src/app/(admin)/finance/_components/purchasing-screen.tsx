'use client';

import { useRouter } from 'next/navigation';
import {
  ScanSearch,
} from 'lucide-react';
import { WmsPageShell } from '../../_components/wms-page-shell';
import { WmsInlineNotice } from '../../_components/wms-inline-notice';
import { WmsWorkspaceCard } from '../../_components/wms-workspace-card';
import { ReceivingBatchModal } from '../../receiving/_components/receiving-batch-modal';
import { usePurchasingReceivingBridge } from '../_hooks/use-purchasing-receiving-bridge';
import { usePurchasingController } from '../_hooks/use-purchasing-controller';
import { PurchasingBatchModal } from './purchasing-batch-modal';
import { PurchasingBatchesTable } from './purchasing-batches-table';
import { PurchasingFilterBar } from './purchasing-filter-bar';

export function PurchasingScreen() {
  const router = useRouter();
  const controller = usePurchasingController();
  const pagination = controller.overview?.pagination;
  const receivingBridge = usePurchasingReceivingBridge({
    batch: controller.selectedBatch,
    tenantId: controller.selectedTenantId,
    canPostReceiving: controller.canPostReceiving,
    onCreated: (receivingBatchId) => {
      controller.closeBatch();
      router.push(`/inventory/stock-receiving?printBatch=${receivingBatchId}`);
    },
  });

  return (
    <div className="space-y-5">
      <WmsPageShell title="Purchasing">
        {controller.banner ? (
          <WmsInlineNotice tone={controller.banner.tone}>
            {controller.banner.message}
          </WmsInlineNotice>
        ) : null}

        {controller.errorMessage ? (
          <WmsInlineNotice tone="error">
            {controller.errorMessage}
          </WmsInlineNotice>
        ) : null}

        <WmsWorkspaceCard
          title="Requests"
          filters={(
            <PurchasingFilterBar
              filters={controller.overview?.filters}
              searchText={controller.searchText}
              onSearchTextChange={controller.setSearchText}
              selectedTenantId={controller.selectedTenantId}
              onTenantChange={controller.setSelectedTenantId}
              selectedStoreId={controller.selectedStoreId}
              onStoreChange={controller.setSelectedStoreId}
              selectedRequestType={controller.selectedRequestType}
              onRequestTypeChange={controller.setSelectedRequestType}
              selectedStatus={controller.selectedStatus}
              onStatusChange={controller.setSelectedStatus}
            />
          )}
          footer={(
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[12px] text-[#6f8290]">
                <ScanSearch className="h-3.5 w-3.5 text-[#12384b]" />
                <span>
                  Showing page <span className="font-semibold text-[#12384b]">{pagination?.page ?? 1}</span> of{' '}
                  <span className="font-semibold text-[#12384b]">{pagination?.totalPages ?? 1}</span>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => controller.setCurrentPage(controller.currentPage - 1)}
                  disabled={controller.currentPage <= 1}
                  className="inline-flex h-9 items-center rounded-xl border border-[#d7e0e7] bg-white px-3 text-[12px] font-semibold text-[#4d6677] transition hover:border-[#c6d4dd] hover:text-[#12384b] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Previous
                </button>

                <span className="rounded-full border border-[#dce4ea] bg-[#fbfcfc] px-3.5 py-1.5 text-[12px] font-semibold text-[#12384b]">
                  {(pagination?.total ?? 0).toLocaleString()} total
                </span>

                <button
                  type="button"
                  onClick={() => controller.setCurrentPage(controller.currentPage + 1)}
                  disabled={controller.currentPage >= (pagination?.totalPages ?? 1)}
                  className="inline-flex h-9 items-center rounded-xl border border-[#d7e0e7] bg-white px-3 text-[12px] font-semibold text-[#4d6677] transition hover:border-[#c6d4dd] hover:text-[#12384b] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        >
          <PurchasingBatchesTable
            batches={controller.overview?.batches ?? []}
            isLoading={controller.isLoading}
            tenantReady={controller.overview?.tenantReady ?? false}
            onOpenBatch={controller.openBatch}
          />
        </WmsWorkspaceCard>
      </WmsPageShell>

      <PurchasingBatchModal
        open={controller.isBatchOpen}
        batch={controller.selectedBatch}
        isLoading={controller.isLoadingBatch}
        canEdit={controller.canEdit}
        canCreateReceiving={receivingBridge.canCreateReceiving}
        isUpdatingStatus={controller.isUpdatingStatus}
        isUpdatingLine={controller.isUpdatingLine}
        isCreatingReceiving={receivingBridge.receivingModal.isSubmitting}
        onClose={controller.closeBatch}
        onApplyStatus={controller.applyStatus}
        onUpdateLine={controller.updateLine}
        onCreateReceiving={receivingBridge.receivingModal.openModal}
      />

      <ReceivingBatchModal
        open={receivingBridge.receivingModal.isOpen}
        batch={receivingBridge.receivableBatch}
        warehouseOptions={receivingBridge.receivingModal.warehouseOptions}
        warehouseId={receivingBridge.receivingModal.warehouseId}
        stagingLocationId={receivingBridge.receivingModal.stagingLocationId}
        notes={receivingBridge.receivingModal.notes}
        lineQuantities={receivingBridge.receivingModal.lineQuantities}
        totalUnits={receivingBridge.receivingModal.totalUnits}
        isSubmitting={receivingBridge.receivingModal.isSubmitting}
        onClose={receivingBridge.receivingModal.close}
        onWarehouseChange={receivingBridge.receivingModal.setWarehouseId}
        onStagingLocationChange={receivingBridge.receivingModal.setStagingLocationId}
        onNotesChange={receivingBridge.receivingModal.setNotes}
        onLineQuantityChange={receivingBridge.receivingModal.setLineQuantity}
        onSubmit={receivingBridge.receivingModal.submit}
      />

      {receivingBridge.receivingModal.errorMessage ? (
        <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {receivingBridge.receivingModal.errorMessage}
        </div>
      ) : null}
    </div>
  );
}
