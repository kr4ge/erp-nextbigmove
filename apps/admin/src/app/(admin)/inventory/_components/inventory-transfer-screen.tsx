'use client';

import { useRouter } from 'next/navigation';
import { WmsPageShell } from '../../_components/wms-page-shell';
import { WmsInlineNotice } from '../../_components/wms-inline-notice';
import { useReceivingController } from '../../receiving/_hooks/use-receiving-controller';
import { InventoryTransfersTab } from './inventory-transfers-tab';
import { useTransferBatchRouteSync } from '../_hooks/use-transfer-batch-route-sync';

export function InventoryTransferScreen() {
  const router = useRouter();
  const receiving = useReceivingController();
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
      </WmsPageShell>
    </div>
  );
}
