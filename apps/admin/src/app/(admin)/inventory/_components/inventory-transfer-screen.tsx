'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { WmsPageShell } from '../../_components/wms-page-shell';
import { WmsInlineNotice } from '../../_components/wms-inline-notice';
import { WmsWorkspaceCard } from '../../_components/wms-workspace-card';
import { useReceivingController } from '../../receiving/_hooks/use-receiving-controller';
import { InventoryTransfersTab } from './inventory-transfers-tab';
import { useTransferBatchRouteSync } from '../_hooks/use-transfer-batch-route-sync';
import { useInventoryTransferHistory } from '../_hooks/use-inventory-transfer-history';
import { InventoryTransferHistoryFilterBar } from './inventory-transfer-history-filter-bar';
import { InventoryTransferHistoryTable } from './inventory-transfer-history-table';

export function InventoryTransferScreen() {
  const router = useRouter();
  const [activeView, setActiveView] = useState<'putaway' | 'history'>('putaway');
  const receiving = useReceivingController();
  const history = useInventoryTransferHistory(activeView === 'history');
  const transferBatches = (receiving.overview?.receivingBatches ?? []).filter(
    (batch) =>
      batch.labelPrintCount > 0
      && (batch.status === 'STAGED' || batch.status === 'PUTAWAY_PENDING'),
  );
  useTransferBatchRouteSync({
    transferBatches,
    selectedBatchId: receiving.transferWorkspace.selectedBatchId,
    onSelectBatch: receiving.selectTransferBatch,
  });

  return (
    <div className="space-y-4">
      <WmsPageShell title="Transfer">
        <div className="flex flex-wrap items-center gap-2">
          <ViewButton
            active={activeView === 'putaway'}
            label="Put-away"
            onClick={() => setActiveView('putaway')}
          />
          <ViewButton
            active={activeView === 'history'}
            label="History"
            onClick={() => setActiveView('history')}
          />
        </div>

        {activeView === 'putaway' ? (
          <>
            {receiving.errorMessage ? (
              <WmsInlineNotice tone="error">
                {receiving.errorMessage}
              </WmsInlineNotice>
            ) : null}

            <InventoryTransfersTab
              batches={transferBatches}
              selectedBatchId={receiving.transferWorkspace.selectedBatchId}
              selectedBatch={receiving.transferWorkspace.selectedBatch}
              batchDetail={receiving.transferWorkspace.batchDetail}
              putawayOptions={receiving.putawayOptions}
              isLoadingBatches={receiving.isLoading}
              isLoadingPutawayOptions={receiving.isLoadingPutawayOptions}
              isAssigningPutaway={receiving.isAssigningPutaway}
              canPutAway={receiving.canPutAway}
              onSelectBatch={receiving.selectTransferBatch}
              onOpenLabels={(batch) => {
                router.push(`/inventory/stock-receiving?printBatch=${batch.id}`);
              }}
              onAssignPutawayUnits={receiving.assignPutawayUnits}
              onAssignPutawayUnit={receiving.assignPutawayUnit}
            />
          </>
        ) : (
          <>
            {history.errorMessage ? (
              <WmsInlineNotice tone="error">
                {history.errorMessage}
              </WmsInlineNotice>
            ) : null}

            <WmsWorkspaceCard
              title="Transfer History"
              filters={(
                <InventoryTransferHistoryFilterBar
                  filters={history.history?.filters}
                  searchText={history.searchText}
                  onSearchTextChange={history.setSearchText}
                  selectedTenantId={history.selectedTenantId}
                  onTenantChange={history.setSelectedTenantId}
                  selectedWarehouseId={history.selectedWarehouseId}
                  onWarehouseChange={history.setSelectedWarehouseId}
                />
              )}
              footer={(
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[12px] text-[#6f8290]">
                    {history.history?.summary.transfers ?? 0} transfer{(history.history?.summary.transfers ?? 0) === 1 ? '' : 's'}
                    {' · '}
                    {history.history?.summary.movedUnits ?? 0} moved unit{(history.history?.summary.movedUnits ?? 0) === 1 ? '' : 's'}
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => history.setCurrentPage(history.currentPage - 1)}
                      disabled={history.currentPage === 1}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#d7e0e7] bg-white text-[#4d6677] transition hover:border-[#c6d4dd] hover:text-[#12384b] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>

                    <span className="rounded-full border border-[#dce4ea] bg-[#fbfcfc] px-3.5 py-1.5 text-[12px] font-semibold text-[#12384b]">
                      {history.currentPage} / {history.totalPages}
                    </span>

                    <button
                      type="button"
                      onClick={() => history.setCurrentPage(history.currentPage + 1)}
                      disabled={history.currentPage === history.totalPages}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#d7e0e7] bg-white text-[#4d6677] transition hover:border-[#c6d4dd] hover:text-[#12384b] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            >
              <InventoryTransferHistoryTable
                transfers={history.transfers}
                isLoading={history.isLoading}
                tenantReady={history.history?.tenantReady ?? false}
              />
            </WmsWorkspaceCard>
          </>
        )}
      </WmsPageShell>
    </div>
  );
}

function ViewButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
        active
          ? 'border-[#12384b] bg-[#12384b] text-white'
          : 'border-[#d7e0e7] bg-white text-[#4f6776] hover:border-[#c6d4dd] hover:text-[#12384b]'
      }`}
    >
      {label}
    </button>
  );
}
