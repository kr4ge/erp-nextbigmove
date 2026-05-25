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
  const paginationTotal = queue.data?.pagination.total ?? 0;
  const paginationPageSize = queue.data?.pagination.pageSize ?? queue.tasks.length;
  const paginationStart = paginationTotal === 0 ? 0 : ((queue.currentPage - 1) * paginationPageSize) + 1;
  const paginationEnd = paginationTotal === 0
    ? 0
    : Math.min(paginationTotal, paginationStart + queue.tasks.length - 1);

  return (
    <div className="space-y-5">
      <WmsPageShell
        title={title}
        actions={(
          <>
            <span
              className="btn btn-md btn-outline"
            >
              {scopeLabel}
            </span>
            <button
              type="button"
              onClick={queue.refresh}
              className="btn btn-md btn-outline btn-icon"
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

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {queue.summaryItems.map((item) => (
            <div
              key={item.id}
              className="card"
            >
              <p className="card-label">{item.label}</p>
              <p className="card-value">{item.value}</p>
            </div>
          ))}
        </div>

        <WmsWorkspaceCard
          title={title}
          icon={<PackageCheck className='panel-icon' />}
          filters={(
            <FulfillmentQueueFilterBar
              searchText={queue.searchText}
              onSearchTextChange={queue.setSearchText}
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
              <p className="text-sm text-slate-600">
                Showing {paginationStart}-{paginationEnd} of {paginationTotal}
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
