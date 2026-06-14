'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { readStoredAdminUser, readStoredPermissions } from '@/lib/admin-session';
import type { WmsSearchableOption } from '../../_components/wms-searchable-select';
import { useWmsScopeFilters } from '../../_hooks/use-wms-scope-filters';
import {
  completeWmsPackTask,
  fetchWmsPackQueue,
  scanWmsPackUnit,
  startWmsPackTask,
  verifyWmsPackTracking,
  voidWmsPackTask,
} from '../_services/fulfillment.service';
import type {
  WmsFulfillmentPackStatus,
  WmsFulfillmentQueueResponse,
  WmsFulfillmentQueueTask,
  WmsTaskAssignmentType,
} from '../_types/fulfillment';

const PACK_STATUS_OPTIONS: Array<{ value: WmsFulfillmentPackStatus | ''; label: string }> = [
  { value: '', label: 'All orders' },
  { value: 'PACKING', label: 'Packing' },
  { value: 'AWAITING_TRACKING', label: 'Awaiting tracking' },
  { value: 'PACKED', label: 'Packed' },
];

const PAGE_SIZE = 5;
const EXECUTION_PERMISSIONS = [
  'wms.dispatch.write',
  'wms.dispatch.edit',
  'wms.dispatch.override',
] as const;
const DIRECT_VOID_PERMISSIONS = [
  'wms.dispatch.void',
  'wms.dispatch.override',
] as const;

export function useFulfillmentPackController() {
  const [data, setData] = useState<WmsFulfillmentQueueResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTenantIdState, setSelectedTenantIdState] = useState<string | undefined>(undefined);
  const [selectedStoreIdState, setSelectedStoreIdState] = useState<string | undefined>(undefined);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const user = useMemo(() => readStoredAdminUser(), []);
  const permissions = useMemo(() => readStoredPermissions(), []);

  const {
    setSelectedTenantId,
    setSelectedStoreId,
  } = useWmsScopeFilters({
    filters: data?.context
      ? {
        tenants: data.context.tenantOptions?.map((tenant) => ({ id: tenant.id })) ?? [],
        stores: data.context.stores.map((store) => ({
          id: store.id,
          tenantId: store.tenantId ?? null,
        })),
        activeTenantId: data.context.activeTenantId,
        activeStoreId: data.context.activeStoreId,
      }
      : null,
    selectedTenantId: selectedTenantIdState,
    setSelectedTenantIdState,
    selectedStoreId: selectedStoreIdState,
    setSelectedStoreIdState,
  });

  const canExecute = useMemo(
    () => user?.role === 'SUPER_ADMIN' || EXECUTION_PERMISSIONS.some((permission) => permissions.includes(permission)),
    [permissions, user?.role],
  );
  const canDirectVoid = useMemo(
    () => user?.role === 'SUPER_ADMIN' || DIRECT_VOID_PERMISSIONS.some((permission) => permissions.includes(permission)),
    [permissions, user?.role],
  );

  const loadQueue = useCallback(async ({
    page,
    mode,
  }: {
    page: number;
    mode: 'initial' | 'refresh';
  }) => {
    if (mode === 'initial') {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    setErrorMessage(null);

    try {
      const nextData = await fetchWmsPackQueue({
        tenantId: selectedTenantIdState,
        storeId: selectedStoreIdState,
        status: (selectedStatus || undefined) as WmsFulfillmentPackStatus | undefined,
        page,
        pageSize: PAGE_SIZE,
      });

      setData(nextData);
      setCurrentPage(nextData.pagination.page);
    } catch (error) {
      setErrorMessage(resolveQueueError(error));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedStatus, selectedStoreIdState, selectedTenantIdState]);

  useEffect(() => {
    void loadQueue({
      mode: currentPage === 1 ? 'initial' : 'refresh',
      page: currentPage,
    });
  }, [currentPage, loadQueue]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!isSubmitting) {
        void loadQueue({ mode: 'refresh', page: currentPage });
      }
    }, 10000);

    return () => clearInterval(timer);
  }, [currentPage, isSubmitting, loadQueue]);

  const indexedTasks = useMemo(
    () => new Map((data?.tasks ?? []).map((task) => [task.id, task] as const)),
    [data?.tasks],
  );
  const activeTask = activeTaskId ? indexedTasks.get(activeTaskId) ?? null : null;
  const queueScope = data?.context?.canViewAllQueue === false ? 'own' as const : 'all' as const;
  const taskAssignment = (data?.context?.taskAssignment ?? null) as WmsTaskAssignmentType;

  useEffect(() => {
    if (!activeTaskId) {
      return;
    }

    if (!indexedTasks.has(activeTaskId)) {
      setActiveTaskId(null);
    }
  }, [activeTaskId, indexedTasks]);

  const tenantOptions = useMemo<WmsSearchableOption[]>(
    () => (data?.context.tenantOptions ?? []).map((tenant) => ({
      value: tenant.id,
      label: tenant.name,
      hint: tenant.slug,
    })),
    [data?.context.tenantOptions],
  );
  const storeOptions = useMemo<WmsSearchableOption[]>(
    () => (data?.context.stores ?? []).map((store) => ({
      value: store.id,
      label: store.name,
      hint: store.tenantName ?? undefined,
    })),
    [data?.context.stores],
  );

  const summaryItems = useMemo(() => {
    const summary = data?.summary ?? {};
    return [
      { id: 'held', label: 'Held', value: summary.held ?? 0 },
      { id: 'awaitingTracking', label: 'Awaiting Tracking', value: summary.awaitingTracking ?? 0 },
      { id: 'packing', label: 'Packing', value: summary.packing ?? 0 },
      { id: 'packed', label: 'Packed', value: summary.packed ?? 0 },
    ];
  }, [data?.summary, data?.tasks]);

  const replaceTask = useCallback((nextTask: WmsFulfillmentQueueTask, options?: { closeWhenFinished?: boolean }) => {
    setData((current) => {
      if (!current) {
        return current;
      }

      const remaining = current.tasks.filter((task) => task.id !== nextTask.id);
      return {
        ...current,
        tasks: nextTask.status === 'PACKED' || nextTask.status === 'CANCELED'
          ? remaining
          : [nextTask, ...remaining],
      };
    });

    if (options?.closeWhenFinished || nextTask.status === 'PACKED' || nextTask.status === 'CANCELED') {
      setActiveTaskId(null);
      return;
    }

    setActiveTaskId(nextTask.id);
  }, []);

  const resolveTenantIdForTask = useCallback((task: WmsFulfillmentQueueTask) => (
    task.store?.tenantId ?? selectedTenantIdState ?? null
  ), [selectedTenantIdState]);

  const startTask = useCallback(async (task: WmsFulfillmentQueueTask) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await startWmsPackTask({
        taskId: task.id,
        tenantId: resolveTenantIdForTask(task),
      });
      replaceTask(result.task);
      return true;
    } catch (error) {
      setErrorMessage(resolveQueueError(error));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [replaceTask, resolveTenantIdForTask]);

  const scanUnit = useCallback(async (task: WmsFulfillmentQueueTask, code: string) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await scanWmsPackUnit({
        taskId: task.id,
        tenantId: resolveTenantIdForTask(task),
        code,
      });
      replaceTask(result.task);
      return true;
    } catch (error) {
      setErrorMessage(resolveQueueError(error));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [replaceTask, resolveTenantIdForTask]);

  const verifyTracking = useCallback(async (task: WmsFulfillmentQueueTask, code: string) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await verifyWmsPackTracking({
        taskId: task.id,
        tenantId: resolveTenantIdForTask(task),
        code,
      });
      replaceTask(result.task);
      return result.tracking;
    } catch (error) {
      setErrorMessage(resolveQueueError(error));
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [replaceTask, resolveTenantIdForTask]);

  const completeTask = useCallback(async (task: WmsFulfillmentQueueTask, trackingCode: string) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await completeWmsPackTask({
        taskId: task.id,
        tenantId: resolveTenantIdForTask(task),
        trackingCode,
      });
      replaceTask(result.task, { closeWhenFinished: true });
      return true;
    } catch (error) {
      setErrorMessage(resolveQueueError(error));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [replaceTask, resolveTenantIdForTask]);

  const voidTask = useCallback(async (params: {
    task: WmsFulfillmentQueueTask;
    reason: string;
    supervisorIdentifier?: string | null;
    supervisorPassword?: string | null;
  }) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await voidWmsPackTask({
        taskId: params.task.id,
        tenantId: resolveTenantIdForTask(params.task),
        reason: params.reason,
        supervisorIdentifier: params.supervisorIdentifier,
        supervisorPassword: params.supervisorPassword,
      });
      replaceTask(result.task, { closeWhenFinished: true });
      return true;
    } catch (error) {
      setErrorMessage(resolveQueueError(error));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [replaceTask, resolveTenantIdForTask]);

  return {
    activeTask,
    canDirectVoid,
    canExecute,
    currentPage,
    errorMessage,
    isLoading,
    isRefreshing,
    isSubmitting,
    queueScope,
    selectedStatus,
    selectedStoreId: selectedStoreIdState,
    selectedTenantId: selectedTenantIdState,
    setActiveTaskId,
    setCurrentPage,
    setSelectedStatus: (value: string) => {
      setActiveTaskId(null);
      setCurrentPage(1);
      setSelectedStatus(value);
    },
    setSelectedStoreId: (value: string | undefined) => {
      setActiveTaskId(null);
      setCurrentPage(1);
      setSelectedStoreId(value);
    },
    setSelectedTenantId: (value: string | undefined) => {
      setActiveTaskId(null);
      setCurrentPage(1);
      setSelectedTenantId(value);
    },
    statusOptions: PACK_STATUS_OPTIONS,
    storeOptions,
    summaryItems,
    taskAssignment,
    tasks: data?.tasks ?? [],
    tenantOptions,
    tenantReady: data?.tenantReady ?? false,
    totalPages: Math.max(1, Math.ceil((data?.pagination.total ?? 0) / (data?.pagination.pageSize ?? PAGE_SIZE))),
    completeTask,
    refresh: () => loadQueue({ mode: 'refresh', page: currentPage }),
    scanUnit,
    startTask,
    verifyTracking,
    voidTask,
  };
}

function resolveQueueError(error: unknown) {
  if (
    typeof error === 'object'
    && error !== null
    && 'response' in error
    && typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === 'string'
  ) {
    return (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Unable to update pack queue.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unable to update pack queue.';
}
