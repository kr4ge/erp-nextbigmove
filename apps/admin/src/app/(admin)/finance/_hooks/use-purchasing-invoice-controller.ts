'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { readStoredAdminUser, readStoredPermissions } from '@/lib/admin-session';
import {
  WMS_INVOICE_EDIT_PERMISSIONS,
  WMS_INVOICE_SETTINGS_READ_PERMISSIONS,
  hasAnyAdminPermission,
} from '@/lib/wms-permissions';
import {
  createManualWmsInvoice,
  ensureManualReceivingLinkedInvoice,
  ensureProcurementLinkedInvoice,
  fetchWmsInvoiceDetail,
  fetchWmsInvoiceOverview,
  updateWmsInvoice,
  updateWmsInvoiceStatus,
} from '../_services/purchasing.service';
import type {
  CreateWmsInvoiceInput,
  UpdateWmsInvoiceInput,
  UpdateWmsInvoiceStatusInput,
  WmsInvoiceSourceType,
  WmsInvoiceStatus,
} from '../_types/purchasing';

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

export function usePurchasingInvoiceController(enabled: boolean) {
  const queryClient = useQueryClient();
  const user = useMemo(() => readStoredAdminUser(), []);
  const permissions = useMemo(() => readStoredPermissions(), []);
  const [selectedTenantId, setSelectedTenantId] = useState<string | undefined>();
  const [selectedStatus, setSelectedStatus] = useState<WmsInvoiceStatus | undefined>();
  const [selectedSourceType, setSelectedSourceType] = useState<WmsInvoiceSourceType | undefined>();
  const [searchText, setSearchText] = useState('');
  const [debouncedSearchText, setDebouncedSearchText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [banner, setBanner] = useState<BannerState>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);

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
      'wms-invoice-overview',
      selectedTenantId ?? 'default-tenant',
      selectedStatus ?? 'all-statuses',
      selectedSourceType ?? 'all-source-types',
      debouncedSearchText,
      currentPage,
    ],
    enabled,
    queryFn: () =>
      fetchWmsInvoiceOverview({
        tenantId: selectedTenantId,
        status: selectedStatus,
        sourceType: selectedSourceType,
        search: debouncedSearchText || undefined,
        page: currentPage,
        pageSize: 10,
      }),
  });

  const detailQuery = useQuery({
    queryKey: ['wms-invoice-detail', selectedInvoiceId, selectedTenantId ?? 'default-tenant'],
    enabled: enabled && Boolean(selectedInvoiceId),
    queryFn: () => fetchWmsInvoiceDetail(selectedInvoiceId!, selectedTenantId),
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedTenantId, selectedStatus, selectedSourceType, debouncedSearchText]);

  useEffect(() => {
    if (!selectedTenantId && overviewQuery.data?.filters.activeTenantId) {
      setSelectedTenantId(overviewQuery.data.filters.activeTenantId);
    }
  }, [overviewQuery.data?.filters.activeTenantId, selectedTenantId]);

  const invalidateInvoices = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['wms-invoice-overview'] }),
      queryClient.invalidateQueries({ queryKey: ['wms-invoice-detail'] }),
    ]);
  };

  const createInvoiceMutation = useMutation({
    mutationFn: (input: CreateWmsInvoiceInput) => createManualWmsInvoice(input, selectedTenantId),
    onSuccess: async (response) => {
      setBanner({
        tone: 'success',
        message: `Invoice ${response.invoice.invoiceNumber} created`,
      });
      setSelectedInvoiceId(response.invoice.id);
      setIsEditorOpen(false);
      setEditingInvoiceId(null);
      await invalidateInvoices();
    },
    onError: (error) => {
      setBanner({ tone: 'error', message: getErrorMessage(error) });
    },
  });

  const updateInvoiceMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateWmsInvoiceInput }) =>
      updateWmsInvoice(id, input, selectedTenantId),
    onSuccess: async (response) => {
      setBanner({
        tone: 'success',
        message: `Invoice ${response.invoice.invoiceNumber} updated`,
      });
      setSelectedInvoiceId(response.invoice.id);
      setIsEditorOpen(false);
      setEditingInvoiceId(null);
      await invalidateInvoices();
    },
    onError: (error) => {
      setBanner({ tone: 'error', message: getErrorMessage(error) });
    },
  });

  const updateInvoiceStatusMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateWmsInvoiceStatusInput }) =>
      updateWmsInvoiceStatus(id, input, selectedTenantId),
    onSuccess: async (response) => {
      setBanner({
        tone: 'success',
        message: `Invoice moved to ${response.invoice.status.replaceAll('_', ' ').toLowerCase()}`,
      });
      setSelectedInvoiceId(response.invoice.id);
      await invalidateInvoices();
    },
    onError: (error) => {
      setBanner({ tone: 'error', message: getErrorMessage(error) });
    },
  });

  const ensureInvoiceMutation = useMutation({
    mutationFn: async (
      input:
        | { kind: 'procurement'; id: string; tenantId?: string }
        | { kind: 'manual-receiving'; id: string; tenantId?: string },
    ) => {
      if (input.kind === 'procurement') {
        return ensureProcurementLinkedInvoice(input.id, input.tenantId ?? selectedTenantId);
      }

      return ensureManualReceivingLinkedInvoice(input.id, input.tenantId ?? selectedTenantId);
    },
    onSuccess: async (response) => {
      setBanner({
        tone: 'success',
        message: `Invoice ${response.invoice.invoiceNumber} is ready`,
      });
      setSelectedTenantId((current) => current ?? response.invoice.tenantId);
      setSelectedInvoiceId(response.invoice.id);
      await invalidateInvoices();
    },
    onError: (error) => {
      setBanner({ tone: 'error', message: getErrorMessage(error) });
    },
  });

  const selectedInvoice = detailQuery.data?.invoice ?? null;
  const errorMessage = useMemo(() => {
    if (!overviewQuery.error) {
      return null;
    }

    return getErrorMessage(overviewQuery.error);
  }, [overviewQuery.error]);

  return {
    overview: overviewQuery.data ?? null,
    selectedInvoice,
    selectedTenantId,
    selectedStatus,
    selectedSourceType,
    searchText,
    currentPage,
    banner,
    errorMessage,
    canRead: hasAnyAdminPermission(user?.role ?? null, permissions, WMS_INVOICE_SETTINGS_READ_PERMISSIONS),
    canEdit: hasAnyAdminPermission(user?.role ?? null, permissions, WMS_INVOICE_EDIT_PERMISSIONS),
    isLoading: overviewQuery.isLoading,
    isFetching: overviewQuery.isFetching,
    isLoadingInvoice: detailQuery.isFetching,
    isInvoiceOpen: Boolean(selectedInvoiceId),
    isEditorOpen,
    editingInvoiceId,
    isSavingEditor: createInvoiceMutation.isPending || updateInvoiceMutation.isPending,
    isUpdatingStatus: updateInvoiceStatusMutation.isPending,
    isEnsuringInvoice: ensureInvoiceMutation.isPending,
    setSelectedTenantId: (value: string | undefined) => {
      setSelectedTenantId(value);
      setSelectedInvoiceId(null);
    },
    setSelectedStatus,
    setSelectedSourceType,
    setSearchText,
    setCurrentPage,
    openInvoice: (invoiceId: string) => setSelectedInvoiceId(invoiceId),
    closeInvoice: () => setSelectedInvoiceId(null),
    openCreateModal: () => {
      setEditingInvoiceId(null);
      setIsEditorOpen(true);
    },
    openEditModal: (invoiceId: string) => {
      setEditingInvoiceId(invoiceId);
      setIsEditorOpen(true);
    },
    closeEditor: () => {
      setEditingInvoiceId(null);
      setIsEditorOpen(false);
    },
    createInvoice: async (input: CreateWmsInvoiceInput) => {
      await createInvoiceMutation.mutateAsync(input);
    },
    updateInvoice: async (id: string, input: UpdateWmsInvoiceInput) => {
      await updateInvoiceMutation.mutateAsync({ id, input });
    },
    updateInvoiceStatus: async (id: string, input: UpdateWmsInvoiceStatusInput) => {
      await updateInvoiceStatusMutation.mutateAsync({ id, input });
    },
    ensureProcurementInvoice: async (id: string, tenantId?: string) => {
      await ensureInvoiceMutation.mutateAsync({ kind: 'procurement', id, tenantId });
    },
    ensureManualReceivingInvoice: async (id: string, tenantId?: string) => {
      await ensureInvoiceMutation.mutateAsync({ kind: 'manual-receiving', id, tenantId });
    },
    clearBanner: () => setBanner(null),
  };
}
