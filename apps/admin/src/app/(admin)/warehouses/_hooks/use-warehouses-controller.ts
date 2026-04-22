'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
  createWmsLocation,
  createWmsWarehouse,
  fetchWmsWarehousesOverview,
  updateWmsLocation,
  updateWmsWarehouse,
} from '../_services/warehouses.service';
import type {
  CreateWmsLocationInput,
  CreateWmsWarehouseInput,
  UpdateWmsLocationInput,
  UpdateWmsWarehouseInput,
  WmsLocationTreeNode,
  WmsWarehouseDetail,
  WmsWarehousesOverviewResponse,
} from '../_types/warehouse';

type BannerState = {
  tone: 'success' | 'error';
  message: string;
} | null;

type WarehouseModalState = {
  open: boolean;
  warehouse: WmsWarehouseDetail | null;
};

type LocationModalState = {
  open: boolean;
  location: WmsLocationTreeNode | null;
  draft: Partial<CreateWmsLocationInput> | null;
};

function resolveLatestBinId(
  warehouse: WmsWarehousesOverviewResponse['activeWarehouse'],
  rackId: string | undefined,
) {
  if (!warehouse || !rackId) {
    return null;
  }

  for (const section of warehouse.structuralLocations) {
    for (const rack of section.children) {
      if (rack.id !== rackId) {
        continue;
      }

      const bins = rack.children.filter((location) => location.kind === 'BIN');
      if (bins.length === 0) {
        return null;
      }

      const sortedBins = [...bins].sort((left, right) => left.code.localeCompare(right.code));
      return sortedBins[sortedBins.length - 1]?.id ?? null;
    }
  }

  return null;
}

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

export function useWarehousesController() {
  const queryClient = useQueryClient();
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | undefined>();
  const [banner, setBanner] = useState<BannerState>(null);
  const [newlyCreatedBinId, setNewlyCreatedBinId] = useState<string | null>(null);
  const [warehouseModal, setWarehouseModal] = useState<WarehouseModalState>({
    open: false,
    warehouse: null,
  });
  const [locationModal, setLocationModal] = useState<LocationModalState>({
    open: false,
    location: null,
    draft: null,
  });

  const overviewQuery = useQuery({
    queryKey: ['wms-warehouses-overview', selectedWarehouseId ?? 'default'],
    queryFn: () => fetchWmsWarehousesOverview(selectedWarehouseId),
  });

  useEffect(() => {
    const activeWarehouseId = overviewQuery.data?.activeWarehouseId;
    if (!selectedWarehouseId && activeWarehouseId) {
      setSelectedWarehouseId(activeWarehouseId);
    }
  }, [overviewQuery.data?.activeWarehouseId, selectedWarehouseId]);

  const activeWarehouse = overviewQuery.data?.activeWarehouse ?? null;

  const handleMutationSuccess = async (response: WmsWarehousesOverviewResponse, message: string) => {
    setBanner({ tone: 'success', message });
    if (response.activeWarehouseId) {
      setSelectedWarehouseId(response.activeWarehouseId);
    }
    await queryClient.invalidateQueries({ queryKey: ['wms-warehouses-overview'] });
  };

  const createWarehouseMutation = useMutation({
    mutationFn: (input: CreateWmsWarehouseInput) => createWmsWarehouse(input),
    onSuccess: async (response) => {
      setWarehouseModal({ open: false, warehouse: null });
      await handleMutationSuccess(response, 'Warehouse created');
    },
    onError: (error) => {
      setBanner({ tone: 'error', message: getErrorMessage(error) });
    },
  });

  const updateWarehouseMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateWmsWarehouseInput }) => updateWmsWarehouse(id, input),
    onSuccess: async (response) => {
      setWarehouseModal({ open: false, warehouse: null });
      await handleMutationSuccess(response, 'Warehouse updated');
    },
    onError: (error) => {
      setBanner({ tone: 'error', message: getErrorMessage(error) });
    },
  });

  const createLocationMutation = useMutation({
    mutationFn: ({ warehouseId, input }: { warehouseId: string; input: CreateWmsLocationInput }) =>
      createWmsLocation(warehouseId, input),
    onSuccess: async (response, variables) => {
      if (variables.input.kind === 'BIN') {
        const createdBinId = resolveLatestBinId(response.activeWarehouse, variables.input.parentId);
        if (createdBinId) {
          setNewlyCreatedBinId(createdBinId);
        } else {
          setNewlyCreatedBinId(null);
        }
      } else {
        setNewlyCreatedBinId(null);
      }

      setLocationModal({ open: false, location: null, draft: null });
      await handleMutationSuccess(response, 'Location created');
    },
    onError: (error) => {
      setBanner({ tone: 'error', message: getErrorMessage(error) });
    },
  });

  const updateLocationMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateWmsLocationInput }) => updateWmsLocation(id, input),
    onSuccess: async (response) => {
      setLocationModal({ open: false, location: null, draft: null });
      setNewlyCreatedBinId(null);
      await handleMutationSuccess(response, 'Location updated');
    },
    onError: (error) => {
      setBanner({ tone: 'error', message: getErrorMessage(error) });
    },
  });

  const errorMessage = useMemo(() => {
    if (!overviewQuery.error) {
      return null;
    }

    return getErrorMessage(overviewQuery.error);
  }, [overviewQuery.error]);

  return {
    overview: overviewQuery.data ?? null,
    activeWarehouse,
    isLoading: overviewQuery.isLoading,
    isFetching: overviewQuery.isFetching,
    errorMessage,
    banner,
    selectedWarehouseId,
    setSelectedWarehouseId,
    newlyCreatedBinId,
    warehouseModal,
    locationModal,
    openCreateWarehouse: () => setWarehouseModal({ open: true, warehouse: null }),
    openEditWarehouse: (warehouse: WmsWarehouseDetail) =>
      setWarehouseModal({ open: true, warehouse }),
    closeWarehouseModal: () => setWarehouseModal({ open: false, warehouse: null }),
    openCreateLocation: (draft?: Partial<CreateWmsLocationInput>) =>
      setLocationModal({ open: true, location: null, draft: draft ?? null }),
    openEditLocation: (location: WmsLocationTreeNode) =>
      setLocationModal({ open: true, location, draft: null }),
    closeLocationModal: () => setLocationModal({ open: false, location: null, draft: null }),
    submitWarehouse: async (input: CreateWmsWarehouseInput | UpdateWmsWarehouseInput) => {
      if (warehouseModal.warehouse) {
        await updateWarehouseMutation.mutateAsync({
          id: warehouseModal.warehouse.id,
          input,
        });
        return;
      }

      await createWarehouseMutation.mutateAsync(input as CreateWmsWarehouseInput);
    },
    submitLocation: async (input: CreateWmsLocationInput | UpdateWmsLocationInput) => {
      if (locationModal.location) {
        await updateLocationMutation.mutateAsync({
          id: locationModal.location.id,
          input,
        });
        return;
      }

      if (!activeWarehouse) {
        setBanner({ tone: 'error', message: 'Select a warehouse before adding locations' });
        return;
      }

      await createLocationMutation.mutateAsync({
        warehouseId: activeWarehouse.id,
        input: input as CreateWmsLocationInput,
      });
    },
    isSavingWarehouse: createWarehouseMutation.isPending || updateWarehouseMutation.isPending,
    isSavingLocation: createLocationMutation.isPending || updateLocationMutation.isPending,
    clearBanner: () => setBanner(null),
    clearNewlyCreatedBinId: () => setNewlyCreatedBinId(null),
  };
}
