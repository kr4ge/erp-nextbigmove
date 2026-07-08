'use client';

import { useEffect, useState } from 'react';
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

type PickQueueView = 'orders' | 'baskets';

export function FulfillmentQueueScreen({ mode }: FulfillmentQueueScreenProps) {
  const queue = useFulfillmentQueueController(mode);
  const [pickView, setPickView] = useState<PickQueueView>('orders');
  const isPick = mode === 'pick';
  const showStatusFilter = !isPick || pickView === 'orders';
  const title = isPick ? 'Pick Queue' : 'Pack Queue';
  const scopeLabel = queue.queueScope === 'own' ? 'My queue' : 'All queues';
  const canBulkReallocate = queue.queueScope === 'all';
  const basketCount = queue.heldBaskets.length;
  const paginationTotal = pickView === 'baskets' && isPick ? basketCount : (queue.data?.pagination.total ?? 0);
  const paginationPageSize = pickView === 'baskets' && isPick
    ? basketCount
    : (queue.data?.pagination.pageSize ?? queue.tasks.length);
  const paginationStart = paginationTotal === 0 ? 0 : ((queue.currentPage - 1) * paginationPageSize) + 1;
  const paginationEnd = paginationTotal === 0
    ? 0
    : Math.min(paginationTotal, paginationStart + (pickView === 'baskets' && isPick ? basketCount : queue.tasks.length) - 1);
  const { currentPage, selectedStatus, setCurrentPage, setSelectedStatus } = queue;

  useEffect(() => {
    if (!isPick && pickView !== 'orders') {
      setPickView('orders');
    }
  }, [isPick, pickView]);

  useEffect(() => {
    if (isPick && pickView === 'baskets' && selectedStatus) {
      setSelectedStatus('');
    }
  }, [isPick, pickView, selectedStatus, setSelectedStatus]);

  useEffect(() => {
    if (isPick && pickView === 'baskets' && currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [currentPage, isPick, pickView, setCurrentPage]);

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
            {isPick ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    void queue.reallocatePickQueue();
                  }}
                  disabled={queue.isReallocating || queue.requiresTenantSelectionForResync || !canBulkReallocate}
                  className="btn btn-md btn-outline btn-icon"
                  title={
                    queue.requiresTenantSelectionForResync
                      ? 'Select a partner before reallocating waiting pick orders.'
                      : !canBulkReallocate
                        ? 'Only supervisors can reallocate the full pick queue from WMS Web.'
                        : undefined
                  }
                >
                  <PackageCheck className={`h-4 w-4 ${queue.isReallocating ? 'animate-pulse' : ''}`} />
                  Reallocate waiting
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void queue.resyncPickQueue();
                  }}
                  disabled={queue.isResyncing || queue.requiresTenantSelectionForResync}
                  className="btn btn-md btn-outline btn-icon"
                  title={queue.requiresTenantSelectionForResync ? 'Select a partner before resyncing the pick queue.' : undefined}
                >
                  <RefreshCcw className={`h-4 w-4 ${queue.isResyncing ? 'animate-spin' : ''}`} />
                  Resync queue
                </button>
              </>
            ) : null}
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

        {queue.notice ? (
          <WmsInlineNotice
            tone={queue.notice.tone}
            dismissible
            autoDismissMs={5000}
            onDismiss={queue.clearNotice}
          >
            {queue.notice.message}
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
            <div className="space-y-3">
              {isPick ? (
                <div className="border-b border-[#dce4ea]">
                  <div className="flex items-end gap-8">
                    <PickQueueTab
                      active={pickView === 'orders'}
                      onClick={() => setPickView('orders')}
                    >
                      Orders
                    </PickQueueTab>
                    <PickQueueTab
                      active={pickView === 'baskets'}
                      onClick={() => setPickView('baskets')}
                    >
                      Baskets
                    </PickQueueTab>
                  </div>
                </div>
              ) : null}

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
                showStatusFilter={showStatusFilter}
              />
            </div>
          )}
          footer={(
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-slate-600">
                {pickView === 'baskets' && isPick
                  ? `${basketCount} active basket${basketCount === 1 ? '' : 's'}`
                  : `Showing ${paginationStart}-${paginationEnd} of ${paginationTotal}`}
              </p>

              {pickView === 'baskets' && isPick ? null : (
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
              )}
            </div>
          )}
        >
          <FulfillmentQueueTable
            mode={mode}
            tasks={queue.tasks}
            heldBaskets={queue.heldBaskets}
            isLoading={queue.isLoading}
            tenantReady={queue.tenantReady}
            pickView={pickView}
            canVoidPickBaskets={isPick && queue.queueScope === 'all'}
            isVoidingPickBasket={queue.isVoidingBasket}
            onVoidPickBasket={queue.voidPickBasket}
            onRefresh={queue.refresh}
          />
        </WmsWorkspaceCard>
      </WmsPageShell>
    </div>
  );
}

function PickQueueTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative -mb-px border-b-[3px] px-0 pb-4 text-[14px] font-semibold transition ${
        active
          ? 'border-orange-500 text-primary'
          : 'border-transparent text-[#526879] hover:text-primary'
      }`}
    >
      {children}
    </button>
  );
}
