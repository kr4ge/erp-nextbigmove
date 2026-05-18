import { useCallback, useEffect, useMemo, useState, type SetStateAction } from 'react';
import type { BootstrapResponse, DeviceIdentity, StoredSession } from '@/src/features/auth/types';
import { ApiError } from '@/src/shared/services/http';
import {
  claimMobilePickingTask,
  fetchMobilePickingTasks,
  handoffMobilePickingTask,
  scanMobilePickingBasket,
  scanMobilePickingBin,
  scanMobilePickingUnit,
} from '../services/picking-api';
import type {
  PickingFilters,
  PickingStatus,
  WmsMobilePickingBinScanResult,
  WmsMobilePickingResponse,
  WmsMobilePickingTask,
} from '../types';

const PICKING_PAGE_SIZE = 10;

type UsePickingWorkspaceParams = {
  bootstrap: BootstrapResponse;
  device: DeviceIdentity | null;
  session: StoredSession;
};

export function usePickingWorkspace({
  bootstrap,
  device,
  session,
}: UsePickingWorkspaceParams) {
  const [filters, setFilters] = useState<PickingFilters>({
    tenantId: bootstrap.tenant?.id ?? null,
    storeId: null,
  });
  const [picking, setPicking] = useState<WmsMobilePickingResponse | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activeBin, setActiveBin] = useState<WmsMobilePickingBinScanResult['bin'] | null>(null);
  const [statusFilter, setStatusFilterState] = useState<PickingStatus | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadPickingPage = useCallback(async ({
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
      const nextPicking = await fetchMobilePickingTasks({
        accessToken: session.accessToken,
        device,
        filters,
        status: statusFilter,
        page: nextPage,
        pageSize: PICKING_PAGE_SIZE,
      });

      setPicking((current) => (
        append && current ? mergePickingPage(current, nextPicking) : nextPicking
      ));
      setPage(nextPage);
      setError(null);
    } catch (requestError) {
      setError(resolvePickingError(requestError));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  }, [device, filters, session.accessToken, statusFilter]);

  const refreshPicking = useCallback(async () => {
    await loadPickingPage({
      loadingKind: 'refresh',
      page: 1,
    });
  }, [loadPickingPage]);

  const loadMore = useCallback(async () => {
    if (!picking?.pagination.hasMore || isLoadingMore) {
      return;
    }

    await loadPickingPage({
      append: true,
      loadingKind: 'more',
      page: page + 1,
    });
  }, [isLoadingMore, loadPickingPage, page, picking?.pagination.hasMore]);

  const updateFilters = useCallback((nextFilters: SetStateAction<PickingFilters>) => {
    setPicking(null);
    setActiveTaskId(null);
    setActiveBin(null);
    setPage(1);
    setError(null);
    setFilters(nextFilters);
  }, []);

  const setStatusFilter = useCallback((nextStatus: PickingStatus | null) => {
    setPicking(null);
    setActiveTaskId(null);
    setActiveBin(null);
    setPage(1);
    setError(null);
    setStatusFilterState(nextStatus);
  }, []);

  const claimTask = useCallback(async (taskId: string) => {
    if (!device) {
      setError('Device is not ready.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await claimMobilePickingTask({
        accessToken: session.accessToken,
        device,
        taskId,
        tenantId: filters.tenantId,
      });
      setPicking((current) => current ? replacePickingTask(current, result.task) : current);
      setActiveTaskId(result.task.id);
      setError(null);
    } catch (requestError) {
      setError(resolvePickingError(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }, [device, filters.tenantId, session.accessToken]);

  const scanBin = useCallback(async (taskId: string, code: string) => {
    if (!device) {
      setError('Device is not ready.');
      return false;
    }

    setIsSubmitting(true);
    try {
      const result = await scanMobilePickingBin({
        accessToken: session.accessToken,
        device,
        taskId,
        tenantId: filters.tenantId,
        code,
      });
      setActiveBin(result.bin);
      setError(null);
      return true;
    } catch (requestError) {
      setError(resolvePickingError(requestError));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [device, filters.tenantId, session.accessToken]);

  const scanBasket = useCallback(async (taskId: string, code: string) => {
    if (!device) {
      setError('Device is not ready.');
      return false;
    }

    setIsSubmitting(true);
    try {
      const result = await scanMobilePickingBasket({
        accessToken: session.accessToken,
        device,
        taskId,
        tenantId: filters.tenantId,
        code,
      });
      setPicking((current) => current ? replacePickingTask(current, result.task) : current);
      setActiveTaskId(result.task.id);
      setError(null);
      return true;
    } catch (requestError) {
      setError(resolvePickingError(requestError));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [device, filters.tenantId, session.accessToken]);

  const scanUnit = useCallback(async (taskId: string, code: string) => {
    if (!device) {
      setError('Device is not ready.');
      return false;
    }

    setIsSubmitting(true);
    try {
      const result = await scanMobilePickingUnit({
        accessToken: session.accessToken,
        device,
        taskId,
        tenantId: filters.tenantId,
        code,
      });
      setPicking((current) => current ? replacePickingTask(current, result.task) : current);
      setActiveTaskId(result.task.id);
      if (!result.task.nextPick) {
        setActiveBin(null);
      }
      setError(null);
      return true;
    } catch (requestError) {
      setError(resolvePickingError(requestError));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [device, filters.tenantId, session.accessToken]);

  const handoffTask = useCallback(async (taskId: string, packerId: string) => {
    if (!device) {
      setError('Device is not ready.');
      return false;
    }

    setIsSubmitting(true);
    try {
      const result = await handoffMobilePickingTask({
        accessToken: session.accessToken,
        device,
        taskId,
        tenantId: filters.tenantId,
        packerId,
      });
      setPicking((current) => current ? replacePickingTask(current, result.task) : current);
      setActiveTaskId(result.task.id);
      setError(null);
      return true;
    } catch (requestError) {
      setError(resolvePickingError(requestError));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [device, filters.tenantId, session.accessToken]);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        await loadPickingPage({
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
  }, [loadPickingPage]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!isSubmitting) {
        void loadPickingPage({
          loadingKind: 'refresh',
          page: 1,
        });
      }
    }, 10000);

    return () => clearInterval(timer);
  }, [isSubmitting, loadPickingPage]);

  const indexedTasks = useMemo(() => {
    if (!picking) {
      return new Map<string, WmsMobilePickingTask>();
    }

    const entries = new Map<string, WmsMobilePickingTask>();

    for (const task of picking.tasks) {
      entries.set(task.id, task);
    }

    for (const basket of picking.heldBaskets) {
      if (basket.task) {
        entries.set(basket.task.id, basket.task);
      }
    }

    for (const task of picking.pickedHistory) {
      entries.set(task.id, task);
    }

    return entries;
  }, [picking]);

  const activeTask = useMemo(() => {
    if (!activeTaskId) {
      return null;
    }

    return indexedTasks.get(activeTaskId) ?? null;
  }, [activeTaskId, indexedTasks]);

  return {
    activeBin,
    activeTask,
    activeTaskId,
    claimTask,
    error,
    filters,
    isLoading,
    isLoadingMore,
    isRefreshing,
    isSubmitting,
    handoffTask,
    loadMore,
    picking,
    refreshPicking,
    scanBasket,
    scanBin,
    scanUnit,
    setActiveBin,
    setActiveTaskId,
    setFilters: updateFilters,
    setStatusFilter,
    statusFilter,
  };
}

function mergePickingPage(
  current: WmsMobilePickingResponse,
  next: WmsMobilePickingResponse,
): WmsMobilePickingResponse {
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

function replacePickingTask(
  current: WmsMobilePickingResponse,
  nextTask: WmsMobilePickingTask,
): WmsMobilePickingResponse {
  const previousTask = findTaskById(current, nextTask.id);
  const activeStatuses = new Set(['READY', 'PARTIAL', 'RESTOCKING', 'ISSUE', 'IN_PICKING']);
  const completeStatuses = new Set(['READY_FOR_PACK', 'PICKED']);
  const nextTasks = current.tasks.filter((task) => task.id !== nextTask.id);
  const tasks = activeStatuses.has(nextTask.status) ? [nextTask, ...nextTasks] : nextTasks;
  const historyWithoutTask = current.pickedHistory.filter((task) => task.id !== nextTask.id);
  const pickedHistory = completeStatuses.has(nextTask.status)
    ? [nextTask, ...historyWithoutTask].slice(0, 20)
    : historyWithoutTask;
  const heldBaskets = buildHeldBasketCollection(
    current.heldBaskets.filter((basket) => basket.task?.id !== nextTask.id),
    nextTask,
  );
  const availableBaskets = nextTask.basket
    ? current.availableBaskets.filter((basket) => basket.id !== nextTask.basket?.id)
    : current.availableBaskets;
  const fullHeldBaskets = heldBaskets.filter((basket) => basket.status === 'FULL_HELD').length;
  const activeLoad = Math.max(
    current.picker.activeLoad
      - getTaskLoadContribution(previousTask)
      + getTaskLoadContribution(nextTask),
    0,
  );

  return {
    ...current,
    picker: {
      ...current.picker,
      activeLoad,
      availableSlots: availableBaskets.length,
      heldBaskets: heldBaskets.length,
      fullHeldBaskets,
    },
    availableBaskets,
    heldBaskets,
    pickedHistory,
    tasks,
  };
}

function buildHeldBasketCollection(
  current: WmsMobilePickingResponse['heldBaskets'],
  nextTask: WmsMobilePickingTask,
) {
  if (!nextTask.basket) {
    return current;
  }

  return [
    {
      ...nextTask.basket,
      task: nextTask,
    },
    ...current,
  ];
}

function findTaskById(current: WmsMobilePickingResponse, taskId: string) {
  return current.tasks.find((task) => task.id === taskId)
    ?? current.pickedHistory.find((task) => task.id === taskId)
    ?? current.heldBaskets.find((basket) => basket.task?.id === taskId)?.task
    ?? null;
}

function getTaskLoadContribution(task: WmsMobilePickingTask | null) {
  if (!task) {
    return 0;
  }

  if (task.status === 'IN_PICKING') {
    return 1;
  }

  return 0;
}

function resolvePickingError(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Picking sync failed.';
}
