'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { readStoredAdminUser, readStoredPermissions } from '@/lib/admin-session';
import { useWmsScopeFilters } from '../../_hooks/use-wms-scope-filters';
import {
  hasAnyAdminPermission,
  WMS_RECEIVING_CREATE_BATCH_PERMISSIONS,
  WMS_RECEIVING_MANUAL_INPUT_PERMISSIONS,
  WMS_RECEIVING_PRINT_LABELS_PERMISSIONS,
  WMS_INVENTORY_DELETE_PERMISSIONS,
  WMS_TRANSFER_PUTAWAY_PERMISSIONS,
} from '@/lib/wms-permissions';
import { fetchWmsProductsOverview } from '../../products/_services/products.service';
import { ensureManualReceivingLinkedInvoice } from '../../finance/_services/purchasing.service';
import {
  assignWmsReceivingPutaway,
  createWmsReceivingBatch,
  fetchWmsReceivingBatch,
  fetchWmsReceivingBatchLabels,
  fetchWmsReceivingOverview,
  fetchWmsReceivingPutawayOptions,
  recordWmsReceivingBatchLabelPrint,
  resetWmsReceivingPutaway,
  voidWmsReceivingBatch,
} from '../_services/receiving.service';
import type {
  AssignWmsReceivingPutawayInput,
  CreateWmsReceivingBatchInput,
  ResetWmsReceivingPutawayInput,
  VoidWmsReceivingBatchInput,
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
  tenantId: string | null;
};

type ManualReceiveLineState = {
  id: string;
  storeId: string;
  profileId: string;
  quantity: number;
  unitCost: number | null;
};

type ManualReceiveModalState = {
  open: boolean;
};

type TransferWorkspaceState = {
  batchId: string | null;
  tenantId: string | null;
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

function parseOptionalCost(value: string | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readInitialTenantScope() {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const tenantId = localStorage.getItem('current_tenant_id');
  return tenantId || undefined;
}

export function useReceivingController() {
  const queryClient = useQueryClient();
  const user = useMemo(() => readStoredAdminUser(), []);
  const permissions = useMemo(() => readStoredPermissions(), []);
  const [selectedTenantId, setSelectedTenantIdState] = useState<string | undefined>(readInitialTenantScope);
  const [selectedStoreId, setSelectedStoreIdState] = useState<string | undefined>();
  const [selectedWarehouseId, setSelectedWarehouseIdState] = useState<string | undefined>();
  const [searchText, setSearchText] = useState('');
  const [debouncedSearchText, setDebouncedSearchText] = useState('');
  const [banner, setBanner] = useState<BannerState>(null);
  const [receiveModal, setReceiveModal] = useState<ReceiveModalState>({
    open: false,
    batch: null,
  });
  const [labelsModalState, setLabelsModalState] = useState<LabelsModalState>({
    open: false,
    batchId: null,
    tenantId: null,
  });
  const [manualReceiveModal, setManualReceiveModal] = useState<ManualReceiveModalState>({
    open: false,
  });
  const [transferWorkspaceState, setTransferWorkspaceState] = useState<TransferWorkspaceState>({
    batchId: null,
    tenantId: null,
  });
  const [receiveWarehouseId, setReceiveWarehouseId] = useState('');
  const [receiveStagingLocationId, setReceiveStagingLocationId] = useState('');
  const [receiveNotes, setReceiveNotes] = useState('');
  const [lineQuantities, setLineQuantities] = useState<Record<string, number>>({});
  const [manualWarehouseId, setManualWarehouseId] = useState('');
  const [manualStagingLocationId, setManualStagingLocationId] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [manualLines, setManualLines] = useState<ManualReceiveLineState[]>([]);

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
      'wms-receiving-overview',
      selectedTenantId ?? 'default-tenant',
      selectedStoreId ?? 'all-stores',
      selectedWarehouseId ?? 'all-warehouses',
      debouncedSearchText,
    ],
    queryFn: () =>
      fetchWmsReceivingOverview({
        allTenants: !selectedTenantId,
        tenantId: selectedTenantId,
        storeId: selectedStoreId,
        warehouseId: selectedWarehouseId,
        search: debouncedSearchText || undefined,
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
    allowAllTenants: true,
  });

  const selectedWarehouseOption = useMemo(
    () => overviewQuery.data?.warehouseOptions.find((option) => option.id === receiveWarehouseId) ?? null,
    [overviewQuery.data?.warehouseOptions, receiveWarehouseId],
  );
  const selectedManualWarehouseOption = useMemo(
    () => overviewQuery.data?.warehouseOptions.find((option) => option.id === manualWarehouseId) ?? null,
    [manualWarehouseId, overviewQuery.data?.warehouseOptions],
  );
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
    queryKey: ['wms-manual-receiving-products', selectedTenantId ?? 'no-tenant'],
    queryFn: () =>
      fetchWmsProductsOverview({
        tenantId: selectedTenantId,
      }),
    enabled: Boolean(manualReceiveModal.open && selectedTenantId),
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
      recordWmsReceivingBatchLabelPrint(
        input.batchId,
        { action: input.action },
        labelsModalState.tenantId ?? selectedTenantId,
      ),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['wms-receiving-overview'] }),
        queryClient.invalidateQueries({
          queryKey: ['wms-receiving-batch', variables.batchId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['wms-receiving-batch-labels', variables.batchId],
        }),
        queryClient.invalidateQueries({ queryKey: ['wms-inventory-overview'] }),
      ]);
    },
  });

  const ensureInvoiceMutation = useMutation({
    mutationFn: (input: { batchId: string; tenantId?: string | null }) =>
      ensureManualReceivingLinkedInvoice(input.batchId, input.tenantId ?? selectedTenantId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['wms-receiving-batch-labels'] }),
        queryClient.invalidateQueries({ queryKey: ['wms-invoice-overview'] }),
        queryClient.invalidateQueries({ queryKey: ['wms-invoice-detail'] }),
      ]);
    },
    onError: (error) => {
      setBanner({
        tone: 'error',
        message: getErrorMessage(error),
      });
    },
  });

  const labelsBatchQuery = useQuery({
    queryKey: ['wms-receiving-batch-labels', labelsModalState.batchId, labelsModalState.tenantId ?? selectedTenantId ?? 'default-tenant'],
    queryFn: () => fetchWmsReceivingBatchLabels(labelsModalState.batchId!, labelsModalState.tenantId ?? selectedTenantId),
    enabled: Boolean(labelsModalState.open && labelsModalState.batchId),
  });

  const transferBatchQuery = useQuery({
    queryKey: ['wms-receiving-transfer-batch', transferWorkspaceState.batchId, transferWorkspaceState.tenantId ?? selectedTenantId ?? 'default-tenant'],
    queryFn: () => fetchWmsReceivingBatch(transferWorkspaceState.batchId!, transferWorkspaceState.tenantId ?? selectedTenantId),
    enabled: Boolean(transferWorkspaceState.batchId),
  });

  const putawayOptionsQuery = useQuery({
    queryKey: ['wms-receiving-putaway-options', transferWorkspaceState.batchId, transferWorkspaceState.tenantId ?? selectedTenantId ?? 'default-tenant'],
    queryFn: () => fetchWmsReceivingPutawayOptions(transferWorkspaceState.batchId!, transferWorkspaceState.tenantId ?? selectedTenantId),
    enabled: Boolean(transferWorkspaceState.batchId),
  });

  const assignPutawayMutation = useMutation({
    mutationFn: (input: { batchId: string; payload: AssignWmsReceivingPutawayInput }) =>
      assignWmsReceivingPutaway(
        input.batchId,
        input.payload,
        transferWorkspaceState.tenantId ?? selectedTenantId,
      ),
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

  const resetPutawayMutation = useMutation({
    mutationFn: (input: { batchId: string; payload: ResetWmsReceivingPutawayInput }) =>
      resetWmsReceivingPutaway(
        input.batchId,
        input.payload,
        transferWorkspaceState.tenantId ?? selectedTenantId,
      ),
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

  const voidBatchMutation = useMutation({
    mutationFn: (input: { batchId: string; payload: VoidWmsReceivingBatchInput; tenantId?: string }) =>
      voidWmsReceivingBatch(
        input.batchId,
        input.payload,
        input.tenantId ?? selectedTenantId,
      ),
    onSuccess: async (result, variables) => {
      setBanner({
        tone: 'success',
        message: `${result.batch.code} voided. ${result.voidedUnitCount.toLocaleString()} staged units archived.`,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['wms-receiving-overview'] }),
        queryClient.invalidateQueries({
          queryKey: ['wms-receiving-batch', variables.batchId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['wms-receiving-batch-labels', variables.batchId],
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
      tenantId: batch.tenantId,
    });
  }, []);

  const closeLabelsModal = useCallback(() => {
    setLabelsModalState({
      open: false,
      batchId: null,
      tenantId: null,
    });
  }, []);

  const selectTransferBatch = useCallback((batch: WmsReceivingBatchRow | null) => {
    setTransferWorkspaceState({
      batchId: batch?.id ?? null,
      tenantId: batch?.tenantId ?? null,
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
    if (!selectedTenantId) {
      throw new Error('Select a partner before manual stock input');
    }

    await createBatchMutation.mutateAsync({
      warehouseId: manualWarehouseId,
      stagingLocationId: manualStagingLocationId,
      notes: manualNotes.trim() || undefined,
      lines: manualLines
        .filter((line) => line.profileId && line.quantity > 0 && line.storeId)
        .map((line) => ({
          profileId: line.profileId,
          storeId: line.storeId,
          receiveQuantity: Math.max(0, Math.floor(line.quantity)),
          unitCost: line.unitCost ?? undefined,
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

  async function ensureBatchInvoice(batchId: string, tenantId?: string | null) {
    try {
      const response = await ensureInvoiceMutation.mutateAsync({ batchId, tenantId });
      setBanner({
        tone: 'success',
        message: `Invoice ${response.invoice.invoiceNumber} is ready`,
      });
      return response.invoice;
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

  async function resetPutawayUnits(batchId: string, unitIds: string[]) {
    try {
      await resetPutawayMutation.mutateAsync({
        batchId,
        payload: {
          unitIds,
        },
      });
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  async function voidReceivingBatch(batch: WmsReceivingBatchRow) {
    if (batch.status !== 'STAGED') {
      setBanner({
        tone: 'error',
        message: 'Only staged receiving batches can be voided.',
      });
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    const reason = window.prompt(`Reason for voiding ${batch.code}?`);
    const cleanReason = reason?.trim();
    if (!cleanReason) {
      return;
    }

    const confirmed = window.confirm(
      `Void ${batch.code} and archive ${batch.unitCount.toLocaleString()} staged units? This cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }

    try {
      await voidBatchMutation.mutateAsync({
        batchId: batch.id,
        tenantId: batch.tenantId,
        payload: {
          reason: cleanReason,
        },
      });
    } catch (error) {
      setBanner({
        tone: 'error',
        message: getErrorMessage(error),
      });
    }
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
        .filter((product) => product.isStockable && product.status !== 'ARCHIVED')
        .map((product) => ({
          id: product.id,
          storeId: product.store.id,
          storeLabel: product.store.name,
          label: product.name,
          variationLabel: product.variationDisplayId ?? product.variationId ?? 'No variation',
          customId: product.productCustomId ?? product.customId ?? null,
          hint: product.productCustomId ?? product.customId ?? null,
          defaultUnitCost: parseOptionalCost(product.inhouseUnitCost),
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
    canVoidReceivingBatch: hasAnyAdminPermission(
      user?.role ?? null,
      permissions,
      WMS_INVENTORY_DELETE_PERMISSIONS,
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
        { id: `manual-${Date.now()}-${current.length}`, storeId: '', profileId: '', quantity: 1, unitCost: null },
      ]),
    addManualProduct: (profileId: string) =>
      setManualLines((current) => {
        const product = manualProductOptions.find((option) => option.id === profileId);
        const existingLine = current.find((line) => line.profileId === profileId && line.storeId === product?.storeId);
        if (existingLine) {
          return current.map((line) =>
            line.id === existingLine.id
              ? { ...line, quantity: Math.max(1, Math.floor(line.quantity) + 1) }
              : line,
          );
        }

        return [
          ...current,
          {
            id: `manual-${Date.now()}-${current.length}`,
            storeId: product?.storeId ?? '',
            profileId,
            quantity: 1,
            unitCost: product?.defaultUnitCost ?? null,
          },
        ];
      }),
    removeManualLine: (lineId: string) =>
      setManualLines((current) => current.filter((line) => line.id !== lineId)),
    setManualLineProfile: (lineId: string, profileId: string) =>
      setManualLines((current) =>
        current.map((line) => {
          if (line.id !== lineId) {
            return line;
          }

          const product = manualProductOptions.find((option) => option.id === profileId);
          return {
            ...line,
            profileId,
            storeId: product?.storeId ?? line.storeId,
            unitCost: line.unitCost ?? product?.defaultUnitCost ?? null,
          };
        }),
      ),
    setManualLineQuantity: (lineId: string, quantity: number) =>
      setManualLines((current) =>
        current.map((line) =>
          line.id === lineId
            ? { ...line, quantity: Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0 }
            : line,
        ),
      ),
    setManualLineUnitCost: (lineId: string, unitCost: number | null) =>
      setManualLines((current) =>
        current.map((line) =>
          line.id === lineId
            ? { ...line, unitCost: unitCost !== null && Number.isFinite(unitCost) ? Math.max(0, unitCost) : null }
            : line,
        ),
      ),
    labelsModal: {
      open: labelsModalState.open,
      batch: labelsBatchQuery.data?.batch ?? null,
    },
    isLoadingLabelsBatch: labelsBatchQuery.isLoading || labelsBatchQuery.isFetching,
    labelsErrorMessage: labelsBatchQuery.error ? getErrorMessage(labelsBatchQuery.error) : null,
    isRecordingBatchLabelPrint: recordBatchLabelPrintMutation.isPending,
    isEnsuringBatchInvoice: ensureInvoiceMutation.isPending,
    transferWorkspace: {
      selectedBatchId: transferWorkspaceState.batchId,
      selectedBatch:
        overviewQuery.data?.receivingBatches.find((batch) => batch.id === transferWorkspaceState.batchId) ?? null,
      batchDetail: transferBatchQuery.data?.batch ?? null,
    },
    putawayOptions: putawayOptionsQuery.data ?? null,
    isLoadingPutawayOptions: putawayOptionsQuery.isLoading || putawayOptionsQuery.isFetching,
    isAssigningPutaway: assignPutawayMutation.isPending,
    isResettingPutaway: resetPutawayMutation.isPending,
    isVoidingReceivingBatch: voidBatchMutation.isPending,
    openLabelsModal,
    closeLabelsModal,
    selectTransferBatch,
    recordBatchLabelPrint,
    ensureBatchInvoice,
    assignPutawayUnits,
    assignPutawayUnit,
    resetPutawayUnits,
    voidReceivingBatch,
    submitReceive,
    submitManualReceive,
    isSubmitting: createBatchMutation.isPending,
  };
}
