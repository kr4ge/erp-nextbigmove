'use client';

import type { ReactNode } from 'react';
import { BarChart3, ChevronLeft, ChevronRight, RefreshCcw, Route, Truck } from 'lucide-react';
import { WmsInlineNotice } from '../../_components/wms-inline-notice';
import { WmsPageShell } from '../../_components/wms-page-shell';
import { WmsWorkspaceCard } from '../../_components/wms-workspace-card';
import { useDispatchController } from '../_hooks/use-dispatch-controller';
import { DispatchDetailPanel } from './dispatch-detail-panel';
import { DispatchFilterBar } from './dispatch-filter-bar';
import { DispatchReportsPanel } from './dispatch-reports-panel';
import { DispatchTable } from './dispatch-table';

export function DispatchScreen() {
  const dispatch = useDispatchController();
  const paginationStart = dispatch.tasksPagination.total === 0
    ? 0
    : ((dispatch.currentPage - 1) * dispatch.tasksPagination.pageSize) + 1;
  const paginationEnd = dispatch.tasksPagination.total === 0
    ? 0
    : Math.min(
        dispatch.tasksPagination.total,
        paginationStart
          + (dispatch.selectedTab === 'returns' ? dispatch.returnTasks.length : dispatch.outboundTasks.length)
          - 1,
      );

  return (
    <div className="space-y-5">
      <WmsPageShell
        title="Dispatch"
        description="Outbound and returns now live in one queue so WMS can monitor waybills, shipped work, and RTS verification in the same module."
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            {dispatch.canManageOutbound && dispatch.selectedTab === 'outbound' ? (
              <button
                type="button"
                onClick={() => {
                  void dispatch.reconcileOutboundScope();
                }}
                disabled={!dispatch.canRunScopedReconcile || dispatch.isReconciling}
                title={dispatch.reconcileScopeDisabledReason ?? undefined}
                className="btn btn-md btn-outline"
              >
                {dispatch.isReconciling ? 'Repairing…' : 'Run dispatch repair'}
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => {
                void dispatch.refresh();
              }}
              className="btn btn-md btn-outline btn-icon"
            >
              <RefreshCcw className={`h-4 w-4 ${dispatch.isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        )}
      >
        {dispatch.errorMessage ? (
          <WmsInlineNotice tone="error">
            {dispatch.errorMessage}
          </WmsInlineNotice>
        ) : null}

        {dispatch.successMessage ? (
          <WmsInlineNotice tone="success" dismissible autoDismissMs={5000} onDismiss={dispatch.clearSuccessMessage}>
            {dispatch.successMessage}
          </WmsInlineNotice>
        ) : null}

        {!dispatch.canViewOutbound && !dispatch.canViewReturns ? (
          <WmsInlineNotice tone="error">
            This account does not currently have WMS dispatch access.
          </WmsInlineNotice>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {dispatch.summaryItems.map((item) => (
            <div key={item.id} className="card">
              <p className="card-label">{item.label}</p>
              <p className="card-value">{item.value}</p>
            </div>
          ))}
        </div>

        <WmsWorkspaceCard
          title="Dispatch Workspace"
          icon={
            dispatch.selectedTab === 'returns'
              ? <Route className="panel-icon" />
              : dispatch.selectedTab === 'reports'
                ? <BarChart3 className="panel-icon" />
                : <Truck className="panel-icon" />
          }
          filters={(
            <div className="space-y-3">
              <div className="border-b border-[#dce4ea]">
                <div className="flex items-end gap-8">
                  {dispatch.canViewOutbound ? (
                    <DispatchTab
                      active={dispatch.selectedTab === 'outbound'}
                      onClick={() => dispatch.setSelectedTab('outbound')}
                      icon={<Truck className="h-4 w-4" />}
                    >
                      Outbound
                    </DispatchTab>
                  ) : null}
                  {dispatch.canViewReturns ? (
                    <DispatchTab
                      active={dispatch.selectedTab === 'returns'}
                      onClick={() => dispatch.setSelectedTab('returns')}
                      icon={<Route className="h-4 w-4" />}
                    >
                      Returns
                    </DispatchTab>
                  ) : null}
                  {dispatch.canViewReports ? (
                    <DispatchTab
                      active={dispatch.selectedTab === 'reports'}
                      onClick={() => dispatch.setSelectedTab('reports')}
                      icon={<BarChart3 className="h-4 w-4" />}
                    >
                      Reports
                    </DispatchTab>
                  ) : null}
                </div>
              </div>

              <DispatchFilterBar
                showSearch={dispatch.selectedTab !== 'reports'}
                searchText={dispatch.searchText}
                onSearchTextChange={dispatch.setSearchText}
                tenantOptions={dispatch.tenantOptions}
                selectedTenantId={dispatch.selectedTenantId}
                onTenantChange={dispatch.setSelectedTenantId}
                storeOptions={dispatch.storeOptions}
                selectedStoreId={dispatch.selectedStoreId}
                onStoreChange={dispatch.setSelectedStoreId}
                selectedStatus={dispatch.selectedStatus}
                onStatusChange={dispatch.setSelectedStatus}
                statusOptions={dispatch.selectedTab === 'returns' ? dispatch.returnStatusOptions : dispatch.outboundStatusOptions}
                showStatus={dispatch.selectedTab !== 'reports'}
              />
            </div>
          )}
          footer={dispatch.selectedTab === 'reports' ? null : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-slate-600">
                Showing {paginationStart}-{paginationEnd} of {dispatch.tasksPagination.total}
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => dispatch.setCurrentPage(dispatch.currentPage - 1)}
                  disabled={dispatch.currentPage === 1}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#d7e0e7] bg-white text-[#4d6677] transition hover:border-[#c6d4dd] hover:text-[#12384b] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <span className="rounded-full border border-[#dce4ea] bg-[#fbfcfc] px-3.5 py-1.5 text-[12px] font-semibold text-[#12384b]">
                  {dispatch.currentPage} / {dispatch.totalPages}
                </span>

                <button
                  type="button"
                  onClick={() => dispatch.setCurrentPage(dispatch.currentPage + 1)}
                  disabled={dispatch.currentPage >= dispatch.totalPages}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#d7e0e7] bg-white text-[#4d6677] transition hover:border-[#c6d4dd] hover:text-[#12384b] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        >
          {dispatch.selectedTab === 'reports' ? (
            <DispatchReportsPanel
              data={dispatch.reportsData}
              isLoading={dispatch.isLoading}
              selectedWindowDays={dispatch.reportWindowDays}
              windowOptions={dispatch.reportWindowOptions}
              onWindowDaysChange={(value) => dispatch.setReportWindowDays(value as 7 | 14 | 30)}
            />
          ) : (
            <DispatchTable
              tab={dispatch.selectedTab}
              outboundTasks={dispatch.outboundTasks}
              returnTasks={dispatch.returnTasks}
              isLoading={dispatch.isLoading}
              onSelectTask={dispatch.setSelectedTaskId}
            />
          )}
        </WmsWorkspaceCard>
      </WmsPageShell>

      {dispatch.selectedTab === 'reports' ? null : (
        <DispatchDetailPanel
          tab={dispatch.selectedTab}
          outboundTask={dispatch.selectedOutboundTask}
          returnTask={dispatch.selectedReturnTask}
          hasSelection={Boolean(dispatch.selectedTaskId)}
          isLoading={dispatch.isTaskDetailLoading}
          canReconcileOutbound={dispatch.canManageOutbound}
          isReconcilingOutbound={dispatch.isReconciling}
          onReconcileOutboundTask={(taskId) => dispatch.reconcileOutboundTask(taskId)}
          onClose={() => dispatch.setSelectedTaskId(null)}
        />
      )}
    </div>
  );
}

function DispatchTab({
  active,
  children,
  icon,
  onClick,
}: {
  active: boolean;
  children: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative -mb-px flex items-center gap-2 border-b-[3px] px-0 pb-4 text-[14px] font-semibold transition ${
        active
          ? 'border-orange-500 text-primary'
          : 'border-transparent text-[#526879] hover:text-primary'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
