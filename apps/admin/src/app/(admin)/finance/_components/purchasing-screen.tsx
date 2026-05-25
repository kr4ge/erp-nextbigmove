'use client';

import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  Clipboard,
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

const NOTICE_AUTO_DISMISS_MS = 5000;

export function PurchasingScreen() {
  const router = useRouter();
  const controller = usePurchasingController();
  const pagination = controller.overview?.pagination;
  const paginationTotal = pagination?.total ?? 0;
  const paginationPageSize = pagination?.pageSize ?? (controller.overview?.batches.length ?? 0);
  const paginationStart = paginationTotal === 0 ? 0 : ((controller.currentPage - 1) * paginationPageSize) + 1;
  const paginationEnd = paginationTotal === 0
    ? 0
    : Math.min(paginationTotal, paginationStart + (controller.overview?.batches.length ?? 0) - 1);
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
          <WmsInlineNotice
            tone={controller.banner.tone}
            dismissible
            autoDismissMs={NOTICE_AUTO_DISMISS_MS}
            onDismiss={controller.clearBanner}
          >
            {controller.banner.message}
          </WmsInlineNotice>
        ) : null}

        {controller.errorMessage ? (
          <WmsInlineNotice
            tone="error"
            dismissible
            autoDismissMs={NOTICE_AUTO_DISMISS_MS}
          >
            {controller.errorMessage}
          </WmsInlineNotice>
        ) : null}

        <WmsWorkspaceCard
          title="Requests"
          icon={<Clipboard className='panel-icon' />}
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
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-slate-600">
                Showing {paginationStart}-{paginationEnd} of {paginationTotal}
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => controller.setCurrentPage(controller.currentPage - 1)}
                  disabled={controller.currentPage <= 1}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#d7e0e7] bg-white text-[#4d6677] transition hover:border-[#c6d4dd] hover:text-[#12384b] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <span className="rounded-full border border-[#dce4ea] bg-[#fbfcfc] px-3.5 py-1.5 text-[12px] font-semibold text-[#12384b]">
                  {pagination?.page ?? 1} / {pagination?.totalPages ?? 1}
                </span>

                <button
                  type="button"
                  onClick={() => controller.setCurrentPage(controller.currentPage + 1)}
                  disabled={controller.currentPage >= (pagination?.totalPages ?? 1)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#d7e0e7] bg-white text-[#4d6677] transition hover:border-[#c6d4dd] hover:text-[#12384b] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <ChevronRight className="h-4 w-4" />
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
