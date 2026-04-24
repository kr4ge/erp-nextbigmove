'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { readStoredAdminUser, readStoredPermissions } from '@/lib/admin-session';
import { useWmsScopeFilters } from '../../_hooks/use-wms-scope-filters';
import {
  hasAnyAdminPermission,
  WMS_INVENTORY_ADJUST_PERMISSIONS,
  WMS_INVENTORY_PRINT_LABELS_PERMISSIONS,
  WMS_INVENTORY_TRANSFER_PERMISSIONS,
} from '@/lib/wms-permissions';
import {
  createWmsInventoryAdjustment,
  createWmsInventoryTransfer,
  fetchWmsInventoryOverview,
  fetchWmsInventoryUnitMovements,
  fetchWmsInventoryUnitTransferOptions,
  recordWmsInventoryUnitLabelPrint,
} from '../_services/inventory.service';
import type {
  CreateWmsInventoryAdjustmentInput,
  CreateWmsInventoryTransferInput,
  WmsInventoryUnitRecord,
  WmsInventoryUnitStatus,
} from '../_types/inventory';

type UnitModalState = {
  open: boolean;
  unit: WmsInventoryUnitRecord | null;
};

function getErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data;

    if (Array.isArray(payload?.message)) {
      return payload.message.join(' ');
    }

    if (typeof payload?.message === 'string') {
      return payload.message;
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Request failed';
}

export function useInventoryController() {
  const queryClient = useQueryClient();
  const pageSize = 10;
  const user = useMemo(() => readStoredAdminUser(), []);
  const permissions = useMemo(() => readStoredPermissions(), []);
  const [selectedTenantId, setSelectedTenantIdState] = useState<string | undefined>();
  const [selectedStoreId, setSelectedStoreIdState] = useState<string | undefined>();
  const [selectedWarehouseId, setSelectedWarehouseIdState] = useState<string | undefined>();
  const [selectedStatus, setSelectedStatus] = useState<WmsInventoryUnitStatus | undefined>();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchText, setSearchText] = useState('');
  const [unitModal, setUnitModal] = useState<UnitModalState>({
    open: false,
    unit: null,
  });

  const deferredSearch = useDeferredValue(searchText.trim());

  const overviewQuery = useQuery({
    queryKey: [
      'wms-inventory-overview',
      selectedTenantId ?? 'default-tenant',
      selectedStoreId ?? 'all-stores',
      selectedWarehouseId ?? 'all-warehouses',
      selectedStatus ?? 'all-statuses',
      deferredSearch,
    ],
    queryFn: () =>
      fetchWmsInventoryOverview({
        tenantId: selectedTenantId,
        storeId: selectedStoreId,
        warehouseId: selectedWarehouseId,
        search: deferredSearch || undefined,
        status: selectedStatus,
      }),
  });

  const { setSelectedTenantId, setSelectedStoreId, setSelectedWarehouseId } = useWmsScopeFilters({
    filters: overviewQuery.data?.filters,
    selectedTenantId,
    setSelectedTenantIdState,
    selectedStoreId,
    setSelectedStoreIdState,
    selectedWarehouseId,
    setSelectedWarehouseIdState,
    includeWarehouse: true,
  });

  useEffect(() => {
    if (!selectedStatus) {
      return;
    }

    const statuses = overviewQuery.data?.filters.statuses;
    if (!statuses) {
      return;
    }

    const stillExists = statuses.some((status) => status.value === selectedStatus);

    if (!stillExists) {
      setSelectedStatus(undefined);
    }
  }, [overviewQuery.data?.filters.statuses, selectedStatus]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedTenantId, selectedStoreId, selectedWarehouseId, selectedStatus, deferredSearch]);

  const errorMessage = useMemo(() => {
    if (!overviewQuery.error) {
      return null;
    }

    return getErrorMessage(overviewQuery.error);
  }, [overviewQuery.error]);

  const totalPages = useMemo(() => {
    const totalUnits = overviewQuery.data?.units.length ?? 0;
    return Math.max(1, Math.ceil(totalUnits / pageSize));
  }, [overviewQuery.data?.units.length]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedUnits = useMemo(() => {
    const units = overviewQuery.data?.units ?? [];
    const startIndex = (currentPage - 1) * pageSize;

    return units.slice(startIndex, startIndex + pageSize);
  }, [currentPage, overviewQuery.data?.units]);

  const recordUnitLabelPrintMutation = useMutation({
    mutationFn: (input: { unitId: string; action: 'PRINT' | 'REPRINT' }) =>
      recordWmsInventoryUnitLabelPrint(input.unitId, { action: input.action }, selectedTenantId),
    onSuccess: async (response) => {
      setUnitModal((current) => {
        if (!current.open || !current.unit || current.unit.id !== response.unit.id) {
          return current;
        }

        return {
          open: true,
          unit: response.unit,
        };
      });

      await queryClient.invalidateQueries({ queryKey: ['wms-inventory-overview'] });
    },
  });

  const unitMovementsQuery = useQuery({
    queryKey: ['wms-inventory-unit-movements', unitModal.unit?.id ?? null, selectedTenantId ?? 'default-tenant'],
    queryFn: () => fetchWmsInventoryUnitMovements(unitModal.unit!.id, selectedTenantId),
    enabled: Boolean(unitModal.open && unitModal.unit?.id),
  });

  const unitTransferOptionsQuery = useQuery({
    queryKey: ['wms-inventory-unit-transfer-options', unitModal.unit?.id ?? null, selectedTenantId ?? 'default-tenant'],
    queryFn: () => fetchWmsInventoryUnitTransferOptions(unitModal.unit!.id, selectedTenantId),
    enabled: Boolean(unitModal.open && unitModal.unit?.id),
  });

  const createTransferMutation = useMutation({
    mutationFn: (input: CreateWmsInventoryTransferInput) =>
      createWmsInventoryTransfer(input, selectedTenantId),
    onSuccess: async (response) => {
      const updatedUnit = response.units[0] ?? null;

      setUnitModal((current) => {
        if (!current.open || !current.unit || !updatedUnit || current.unit.id !== updatedUnit.id) {
          return current;
        }

        return {
          open: true,
          unit: updatedUnit,
        };
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['wms-inventory-overview'] }),
        queryClient.invalidateQueries({ queryKey: ['wms-inventory-unit-movements'] }),
        queryClient.invalidateQueries({ queryKey: ['wms-inventory-unit-transfer-options'] }),
        queryClient.invalidateQueries({ queryKey: ['wms-inventory-transfers'] }),
      ]);
    },
  });

  const createAdjustmentMutation = useMutation({
    mutationFn: (input: CreateWmsInventoryAdjustmentInput) =>
      createWmsInventoryAdjustment(input, selectedTenantId),
    onSuccess: async (response) => {
      const updatedUnit = response.units[0] ?? null;

      setUnitModal((current) => {
        if (!current.open || !current.unit || !updatedUnit || current.unit.id !== updatedUnit.id) {
          return current;
        }

        return {
          open: true,
          unit: updatedUnit,
        };
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['wms-inventory-overview'] }),
        queryClient.invalidateQueries({ queryKey: ['wms-inventory-unit-movements'] }),
        queryClient.invalidateQueries({ queryKey: ['wms-inventory-unit-transfer-options'] }),
        queryClient.invalidateQueries({ queryKey: ['wms-inventory-transfers'] }),
      ]);
    },
  });

  async function recordUnitLabelPrint(unitId: string, action: 'PRINT' | 'REPRINT') {
    try {
      await recordUnitLabelPrintMutation.mutateAsync({ unitId, action });
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  async function transferUnit(input: CreateWmsInventoryTransferInput) {
    try {
      await createTransferMutation.mutateAsync(input);
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  async function adjustUnit(input: CreateWmsInventoryAdjustmentInput) {
    try {
      await createAdjustmentMutation.mutateAsync(input);
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  return {
    overview: overviewQuery.data ?? null,
    units: paginatedUnits,
    isLoading: overviewQuery.isLoading,
    isFetching: overviewQuery.isFetching,
    errorMessage,
    selectedTenantId,
    selectedStoreId,
    selectedWarehouseId,
    selectedStatus,
    currentPage,
    totalPages,
    searchText,
    unitModal,
    canPrintLabels: hasAnyAdminPermission(
      user?.role ?? null,
      permissions,
      WMS_INVENTORY_PRINT_LABELS_PERMISSIONS,
    ),
    canTransferUnits: hasAnyAdminPermission(
      user?.role ?? null,
      permissions,
      WMS_INVENTORY_TRANSFER_PERMISSIONS,
    ),
    canAdjustUnits: hasAnyAdminPermission(
      user?.role ?? null,
      permissions,
      WMS_INVENTORY_ADJUST_PERMISSIONS,
    ),
    isRecordingUnitLabelPrint: recordUnitLabelPrintMutation.isPending,
    unitMovements: unitMovementsQuery.data?.movements ?? [],
    transferOptions: unitTransferOptionsQuery.data ?? null,
    isLoadingUnitMovements: unitMovementsQuery.isLoading || unitMovementsQuery.isFetching,
    isLoadingUnitTransferOptions:
      unitTransferOptionsQuery.isLoading || unitTransferOptionsQuery.isFetching,
    isTransferringUnit: createTransferMutation.isPending,
    isAdjustingUnit: createAdjustmentMutation.isPending,
    setSelectedTenantId: (tenantId: string | undefined) => {
      setSelectedTenantId(tenantId);
      setSelectedStatus(undefined);
    },
    setSelectedStoreId,
    setSelectedWarehouseId,
    setSelectedStatus,
    setCurrentPage,
    setSearchText,
    recordUnitLabelPrint,
    transferUnit,
    adjustUnit,
    openUnitModal: (unit: WmsInventoryUnitRecord) => setUnitModal({ open: true, unit }),
    closeUnitModal: () => setUnitModal({ open: false, unit: null }),
  };
}
