'use client';

import { ChevronLeft, ChevronRight, PackageCheck, RefreshCcw } from 'lucide-react';
import { WmsInlineNotice } from '../../_components/wms-inline-notice';
import { WmsPageShell } from '../../_components/wms-page-shell';
import { WmsWorkspaceCard } from '../../_components/wms-workspace-card';
import { useFulfillmentQueueController } from '../_hooks/use-fulfillment-queue-controller';
import type { WmsFulfillmentQueueMode } from '../_types/fulfillment';
import { FulfillmentQueueFilterBar } from './fulfillment-queue-filter-bar';
import { FulfillmentQueueTable } from './fulfillment-queue-table';

type FulfillmentQueueScreenProps = {
  mode: WmsFulfillmentQueueMode;
};

export function FulfillmentQueueScreen({ mode }: FulfillmentQueueScreenProps) {
  const queue = useFulfillmentQueueController(mode);
  const isPick = mode === 'pick';
  const title = isPick ? 'Pick Queue' : 'Pack Queue';
  const scopeLabel = queue.queueScope === 'own' ? 'My queue' : 'All queues';

  return (
    <div className="space-y-5">
      <WmsPageShell
        title={title}
        breadcrumb="Fulfillment"
        description={
          isPick
            ? 'Read-only queue visibility for WMS web. Supervisors can monitor the full pick queue, while picker accounts are scoped to their own claimed orders.'
            : 'Read-only queue visibility for WMS web. Packer execution will be added in this Pack workspace after the queue structure is finalized.'
        }
        actions={(
          <>
            <span className="inline-flex h-11 items-center rounded-full border border-[#d7e0e7] bg-white px-4 text-[12px] font-semibold text-[#12384b]">
              {scopeLabel}
            </span>
            <button
              type="button"
              onClick={queue.refresh}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-[#d7e0e7] bg-white px-4 text-[12px] font-semibold text-[#12384b] transition hover:border-[#c6d4dd]"
            >
              <RefreshCcw className={`h-4 w-4 ${queue.isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </>
        )}
      >
        {queue.errorMessage ? (
          <WmsInlineNotice tone="error">
            {queue.errorMessage}
          </WmsInlineNotice>
        ) : null}

        <WmsInlineNotice tone="info">
          {queue.queueScope === 'own'
            ? `This ${title.toLowerCase()} is scoped to orders assigned to your WMS task role.`
            : `This ${title.toLowerCase()} is a monitoring view. Queue actions stay disabled in WMS web for this stage.`}
        </WmsInlineNotice>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {queue.summaryItems.map((item) => (
            <div
              key={item.id}
              className="rounded-[22px] border border-[#dce4ea] bg-white px-5 py-4 shadow-[0_16px_40px_-34px_rgba(18,56,75,0.32)]"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8193a0]">{item.label}</p>
              <p className="mt-2 text-[28px] font-semibold tracking-tight text-[#12384b]">{item.value}</p>
            </div>
          ))}
        </div>

        <WmsWorkspaceCard
          title={title}
          icon={<PackageCheck className='panel-icon' />}
          filters={(
            <FulfillmentQueueFilterBar
              tenantOptions={queue.tenantOptions}
              selectedTenantId={queue.selectedTenantId}
              onTenantChange={queue.setSelectedTenantId}
              storeOptions={queue.storeOptions}
              selectedStoreId={queue.selectedStoreId}
              onStoreChange={queue.setSelectedStoreId}
              selectedStatus={queue.selectedStatus}
              onStatusChange={queue.setSelectedStatus}
              statusOptions={queue.statusOptions}
            />
          )}
          footer={(
            <div className="flex items-center justify-between gap-3">
              <p className="text-[12px] text-[#6f8290]">
                {queue.data?.pagination.total ?? 0} order{(queue.data?.pagination.total ?? 0) === 1 ? '' : 's'} in view
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => queue.setCurrentPage(queue.currentPage - 1)}
                  disabled={queue.currentPage === 1}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#d7e0e7] bg-white text-[#4d6677] transition hover:border-[#c6d4dd] hover:text-[#12384b] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <span className="rounded-full border border-[#dce4ea] bg-[#fbfcfc] px-3.5 py-1.5 text-[12px] font-semibold text-[#12384b]">
                  {queue.currentPage} / {queue.totalPages}
                </span>

                <button
                  type="button"
                  onClick={() => queue.setCurrentPage(queue.currentPage + 1)}
                  disabled={queue.currentPage >= queue.totalPages}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#d7e0e7] bg-white text-[#4d6677] transition hover:border-[#c6d4dd] hover:text-[#12384b] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        >
          <FulfillmentQueueTable
            mode={mode}
            tasks={queue.tasks}
            isLoading={queue.isLoading}
            tenantReady={queue.tenantReady}
          />
        </WmsWorkspaceCard>
      </WmsPageShell>
    </div>
  );
}
