'use client';

import { ChevronLeft, ChevronRight, PackageCheck, RefreshCcw } from 'lucide-react';
import { WmsInlineNotice } from '../../_components/wms-inline-notice';
import { WmsPageShell } from '../../_components/wms-page-shell';
import { WmsWorkspaceCard } from '../../_components/wms-workspace-card';
import { useFulfillmentPackController } from '../_hooks/use-fulfillment-pack-controller';
import { FulfillmentQueueFilterBar } from './fulfillment-queue-filter-bar';
import { FulfillmentPackExecutionPanel } from './fulfillment-pack-execution-panel';
import { FulfillmentPackQueueList } from './fulfillment-pack-queue-list';

export function FulfillmentPackScreen() {
  const pack = useFulfillmentPackController();
  const scopeLabel = pack.queueScope === 'own' ? 'My queue' : 'All queues';

  return (
    <div className="space-y-5">
      <WmsPageShell
        title="Pack Queue"
        breadcrumb="Fulfillment"
        description="Assigned packers can execute the Pack flow in WMS web. Supervisors and super admins can monitor the full queue, and users with execution permissions can work the selected order directly from this panel."
        actions={(
          <>
            <span className="inline-flex h-11 items-center rounded-full border border-[#d7e0e7] bg-white px-4 text-[12px] font-semibold text-[#12384b]">
              {scopeLabel}
            </span>
            <button
              type="button"
              onClick={pack.refresh}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-[#d7e0e7] bg-white px-4 text-[12px] font-semibold text-[#12384b] transition hover:border-[#c6d4dd]"
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

        <WmsInlineNotice tone="info">
          {pack.queueScope === 'own'
            ? 'This pack queue is scoped to orders assigned to your PACK task in WMS Web.'
            : 'This pack queue is in supervisor view. Select an order to inspect or, if your role allows it, execute the packing workflow.'}
        </WmsInlineNotice>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {pack.summaryItems.map((item) => (
            <div
              key={item.id}
              className="rounded-[22px] border border-[#dce4ea] bg-white px-5 py-4 shadow-[0_16px_40px_-34px_rgba(18,56,75,0.32)]"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8193a0]">{item.label}</p>
              <p className="mt-2 text-[28px] font-semibold tracking-tight text-[#12384b]">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(360px,0.92fr)_minmax(0,1.08fr)]">
          <WmsWorkspaceCard
            title="Pack Orders"
            icon={<PackageCheck className='panel-icon' />}
            filters={(
              <FulfillmentQueueFilterBar
                tenantOptions={pack.tenantOptions}
                selectedTenantId={pack.selectedTenantId}
                onTenantChange={pack.setSelectedTenantId}
                storeOptions={pack.storeOptions}
                selectedStoreId={pack.selectedStoreId}
                onStoreChange={pack.setSelectedStoreId}
                selectedStatus={pack.selectedStatus}
                onStatusChange={pack.setSelectedStatus}
                statusOptions={pack.statusOptions}
              />
            )}
            footer={(
              <div className="flex items-center justify-between gap-3">
                <p className="text-[12px] text-[#6f8290]">
                  {pack.tasks.length} order{pack.tasks.length === 1 ? '' : 's'} on this page
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

                  <span className="rounded-full border border-[#dce4ea] bg-[#fbfcfc] px-3.5 py-1.5 text-[12px] font-semibold text-[#12384b]">
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

          <FulfillmentPackExecutionPanel
            canDirectVoid={pack.canDirectVoid}
            canExecute={pack.canExecute}
            isRefreshing={pack.isRefreshing}
            isSubmitting={pack.isSubmitting}
            task={pack.activeTask}
            onBack={() => pack.setActiveTaskId(null)}
            onRefresh={pack.refresh}
            onStart={pack.startTask}
            onScanUnit={pack.scanUnit}
            onVerifyTracking={pack.verifyTracking}
            onComplete={pack.completeTask}
            onVoid={pack.voidTask}
          />
        </div>
      </WmsPageShell>
    </div>
  );
}
