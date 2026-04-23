'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { readStoredAdminUser, readStoredPermissions } from '@/lib/admin-session';
import { useWmsScopeFilters } from '../../_hooks/use-wms-scope-filters';
import {
  hasAnyAdminPermission,
  WMS_RECEIVING_CREATE_BATCH_PERMISSIONS,
  WMS_RECEIVING_MANUAL_INPUT_PERMISSIONS,
  WMS_RECEIVING_PRINT_LABELS_PERMISSIONS,
  WMS_TRANSFER_PUTAWAY_PERMISSIONS,
} from '@/lib/wms-permissions';
import { fetchWmsProductsOverview } from '../../products/_services/products.service';
import {
  assignWmsReceivingPutaway,
  createWmsReceivingBatch,
  fetchWmsReceivingBatch,
  fetchWmsReceivingOverview,
  fetchWmsReceivingPutawayOptions,
  recordWmsReceivingBatchLabelPrint,
} from '../_services/receiving.service';
import type {
  AssignWmsReceivingPutawayInput,
  CreateWmsReceivingBatchInput,
  WmsReceivingBatchRow,
  WmsReceivablePurchasingBatch,
} from '../_types/receiving';

type BannerState = {
  tone: 'success' | 'error';
  message: string;
} | null;

type ReceiveModalState = {
  open: boolean;
  batch: WmsReceivablePurchasingBatch | null;
};

type LabelsModalState = {
  open: boolean;
  batchId: string | null;
};

type ManualReceiveLineState = {
  id: string;
  profileId: string;
  quantity: number;
};

type ManualReceiveModalState = {
  open: boolean;
};

type TransferWorkspaceState = {
  batchId: string | null;
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

export function useReceivingController() {
  const queryClient = useQueryClient();
  const user = useMemo(() => readStoredAdminUser(), []);
  const permissions = useMemo(() => readStoredPermissions(), []);
  const [selectedTenantId, setSelectedTenantIdState] = useState<string | undefined>();
  const [selectedStoreId, setSelectedStoreIdState] = useState<string | undefined>();
  const [selectedWarehouseId, setSelectedWarehouseIdState] = useState<string | undefined>();
  const [searchText, setSearchText] = useState('');
  const [banner, setBanner] = useState<BannerState>(null);
  const [receiveModal, setReceiveModal] = useState<ReceiveModalState>({
    open: false,
    batch: null,
  });
  const [labelsModalState, setLabelsModalState] = useState<LabelsModalState>({
    open: false,
    batchId: null,
  });
  const [manualReceiveModal, setManualReceiveModal] = useState<ManualReceiveModalState>({
    open: false,
  });
  const [transferWorkspaceState, setTransferWorkspaceState] = useState<TransferWorkspaceState>({
    batchId: null,
  });
  const [receiveWarehouseId, setReceiveWarehouseId] = useState('');
  const [receiveStagingLocationId, setReceiveStagingLocationId] = useState('');
  const [receiveNotes, setReceiveNotes] = useState('');
  const [lineQuantities, setLineQuantities] = useState<Record<string, number>>({});
  const [manualWarehouseId, setManualWarehouseId] = useState('');
  const [manualStagingLocationId, setManualStagingLocationId] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [manualLines, setManualLines] = useState<ManualReceiveLineState[]>([]);
  const deferredSearch = useDeferredValue(searchText.trim());

  const overviewQuery = useQuery({
    queryKey: [
      'wms-receiving-overview',
      selectedTenantId ?? 'default-tenant',
      selectedStoreId ?? 'all-stores',
      selectedWarehouseId ?? 'all-warehouses',
      deferredSearch,
    ],
    queryFn: () =>
      fetchWmsReceivingOverview({
        tenantId: selectedTenantId,
        storeId: selectedStoreId,
        warehouseId: selectedWarehouseId,
        search: deferredSearch || undefined,
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
    autoSelectWarehouseOnStoreChange: true,
  });

  const selectedWarehouseOption = useMemo(
    () => overviewQuery.data?.warehouseOptions.find((option) => option.id === receiveWarehouseId) ?? null,
    [overviewQuery.data?.warehouseOptions, receiveWarehouseId],
  );
  const selectedManualWarehouseOption = useMemo(
    () => overviewQuery.data?.warehouseOptions.find((option) => option.id === manualWarehouseId) ?? null,
    [manualWarehouseId, overviewQuery.data?.warehouseOptions],
  );
  const manualStoreId = useMemo(() => {
    if (selectedStoreId) {
      return selectedStoreId;
    }

    const stores = overviewQuery.data?.filters.stores ?? [];
    return stores.length === 1 ? stores[0]?.id : undefined;
  }, [overviewQuery.data?.filters.stores, selectedStoreId]);
  const manualStoreName = useMemo(() => {
    const stores = overviewQuery.data?.filters.stores ?? [];
    return stores.find((store) => store.id === manualStoreId)?.label ?? null;
  }, [manualStoreId, overviewQuery.data?.filters.stores]);

  useEffect(() => {
    if (!receiveModal.open || !receiveModal.batch) {
      return;
    }

    const defaultWarehouseId = selectedWarehouseId || overviewQuery.data?.warehouseOptions[0]?.id || '';
    setReceiveWarehouseId((current) => current || defaultWarehouseId);
  }, [overviewQuery.data?.warehouseOptions, receiveModal.batch, receiveModal.open, selectedWarehouseId]);

  useEffect(() => {
    if (!selectedWarehouseOption) {
      setReceiveStagingLocationId('');
      return;
    }

    if (
      receiveStagingLocationId
      && !selectedWarehouseOption.stagingLocations.some((location) => location.id === receiveStagingLocationId)
    ) {
      setReceiveStagingLocationId('');
    }

    if (!receiveStagingLocationId && selectedWarehouseOption.stagingLocations.length > 0) {
      setReceiveStagingLocationId(selectedWarehouseOption.stagingLocations[0].id);
    }
  }, [receiveStagingLocationId, selectedWarehouseOption]);

  useEffect(() => {
    if (!manualReceiveModal.open) {
      return;
    }

    const defaultWarehouseId = selectedWarehouseId || overviewQuery.data?.warehouseOptions[0]?.id || '';
    setManualWarehouseId((current) => current || defaultWarehouseId);
  }, [manualReceiveModal.open, overviewQuery.data?.warehouseOptions, selectedWarehouseId]);

  useEffect(() => {
    if (!selectedManualWarehouseOption) {
      setManualStagingLocationId('');
      return;
    }

    if (
      manualStagingLocationId
      && !selectedManualWarehouseOption.stagingLocations.some((location) => location.id === manualStagingLocationId)
    ) {
      setManualStagingLocationId('');
    }

    if (!manualStagingLocationId && selectedManualWarehouseOption.stagingLocations.length > 0) {
      setManualStagingLocationId(selectedManualWarehouseOption.stagingLocations[0].id);
    }
  }, [manualStagingLocationId, selectedManualWarehouseOption]);

  const manualProductsQuery = useQuery({
    queryKey: ['wms-manual-receiving-products', selectedTenantId ?? 'default-tenant', manualStoreId ?? 'no-store'],
    queryFn: () =>
      fetchWmsProductsOverview({
        tenantId: selectedTenantId,
        storeId: manualStoreId,
      }),
    enabled: Boolean(manualReceiveModal.open && manualStoreId),
  });

  const createBatchMutation = useMutation({
    mutationFn: (input: CreateWmsReceivingBatchInput) => createWmsReceivingBatch(input, selectedTenantId),
    onSuccess: async (response) => {
      setBanner({
        tone: 'success',
        message: `Receiving batch ${response.batch.code} created and units staged`,
      });
      closeReceiveModal();
      closeManualReceiveModal();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['wms-receiving-overview'] }),
        queryClient.invalidateQueries({ queryKey: ['wms-purchasing-overview'] }),
        queryClient.invalidateQueries({ queryKey: ['wms-purchasing-batch'] }),
        queryClient.invalidateQueries({ queryKey: ['wms-inventory-overview'] }),
      ]);
    },
    onError: (error) => {
      setBanner({
        tone: 'error',
        message: getErrorMessage(error),
      });
    },
  });

  const recordBatchLabelPrintMutation = useMutation({
    mutationFn: (input: { batchId: string; action: 'PRINT' | 'REPRINT' }) =>
      recordWmsReceivingBatchLabelPrint(input.batchId, { action: input.action }, selectedTenantId),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['wms-receiving-overview'] }),
        queryClient.invalidateQueries({
          queryKey: ['wms-receiving-batch', variables.batchId],
        }),
        queryClient.invalidateQueries({ queryKey: ['wms-inventory-overview'] }),
      ]);
    },
  });

  const labelsBatchQuery = useQuery({
    queryKey: ['wms-receiving-batch', labelsModalState.batchId, selectedTenantId ?? 'default-tenant'],
    queryFn: () => fetchWmsReceivingBatch(labelsModalState.batchId!, selectedTenantId),
    enabled: Boolean(labelsModalState.open && labelsModalState.batchId),
  });

  const transferBatchQuery = useQuery({
    queryKey: ['wms-receiving-transfer-batch', transferWorkspaceState.batchId, selectedTenantId ?? 'default-tenant'],
    queryFn: () => fetchWmsReceivingBatch(transferWorkspaceState.batchId!, selectedTenantId),
    enabled: Boolean(transferWorkspaceState.batchId),
  });

  const putawayOptionsQuery = useQuery({
    queryKey: ['wms-receiving-putaway-options', transferWorkspaceState.batchId, selectedTenantId ?? 'default-tenant'],
    queryFn: () => fetchWmsReceivingPutawayOptions(transferWorkspaceState.batchId!, selectedTenantId),
    enabled: Boolean(transferWorkspaceState.batchId),
  });

  const assignPutawayMutation = useMutation({
    mutationFn: (input: { batchId: string; payload: AssignWmsReceivingPutawayInput }) =>
      assignWmsReceivingPutaway(input.batchId, input.payload, selectedTenantId),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['wms-receiving-overview'] }),
        queryClient.invalidateQueries({
          queryKey: ['wms-receiving-batch', variables.batchId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['wms-receiving-putaway-options', variables.batchId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['wms-receiving-transfer-batch', variables.batchId],
        }),
        queryClient.invalidateQueries({ queryKey: ['wms-inventory-overview'] }),
      ]);
    },
  });

  const errorMessage = useMemo(() => {
    if (!overviewQuery.error) {
      return null;
    }
    return getErrorMessage(overviewQuery.error);
  }, [overviewQuery.error]);

  const openReceiveModal = useCallback((batch: WmsReceivablePurchasingBatch) => {
    setReceiveModal({
      open: true,
      batch,
    });
    setReceiveNotes('');
    setReceiveWarehouseId('');
    setReceiveStagingLocationId('');
    setLineQuantities(
      Object.fromEntries(batch.lines.map((line) => [line.id, line.remainingQuantity])),
    );
  }, []);

  const closeReceiveModal = useCallback(() => {
    setReceiveModal({
      open: false,
      batch: null,
    });
    setReceiveNotes('');
    setReceiveWarehouseId('');
    setReceiveStagingLocationId('');
    setLineQuantities({});
  }, []);

  const openManualReceiveModal = useCallback(() => {
    setManualReceiveModal({ open: true });
    setManualWarehouseId('');
    setManualStagingLocationId('');
    setManualNotes('');
    setManualLines([]);
  }, []);

  const closeManualReceiveModal = useCallback(() => {
    setManualReceiveModal({ open: false });
    setManualWarehouseId('');
    setManualStagingLocationId('');
    setManualNotes('');
    setManualLines([]);
  }, []);

  const openLabelsModal = useCallback((batch: WmsReceivingBatchRow) => {
    setLabelsModalState({
      open: true,
      batchId: batch.id,
    });
  }, []);

  const closeLabelsModal = useCallback(() => {
    setLabelsModalState({
      open: false,
      batchId: null,
    });
  }, []);

  const selectTransferBatch = useCallback((batch: WmsReceivingBatchRow | null) => {
    setTransferWorkspaceState({
      batchId: batch?.id ?? null,
    });
  }, []);

  async function submitReceive() {
    if (!receiveModal.batch) {
      throw new Error('No purchasing batch selected');
    }

    await createBatchMutation.mutateAsync({
      purchasingBatchId: receiveModal.batch.id,
      warehouseId: receiveWarehouseId,
      stagingLocationId: receiveStagingLocationId,
      notes: receiveNotes.trim() || undefined,
      lines: receiveModal.batch.lines.map((line) => ({
        purchasingBatchLineId: line.id,
        receiveQuantity: Math.max(0, Math.floor(lineQuantities[line.id] ?? 0)),
      })),
    });
  }

  async function submitManualReceive() {
    if (!manualStoreId) {
      throw new Error('Select a store before manual stock input');
    }

    await createBatchMutation.mutateAsync({
      storeId: manualStoreId,
      warehouseId: manualWarehouseId,
      stagingLocationId: manualStagingLocationId,
      notes: manualNotes.trim() || undefined,
      lines: manualLines
        .filter((line) => line.profileId && line.quantity > 0)
        .map((line) => ({
          profileId: line.profileId,
          receiveQuantity: Math.max(0, Math.floor(line.quantity)),
        })),
    });
  }

  async function recordBatchLabelPrint(batchId: string, action: 'PRINT' | 'REPRINT') {
    try {
      await recordBatchLabelPrintMutation.mutateAsync({ batchId, action });
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  async function assignPutawayUnits(
    batchId: string,
    assignments: AssignWmsReceivingPutawayInput['assignments'],
  ) {
    try {
      await assignPutawayMutation.mutateAsync({
        batchId,
        payload: {
          assignments,
        },
      });
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  async function assignPutawayUnit(
    batchId: string,
    assignment: AssignWmsReceivingPutawayInput['assignments'][number],
  ) {
    await assignPutawayUnits(batchId, [assignment]);
  }

  const modalTotalUnits = useMemo(() => {
    if (!receiveModal.batch) {
      return 0;
    }

    return receiveModal.batch.lines.reduce(
      (sum, line) => sum + Math.max(0, Math.floor(lineQuantities[line.id] ?? 0)),
      0,
    );
  }, [lineQuantities, receiveModal.batch]);
  const manualModalTotalUnits = useMemo(
    () => manualLines.reduce((sum, line) => sum + Math.max(0, Math.floor(line.quantity)), 0),
    [manualLines],
  );
  const manualProductOptions = useMemo(
    () =>
      (manualProductsQuery.data?.products ?? [])
        .filter((product) => product.status !== 'ARCHIVED')
        .map((product) => ({
          id: product.id,
          label: product.name,
          variationLabel: product.variationDisplayId ?? product.variationId ?? 'No variation',
          customId: product.productCustomId ?? product.customId ?? null,
          hint: product.productCustomId ?? product.customId ?? null,
        })),
    [manualProductsQuery.data?.products],
  );

  return {
    overview: overviewQuery.data ?? null,
    isLoading: overviewQuery.isLoading,
    isFetching: overviewQuery.isFetching,
    errorMessage,
    banner,
    canReceive: hasAnyAdminPermission(
      user?.role ?? null,
      permissions,
      WMS_RECEIVING_CREATE_BATCH_PERMISSIONS,
    ),
    canManualInput: hasAnyAdminPermission(
      user?.role ?? null,
      permissions,
      WMS_RECEIVING_MANUAL_INPUT_PERMISSIONS,
    ),
    canPrintLabels: hasAnyAdminPermission(
      user?.role ?? null,
      permissions,
      WMS_RECEIVING_PRINT_LABELS_PERMISSIONS,
    ),
    canPutAway: hasAnyAdminPermission(
      user?.role ?? null,
      permissions,
      WMS_TRANSFER_PUTAWAY_PERMISSIONS,
    ),
    selectedTenantId,
    selectedStoreId,
    selectedWarehouseId,
    searchText,
    setSelectedTenantId,
    setSelectedStoreId,
    setSelectedWarehouseId,
    setSearchText,
    clearBanner: () => setBanner(null),
    receiveModal,
    selectedWarehouseOption,
    receiveWarehouseId,
    receiveStagingLocationId,
    receiveNotes,
    lineQuantities,
    modalTotalUnits,
    manualReceiveModal,
    manualStoreId,
    manualStoreName,
    manualWarehouseId,
    manualStagingLocationId,
    manualNotes,
    manualLines,
    manualModalTotalUnits,
    manualProductOptions,
    isLoadingManualProducts: manualProductsQuery.isLoading || manualProductsQuery.isFetching,
    openReceiveModal,
    closeReceiveModal,
    openManualReceiveModal,
    closeManualReceiveModal,
    setReceiveWarehouseId,
    setReceiveStagingLocationId,
    setReceiveNotes,
    setLineQuantity: (lineId: string, quantity: number) => {
      setLineQuantities((current) => ({
        ...current,
        [lineId]: Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0,
      }));
    },
    setManualWarehouseId,
    setManualStagingLocationId,
    setManualNotes,
    addManualLine: () =>
      setManualLines((current) => [
        ...current,
        { id: `manual-${Date.now()}-${current.length}`, profileId: '', quantity: 1 },
      ]),
    addManualProduct: (profileId: string) =>
      setManualLines((current) => {
        const existingLine = current.find((line) => line.profileId === profileId);
        if (existingLine) {
          return current.map((line) =>
            line.id === existingLine.id
              ? { ...line, quantity: Math.max(1, Math.floor(line.quantity) + 1) }
              : line,
          );
        }

        return [
          ...current,
          { id: `manual-${Date.now()}-${current.length}`, profileId, quantity: 1 },
        ];
      }),
    removeManualLine: (lineId: string) =>
      setManualLines((current) => current.filter((line) => line.id !== lineId)),
    setManualLineProfile: (lineId: string, profileId: string) =>
      setManualLines((current) =>
        current.map((line) => (line.id === lineId ? { ...line, profileId } : line)),
      ),
    setManualLineQuantity: (lineId: string, quantity: number) =>
      setManualLines((current) =>
        current.map((line) =>
          line.id === lineId
            ? { ...line, quantity: Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0 }
            : line,
        ),
      ),
    labelsModal: {
      open: labelsModalState.open,
      batch: labelsBatchQuery.data?.batch ?? null,
    },
    isLoadingLabelsBatch: labelsBatchQuery.isLoading || labelsBatchQuery.isFetching,
    isRecordingBatchLabelPrint: recordBatchLabelPrintMutation.isPending,
    transferWorkspace: {
      selectedBatchId: transferWorkspaceState.batchId,
      selectedBatch:
        overviewQuery.data?.receivingBatches.find((batch) => batch.id === transferWorkspaceState.batchId) ?? null,
      batchDetail: transferBatchQuery.data?.batch ?? null,
    },
    putawayOptions: putawayOptionsQuery.data ?? null,
    isLoadingPutawayOptions: putawayOptionsQuery.isLoading || putawayOptionsQuery.isFetching,
    isAssigningPutaway: assignPutawayMutation.isPending,
    openLabelsModal,
    closeLabelsModal,
    selectTransferBatch,
    recordBatchLabelPrint,
    assignPutawayUnits,
    assignPutawayUnit,
    submitReceive,
    submitManualReceive,
    isSubmitting: createBatchMutation.isPending,
  };
}
