'use client';

import { Archive, ChevronLeft, ChevronRight, Shuffle, X } from 'lucide-react';
import { WmsPageShell } from '../../_components/wms-page-shell';
import { WmsInlineNotice } from '../../_components/wms-inline-notice';
import { WmsWorkspaceCard } from '../../_components/wms-workspace-card';
import { useInventoryController } from '../_hooks/use-inventory-controller';
import { InventoryFilterBar } from './inventory-filter-bar';
import { InventoryStockDashboard } from './inventory-stock-dashboard';
import { InventoryStoreTransferModal } from './inventory-store-transfer-modal';
import { InventoryUnitModal } from './inventory-unit-modal';
import { InventoryUnitsTable } from './inventory-units-table';

export function InventoryStockScreen() {
  const inventory = useInventoryController();

  return (
    <div className="space-y-5">
      <WmsPageShell
        title="Stock Control"
      >
        {inventory.errorMessage ? (
          <WmsInlineNotice tone="error">
            {inventory.errorMessage}
          </WmsInlineNotice>
        ) : null}

        <InventoryStockDashboard
          overview={inventory.overview}
          isFetching={inventory.isFetching}
          filters={(
            <InventoryFilterBar
              filters={inventory.overview?.filters}
              searchText={inventory.searchText}
              onSearchTextChange={inventory.setSearchText}
              selectedTenantId={inventory.selectedTenantId}
              onTenantChange={inventory.setSelectedTenantId}
              selectedStoreId={inventory.selectedStoreId}
              onStoreChange={inventory.setSelectedStoreId}
              selectedWarehouseId={inventory.selectedWarehouseId}
              onWarehouseChange={inventory.setSelectedWarehouseId}
              selectedStatus={inventory.selectedStatus}
              onStatusChange={inventory.setSelectedStatus}
            />
          )}
        />

        <WmsWorkspaceCard
          title="Stock Records"
          icon={<Archive className='panel-icon' />}
          actions={(
            <div className="flex flex-wrap items-center justify-end gap-2">
              {inventory.selectedUnitIds.length > 0 ? (
                <button
                  type="button"
                  onClick={inventory.clearUnitSelection}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#d7e0e7] bg-white px-3 text-[12px] font-semibold text-[#4d6677] transition hover:border-[#c6d4dd] hover:bg-[#f8fafb]"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear {inventory.selectedUnitIds.length}
                </button>
              ) : null}
              <button
                type="button"
                onClick={inventory.openStoreTransferModal}
                disabled={!inventory.canTransferUnits || inventory.selectedUnitIds.length === 0}
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-primary px-3.5 text-[12px] font-semibold text-white transition hover:bg-[#0f3242] disabled:cursor-not-allowed disabled:opacity-45"
                title={!inventory.canTransferUnits ? 'Transfer permission required.' : undefined}
              >
                <Shuffle className="h-3.5 w-3.5" />
                Transfer to store
              </button>
            </div>
          )}
          footer={(
            <div className="flex items-center justify-between gap-3">
              <p className="text-[12px] text-[#6f8290]">
                {inventory.overview?.summary.units ?? 0} record{(inventory.overview?.summary.units ?? 0) === 1 ? '' : 's'} in view
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => inventory.setCurrentPage(inventory.currentPage - 1)}
                  disabled={inventory.currentPage === 1}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#d7e0e7] bg-white text-[#4d6677] transition hover:border-[#c6d4dd] hover:text-primary disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <span className="rounded-full border border-[#dce4ea] bg-[#fbfcfc] px-3.5 py-1.5 text-[12px] font-semibold text-primary">
                  {inventory.currentPage} / {inventory.totalPages}
                </span>

                <button
                  type="button"
                  onClick={() => inventory.setCurrentPage(inventory.currentPage + 1)}
                  disabled={inventory.currentPage === inventory.totalPages}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#d7e0e7] bg-white text-[#4d6677] transition hover:border-[#c6d4dd] hover:text-primary disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        >
          <InventoryUnitsTable
            units={inventory.units}
            isLoading={inventory.isLoading}
            tenantReady={inventory.overview?.tenantReady ?? false}
            selectedUnitIds={inventory.selectedUnitIds}
            canSelectUnits={inventory.canTransferUnits}
            onToggleUnitSelection={inventory.toggleUnitSelection}
            onToggleVisibleUnitSelection={inventory.toggleVisibleUnitSelection}
            onViewUnit={inventory.openUnitModal}
          />
        </WmsWorkspaceCard>
      </WmsPageShell>

      <InventoryUnitModal
        open={inventory.unitModal.open}
        unit={inventory.unitModal.unit}
        movements={inventory.unitMovements}
        transferOptions={inventory.transferOptions}
        canPrintLabels={inventory.canPrintLabels}
        canTransferUnits={inventory.canTransferUnits}
        canAdjustUnits={inventory.canAdjustUnits}
        canVoidUnits={inventory.canVoidUnits}
        isRecordingPrint={inventory.isRecordingUnitLabelPrint}
        isLoadingMovements={inventory.isLoadingUnitMovements}
        isLoadingTransferOptions={inventory.isLoadingUnitTransferOptions}
        isTransferringUnit={inventory.isTransferringUnit}
        isAdjustingUnit={inventory.isAdjustingUnit}
        isVoidingUnit={inventory.isVoidingUnit}
        onRecordPrint={inventory.recordUnitLabelPrint}
        onTransferUnit={inventory.transferUnit}
        onAdjustUnit={inventory.adjustUnit}
        onVoidUnit={inventory.voidUnit}
        onClose={inventory.closeUnitModal}
      />

      <InventoryStoreTransferModal
        open={inventory.storeTransferModal.open}
        units={inventory.selectedUnits}
        options={inventory.storeTransferOptions}
        targetStoreId={inventory.storeTransferModal.targetStoreId}
        targetProfileId={inventory.storeTransferModal.targetProfileId}
        notes={inventory.storeTransferModal.notes}
        preview={inventory.storeTransferPreview}
        isLoadingOptions={inventory.isLoadingStoreTransferOptions}
        isLoadingPreview={inventory.isLoadingStoreTransferPreview}
        previewErrorMessage={inventory.storeTransferPreviewErrorMessage}
        isSubmitting={inventory.isTransferringStoreUnits}
        errorMessage={inventory.storeTransferModal.errorMessage}
        onTargetStoreChange={inventory.setStoreTransferTargetStoreId}
        onTargetProfileChange={inventory.setStoreTransferTargetProfileId}
        onNotesChange={inventory.setStoreTransferNotes}
        onSubmit={inventory.submitStoreTransfer}
        onClose={inventory.closeStoreTransferModal}
      />
    </div>
  );
}
