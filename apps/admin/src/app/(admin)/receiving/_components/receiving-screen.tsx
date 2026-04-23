'use client';

import { WmsCompactPanel } from '../../_components/wms-compact-panel';
import { WmsScopeFilterFields } from '../../_components/wms-scope-filter-fields';
import { useReceivingController } from '../_hooks/use-receiving-controller';
import { ReceivableBatchesTable } from './receivable-batches-table';
import { ReceivingBatchModal } from './receiving-batch-modal';
import { ReceivingBatchLabelsModal } from './receiving-batch-labels-modal';
import { ReceivingBatchesTable } from './receiving-batches-table';

export function ReceivingScreen() {
  const controller = useReceivingController();
  const summary = controller.overview?.summary;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="wms-page-title font-medium tracking-tight text-[#12384b]">Receiving</h1>
          <p className="mt-1 text-sm text-[#5f7483]">
            Convert approved purchasing batches into staged serialized stock.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <WmsScopeFilterFields
            storeOptions={(controller.overview?.filters.stores ?? []).map((store) => ({
              value: store.id,
              label: store.label,
            }))}
            selectedStoreId={controller.selectedStoreId}
            onStoreChange={controller.setSelectedStoreId}
            warehouseOptions={(controller.overview?.filters.warehouses ?? []).map((warehouse) => ({
              value: warehouse.id,
              label: `${warehouse.code} · ${warehouse.label}`,
            }))}
            selectedWarehouseId={controller.selectedWarehouseId}
            onWarehouseChange={controller.setSelectedWarehouseId}
          />
          <input
            value={controller.searchText}
            onChange={(event) => controller.setSearchText(event.target.value)}
            placeholder="Search by request, item, or receiving batch"
            className="h-[42px] min-w-[260px] rounded-full border border-[#d7e0e7] bg-white px-4 text-[13px] font-medium text-[#12384b] outline-none transition placeholder:text-[#94a3b8] focus:border-[#96b4c3]"
          />
        </div>
      </div>

      {controller.banner ? (
        <div
          className={`rounded-[24px] border px-4 py-3 text-sm ${
            controller.banner.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {controller.banner.message}
        </div>
      ) : null}

      {controller.errorMessage ? (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {controller.errorMessage}
        </div>
      ) : null}

      <div className="grid gap-3 xl:grid-cols-4">
        <InsightCard label="Receivable" value={(summary?.receivableBatches ?? 0).toLocaleString()} />
        <InsightCard label="Receiving Batches" value={(summary?.receivingBatches ?? 0).toLocaleString()} />
        <InsightCard label="Staged Batches" value={(summary?.stagedBatches ?? 0).toLocaleString()} />
        <InsightCard label="Staged Units" value={(summary?.stagedUnits ?? 0).toLocaleString()} />
      </div>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.85fr)]">
        <WmsCompactPanel
          title="Purchasing Queue"
          eyebrow="Ready For Receiving"
          headerActions={
            <span className="rounded-full border border-[#dce4ea] bg-[#fbfcfc] px-3 py-1 text-[11px] font-semibold text-[#4d6677]">
              {controller.overview?.receivableBatches.length ?? 0} batches
            </span>
          }
        >
          <div className="overflow-hidden rounded-[22px] border border-[#dce4ea] bg-[#fbfcfc]">
            <ReceivableBatchesTable
              batches={controller.overview?.receivableBatches ?? []}
              isLoading={controller.isLoading}
              canReceive={controller.canReceive}
              onReceive={controller.openReceiveModal}
            />
          </div>
        </WmsCompactPanel>

        <WmsCompactPanel
          title="Recent Receiving"
          eyebrow="Staging"
          headerActions={
            <span className="rounded-full border border-[#dce4ea] bg-[#fbfcfc] px-3 py-1 text-[11px] font-semibold text-[#4d6677]">
              {controller.overview?.receivingBatches.length ?? 0} recent
            </span>
          }
        >
          <div className="overflow-hidden rounded-[22px] border border-[#dce4ea] bg-[#fbfcfc]">
            <ReceivingBatchesTable
              batches={controller.overview?.receivingBatches ?? []}
              isLoading={controller.isLoading}
              onViewBatch={controller.openLabelsModal}
            />
          </div>
        </WmsCompactPanel>
      </section>

      <ReceivingBatchModal
        open={controller.receiveModal.open}
        batch={controller.receiveModal.batch}
        warehouseOptions={controller.overview?.warehouseOptions ?? []}
        warehouseId={controller.receiveWarehouseId}
        stagingLocationId={controller.receiveStagingLocationId}
        notes={controller.receiveNotes}
        lineQuantities={controller.lineQuantities}
        totalUnits={controller.modalTotalUnits}
        isSubmitting={controller.isSubmitting}
        onClose={controller.closeReceiveModal}
        onWarehouseChange={controller.setReceiveWarehouseId}
        onStagingLocationChange={controller.setReceiveStagingLocationId}
        onNotesChange={controller.setReceiveNotes}
        onLineQuantityChange={controller.setLineQuantity}
        onSubmit={controller.submitReceive}
      />

      <ReceivingBatchLabelsModal
        open={controller.labelsModal.open}
        isLoading={controller.isLoadingLabelsBatch}
        isRecordingPrint={controller.isRecordingBatchLabelPrint}
        batch={controller.labelsModal.batch}
        canPrintLabels={controller.canPrintLabels}
        onRecordPrint={controller.recordBatchLabelPrint}
        onClose={controller.closeLabelsModal}
      />
    </div>
  );
}

function InsightCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-[#dce4ea] bg-white px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8193a0]">{label}</p>
      <p className="mt-2 text-[1.4rem] font-semibold tracking-tight text-[#12384b]">{value}</p>
    </div>
  );
}
