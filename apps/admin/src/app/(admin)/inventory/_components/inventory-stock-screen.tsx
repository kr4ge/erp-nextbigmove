'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { WmsPageShell } from '../../_components/wms-page-shell';
import { WmsInlineNotice } from '../../_components/wms-inline-notice';
import { WmsWorkspaceCard } from '../../_components/wms-workspace-card';
import { useInventoryController } from '../_hooks/use-inventory-controller';
import { InventoryFilterBar } from './inventory-filter-bar';
import { InventoryUnitModal } from './inventory-unit-modal';
import { InventoryUnitsTable } from './inventory-units-table';

export function InventoryStockScreen() {
  const inventory = useInventoryController();

  return (
    <div className="space-y-5">
      <WmsPageShell title="Stock">
        {inventory.errorMessage ? (
          <WmsInlineNotice tone="error">
            {inventory.errorMessage}
          </WmsInlineNotice>
        ) : null}

        <WmsWorkspaceCard
          title="Units"
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
          footer={(
            <div className="flex items-center justify-between gap-3">
              <p className="text-[12px] text-[#6f8290]">
                {inventory.overview?.summary.units ?? 0} unit{(inventory.overview?.summary.units ?? 0) === 1 ? '' : 's'} in scope
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => inventory.setCurrentPage(inventory.currentPage - 1)}
                  disabled={inventory.currentPage === 1}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#d7e0e7] bg-white text-[#4d6677] transition hover:border-[#c6d4dd] hover:text-[#12384b] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <span className="rounded-full border border-[#dce4ea] bg-[#fbfcfc] px-3.5 py-1.5 text-[12px] font-semibold text-[#12384b]">
                  {inventory.currentPage} / {inventory.totalPages}
                </span>

                <button
                  type="button"
                  onClick={() => inventory.setCurrentPage(inventory.currentPage + 1)}
                  disabled={inventory.currentPage === inventory.totalPages}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#d7e0e7] bg-white text-[#4d6677] transition hover:border-[#c6d4dd] hover:text-[#12384b] disabled:cursor-not-allowed disabled:opacity-45"
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
        isRecordingPrint={inventory.isRecordingUnitLabelPrint}
        isLoadingMovements={inventory.isLoadingUnitMovements}
        isLoadingTransferOptions={inventory.isLoadingUnitTransferOptions}
        isTransferringUnit={inventory.isTransferringUnit}
        onRecordPrint={inventory.recordUnitLabelPrint}
        onTransferUnit={inventory.transferUnit}
        onClose={inventory.closeUnitModal}
      />
    </div>
  );
}
