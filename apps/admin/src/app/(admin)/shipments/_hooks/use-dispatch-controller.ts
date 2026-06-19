'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { readStoredAdminUser, readStoredPermissions } from '@/lib/admin-session';
import type { WmsSearchableOption } from '../../_components/wms-searchable-select';
import { useWmsScopeFilters } from '../../_hooks/use-wms-scope-filters';
import {
  fetchWmsDispatchOutbound,
  fetchWmsDispatchOutboundTask,
  fetchWmsDispatchReports,
  fetchWmsDispatchReturnTask,
  fetchWmsDispatchReturns,
  fetchWmsDispatchSummary,
  reconcileWmsDispatchOutbound,
  voidWmsDispatchOutboundTask,
} from '../_services/dispatch.service';
import type {
  WmsDispatchOutboundResponse,
  WmsDispatchOutboundStatusFilter,
  WmsDispatchReportsResponse,
  WmsDispatchReturnTask,
  WmsDispatchReturnStatusFilter,
  WmsDispatchReturnsResponse,
  WmsDispatchSummaryResponse,
  WmsDispatchTask,
  WmsDispatchTab,
} from '../_types/dispatch';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;
const REPORT_WINDOW_OPTIONS = [7, 14, 30] as const;
const OUTBOUND_PERMISSIONS = [
  'wms.dispatch.read',
  'wms.dispatch.write',
  'wms.dispatch.edit',
  'wms.dispatch.override',
] as const;
const RETURNS_PERMISSIONS = [
  'wms.rts.read',
  'wms.dispatch.read',
  'wms.dispatch.write',
  'wms.dispatch.edit',
  'wms.dispatch.override',
] as const;
const OUTBOUND_MUTATION_PERMISSIONS = [
  'wms.dispatch.write',
  'wms.dispatch.edit',
  'wms.dispatch.override',
] as const;
const OUTBOUND_VOID_PERMISSIONS = [
  'wms.dispatch.void',
  'wms.dispatch.override',
] as const;

export function useDispatchController() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab') === 'returns'
    ? 'returns'
    : searchParams.get('tab') === 'reports'
      ? 'reports'
      : 'outbound';

  const [summary, setSummary] = useState<WmsDispatchSummaryResponse | null>(null);
  const [outboundData, setOutboundData] = useState<WmsDispatchOutboundResponse | null>(null);
  const [returnsData, setReturnsData] = useState<WmsDispatchReturnsResponse | null>(null);
  const [reportsData, setReportsData] = useState<WmsDispatchReportsResponse | null>(null);
  const [selectedOutboundTaskDetail, setSelectedOutboundTaskDetail] = useState<WmsDispatchTask | null>(null);
  const [selectedReturnTaskDetail, setSelectedReturnTaskDetail] = useState<WmsDispatchReturnTask | null>(null);
  const [selectedTab, setSelectedTabState] = useState<WmsDispatchTab>(requestedTab);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTenantIdState, setSelectedTenantIdState] = useState<string | undefined>(undefined);
  const [selectedStoreIdState, setSelectedStoreIdState] = useState<string | undefined>(undefined);
  const [selectedOutboundStatus, setSelectedOutboundStatus] = useState<WmsDispatchOutboundStatusFilter>('');
  const [selectedReturnStatus, setSelectedReturnStatus] = useState<WmsDispatchReturnStatusFilter>('');
  const [reportWindowDays, setReportWindowDays] = useState<(typeof REPORT_WINDOW_OPTIONS)[number]>(14);
  const [detailReloadKey, setDetailReloadKey] = useState(0);
  const [searchText, setSearchText] = useState('');
  const [debouncedSearchText, setDebouncedSearchText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(true);
  const [isListLoading, setIsListLoading] = useState(true);
  const [isTaskDetailLoading, setIsTaskDetailLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);
  const summaryRequestIdRef = useRef(0);
  const listRequestIdRef = useRef(0);
  const reportsRequestIdRef = useRef(0);
  const detailRequestIdRef = useRef(0);

  const user = useMemo(() => readStoredAdminUser(), []);
  const permissions = useMemo(() => readStoredPermissions(), []);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const canViewOutbound = isSuperAdmin || OUTBOUND_PERMISSIONS.some((permission) => permissions.includes(permission));
  const canViewReturns = isSuperAdmin || RETURNS_PERMISSIONS.some((permission) => permissions.includes(permission));
  const canViewReports = canViewOutbound || canViewReturns;
  const canManageOutbound = isSuperAdmin || OUTBOUND_MUTATION_PERMISSIONS.some((permission) => permissions.includes(permission));
  const canVoidOutbound = isSuperAdmin || OUTBOUND_VOID_PERMISSIONS.some((permission) => permissions.includes(permission));

  const {
    setSelectedTenantId,
    setSelectedStoreId,
  } = useWmsScopeFilters({
    filters: summary?.context
      ? {
          tenants: summary.context.tenantOptions.map((tenant) => ({ id: tenant.id })),
          stores: summary.context.stores.map((store) => ({
            id: store.id,
            tenantId: store.tenantId ?? null,
          })),
          activeTenantId: summary.context.activeTenantId,
          activeStoreId: summary.context.activeStoreId,
        }
      : null,
    selectedTenantId: selectedTenantIdState,
    setSelectedTenantIdState,
    selectedStoreId: selectedStoreIdState,
    setSelectedStoreIdState,
    allowAllTenants: true,
  });

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchText(searchText.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchText]);

  useEffect(() => {
    if (requestedTab === 'returns' && canViewReturns) {
      setSelectedTabState('returns');
      return;
    }

    if (requestedTab === 'reports' && canViewReports) {
      setSelectedTabState('reports');
      return;
    }

    if (requestedTab === 'outbound' && canViewOutbound) {
      setSelectedTabState('outbound');
      return;
    }

    if (canViewOutbound) {
      setSelectedTabState('outbound');
      return;
    }

    if (canViewReturns) {
      setSelectedTabState('returns');
      return;
    }

    if (canViewReports) {
      setSelectedTabState('reports');
    }
  }, [canViewOutbound, canViewReports, canViewReturns, requestedTab]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    const currentTab = params.get('tab') === 'returns'
      ? 'returns'
      : params.get('tab') === 'reports'
        ? 'reports'
        : 'outbound';

    if (selectedTab === 'returns') {
      params.set('tab', 'returns');
    } else if (selectedTab === 'reports') {
      params.set('tab', 'reports');
    } else {
      params.delete('tab');
    }

    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    const currentQuery = searchParams.toString();
    const currentUrl = currentQuery ? `${pathname}?${currentQuery}` : pathname;

    if (currentTab !== selectedTab && nextUrl !== currentUrl) {
      router.replace(nextUrl, { scroll: false });
    }
  }, [pathname, router, searchParams, selectedTab]);

  const loadSummary = useCallback(async (refresh = false) => {
    const requestId = summaryRequestIdRef.current + 1;
    summaryRequestIdRef.current = requestId;

    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsSummaryLoading(true);
    }

    try {
      const nextSummary = await fetchWmsDispatchSummary({
        tenantId: selectedTenantIdState,
        storeId: selectedStoreIdState,
      });
      if (summaryRequestIdRef.current === requestId) {
        setSummary(nextSummary);
      }
    } catch (error) {
      if (summaryRequestIdRef.current === requestId) {
        setErrorMessage(resolveDispatchError(error));
      }
    } finally {
      if (summaryRequestIdRef.current === requestId) {
        setIsSummaryLoading(false);
        if (refresh) {
          setIsRefreshing(false);
        }
      }
    }
  }, [selectedStoreIdState, selectedTenantIdState]);

  const loadList = useCallback(async (refresh = false) => {
    const requestId = listRequestIdRef.current + 1;
    listRequestIdRef.current = requestId;

    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsListLoading(true);
    }

    setErrorMessage(null);

    try {
      if (selectedTab === 'returns') {
        const nextReturns = await fetchWmsDispatchReturns({
          tenantId: selectedTenantIdState,
          storeId: selectedStoreIdState,
          status: selectedReturnStatus || undefined,
          search: debouncedSearchText || undefined,
          page: currentPage,
          pageSize: PAGE_SIZE,
        });
        if (listRequestIdRef.current === requestId) {
          setReturnsData(nextReturns);
        }
      } else {
        const nextOutbound = await fetchWmsDispatchOutbound({
          tenantId: selectedTenantIdState,
          storeId: selectedStoreIdState,
          status: selectedOutboundStatus || undefined,
          search: debouncedSearchText || undefined,
          page: currentPage,
          pageSize: PAGE_SIZE,
        });
        if (listRequestIdRef.current === requestId) {
          setOutboundData(nextOutbound);
        }
      }
    } catch (error) {
      if (listRequestIdRef.current === requestId) {
        setErrorMessage(resolveDispatchError(error));
      }
    } finally {
      if (listRequestIdRef.current === requestId) {
        setIsListLoading(false);
        if (refresh) {
          setIsRefreshing(false);
        }
      }
    }
  }, [
    currentPage,
    debouncedSearchText,
    selectedOutboundStatus,
    selectedReturnStatus,
    selectedStoreIdState,
    selectedTab,
    selectedTenantIdState,
  ]);

  const loadReports = useCallback(async (refresh = false) => {
    const requestId = reportsRequestIdRef.current + 1;
    reportsRequestIdRef.current = requestId;

    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsListLoading(true);
    }

    setErrorMessage(null);

    try {
      const nextReports = await fetchWmsDispatchReports({
        tenantId: selectedTenantIdState,
        storeId: selectedStoreIdState,
        days: reportWindowDays,
      });
      if (reportsRequestIdRef.current === requestId) {
        setReportsData(nextReports);
      }
    } catch (error) {
      if (reportsRequestIdRef.current === requestId) {
        setErrorMessage(resolveDispatchError(error));
      }
    } finally {
      if (reportsRequestIdRef.current === requestId) {
        setIsListLoading(false);
        if (refresh) {
          setIsRefreshing(false);
        }
      }
    }
  }, [reportWindowDays, selectedStoreIdState, selectedTenantIdState]);

  useEffect(() => {
    void loadSummary(false);
  }, [loadSummary]);

  useEffect(() => {
    if (
      (selectedTab === 'outbound' && !canViewOutbound)
      || (selectedTab === 'returns' && !canViewReturns)
      || (selectedTab === 'reports' && !canViewReports)
    ) {
      setIsListLoading(false);
      return;
    }

    if (selectedTab === 'reports') {
      void loadReports(false);
      return;
    }

    void loadList(false);
  }, [canViewOutbound, canViewReports, canViewReturns, loadList, loadReports, selectedTab]);

  const currentData = selectedTab === 'returns' ? returnsData : outboundData;
  const outboundTasks = useMemo(
    () => outboundData?.tasks ?? [],
    [outboundData?.tasks],
  );
  const returnTasks = useMemo(
    () => returnsData?.tasks ?? [],
    [returnsData?.tasks],
  );
  const selectedOutboundTask = selectedOutboundTaskDetail;
  const selectedReturnTask = selectedReturnTaskDetail;

  useEffect(() => {
    if (!selectedTaskId) {
      return;
    }

    const exists = selectedTab === 'returns'
      ? returnTasks.some((entry) => entry.task.id === selectedTaskId)
      : outboundTasks.some((task) => task.id === selectedTaskId);

    if (!exists) {
      setSelectedTaskId(null);
    }
  }, [outboundTasks, returnTasks, selectedTab, selectedTaskId]);

  useEffect(() => {
    if (!selectedTaskId || selectedTab === 'reports') {
      detailRequestIdRef.current += 1;
      setIsTaskDetailLoading(false);
      setSelectedOutboundTaskDetail(null);
      setSelectedReturnTaskDetail(null);
      return;
    }

    const requestId = detailRequestIdRef.current + 1;
    detailRequestIdRef.current = requestId;
    setIsTaskDetailLoading(true);
    setErrorMessage(null);
    setSelectedOutboundTaskDetail(null);
    setSelectedReturnTaskDetail(null);

    void (async () => {
      try {
        if (selectedTab === 'returns') {
          const response = await fetchWmsDispatchReturnTask({
            taskId: selectedTaskId,
            tenantId: selectedTenantIdState,
            storeId: selectedStoreIdState,
          });
          if (detailRequestIdRef.current === requestId) {
            setSelectedReturnTaskDetail(response.task);
            setSelectedOutboundTaskDetail(null);
          }
          return;
        }

        const response = await fetchWmsDispatchOutboundTask({
          taskId: selectedTaskId,
          tenantId: selectedTenantIdState,
          storeId: selectedStoreIdState,
        });
        if (detailRequestIdRef.current === requestId) {
          setSelectedOutboundTaskDetail(response.task);
          setSelectedReturnTaskDetail(null);
        }
      } catch (error) {
        if (detailRequestIdRef.current === requestId) {
          setSelectedOutboundTaskDetail(null);
          setSelectedReturnTaskDetail(null);
          setErrorMessage(resolveDispatchError(error));
        }
      } finally {
        if (detailRequestIdRef.current === requestId) {
          setIsTaskDetailLoading(false);
        }
      }
    })();
  }, [detailReloadKey, selectedStoreIdState, selectedTab, selectedTaskId, selectedTenantIdState]);

  const tenantOptions = useMemo<WmsSearchableOption[]>(
    () => (summary?.context.tenantOptions ?? []).map((tenant) => ({
      value: tenant.id,
      label: tenant.name,
      hint: tenant.slug,
    })),
    [summary?.context.tenantOptions],
  );
  const storeOptions = useMemo<WmsSearchableOption[]>(
    () => (summary?.context.stores ?? []).map((store) => ({
      value: store.id,
      label: store.name,
      hint: store.tenantName ?? undefined,
    })),
    [summary?.context.stores],
  );

  const summaryItems = useMemo(() => {
    const orderSummary = summary?.summary.orders;
    const unitSummary = summary?.summary.units;

    return [
      { id: 'packedOrders', label: 'Packed Orders', value: orderSummary?.packed ?? 0 },
      { id: 'shippedOrders', label: 'Shipped Orders', value: orderSummary?.shipped ?? 0 },
      { id: 'deliveredOrders', label: 'Delivered Orders', value: orderSummary?.delivered ?? 0 },
      { id: 'returningOrders', label: 'Returning', value: orderSummary?.returning ?? 0 },
      { id: 'returnedOrders', label: 'Returned', value: orderSummary?.returned ?? 0 },
      { id: 'packedUnits', label: 'Packed Units', value: unitSummary?.packed ?? 0 },
      { id: 'dispatchedUnits', label: 'Dispatched Units', value: unitSummary?.dispatched ?? 0 },
      { id: 'rtsUnits', label: 'RTS Units', value: unitSummary?.rts ?? 0 },
    ];
  }, [summary?.summary.orders, summary?.summary.units]);

  const outboundStatusOptions = useMemo<Array<{ value: WmsDispatchOutboundStatusFilter; label: string }>>(
    () => [
      { value: '', label: 'All outbound' },
      { value: 'PACKED', label: 'Packed' },
      { value: 'SHIPPED', label: 'Shipped' },
      { value: 'DELIVERED', label: 'Delivered' },
    ],
    [],
  );

  const returnStatusOptions = useMemo<Array<{ value: WmsDispatchReturnStatusFilter; label: string }>>(
    () => [
      { value: '', label: 'All returns' },
      { value: 'RETURNING', label: 'Returning' },
      { value: 'RETURNED', label: 'Returned' },
      { value: 'READY_TO_VERIFY', label: 'Ready to verify' },
      { value: 'AWAITING_PLACEMENT', label: 'Awaiting placement' },
      { value: 'PARTIAL', label: 'Partially processed' },
      { value: 'VERIFIED', label: 'Processed' },
    ],
    [],
  );

  const totalPages = Math.max(
    1,
    Math.ceil((currentData?.pagination.total ?? 0) / (currentData?.pagination.pageSize ?? PAGE_SIZE)),
  );

  const canRunScopedReconcile = Boolean(
    canManageOutbound
    && selectedTab === 'outbound'
    && (selectedTenantIdState || selectedStoreIdState),
  );
  const reconcileScopeDisabledReason = !canManageOutbound
    ? 'This account does not have dispatch repair access.'
    : selectedTab !== 'outbound'
      ? 'Dispatch repair only applies to outbound monitoring.'
      : !selectedTenantIdState && !selectedStoreIdState
        ? 'Select a tenant or store before running dispatch repair.'
        : null;

  const runReconcile = useCallback(async (params: {
    tenantId?: string;
    storeId?: string;
    taskIds?: string[];
  }) => {
    setIsReconciling(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await reconcileWmsDispatchOutbound(params);
      const changedCount = response.result.dispatchedUnits + response.result.deliveredOrders;
      const summaryMessage = changedCount > 0
        ? `Dispatch repair updated ${response.result.dispatchedUnits} dispatched units and ${response.result.deliveredOrders} delivered orders.`
        : 'Dispatch repair completed. No additional outbound repairs were needed.';

      setSuccessMessage(summaryMessage);
      await Promise.all([
        loadSummary(true),
        loadList(true),
      ]);
      if (selectedTaskId) {
        setDetailReloadKey((current) => current + 1);
      }
      return true;
    } catch (error) {
      setErrorMessage(resolveDispatchError(error));
      return false;
    } finally {
      setIsReconciling(false);
    }
  }, [loadList, loadSummary, selectedTaskId]);

  const runDispatchVoid = useCallback(async (params: {
    taskId: string;
    reason: string;
  }) => {
    setIsVoiding(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await voidWmsDispatchOutboundTask({
        taskId: params.taskId,
        tenantId: selectedTenantIdState,
        storeId: selectedStoreIdState,
        reason: params.reason,
      });
      const syncSummary = response.posStatusUpdate.queued > 0
        ? ` POS reset queued for ${response.posStatusUpdate.queued} order${response.posStatusUpdate.queued === 1 ? '' : 's'}.`
        : '';

      setSuccessMessage(
        `Dispatch void returned order #${response.posOrderId} with ${response.restoredPackedUnits} packed unit${response.restoredPackedUnits === 1 ? '' : 's'} back to picking.${syncSummary}`,
      );
      setSelectedTaskId(null);
      await Promise.all([
        loadSummary(true),
        loadList(true),
      ]);
      return true;
    } catch (error) {
      setErrorMessage(resolveDispatchError(error));
      return false;
    } finally {
      setIsVoiding(false);
    }
  }, [loadList, loadSummary, selectedStoreIdState, selectedTenantIdState]);

  return {
    canViewOutbound,
    canViewReports,
    canViewReturns,
    canManageOutbound,
    canVoidOutbound,
    canRunScopedReconcile,
    currentPage,
    errorMessage,
    isLoading: isSummaryLoading || isListLoading,
    isReconciling,
    isRefreshing,
    isTaskDetailLoading,
    isVoiding,
    outboundTasks,
    reportsData,
    returnTasks,
    reconcileScopeDisabledReason,
    reportWindowDays,
    reportWindowOptions: [...REPORT_WINDOW_OPTIONS],
    selectedOutboundTask,
    selectedReturnTask,
    selectedTaskId,
    selectedStoreId: selectedStoreIdState,
    selectedTab,
    selectedTenantId: selectedTenantIdState,
    selectedStatus: selectedTab === 'returns' ? selectedReturnStatus : selectedOutboundStatus,
    searchText,
    successMessage,
    storeOptions,
    summaryItems,
    outboundStatusOptions,
    returnStatusOptions,
    tabCounts: {
      outbound: summary?.summary.orders.packed ?? 0,
      returns: (summary?.summary.orders.returning ?? 0) + (summary?.summary.orders.returned ?? 0),
    },
    tasksPagination: currentData?.pagination ?? {
      page: 1,
      pageSize: PAGE_SIZE,
      total: 0,
      hasMore: false,
    },
    tenantOptions,
    setCurrentPage,
    setSearchText: (value: string) => {
      setCurrentPage(1);
      setSearchText(value);
    },
    setSelectedStoreId: (value: string | undefined) => {
      setSuccessMessage(null);
      setSelectedTaskId(null);
      setCurrentPage(1);
      setSelectedStoreId(value);
    },
    setSelectedTab: (value: WmsDispatchTab) => {
      setSuccessMessage(null);
      setSelectedTaskId(null);
      setCurrentPage(1);
      setSelectedTabState(value);
    },
    setReportWindowDays: (value: (typeof REPORT_WINDOW_OPTIONS)[number]) => {
      setSuccessMessage(null);
      setReportWindowDays(value);
    },
    setSelectedStatus: (value: string) => {
      setSuccessMessage(null);
      setSelectedTaskId(null);
      setCurrentPage(1);
      if (selectedTab === 'returns') {
        setSelectedReturnStatus(value as WmsDispatchReturnStatusFilter);
        return;
      }
      setSelectedOutboundStatus(value as WmsDispatchOutboundStatusFilter);
    },
    setSelectedTaskId,
    setSelectedTenantId: (value: string | undefined) => {
      setSuccessMessage(null);
      setSelectedTaskId(null);
      setCurrentPage(1);
      setSelectedTenantId(value);
    },
    clearSuccessMessage: () => setSuccessMessage(null),
    reconcileOutboundScope: async () => runReconcile({
      tenantId: selectedTenantIdState,
      storeId: selectedStoreIdState,
    }),
    reconcileOutboundTask: async (taskId: string) => runReconcile({
      tenantId: selectedTenantIdState,
      storeId: selectedStoreIdState,
      taskIds: [taskId],
    }),
    voidOutboundTask: async (taskId: string, reason: string) => runDispatchVoid({
      taskId,
      reason,
    }),
    refresh: async () => {
      setSuccessMessage(null);
      await Promise.all([
        loadSummary(true),
        selectedTab === 'reports' ? loadReports(true) : loadList(true),
      ]);
      if (selectedTaskId && selectedTab !== 'reports') {
        setDetailReloadKey((current) => current + 1);
      }
    },
    totalPages,
  };
}

function resolveDispatchError(error: unknown) {
  return typeof error === 'object'
    && error !== null
    && 'response' in error
    && typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === 'string'
    ? (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Unable to load dispatch data.'
    : 'Unable to load dispatch data.';
}
