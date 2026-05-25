'use client';

import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  RefreshCw,
} from 'lucide-react';
import { WmsCompactPanel } from '../../_components/wms-compact-panel';
import { useProductsController } from '../_hooks/use-products-controller';
import { ProductsFilterBar } from './products-filter-bar';
import { ProductProfileModal } from './product-profile-modal';
import { ProductsProfilesTable } from './products-profiles-table';

export function ProductsScreen() {
  const controller = useProductsController();
  const summary = controller.overview?.summary;
  const totalProducts = summary?.products ?? 0;
  const assignedProfiles = summary?.assignedProfiles ?? 0;
  const unassignedProfiles = summary?.unassignedProfiles ?? 0;
  const storesInScope = controller.selectedStoreId
    ? 1
    : controller.overview?.filters.stores.length ?? 0;
  const paginationTotal = controller.overview?.products.length ?? 0;
  const paginationStart = paginationTotal === 0 ? 0 : ((controller.currentPage - 1) * controller.pageSize) + 1;
  const paginationEnd = paginationTotal === 0
    ? 0
    : Math.min(paginationTotal, paginationStart + controller.products.length - 1);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end gap-4">
        <div className="flex items-center gap-2.5">
          {controller.canSyncStore ? (
            <button
              type="button"
              onClick={() => void controller.syncSelectedStore()}
              disabled={!controller.selectedStoreId || controller.isSyncingStore}
              className="btn btn-md btn-primary btn-icon"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${controller.isSyncingStore ? 'animate-spin' : ''}`} />
              {controller.isSyncingStore ? 'Syncing' : 'Sync products'}
            </button>
          ) : null}
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
        <InsightCard label="Products" value={totalProducts.toLocaleString()} />
        <InsightCard label="Stores" value={storesInScope.toLocaleString()} />
        <InsightCard label="Assigned" value={assignedProfiles.toLocaleString()} />
        <InsightCard label="Unassigned" value={unassignedProfiles.toLocaleString()} />
      </div>

      <WmsCompactPanel
        title="Product Profiles"
        icon={<ClipboardList className='panel-icon'/>}
        headerActions={
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-[#dce4ea] bg-[#fbfcfc] px-3 py-1 text-[11px] font-semibold text-[#4d6677]">
              {controller.isFetching ? 'Refreshing…' : `${totalProducts.toLocaleString()} records`}
            </span>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="overflow-hidden rounded-[22px] border border-[#dce4ea] bg-[#fbfcfc]">
            <div className="border-b border-[#e7edf2] px-4 py-3">
              <ProductsFilterBar
                filters={controller.overview?.filters}
                searchText={controller.searchText}
                onSearchTextChange={controller.setSearchText}
                selectedTenantId={controller.selectedTenantId}
                onTenantChange={controller.setSelectedTenantId}
                selectedStoreId={controller.selectedStoreId}
                onStoreChange={controller.setSelectedStoreId}
                selectedPosWarehouseId={controller.selectedPosWarehouseId}
                onPosWarehouseChange={controller.setSelectedPosWarehouseId}
              />
            </div>

            <ProductsProfilesTable
              profiles={controller.products}
              isLoading={controller.isLoading}
              tenantReady={controller.overview?.tenantReady ?? false}
              canEditProfile={controller.canEditProfile}
              onEditProfile={controller.openProfileModal}
              variant="embedded"
            />

            <div className="flex items-center justify-between border-t border-[#e7edf2] bg-white px-4 py-3">
              <p className="text-sm text-slate-600">
                Showing {paginationStart}-{paginationEnd} of {paginationTotal}
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => controller.setCurrentPage(controller.currentPage - 1)}
                  disabled={controller.currentPage === 1}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#d7e0e7] bg-white text-[#4d6677] transition hover:border-[#c6d4dd] hover:text-[#12384b] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <span className="rounded-full border border-[#dce4ea] bg-[#fbfcfc] px-3.5 py-1.5 text-[12px] font-semibold text-[#12384b]">
                  {controller.currentPage} / {controller.totalPages}
                </span>

                <button
                  type="button"
                  onClick={() => controller.setCurrentPage(controller.currentPage + 1)}
                  disabled={controller.currentPage === controller.totalPages}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#d7e0e7] bg-white text-[#4d6677] transition hover:border-[#c6d4dd] hover:text-[#12384b] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </WmsCompactPanel>

      <ProductProfileModal
        open={controller.profileModal.open}
        profile={controller.profileModal.profile}
        locationOptions={controller.overview?.locationOptions ?? []}
        canEditProfile={controller.canEditProfile}
        isSaving={controller.isSavingProfile}
        onClose={controller.closeProfileModal}
        onSubmit={controller.submitProfile}
      />
    </div>
  );
}

function InsightCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <p className="card-label">{label}</p>
      <p className="card-value">{value}</p>
    </div>
  );
}
