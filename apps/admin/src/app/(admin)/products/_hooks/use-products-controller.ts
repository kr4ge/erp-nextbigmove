'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { readStoredAdminUser, readStoredPermissions } from '@/lib/admin-session';
import { useWmsScopeFilters } from '../../_hooks/use-wms-scope-filters';
import {
  hasAnyAdminPermission,
  WMS_PRODUCTS_EDIT_PERMISSIONS,
  WMS_PRODUCTS_SYNC_PERMISSIONS,
} from '@/lib/wms-permissions';
import {
  fetchWmsProductsOverview,
  syncWmsProductsStore,
  updateWmsProductProfile,
} from '../_services/products.service';
import type {
  UpdateWmsProductProfileInput,
  WmsProductProfileRecord,
  WmsProductProfileStatus,
} from '../_types/product';

type BannerState = {
  tone: 'success' | 'error';
  message: string;
} | null;

type ProfileModalState = {
  open: boolean;
  profile: WmsProductProfileRecord | null;
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

export function useProductsController() {
  const pageSize = 10;
  const queryClient = useQueryClient();
  const user = useMemo(() => readStoredAdminUser(), []);
  const permissions = useMemo(() => readStoredPermissions(), []);
  const [selectedTenantId, setSelectedTenantIdState] = useState<string | undefined>();
  const [selectedStoreId, setSelectedStoreIdState] = useState<string | undefined>();
  const [selectedPosWarehouseId, setSelectedPosWarehouseId] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<WmsProductProfileStatus | undefined>();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchText, setSearchText] = useState('');
  const [banner, setBanner] = useState<BannerState>(null);
  const [profileModal, setProfileModal] = useState<ProfileModalState>({
    open: false,
    profile: null,
  });

  const deferredSearch = useDeferredValue(searchText.trim());

  const overviewQuery = useQuery({
    queryKey: [
      'wms-products-overview',
      selectedTenantId ?? 'default-tenant',
      selectedStoreId ?? 'default',
      selectedPosWarehouseId ?? 'all',
      deferredSearch,
      statusFilter ?? 'all',
    ],
    queryFn: () =>
      fetchWmsProductsOverview({
        tenantId: selectedTenantId,
        storeId: selectedStoreId,
        posWarehouseId: selectedPosWarehouseId,
        search: deferredSearch || undefined,
        status: statusFilter,
      }),
  });

  const { setSelectedTenantId, setSelectedStoreId } = useWmsScopeFilters({
    filters: overviewQuery.data?.filters,
    selectedTenantId,
    setSelectedTenantIdState,
    selectedStoreId,
    setSelectedStoreIdState,
  });

  useEffect(() => {
    if (!selectedPosWarehouseId) {
      return;
    }

    const posWarehouses = overviewQuery.data?.filters.posWarehouses;

    if (!posWarehouses) {
      return;
    }

    const stillExists = posWarehouses.some((warehouse) => warehouse.id === selectedPosWarehouseId);

    if (!stillExists) {
      setSelectedPosWarehouseId(undefined);
    }
  }, [overviewQuery.data?.filters.posWarehouses, selectedPosWarehouseId]);

  const updateProfileMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateWmsProductProfileInput }) =>
      updateWmsProductProfile(id, input, selectedTenantId),
    onSuccess: async () => {
      setBanner({ tone: 'success', message: 'Product profile updated' });
      setProfileModal({ open: false, profile: null });
      await queryClient.invalidateQueries({ queryKey: ['wms-products-overview'] });
    },
    onError: (error) => {
      setBanner({ tone: 'error', message: getErrorMessage(error) });
    },
  });

  const syncStoreMutation = useMutation({
    mutationFn: ({ storeId, tenantId }: { storeId: string; tenantId?: string }) =>
      syncWmsProductsStore(storeId, tenantId),
    onSuccess: async (response) => {
      setBanner({
        tone: 'success',
        message: `${response.store.name}: synced ${response.syncedCount.toLocaleString()} products`,
      });
      await queryClient.invalidateQueries({ queryKey: ['wms-products-overview'] });
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

  const totalPages = useMemo(() => {
    const totalProducts = overviewQuery.data?.products.length ?? 0;
    return Math.max(1, Math.ceil(totalProducts / pageSize));
  }, [overviewQuery.data?.products.length, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedTenantId, selectedStoreId, selectedPosWarehouseId, deferredSearch, statusFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedProducts = useMemo(() => {
    const products = overviewQuery.data?.products ?? [];
    const startIndex = (currentPage - 1) * pageSize;

    return products.slice(startIndex, startIndex + pageSize);
  }, [currentPage, overviewQuery.data?.products, pageSize]);

  return {
    overview: overviewQuery.data ?? null,
    products: paginatedProducts,
    userRole: user?.role ?? null,
    canEditProfile: hasAnyAdminPermission(
      user?.role ?? null,
      permissions,
      WMS_PRODUCTS_EDIT_PERMISSIONS,
    ),
    canSyncStore: hasAnyAdminPermission(
      user?.role ?? null,
      permissions,
      WMS_PRODUCTS_SYNC_PERMISSIONS,
    ),
    isLoading: overviewQuery.isLoading,
    isFetching: overviewQuery.isFetching,
    errorMessage,
    banner,
    selectedTenantId,
    selectedStoreId,
    selectedPosWarehouseId,
    statusFilter,
    currentPage,
    totalPages,
    pageSize,
    searchText,
    profileModal,
    setSelectedTenantId: (tenantId: string | undefined) => {
      setSelectedTenantId(tenantId);
      setSelectedPosWarehouseId(undefined);
    },
    setSelectedStoreId: (storeId: string | undefined) => {
      setSelectedStoreId(storeId);
      setSelectedPosWarehouseId(undefined);
    },
    setSelectedPosWarehouseId,
    setStatusFilter,
    setCurrentPage,
    setSearchText,
    openProfileModal: (profile: WmsProductProfileRecord) => setProfileModal({ open: true, profile }),
    closeProfileModal: () => setProfileModal({ open: false, profile: null }),
    submitProfile: async (input: UpdateWmsProductProfileInput) => {
      if (!profileModal.profile) {
        return;
      }

      await updateProfileMutation.mutateAsync({
        id: profileModal.profile.id,
        input,
      });
    },
    syncSelectedStore: async () => {
      if (!selectedStoreId) {
        setBanner({ tone: 'error', message: 'Select a store before syncing products' });
        return;
      }

      await syncStoreMutation.mutateAsync({
        storeId: selectedStoreId,
        tenantId: selectedTenantId,
      });
    },
    isSavingProfile: updateProfileMutation.isPending,
    isSyncingStore: syncStoreMutation.isPending,
    clearBanner: () => setBanner(null),
  };
}
