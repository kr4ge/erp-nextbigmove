import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import type { BootstrapResponse, DeviceIdentity, StoredSession } from '@/src/features/auth/types';
import { ApiError } from '@/src/shared/services/http';
import type { WmsMobilePickingTask } from '@/src/features/picking/types';
import {
  completeMobilePackingBasketOrder,
  completeMobilePackingTask,
  fetchMobilePackingBasketPlan,
  fetchMobilePackingTasks,
  scanMobilePackingBasketOrderUnit,
  scanMobilePackingBasketWaybill,
  scanMobilePackingUnit,
  startMobilePackingTask,
  verifyMobilePackingTracking,
  voidMobilePackingTask,
} from '../services/packing-api';
import type {
  WmsMobileBasketPackCompleteResponse,
  PackingFilters,
  PackingStatusFilter,
  WmsMobileBasketPackPlan,
  WmsMobileBasketPackPlanResponse,
  WmsMobileBasketPackUnitResponse,
  WmsMobileBasketPackWaybillResponse,
  WmsMobilePackingResponse,
} from '../types';

const PACKING_PAGE_SIZE = 10;

type UsePackingWorkspaceParams = {
  bootstrap: BootstrapResponse;
  device: DeviceIdentity | null;
  session: StoredSession;
};

type BasketPackView = {
  basket: WmsMobileBasketPackPlanResponse['basket'];
  tasks: WmsMobilePickingTask[];
  plan: WmsMobileBasketPackPlan;
};

export function usePackingWorkspace({
  bootstrap,
  device,
  session,
}: UsePackingWorkspaceParams) {
  const [filters, setFilters] = useState<PackingFilters>({
    tenantId: bootstrap.tenant?.id ?? null,
    storeId: null,
  });
  const [packing, setPacking] = useState<WmsMobilePackingResponse | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [statusFilter, setStatusFilterState] = useState<PackingStatusFilter | null>(null);
  const [basketViews, setBasketViews] = useState<Record<string, BasketPackView>>({});
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadPackingPage = useCallback(async ({
    append = false,
    loadingKind,
    page: nextPage,
  }: {
    append?: boolean;
    loadingKind: 'initial' | 'refresh' | 'more';
    page: number;
  }) => {
    if (!device) {
      setError('Device is not ready.');
      setIsLoading(false);
      return;
    }

    if (loadingKind === 'initial') {
      setIsLoading(true);
    }
    if (loadingKind === 'refresh') {
      setIsRefreshing(true);
    }
    if (loadingKind === 'more') {
      setIsLoadingMore(true);
    }

    try {
      if (append) {
        const nextPacking = await fetchMobilePackingTasks({
          accessToken: session.accessToken,
          device,
          filters,
          status: statusFilter,
          page: nextPage,
          pageSize: PACKING_PAGE_SIZE,
        });

        setPacking((current) => (
          current ? mergePackingPage(current, nextPacking) : nextPacking
        ));
        setPage(nextPage);
      } else {
        let mergedPacking: WmsMobilePackingResponse | null = null;
        let lastLoadedPage = 1;

        for (let pageIndex = 1; pageIndex <= nextPage; pageIndex += 1) {
          const pageResult = await fetchMobilePackingTasks({
            accessToken: session.accessToken,
            device,
            filters,
            status: statusFilter,
            page: pageIndex,
            pageSize: PACKING_PAGE_SIZE,
          });

          mergedPacking = mergedPacking ? mergePackingPage(mergedPacking, pageResult) : pageResult;
          lastLoadedPage = pageIndex;

          if (!pageResult.pagination.hasMore) {
            break;
          }
        }

        setPacking(mergedPacking);
        setPage(lastLoadedPage);
      }
      setError(null);
    } catch (requestError) {
      setError(resolvePackingError(requestError));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  }, [device, filters, session.accessToken, statusFilter]);

  const refreshPacking = useCallback(async () => {
    await loadPackingPage({
      loadingKind: 'refresh',
      page,
    });
  }, [loadPackingPage, page]);

  const loadMore = useCallback(async () => {
    if (!packing?.pagination.hasMore || isLoadingMore) {
      return;
    }

    await loadPackingPage({
      append: true,
      loadingKind: 'more',
      page: page + 1,
    });
  }, [isLoadingMore, loadPackingPage, packing?.pagination.hasMore, page]);

  const updateFilters = useCallback((nextFilters: SetStateAction<PackingFilters>) => {
    setPacking(null);
    setBasketViews({});
    setActiveTaskId(null);
    setPage(1);
    setError(null);
    setFilters(nextFilters);
  }, []);

  const setStatusFilter = useCallback((nextStatus: PackingStatusFilter | null) => {
    setPacking(null);
    setBasketViews({});
    setActiveTaskId(null);
    setPage(1);
    setError(null);
    setStatusFilterState(nextStatus);
  }, []);

  const startTask = useCallback(async (taskId: string) => {
    if (!device) {
      setError('Device is not ready.');
      return false;
    }

    setIsSubmitting(true);
    try {
      const result = await startMobilePackingTask({
        accessToken: session.accessToken,
        device,
        taskId,
        tenantId: filters.tenantId,
      });
      setPacking((current) => current ? replacePackingTask(current, result.task) : current);
      setActiveTaskId(result.task.id);
      setError(null);
      return true;
    } catch (requestError) {
      setError(resolvePackingError(requestError));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [device, filters.tenantId, session.accessToken]);

  const fetchBasketPlan = useCallback(async (basketId: string) => {
    if (!device) {
      setError('Device is not ready.');
      return null;
    }

    setIsSubmitting(true);
    try {
      const result = await fetchMobilePackingBasketPlan({
        accessToken: session.accessToken,
        device,
        basketId,
        tenantId: filters.tenantId,
      });
      setBasketViews((current) => ({
        ...current,
        [basketId]: {
          basket: result.basket,
          tasks: result.tasks,
          plan: result.plan,
        },
      }));
      setActiveTaskId(result.plan.activeOrder?.id ?? null);
      setPacking((current) => current ? replacePackingTasksForBasket(current, basketId, result.tasks) : current);
      setError(null);
      return result;
    } catch (requestError) {
      setError(resolvePackingError(requestError));
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [device, filters.tenantId, session.accessToken]);

  const scanBasketWaybill = useCallback(async (basketId: string, code: string) => {
    if (!device) {
      setError('Device is not ready.');
      return null;
    }

    setIsSubmitting(true);
    try {
      const result = await scanMobilePackingBasketWaybill({
        accessToken: session.accessToken,
        device,
        basketId,
        tenantId: filters.tenantId,
        code,
      });
      setBasketViews((current) => ({
        ...current,
        [basketId]: {
          basket: result.basket,
          tasks: result.tasks,
          plan: result.plan,
        },
      }));
      setPacking((current) => current ? replacePackingTasksForBasket(current, basketId, result.tasks) : current);
      setActiveTaskId(result.activeOrderId);
      setError(null);
      return result;
    } catch (requestError) {
      setError(resolvePackingError(requestError));
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [device, filters.tenantId, session.accessToken]);

  const scanBasketOrderUnit = useCallback(async (basketId: string, orderId: string, code: string) => {
    if (!device) {
      setError('Device is not ready.');
      return null;
    }

    setIsSubmitting(true);
    try {
      const result = await scanMobilePackingBasketOrderUnit({
        accessToken: session.accessToken,
        device,
        basketId,
        orderId,
        tenantId: filters.tenantId,
        code,
      });
      setBasketViews((current) => ({
        ...current,
        [basketId]: {
          basket: result.basket,
          tasks: result.tasks,
          plan: result.plan,
        },
      }));
      setPacking((current) => current ? replacePackingTasksForBasket(current, basketId, result.tasks) : current);
      setActiveTaskId(result.activeOrderId);
      setError(null);
      return result;
    } catch (requestError) {
      setError(resolvePackingError(requestError));
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [device, filters.tenantId, session.accessToken]);

  const completeBasketOrder = useCallback(async (basketId: string, orderId: string) => {
    if (!device) {
      setError('Device is not ready.');
      return false;
    }

    setIsSubmitting(true);
    try {
      const result = await completeMobilePackingBasketOrder({
        accessToken: session.accessToken,
        device,
        basketId,
        orderId,
        tenantId: filters.tenantId,
      });
      applyBasketResult({
        result,
        setBasketViews,
        setPacking,
      });
      setActiveTaskId(result.activeOrderId);
      setError(null);
      await loadPackingPage({
        loadingKind: 'refresh',
        page: 1,
      });
      return true;
    } catch (requestError) {
      setError(resolvePackingError(requestError));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [device, filters.tenantId, loadPackingPage, session.accessToken]);

  const scanUnit = useCallback(async (taskId: string, code: string) => {
    if (!device) {
      setError('Device is not ready.');
      return false;
    }

    setIsSubmitting(true);
    try {
      const result = await scanMobilePackingUnit({
        accessToken: session.accessToken,
        device,
        taskId,
        tenantId: filters.tenantId,
        code,
      });
      setPacking((current) => current ? replacePackingTask(current, result.task) : current);
      setActiveTaskId(result.task.id);
      setError(null);
      return true;
    } catch (requestError) {
      setError(resolvePackingError(requestError));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [device, filters.tenantId, session.accessToken]);

  const verifyTracking = useCallback(async (taskId: string, code: string) => {
    if (!device) {
      setError('Device is not ready.');
      return null;
    }

    setIsSubmitting(true);
    try {
      const result = await verifyMobilePackingTracking({
        accessToken: session.accessToken,
        device,
        taskId,
        tenantId: filters.tenantId,
        code,
      });
      setPacking((current) => current ? replacePackingTask(current, result.task) : current);
      setActiveTaskId(result.task.id);
      setError(null);
      return result.tracking;
    } catch (requestError) {
      setError(resolvePackingError(requestError));
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [device, filters.tenantId, session.accessToken]);

  const completeTask = useCallback(async (taskId: string, trackingCode: string) => {
    if (!device) {
      setError('Device is not ready.');
      return false;
    }

    setIsSubmitting(true);
    try {
      const result = await completeMobilePackingTask({
        accessToken: session.accessToken,
        device,
        taskId,
        tenantId: filters.tenantId,
        trackingCode,
      });
      setPacking((current) => current ? replacePackingTask(current, result.task) : current);
      setActiveTaskId(null);
      setError(null);
      await loadPackingPage({
        loadingKind: 'refresh',
        page: 1,
      });
      return true;
    } catch (requestError) {
      setError(resolvePackingError(requestError));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [device, filters.tenantId, loadPackingPage, session.accessToken]);

  const voidTask = useCallback(async ({
    taskId,
    reason,
    supervisorIdentifier,
    supervisorPassword,
  }: {
    taskId: string;
    reason: string;
    supervisorIdentifier?: string | null;
    supervisorPassword?: string | null;
  }) => {
    if (!device) {
      setError('Device is not ready.');
      return false;
    }

    setIsSubmitting(true);
    try {
      const result = await voidMobilePackingTask({
        accessToken: session.accessToken,
        device,
        taskId,
        tenantId: filters.tenantId,
        reason,
        supervisorIdentifier,
        supervisorPassword,
      });
      setPacking((current) => current ? replacePackingTask(current, result.task) : current);
      setActiveTaskId(null);
      setError(null);
      await loadPackingPage({
        loadingKind: 'refresh',
        page: 1,
      });
      return true;
    } catch (requestError) {
      setError(resolvePackingError(requestError));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [device, filters.tenantId, loadPackingPage, session.accessToken]);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        await loadPackingPage({
          loadingKind: 'initial',
          page: 1,
        });
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    setIsLoading(true);
    void load();

    return () => {
      isMounted = false;
    };
  }, [loadPackingPage]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!isSubmitting) {
        void loadPackingPage({
          loadingKind: 'refresh',
          page,
        });
      }
    }, 10000);

    return () => clearInterval(timer);
  }, [isSubmitting, loadPackingPage, page]);

  const indexedTasks = useMemo(() => {
    if (!packing) {
      return new Map<string, WmsMobilePickingTask>();
    }

    return new Map(packing.tasks.map((task) => [task.id, task] as const));
  }, [packing]);

  const activeTask = useMemo(() => {
    if (!activeTaskId) {
      return null;
    }

    return indexedTasks.get(activeTaskId) ?? null;
  }, [activeTaskId, indexedTasks]);

  return {
    activeTask,
    activeTaskId,
    basketViews,
    completeBasketOrder,
    completeTask,
    error,
    fetchBasketPlan,
    filters,
    isLoading,
    isLoadingMore,
    isRefreshing,
    isSubmitting,
    loadMore,
    packing,
    refreshPacking,
    scanBasketOrderUnit,
    scanBasketWaybill,
    scanUnit,
    setFilters: updateFilters,
    setActiveTaskId,
    setStatusFilter,
    startTask,
    statusFilter,
    verifyTracking,
    voidTask,
  };
}

function mergePackingPage(
  current: WmsMobilePackingResponse,
  next: WmsMobilePackingResponse,
): WmsMobilePackingResponse {
  const seen = new Set<string>();
  const tasks = [...current.tasks, ...next.tasks].filter((task) => {
    if (seen.has(task.id)) {
      return false;
    }

    seen.add(task.id);
    return true;
  });

  return {
    ...next,
    tasks,
  };
}

function replacePackingTask(
  current: WmsMobilePackingResponse,
  nextTask: WmsMobilePickingTask,
): WmsMobilePackingResponse {
  const tasks = current.tasks.filter((task) => task.id !== nextTask.id);

  return {
    ...current,
    tasks: nextTask.status === 'PACKED' || nextTask.status === 'CANCELED' ? tasks : [nextTask, ...tasks],
  };
}

function replacePackingTasksForBasket(
  current: WmsMobilePackingResponse,
  basketId: string,
  nextTasks: WmsMobilePickingTask[],
): WmsMobilePackingResponse {
  const retainedTasks = current.tasks.filter((task) => task.basket?.id !== basketId);

  return {
    ...current,
    tasks: [...nextTasks, ...retainedTasks],
  };
}

function applyBasketResult(params: {
  result:
    | WmsMobileBasketPackPlanResponse
    | WmsMobileBasketPackWaybillResponse
    | WmsMobileBasketPackUnitResponse
    | WmsMobileBasketPackCompleteResponse;
  setBasketViews: Dispatch<SetStateAction<Record<string, BasketPackView>>>;
  setPacking: Dispatch<SetStateAction<WmsMobilePackingResponse | null>>;
}) {
  const { result, setBasketViews, setPacking } = params;

  setBasketViews((current) => ({
    ...current,
    [result.basket.id]: {
      basket: result.basket,
      tasks: result.tasks,
      plan: result.plan,
    },
  }));
  setPacking((current) => current ? replacePackingTasksForBasket(current, result.basket.id, result.tasks) : current);
}

function resolvePackingError(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Packing sync failed.';
}
