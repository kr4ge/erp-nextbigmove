'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { readStoredAdminUser, readStoredPermissions } from '@/lib/admin-session';
import { useWmsScopeFilters } from '../../_hooks/use-wms-scope-filters';
import {
  hasAnyAdminPermission,
  WMS_PURCHASING_EDIT_PERMISSIONS,
  WMS_PURCHASING_POST_RECEIVING_PERMISSIONS,
} from '@/lib/wms-permissions';
import {
  fetchWmsPurchasingBatch,
  fetchWmsPurchasingOverview,
  markWmsPurchasingNotificationsRead,
  updateWmsPurchasingLine,
  updateWmsPurchasingStatus,
} from '../_services/purchasing.service';
import type {
  UpdateWmsPurchasingLineInput,
  UpdateWmsPurchasingStatusInput,
  WmsPurchasingBatchStatus,
  WmsPurchasingRequestType,
} from '../_types/purchasing';
import { STATUS_TRANSITIONS } from '../_utils/purchasing-presenters';
import { usePurchasingRealtime } from './use-purchasing-realtime';

type BannerState = {
  tone: 'success' | 'error';
  message: string;
} | null;

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

export function usePurchasingController() {
  const queryClient = useQueryClient();
  const user = useMemo(() => readStoredAdminUser(), []);
  const permissions = useMemo(() => readStoredPermissions(), []);
  const [selectedTenantId, setSelectedTenantIdState] = useState<string | undefined>();
  const [selectedStoreId, setSelectedStoreIdState] = useState<string | undefined>();
  const [selectedRequestType, setSelectedRequestType] = useState<WmsPurchasingRequestType | undefined>();
  const [selectedStatus, setSelectedStatus] = useState<WmsPurchasingBatchStatus | undefined>();
  const [searchText, setSearchText] = useState('');
  const [debouncedSearchText, setDebouncedSearchText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [banner, setBanner] = useState<BannerState>(null);
  const markedNotificationRef = useRef<string | null>(null);

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
      'wms-purchasing-overview',
      selectedTenantId ?? 'default-tenant',
      selectedStoreId ?? 'all-stores',
      selectedRequestType ?? 'all-types',
      selectedStatus ?? 'all-statuses',
      debouncedSearchText,
      currentPage,
    ],
    queryFn: () =>
      fetchWmsPurchasingOverview({
        tenantId: selectedTenantId,
        storeId: selectedStoreId,
        requestType: selectedRequestType,
        status: selectedStatus,
        search: debouncedSearchText || undefined,
        page: currentPage,
        pageSize: 10,
      }),
  });

  const { setSelectedTenantId, setSelectedStoreId } = useWmsScopeFilters({
    filters: overviewQuery.data?.filters,
    selectedTenantId,
    setSelectedTenantIdState,
    selectedStoreId,
    setSelectedStoreIdState,
  });

  const batchDetailQuery = useQuery({
    queryKey: ['wms-purchasing-batch', selectedBatchId, selectedTenantId ?? 'default-tenant'],
    queryFn: () => fetchWmsPurchasingBatch(selectedBatchId!, selectedTenantId),
    enabled: Boolean(selectedBatchId),
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedTenantId, selectedStoreId, selectedRequestType, selectedStatus, debouncedSearchText]);

  useEffect(() => {
    if (!selectedBatchId) {
      markedNotificationRef.current = null;
      return;
    }

    const currentRows = overviewQuery.data?.batches ?? [];
    const rowStillVisible = currentRows.some((batch) => batch.id === selectedBatchId);

    if (!rowStillVisible && !overviewQuery.isFetching) {
      setSelectedBatchId(null);
    }
  }, [overviewQuery.data?.batches, overviewQuery.isFetching, selectedBatchId]);

  const updateStatusMutation = useMutation({
    mutationFn: (input: UpdateWmsPurchasingStatusInput) => {
      if (!selectedBatchId) {
        throw new Error('No purchasing batch is selected');
      }
      return updateWmsPurchasingStatus(selectedBatchId, input, selectedTenantId);
    },
    onSuccess: async (response) => {
      setBanner({
        tone: 'success',
        message: `Batch moved to ${response.batch.status.replaceAll('_', ' ').toLowerCase()}`,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['wms-purchasing-overview'] }),
        queryClient.invalidateQueries({ queryKey: ['wms-purchasing-batch'] }),
      ]);
    },
    onError: (error) => {
      setBanner({ tone: 'error', message: getErrorMessage(error) });
    },
  });

  const updateLineMutation = useMutation({
    mutationFn: (input: { lineId: string; payload: UpdateWmsPurchasingLineInput }) => {
      if (!selectedBatchId) {
        throw new Error('No purchasing batch is selected');
      }
      return updateWmsPurchasingLine(selectedBatchId, input.lineId, input.payload, selectedTenantId);
    },
    onSuccess: async (response) => {
      setBanner({
        tone: 'success',
        message:
          response.batch.status === 'REVISION'
            ? 'Revision sent to partner for confirmation'
            : 'Request line updated',
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['wms-purchasing-overview'] }),
        queryClient.invalidateQueries({ queryKey: ['wms-purchasing-batch'] }),
      ]);
    },
    onError: (error) => {
      setBanner({ tone: 'error', message: getErrorMessage(error) });
    },
  });

  const selectedBatch = batchDetailQuery.data?.batch ?? null;
  const availableStatusActions = selectedBatch
    ? STATUS_TRANSITIONS[selectedBatch.status]
    : [];

  useEffect(() => {
    if (!selectedBatch) {
      return;
    }

    const markKey = [
      selectedTenantId ?? 'default-tenant',
      selectedBatch.id,
      selectedBatch.events[0]?.id ?? 'no-event',
    ].join(':');

    if (markedNotificationRef.current === markKey) {
      return;
    }

    markedNotificationRef.current = markKey;

    void markWmsPurchasingNotificationsRead(selectedBatch.id, selectedTenantId)
      .then(() =>
        queryClient.invalidateQueries({ queryKey: ['wms-purchasing-notification-count'] }))
      .catch(() => {
        if (markedNotificationRef.current === markKey) {
          markedNotificationRef.current = null;
        }
      });
  }, [queryClient, selectedBatch, selectedTenantId]);

  const errorMessage = useMemo(() => {
    if (!overviewQuery.error) {
      return null;
    }
    return getErrorMessage(overviewQuery.error);
  }, [overviewQuery.error]);

  const handleRealtimeUpdate = useCallback((payload: { batchId?: string }) => {
    void queryClient.invalidateQueries({ queryKey: ['wms-purchasing-overview'] });

    if (selectedBatchId && (!payload.batchId || payload.batchId === selectedBatchId)) {
      void queryClient.invalidateQueries({ queryKey: ['wms-purchasing-batch'] });
    }
  }, [queryClient, selectedBatchId]);

  usePurchasingRealtime({
    tenantId: selectedTenantId ?? null,
    onUpdate: handleRealtimeUpdate,
  });

  return {
    overview: overviewQuery.data ?? null,
    selectedBatch,
    selectedTenantId,
    selectedStoreId,
    selectedRequestType,
    selectedStatus,
    searchText,
    currentPage,
    banner,
    userRole: user?.role ?? null,
    canEdit: hasAnyAdminPermission(
      user?.role ?? null,
      permissions,
      WMS_PURCHASING_EDIT_PERMISSIONS,
    ),
    canPostReceiving: hasAnyAdminPermission(
      user?.role ?? null,
      permissions,
      WMS_PURCHASING_POST_RECEIVING_PERMISSIONS,
    ),
    isLoading: overviewQuery.isLoading,
    isFetching: overviewQuery.isFetching,
    isLoadingBatch: batchDetailQuery.isFetching,
    isBatchOpen: Boolean(selectedBatchId),
    errorMessage,
    availableStatusActions,
    setSelectedTenantId: (tenantId: string | undefined) => {
      setSelectedTenantId(tenantId);
      setSelectedBatchId(null);
    },
    setSelectedStoreId: (storeId: string | undefined) => {
      setSelectedStoreId(storeId);
      setSelectedBatchId(null);
    },
    setSelectedRequestType,
    setSelectedStatus,
    setSearchText,
    setCurrentPage,
    openBatch: (batchId: string) => setSelectedBatchId(batchId),
    closeBatch: () => setSelectedBatchId(null),
    applyStatus: async (status: WmsPurchasingBatchStatus, message?: string) => {
      await updateStatusMutation.mutateAsync({
        status,
        message,
      });
    },
    updateLine: async (lineId: string, payload: UpdateWmsPurchasingLineInput) => {
      await updateLineMutation.mutateAsync({ lineId, payload });
    },
    isUpdatingStatus: updateStatusMutation.isPending,
    isUpdatingLine: updateLineMutation.isPending,
    clearBanner: () => setBanner(null),
  };
}
