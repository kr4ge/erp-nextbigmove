'use client';

import { ChevronLeft, ChevronRight, PackageCheck, RefreshCcw } from 'lucide-react';
import { WmsInlineNotice } from '../../_components/wms-inline-notice';
import { WmsPageShell } from '../../_components/wms-page-shell';
import { WmsWorkspaceCard } from '../../_components/wms-workspace-card';
import { useFulfillmentPackController } from '../_hooks/use-fulfillment-pack-controller';
import { FulfillmentPackExecutionPanel } from './fulfillment-pack-execution-panel';
import { FulfillmentPackQueueList } from './fulfillment-pack-queue-list';

export function FulfillmentPackScreen() {
  const pack = useFulfillmentPackController();

  return (
    <div className="space-y-5">
      <WmsPageShell
        title="Pack Queue"
        actions={(
          <>
            <select
              value={pack.selectedStatus}
              onChange={(event) => pack.setSelectedStatus(event.target.value)}
              className="h-11 min-w-[180px] rounded-2xl border border-[#d7e0e7] bg-white px-3.5 text-[13px] font-semibold text-[#12384b] outline-none transition focus:border-[#96b4c3] focus:shadow-[0_0_0_4px_rgba(18,56,75,0.08)]"
              aria-label="Filter pack orders by status"
            >
              {pack.statusOptions.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={pack.refresh}
              className='btn btn-md btn-outline btn-icon'
              >
              <RefreshCcw className={`h-4 w-4 ${pack.isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </>
        )}
      >
        {pack.errorMessage ? (
          <WmsInlineNotice tone="error">
            {pack.errorMessage}
          </WmsInlineNotice>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {pack.summaryItems.map((item) => (
            <div
              key={item.id}
              className="card"
            >
              <p className="card-label">{item.label}</p>
              <p className="card-value">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-5 xl:grid-cols-12">
          <WmsWorkspaceCard
            className="xl:col-span-3"
            title="Pack Orders"
            icon={<PackageCheck className='panel-icon' />}
            footer={(
              <div className="flex items-center justify-between">
                <p className="text-sm-custom text-[#6f8290]">
                  {pack.tasks.length} order{pack.tasks.length === 1 ? '' : 's'}
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => pack.setCurrentPage(pack.currentPage - 1)}
                    disabled={pack.currentPage === 1}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#d7e0e7] bg-white text-[#4d6677] transition hover:border-[#c6d4dd] hover:text-[#12384b] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <span className="rounded-full border border-[#dce4ea] bg-[#fbfcfc] px-3.5 py-1.5 text-xs font-semibold text-[#12384b]">
                    {pack.currentPage} / {pack.totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() => pack.setCurrentPage(pack.currentPage + 1)}
                    disabled={pack.currentPage >= pack.totalPages}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#d7e0e7] bg-white text-[#4d6677] transition hover:border-[#c6d4dd] hover:text-[#12384b] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          >
            <FulfillmentPackQueueList
              activeTaskId={pack.activeTask?.id ?? null}
              tasks={pack.tasks}
              isLoading={pack.isLoading}
              tenantReady={pack.tenantReady}
              onSelectTask={pack.setActiveTaskId}
            />
          </WmsWorkspaceCard>

          <div className="xl:col-span-9">
            <FulfillmentPackExecutionPanel
              canDirectVoid={pack.canDirectVoid}
              canExecute={pack.canExecute}
              isRefreshing={pack.isRefreshing}
              isSubmitting={pack.isSubmitting}
              task={pack.activeTask}
              onRefresh={pack.refresh}
              onStart={pack.startTask}
              onScanUnit={pack.scanUnit}
              onVerifyTracking={pack.verifyTracking}
              onComplete={pack.completeTask}
              onVoid={pack.voidTask}
            />
          </div>
        </div>
      </WmsPageShell>
    </div>
  );
}
