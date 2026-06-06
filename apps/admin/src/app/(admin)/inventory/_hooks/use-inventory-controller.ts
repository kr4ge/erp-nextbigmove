'use client';

import { useEffect, useMemo, useState } from 'react';
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
  createWmsInventoryStoreTransfer,
  createWmsInventoryTransfer,
  fetchWmsInventoryOverview,
  fetchWmsInventoryStoreTransferOptions,
  fetchWmsInventoryUnitMovements,
  fetchWmsInventoryUnitTransferOptions,
  previewWmsInventoryStoreTransfer,
  recordWmsInventoryUnitLabelPrint,
} from '../_services/inventory.service';
import type {
  CreateWmsInventoryAdjustmentInput,
  CreateWmsInventoryStoreTransferInput,
  CreateWmsInventoryTransferInput,
  WmsInventoryUnitRecord,
  WmsInventoryUnitStatus,
} from '../_types/inventory';

type UnitModalState = {
  open: boolean;
  unit: WmsInventoryUnitRecord | null;
};

type StoreTransferModalState = {
  open: boolean;
  targetStoreId: string;
  targetProfileId: string;
  notes: string;
  errorMessage: string | null;
};

const SEARCH_DEBOUNCE_MS = 300;

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
  const [debouncedSearchText, setDebouncedSearchText] = useState('');
  const [unitModal, setUnitModal] = useState<UnitModalState>({
    open: false,
    unit: null,
  });
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [storeTransferModal, setStoreTransferModal] = useState<StoreTransferModalState>({
    open: false,
    targetStoreId: '',
    targetProfileId: '',
    notes: '',
    errorMessage: null,
  });

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchText(searchText.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchText]);

  const overviewQuery = useQuery({
    queryKey: [
      'wms-inventory-overview',
      selectedTenantId ?? 'default-tenant',
      selectedStoreId ?? 'all-stores',
      selectedWarehouseId ?? 'all-warehouses',
      selectedStatus ?? 'all-statuses',
      debouncedSearchText,
    ],
    queryFn: () =>
      fetchWmsInventoryOverview({
        tenantId: selectedTenantId,
        storeId: selectedStoreId,
        warehouseId: selectedWarehouseId,
        search: debouncedSearchText || undefined,
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
    setSelectedUnitIds([]);
  }, [selectedTenantId, selectedStoreId, selectedWarehouseId, selectedStatus, debouncedSearchText]);

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

  const selectedUnits = useMemo(() => {
    const selectedIds = new Set(selectedUnitIds);
    return (overviewQuery.data?.units ?? []).filter((unit) => selectedIds.has(unit.id));
  }, [overviewQuery.data?.units, selectedUnitIds]);
  const selectedSourceProfileId = selectedUnits.length > 0
    ? selectedUnits[0]?.productProfileId
    : undefined;

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

  const storeTransferOptionsQuery = useQuery({
    queryKey: [
      'wms-inventory-store-transfer-options',
      selectedTenantId ?? 'default-tenant',
      storeTransferModal.targetStoreId || 'no-target-store',
      selectedSourceProfileId ?? 'no-source-profile',
      storeTransferModal.open,
    ],
    queryFn: () =>
      fetchWmsInventoryStoreTransferOptions({
        tenantId: selectedTenantId,
        targetStoreId: storeTransferModal.targetStoreId || undefined,
        sourceProfileId: selectedSourceProfileId,
      }),
    enabled: storeTransferModal.open,
  });
  const storeTransferPreviewQuery = useQuery({
    queryKey: [
      'wms-inventory-store-transfer-preview',
      selectedTenantId ?? 'default-tenant',
      selectedUnitIds,
      storeTransferModal.targetStoreId || 'no-target-store',
      storeTransferModal.targetProfileId || 'no-target-profile',
      storeTransferModal.open,
    ],
    queryFn: () =>
      previewWmsInventoryStoreTransfer({
        unitIds: selectedUnitIds,
        targetStoreId: storeTransferModal.targetStoreId,
        targetProfileId: storeTransferModal.targetProfileId,
      }, selectedTenantId),
    enabled: Boolean(
      storeTransferModal.open
      && selectedUnitIds.length > 0
      && storeTransferModal.targetStoreId
      && storeTransferModal.targetProfileId,
    ),
  });
  const suggestedTargetProfileId = storeTransferOptionsQuery.data?.suggestion?.profileId ?? null;

  useEffect(() => {
    if (
      !storeTransferModal.open
      || !storeTransferModal.targetStoreId
      || storeTransferModal.targetProfileId
      || !suggestedTargetProfileId
    ) {
      return;
    }

    setStoreTransferModal((current) => (
      current.targetProfileId
        ? current
        : {
            ...current,
            targetProfileId: suggestedTargetProfileId,
          }
    ));
  }, [
    storeTransferModal.open,
    storeTransferModal.targetStoreId,
    storeTransferModal.targetProfileId,
    suggestedTargetProfileId,
  ]);

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

  const createStoreTransferMutation = useMutation({
    mutationFn: (input: CreateWmsInventoryStoreTransferInput) =>
      createWmsInventoryStoreTransfer(input, selectedTenantId),
    onSuccess: async () => {
      setSelectedUnitIds([]);
      setStoreTransferModal({
        open: false,
        targetStoreId: '',
        targetProfileId: '',
        notes: '',
        errorMessage: null,
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['wms-inventory-overview'] }),
        queryClient.invalidateQueries({ queryKey: ['wms-inventory-unit-movements'] }),
        queryClient.invalidateQueries({ queryKey: ['wms-inventory-store-transfer-options'] }),
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

  function toggleUnitSelection(unitId: string) {
    setSelectedUnitIds((current) =>
      current.includes(unitId)
        ? current.filter((id) => id !== unitId)
        : [...current, unitId],
    );
  }

  function toggleVisibleUnitSelection() {
    const visibleIds = paginatedUnits.map((unit) => unit.id);
    const visibleIdSet = new Set(visibleIds);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedUnitIds.includes(id));

    setSelectedUnitIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !visibleIdSet.has(id));
      }

      return Array.from(new Set([...current, ...visibleIds]));
    });
  }

  function openStoreTransferModal() {
    setStoreTransferModal({
      open: true,
      targetStoreId: '',
      targetProfileId: '',
      notes: '',
      errorMessage: null,
    });
  }

  function closeStoreTransferModal() {
    setStoreTransferModal({
      open: false,
      targetStoreId: '',
      targetProfileId: '',
      notes: '',
      errorMessage: null,
    });
  }

  async function submitStoreTransfer() {
    try {
      setStoreTransferModal((current) => ({ ...current, errorMessage: null }));
      await createStoreTransferMutation.mutateAsync({
        unitIds: selectedUnitIds,
        targetStoreId: storeTransferModal.targetStoreId,
        targetProfileId: storeTransferModal.targetProfileId,
        notes: storeTransferModal.notes.trim() || undefined,
      });
    } catch (error) {
      setStoreTransferModal((current) => ({
        ...current,
        errorMessage: getErrorMessage(error),
      }));
    }
  }

  return {
    overview: overviewQuery.data ?? null,
    units: paginatedUnits,
    selectedUnits,
    selectedUnitIds,
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
    storeTransferModal,
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
    storeTransferOptions: storeTransferOptionsQuery.data ?? null,
    storeTransferPreview: storeTransferPreviewQuery.data ?? null,
    storeTransferPreviewErrorMessage: storeTransferPreviewQuery.error
      ? getErrorMessage(storeTransferPreviewQuery.error)
      : null,
    isLoadingUnitMovements: unitMovementsQuery.isLoading || unitMovementsQuery.isFetching,
    isLoadingUnitTransferOptions:
      unitTransferOptionsQuery.isLoading || unitTransferOptionsQuery.isFetching,
    isLoadingStoreTransferOptions:
      storeTransferOptionsQuery.isLoading || storeTransferOptionsQuery.isFetching,
    isLoadingStoreTransferPreview:
      storeTransferPreviewQuery.isLoading || storeTransferPreviewQuery.isFetching,
    isTransferringUnit: createTransferMutation.isPending,
    isTransferringStoreUnits: createStoreTransferMutation.isPending,
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
    toggleUnitSelection,
    toggleVisibleUnitSelection,
    clearUnitSelection: () => setSelectedUnitIds([]),
    openStoreTransferModal,
    closeStoreTransferModal,
    setStoreTransferTargetStoreId: (targetStoreId: string) =>
      setStoreTransferModal((current) => ({
        ...current,
        targetStoreId,
        targetProfileId: '',
        errorMessage: null,
      })),
    setStoreTransferTargetProfileId: (targetProfileId: string) =>
      setStoreTransferModal((current) => ({
        ...current,
        targetProfileId,
        errorMessage: null,
      })),
    setStoreTransferNotes: (notes: string) =>
      setStoreTransferModal((current) => ({
        ...current,
        notes,
      })),
    submitStoreTransfer,
    openUnitModal: (unit: WmsInventoryUnitRecord) => setUnitModal({ open: true, unit }),
    closeUnitModal: () => setUnitModal({ open: false, unit: null }),
  };
}
