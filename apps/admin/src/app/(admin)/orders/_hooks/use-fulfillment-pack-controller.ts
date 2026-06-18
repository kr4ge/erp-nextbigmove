'use client';

import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { readStoredAdminUser, readStoredPermissions } from '@/lib/admin-session';
import type { WmsSearchableOption } from '../../_components/wms-searchable-select';
import { useWmsScopeFilters } from '../../_hooks/use-wms-scope-filters';
import {
  completeWmsPackBasketOrder,
  completeWmsPackTask,
  fetchWmsPackBasketPlan,
  fetchWmsPackQueue,
  scanWmsPackBasketOrderUnit,
  scanWmsPackBasketWaybill,
  scanWmsPackUnit,
  startWmsPackTask,
  verifyWmsPackTracking,
  voidWmsPackBasketOrders,
  voidWmsPackTask,
} from '../_services/fulfillment.service';
import type {
  WmsFulfillmentBasket,
  WmsFulfillmentBasketPackPlan,
  WmsFulfillmentBasketPackPlanResponse,
  WmsFulfillmentBasketPackValidation,
  WmsFulfillmentBasketPackWaybillResponse,
  WmsFulfillmentBasketPackUnitResponse,
  WmsFulfillmentBasketPackCompleteResponse,
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

type BasketPackView = {
  basket: WmsFulfillmentBasket;
  tasks: WmsFulfillmentQueueTask[];
  plan: WmsFulfillmentBasketPackPlan;
  validation: WmsFulfillmentBasketPackValidation;
};

export function useFulfillmentPackController() {
  const [data, setData] = useState<WmsFulfillmentQueueResponse | null>(null);
  const [basketViews, setBasketViews] = useState<Record<string, BasketPackView>>({});
  const [activeBasketId, setActiveBasketId] = useState<string | null>(null);
  const [activeBasketTaskSnapshot, setActiveBasketTaskSnapshot] = useState<WmsFulfillmentQueueTask | null>(null);
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
  const activeBasketView = useMemo(() => {
    if (!activeBasketId) {
      return null;
    }

    return basketViews[activeBasketId] ?? null;
  }, [activeBasketId, basketViews]);
  const activeTask = useMemo(() => {
    if (activeBasketId) {
      const basketTasks = activeBasketView?.tasks
        ?? (data?.tasks ?? []).filter((task) => task.basket?.id === activeBasketId);

      if (activeTaskId) {
        const directMatch = basketTasks.find((task) => task.id === activeTaskId)
          ?? indexedTasks.get(activeTaskId)
          ?? null;
        if (directMatch) {
          return directMatch;
        }
      }

      return activeBasketTaskSnapshot ?? basketTasks[0] ?? null;
    }

    return activeTaskId ? indexedTasks.get(activeTaskId) ?? null : null;
  }, [activeBasketId, activeBasketTaskSnapshot, activeBasketView?.tasks, activeTaskId, data?.tasks, indexedTasks]);
  const queueScope = data?.context?.canViewAllQueue === false ? 'own' as const : 'all' as const;
  const taskAssignment = (data?.context?.taskAssignment ?? null) as WmsTaskAssignmentType;

  useEffect(() => {
    if (!activeTaskId) {
      return;
    }

    if (activeBasketId) {
      return;
    }

    if (!indexedTasks.has(activeTaskId)) {
      setActiveTaskId(null);
    }
  }, [activeBasketId, activeTaskId, indexedTasks]);

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
  }, [data?.summary]);

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

  const fetchBasketPlan = useCallback(async (task: WmsFulfillmentQueueTask) => {
    if (!task.basket?.id) {
      setErrorMessage('This pack order is no longer inside a basket.');
      return null;
    }

    setActiveBasketId(task.basket.id);
    setActiveBasketTaskSnapshot(task);
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await fetchWmsPackBasketPlan({
        basketId: task.basket.id,
        tenantId: resolveTenantIdForTask(task),
      });
      applyBasketResult({
        result,
        setBasketViews,
        setData,
      });
      setActiveBasketTaskSnapshot(resolveBasketContextTask(result, task));
      setActiveTaskId(result.plan.activeOrder?.id ?? task.id);
      return result;
    } catch (error) {
      setErrorMessage(resolveQueueError(error));
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [resolveTenantIdForTask]);

  const scanBasketWaybill = useCallback(async (task: WmsFulfillmentQueueTask, code: string) => {
    if (!task.basket?.id) {
      setErrorMessage('This pack order is no longer inside a basket.');
      return false;
    }

    setActiveBasketId(task.basket.id);
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await scanWmsPackBasketWaybill({
        basketId: task.basket.id,
        tenantId: resolveTenantIdForTask(task),
        code,
      });
      applyBasketResult({
        result,
        setBasketViews,
        setData,
      });
      setActiveBasketTaskSnapshot(resolveBasketContextTask(result, task));
      setActiveTaskId(result.activeOrderId);
      return true;
    } catch (error) {
      setErrorMessage(resolveQueueError(error));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [resolveTenantIdForTask]);

  const scanBasketUnit = useCallback(async (task: WmsFulfillmentQueueTask, orderId: string, code: string) => {
    if (!task.basket?.id) {
      setErrorMessage('This pack order is no longer inside a basket.');
      return false;
    }

    setActiveBasketId(task.basket.id);
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await scanWmsPackBasketOrderUnit({
        basketId: task.basket.id,
        orderId,
        tenantId: resolveTenantIdForTask(task),
        code,
      });
      applyBasketResult({
        result,
        setBasketViews,
        setData,
      });
      setActiveBasketTaskSnapshot(resolveBasketContextTask(result, task));
      setActiveTaskId(result.activeOrderId ?? orderId);
      return true;
    } catch (error) {
      setErrorMessage(resolveQueueError(error));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [resolveTenantIdForTask]);

  const completeBasketOrder = useCallback(async (task: WmsFulfillmentQueueTask, orderId: string) => {
    if (!task.basket?.id) {
      setErrorMessage('This pack order is no longer inside a basket.');
      return false;
    }

    setActiveBasketId(task.basket.id);
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await completeWmsPackBasketOrder({
        basketId: task.basket.id,
        orderId,
        tenantId: resolveTenantIdForTask(task),
      });
      applyBasketResult({
        result,
        setBasketViews,
        setData,
      });
      setActiveBasketTaskSnapshot(resolveBasketContextTask(result, task));
      setActiveTaskId(result.activeOrderId ?? null);
      await loadQueue({ mode: 'refresh', page: currentPage });
      return true;
    } catch (error) {
      setErrorMessage(resolveQueueError(error));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [currentPage, loadQueue, resolveTenantIdForTask]);

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

  const voidBasketOrders = useCallback(async (params: {
    task: WmsFulfillmentQueueTask;
    orderIds: string[];
    reason: string;
    supervisorIdentifier?: string | null;
    supervisorPassword?: string | null;
  }) => {
    if (!params.task.basket?.id) {
      setErrorMessage('This pack order is no longer inside a basket.');
      return false;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await voidWmsPackBasketOrders({
        basketId: params.task.basket.id,
        tenantId: resolveTenantIdForTask(params.task),
        orderIds: params.orderIds,
        reason: params.reason,
        supervisorIdentifier: params.supervisorIdentifier,
        supervisorPassword: params.supervisorPassword,
      });
      applyBasketResult({
        result,
        setBasketViews,
        setData,
      });
      setActiveBasketId(result.basket.id);
      setActiveBasketTaskSnapshot(resolveBasketContextTask(result, params.task));
      await loadQueue({ mode: 'refresh', page: currentPage });
      setActiveTaskId(result.activeOrderId);
      return true;
    } catch (error) {
      setErrorMessage(resolveQueueError(error));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [currentPage, loadQueue, resolveTenantIdForTask]);

  const selectTask = useCallback((taskId: string | null) => {
    setActiveTaskId(taskId);
    if (!taskId) {
      return;
    }

    const task = indexedTasks.get(taskId);
    if (!task || task.assignmentMode !== 'BASKET_DEMAND' || !task.basket?.id) {
      setActiveBasketId(null);
      setActiveBasketTaskSnapshot(null);
      return;
    }

    setActiveBasketId(task.basket.id);
    setActiveBasketTaskSnapshot(task);
    const currentBasketView = basketViews[task.basket.id];
    if (currentBasketView) {
      const activeOrderId = currentBasketView.plan.activeOrder?.id;
      setActiveTaskId(activeOrderId ?? taskId);
      return;
    }

    void fetchBasketPlan(task);
  }, [basketViews, fetchBasketPlan, indexedTasks]);

  const refresh = useCallback(async () => {
    await loadQueue({ mode: 'refresh', page: currentPage });

    const refreshTask = activeTask ?? activeBasketTaskSnapshot;
    if (activeBasketId && refreshTask?.assignmentMode === 'BASKET_DEMAND' && refreshTask.basket?.id === activeBasketId) {
      await fetchBasketPlan(refreshTask);
    }
  }, [activeBasketId, activeBasketTaskSnapshot, activeTask, currentPage, fetchBasketPlan, loadQueue]);

  return {
    activeBasketId,
    activeBasketView,
    activeTask,
    basketViews,
    canDirectVoid,
    canExecute,
    currentPage,
    completeBasketOrder,
    errorMessage,
    fetchBasketPlan,
    isLoading,
    isRefreshing,
    isSubmitting,
    queueScope,
    scanBasketUnit,
    scanBasketWaybill,
    selectTask,
    selectedStatus,
    selectedStoreId: selectedStoreIdState,
    selectedTenantId: selectedTenantIdState,
    setActiveTaskId,
    setCurrentPage,
    setSelectedStatus: (value: string) => {
      setActiveBasketId(null);
      setActiveBasketTaskSnapshot(null);
      setActiveTaskId(null);
      setCurrentPage(1);
      setSelectedStatus(value);
    },
    setSelectedStoreId: (value: string | undefined) => {
      setActiveBasketId(null);
      setActiveBasketTaskSnapshot(null);
      setActiveTaskId(null);
      setCurrentPage(1);
      setSelectedStoreId(value);
    },
    setSelectedTenantId: (value: string | undefined) => {
      setActiveBasketId(null);
      setActiveBasketTaskSnapshot(null);
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
    refresh,
    scanUnit,
    startTask,
    verifyTracking,
    voidBasketOrders,
    voidTask,
  };
}

function replaceQueueTasksForBasket(
  current: WmsFulfillmentQueueResponse,
  basketId: string,
  nextTasks: WmsFulfillmentQueueTask[],
): WmsFulfillmentQueueResponse {
  const retainedTasks = current.tasks.filter((task) => task.basket?.id !== basketId);

  return {
    ...current,
    tasks: [...nextTasks, ...retainedTasks],
  };
}

function applyBasketResult(params: {
  result:
    | WmsFulfillmentBasketPackPlanResponse
    | WmsFulfillmentBasketPackWaybillResponse
    | WmsFulfillmentBasketPackUnitResponse
    | WmsFulfillmentBasketPackCompleteResponse
    | ({
        success: boolean;
        activeOrderId: string | null;
        activeOrder: WmsFulfillmentQueueTask | null;
        voidedOrderIds: string[];
        basket: WmsFulfillmentBasketPackPlanResponse['basket'];
        tasks: WmsFulfillmentQueueTask[];
        plan: WmsFulfillmentBasketPackPlanResponse['plan'];
      });
  setBasketViews: Dispatch<SetStateAction<Record<string, BasketPackView>>>;
  setData: Dispatch<SetStateAction<WmsFulfillmentQueueResponse | null>>;
}) {
  const { result, setBasketViews, setData } = params;

  setBasketViews((current) => ({
    ...current,
    [result.basket.id]: {
      basket: result.basket,
      tasks: result.tasks,
      plan: result.plan,
      validation: validateBasketPackResponse(result),
    },
  }));
  setData((current) => current ? replaceQueueTasksForBasket(current, result.basket.id, result.tasks) : current);
}

function resolveBasketContextTask(
  result:
    | WmsFulfillmentBasketPackPlanResponse
    | WmsFulfillmentBasketPackWaybillResponse
    | WmsFulfillmentBasketPackUnitResponse
    | WmsFulfillmentBasketPackCompleteResponse
    | ({
        success: boolean;
        activeOrderId: string | null;
        activeOrder: WmsFulfillmentQueueTask | null;
        voidedOrderIds: string[];
        basket: WmsFulfillmentBasketPackPlanResponse['basket'];
        tasks: WmsFulfillmentQueueTask[];
        plan: WmsFulfillmentBasketPackPlanResponse['plan'];
      }),
  fallbackTask: WmsFulfillmentQueueTask,
) {
  if ('activeOrder' in result && result.activeOrder) {
    return {
      ...result.activeOrder,
      basket: result.basket,
    };
  }

  if ('completedOrder' in result && result.completedOrder) {
    return {
      ...result.completedOrder,
      basket: result.basket,
    };
  }

  return {
    ...fallbackTask,
    basket: result.basket,
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

function validateBasketPackResponse(
  result:
    | WmsFulfillmentBasketPackPlanResponse
    | WmsFulfillmentBasketPackWaybillResponse
    | WmsFulfillmentBasketPackUnitResponse
    | WmsFulfillmentBasketPackCompleteResponse
    | {
        success: boolean;
        activeOrderId: string | null;
        activeOrder: WmsFulfillmentQueueTask | null;
        voidedOrderIds: string[];
        basket: WmsFulfillmentBasketPackPlanResponse['basket'];
        tasks: WmsFulfillmentQueueTask[];
        plan: WmsFulfillmentBasketPackPlanResponse['plan'];
      },
): WmsFulfillmentBasketPackValidation {
  const issues: string[] = [];
  const planOrderIds = result.plan.orders.map((order) => order.id);
  const taskOrderIds = result.tasks.map((task) => task.id);
  const basketOrderIds = (result.basket.orders ?? []).map((order) => order.id);

  if (result.basket.id !== result.plan.basketId) {
    issues.push('Basket header and basket plan are pointing to different basket records.');
  }

  const duplicatePlanOrders = collectDuplicateIds(planOrderIds);
  if (duplicatePlanOrders.length > 0) {
    issues.push(`Basket plan has duplicate orders: ${duplicatePlanOrders.join(', ')}.`);
  }

  const duplicateTaskOrders = collectDuplicateIds(taskOrderIds);
  if (duplicateTaskOrders.length > 0) {
    issues.push(`Pack queue returned duplicate basket tasks: ${duplicateTaskOrders.join(', ')}.`);
  }

  if (!hasSameUniqueIds(planOrderIds, taskOrderIds)) {
    issues.push('Basket plan orders do not match the pack tasks currently attached to this basket.');
  }

  if (basketOrderIds.length > 0 && !hasSameUniqueIds(planOrderIds, basketOrderIds)) {
    issues.push('Basket order chips do not match the plan order list returned for this basket.');
  }

  if ((result.basket.orders ?? []).some((order) => order.store?.tenantId === null)) {
    issues.push('One or more basket orders are missing tenant scope in the basket payload.');
  }

  if (result.tasks.some((task) => task.basket?.id !== result.basket.id)) {
    issues.push('One or more pack tasks still reference a different basket.');
  }

  if (result.plan.orderProgress.total !== result.plan.orders.length) {
    issues.push('Basket order total does not match the number of orders in the active pack plan.');
  }

  const orderRequiredTotal = result.plan.orders.reduce((sum, order) => sum + order.totals.required, 0);
  const orderPackedTotal = result.plan.orders.reduce((sum, order) => sum + order.totals.packed, 0);
  if (
    orderRequiredTotal !== result.plan.totals.required
    || orderPackedTotal !== result.plan.totals.packed
  ) {
    issues.push('Basket totals do not match the order totals returned by the pack plan.');
  }

  const taskRequiredTotal = result.tasks.reduce((sum, task) => sum + task.totals.required, 0);
  const taskPackedTotal = result.tasks.reduce((sum, task) => sum + task.totals.packed, 0);
  if (
    taskRequiredTotal !== result.plan.totals.required
    || taskPackedTotal !== result.plan.totals.packed
  ) {
    issues.push('Queue task totals do not match the active basket totals.');
  }

  if (result.plan.activeOrder && !planOrderIds.includes(result.plan.activeOrder.id)) {
    issues.push('The active packing order is not included in the basket plan order list.');
  }

  return {
    isConsistent: issues.length === 0,
    issues,
  };
}

function hasSameUniqueIds(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  const leftSet = new Set(left);
  const rightSet = new Set(right);
  if (leftSet.size !== rightSet.size) {
    return false;
  }

  for (const value of leftSet) {
    if (!rightSet.has(value)) {
      return false;
    }
  }

  return true;
}

function collectDuplicateIds(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([value]) => value);
}
