'use client';

import { ChevronLeft, ChevronRight, RefreshCw, Truck } from 'lucide-react';
import { WmsInlineNotice } from '../../_components/wms-inline-notice';
import { WmsPageShell } from '../../_components/wms-page-shell';
import { WmsWorkspaceCard } from '../../_components/wms-workspace-card';
import { useOutboundRecordsController } from '../_hooks/use-outbound-records-controller';
import { OutboundRecordDetailPanel } from './outbound-record-detail-panel';
import { OutboundRecordsFilterBar } from './outbound-records-filter-bar';
import { OutboundRecordsSummary } from './outbound-records-summary';
import { OutboundRecordsTable } from './outbound-records-table';

export function OutboundRecordsScreen() {
  const outbound = useOutboundRecordsController();
  const totalItems = outbound.response?.pagination.totalItems ?? 0;

  return (
    <>
      <WmsPageShell
        title="Outbound Records"
        description="See when each serialized item was shipped, delivered, returning, or returned."
      >
        {outbound.errorMessage ? (
          <WmsInlineNotice tone="error">{outbound.errorMessage}</WmsInlineNotice>
        ) : null}

        <OutboundRecordsSummary
          summary={outbound.response?.summary}
          isFetching={outbound.isFetching}
        />

        <WmsWorkspaceCard
          title="Outbound Item Records"
          icon={<Truck className="panel-icon" />}
          actions={(
            <button
              type="button"
              onClick={() => void outbound.refresh()}
              disabled={outbound.isFetching}
              className="btn btn-sm btn-outline btn-icon"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${outbound.isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          )}
          filters={(
            <OutboundRecordsFilterBar
              filters={outbound.response?.filters}
              searchText={outbound.searchText}
              onSearchTextChange={outbound.setSearchText}
              selectedTenantId={outbound.selectedTenantId}
              onTenantChange={outbound.setSelectedTenantId}
              selectedStoreId={outbound.selectedStoreId}
              onStoreChange={outbound.setSelectedStoreId}
              selectedProductProfileId={outbound.selectedProductProfileId}
              onProductChange={outbound.setSelectedProductProfileId}
              selectedStatus={outbound.selectedStatus}
              onStatusChange={outbound.setSelectedStatus}
              dateRange={outbound.dateRange}
              onDateRangeChange={outbound.setDateRange}
            />
          )}
          footer={(
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted">
                {totalItems} activity record{totalItems === 1 ? '' : 's'} in view
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => outbound.setCurrentPage(outbound.currentPage - 1)}
                  disabled={outbound.currentPage === 1}
                  className="btn btn-sm btn-outline px-2"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="pill pill-neutral tabular-nums">
                  {outbound.currentPage} / {outbound.totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => outbound.setCurrentPage(outbound.currentPage + 1)}
                  disabled={outbound.currentPage === outbound.totalPages}
                  className="btn btn-sm btn-outline px-2"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        >
          <OutboundRecordsTable
            records={outbound.records}
            isLoading={outbound.isLoading}
            tenantReady={outbound.response?.tenantReady ?? false}
            onView={outbound.setSelectedRecord}
          />
        </WmsWorkspaceCard>
      </WmsPageShell>

      <OutboundRecordDetailPanel
        record={outbound.selectedRecord}
        onClose={() => outbound.setSelectedRecord(null)}
      />
    </>
  );
}
