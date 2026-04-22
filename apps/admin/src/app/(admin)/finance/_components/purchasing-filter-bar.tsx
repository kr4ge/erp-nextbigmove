'use client';

import { WmsActionBar } from '../../_components/wms-action-bar';
import { WmsSearchableSelect } from '../../_components/wms-searchable-select';
import type {
  WmsPurchasingBatchStatus,
  WmsPurchasingOverviewResponse,
  WmsPurchasingRequestType,
} from '../_types/purchasing';

type PurchasingFilterBarProps = {
  filters: WmsPurchasingOverviewResponse['filters'] | null | undefined;
  searchText: string;
  onSearchTextChange: (value: string) => void;
  selectedTenantId?: string;
  onTenantChange: (value: string | undefined) => void;
  selectedStoreId?: string;
  onStoreChange: (value: string | undefined) => void;
  selectedRequestType?: WmsPurchasingRequestType;
  onRequestTypeChange: (value: WmsPurchasingRequestType | undefined) => void;
  selectedStatus?: WmsPurchasingBatchStatus;
  onStatusChange: (value: WmsPurchasingBatchStatus | undefined) => void;
};

export function PurchasingFilterBar({
  filters,
  searchText,
  onSearchTextChange,
  selectedTenantId,
  onTenantChange,
  selectedStoreId,
  onStoreChange,
  selectedRequestType,
  onRequestTypeChange,
  selectedStatus,
  onStatusChange,
}: PurchasingFilterBarProps) {
  return (
    <WmsActionBar
      searchText={searchText}
      onSearchTextChange={onSearchTextChange}
      searchPlaceholder="Search request ID, title, invoice, or item"
    >
      <WmsSearchableSelect
        label="Tenant"
        value={selectedTenantId ?? ''}
        onChange={(value) => onTenantChange(value || undefined)}
        options={(filters?.tenants ?? []).map((tenant) => ({
          value: tenant.id,
          label: tenant.label,
        }))}
        placeholder="Search tenants…"
        allLabel="All tenants"
      />

      <WmsSearchableSelect
        label="Store"
        value={selectedStoreId ?? ''}
        onChange={(value) => onStoreChange(value || undefined)}
        options={(filters?.stores ?? []).map((store) => ({
          value: store.id,
          label: store.label,
          hint: store.batchCount,
        }))}
        placeholder="Search stores…"
        allLabel="All stores"
      />

      <WmsSearchableSelect
        label="Type"
        value={selectedRequestType ?? ''}
        onChange={(value) => onRequestTypeChange((value as WmsPurchasingRequestType) || undefined)}
        options={(filters?.requestTypes ?? []).map((requestType) => ({
          value: requestType.value,
          label: requestType.label,
          hint: requestType.batchCount,
        }))}
        placeholder="Search request types…"
        allLabel="All request types"
      />

      <WmsSearchableSelect
        label="Status"
        value={selectedStatus ?? ''}
        onChange={(value) => onStatusChange((value as WmsPurchasingBatchStatus) || undefined)}
        options={(filters?.statuses ?? []).map((status) => ({
          value: status.value,
          label: status.label,
          hint: status.batchCount,
        }))}
        placeholder="Search statuses…"
        allLabel="All statuses"
      />
    </WmsActionBar>
  );
}
