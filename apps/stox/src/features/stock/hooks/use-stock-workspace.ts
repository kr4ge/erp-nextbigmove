import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type SetStateAction,
} from 'react';
import type { BootstrapResponse, DeviceIdentity, StoredSession } from '@/src/features/auth/types';
import { ApiError } from '@/src/shared/services/http';
import {
  fetchMobileStock,
  moveMobileStockUnit,
  putawayMobileStockUnit,
} from '../services/stock-api';
import {
  appendQueuedStockAction,
  readCachedStock,
  readQueuedStockActions,
  removeQueuedStockAction,
  updateQueuedStockAction,
  writeCachedStock,
  type QueuedStockAction,
} from '../services/stock-offline-store';
import type { StockFilters, StockMode, WmsMobileStockResponse } from '../types';

const STOCK_PAGE_SIZE = 12;

const initialPages = (): Record<StockMode, number> => ({
  putaway: 1,
  move: 1,
  bins: 1,
  recent: 1,
});

type UseStockWorkspaceParams = {
  bootstrap: BootstrapResponse;
  device: DeviceIdentity | null;
  session: StoredSession;
};

export function useStockWorkspace({
  bootstrap,
  device,
  session,
}: UseStockWorkspaceParams) {
  const [mode, setMode] = useState<StockMode>('putaway');
  const [stock, setStock] = useState<WmsMobileStockResponse | null>(null);
  const [filters, setFilters] = useState<StockFilters>({
    tenantId: null,
    storeId: null,
    warehouseId: null,
  });
  const [pages, setPages] = useState<Record<StockMode, number>>(initialPages);
  const [error, setError] = useState<string | null>(null);
  const [lastCachedAt, setLastCachedAt] = useState<string | null>(null);
  const [pendingActions, setPendingActions] = useState<QueuedStockAction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSyncingQueue, setIsSyncingQueue] = useState(false);

  const userId = session.user.id;

  const loadStockPage = useCallback(async ({
    append = false,
    loadingKind,
    page,
    targetMode,
  }: {
    append?: boolean;
    loadingKind: 'initial' | 'refresh' | 'more';
    page: number;
    targetMode: StockMode;
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
      if (!append && page === 1) {
        const cached = await readCachedStock({
          userId,
          tenantId: filters.tenantId,
          storeId: filters.storeId,
          warehouseId: filters.warehouseId,
          mode: targetMode,
        });

        if (cached) {
          setStock(cached.stock);
          setLastCachedAt(cached.cachedAt);
        }
      }

      const nextStock = await fetchMobileStock({
        accessToken: session.accessToken,
        device,
        tenantId: filters.tenantId,
        storeId: filters.storeId,
        warehouseId: filters.warehouseId,
        mode: targetMode,
        page,
        pageSize: STOCK_PAGE_SIZE,
      });

      setStock((current) => (
        append && current ? mergeStockPage(current, nextStock, targetMode) : nextStock
      ));
      if (!append && page === 1) {
        await writeCachedStock({
          userId,
          tenantId: filters.tenantId,
          storeId: filters.storeId,
          warehouseId: filters.warehouseId,
          mode: targetMode,
        }, nextStock);
      }
      setPages((current) => ({
        ...current,
        [targetMode]: page,
      }));
      setLastCachedAt(null);
      setError(null);
    } catch (requestError) {
      setError(resolveStockError(requestError));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  }, [device, filters.storeId, filters.tenantId, filters.warehouseId, session.accessToken, userId]);

  const reloadPendingActions = useCallback(async () => {
    const actions = await readQueuedStockActions(userId);
    setPendingActions(actions);
    return actions;
  }, [userId]);

  const enqueueStockAction = useCallback(async (action: QueuedStockAction) => {
    const next = await appendQueuedStockAction(userId, action);
    setPendingActions(next);
    setError(null);
  }, [userId]);

  const syncPendingActions = useCallback(async () => {
    if (!device || isSyncingQueue) {
      return;
    }

    setIsSyncingQueue(true);

    try {
      const queuedActions = await readQueuedStockActions(userId);
      let nextActions = queuedActions;

      for (const action of [...queuedActions].reverse()) {
        try {
          const request = {
            accessToken: session.accessToken,
            device,
            tenantId: action.tenantId,
            unitId: action.unitId,
            targetCode: action.targetCode,
            clientRequestId: action.id,
            expectedStatus: action.expectedStatus,
            expectedCurrentLocationId: action.expectedCurrentLocationId,
            expectedUpdatedAt: action.expectedUpdatedAt,
            notes: `Queued from STOX at ${formatQueueDate(action.createdAt)}`,
          };

          if (action.action === 'putaway') {
            await putawayMobileStockUnit(request);
          } else {
            await moveMobileStockUnit(request);
          }

          nextActions = await removeQueuedStockAction(userId, action.id);
          setPendingActions(nextActions);
        } catch (requestError) {
          const failedAction: QueuedStockAction = {
            ...action,
            attempts: action.attempts + 1,
            lastError: resolveStockError(requestError),
          };

          nextActions = await updateQueuedStockAction(userId, failedAction);
          setPendingActions(nextActions);

          if (requestError instanceof ApiError) {
            setError(`Queued action for ${action.unitCode} needs review: ${failedAction.lastError}`);
            break;
          }

          setError(`Still offline. ${nextActions.length} stock action${nextActions.length === 1 ? '' : 's'} pending.`);
          break;
        }
      }
    } finally {
      setIsSyncingQueue(false);
    }
  }, [device, isSyncingQueue, session.accessToken, userId]);

  const refreshStock = useCallback(async () => {
    await syncPendingActions();
    await loadStockPage({
      loadingKind: 'refresh',
      page: 1,
      targetMode: mode,
    });
  }, [loadStockPage, mode, syncPendingActions]);

  const updateFilters = useCallback((nextFilters: SetStateAction<StockFilters>) => {
    setPages(initialPages());
    setStock(null);
    setLastCachedAt(null);
    setError(null);
    setFilters(nextFilters);
  }, []);

  useEffect(() => {
    void reloadPendingActions();
  }, [reloadPendingActions]);

  useEffect(() => {
    let isMounted = true;

    async function loadStock() {
      if (!device) {
        if (isMounted) {
          setError('Device is not ready.');
          setIsLoading(false);
        }
        return;
      }

      try {
        await loadStockPage({
          loadingKind: 'initial',
          page: 1,
          targetMode: mode,
        });
      } catch (requestError) {
        if (isMounted) {
          setError(resolveStockError(requestError));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    }

    setIsLoading(true);
    void loadStock();

    return () => {
      isMounted = false;
    };
  }, [device, loadStockPage, mode]);

  const activeCount = useMemo(() => {
    if (!stock) {
      return 0;
    }

    return getModeRecords(stock, mode).length;
  }, [mode, stock]);

  const activeTotal = useMemo(() => {
    if (!stock) {
      return 0;
    }

    return getModeTotal(stock, mode);
  }, [mode, stock]);

  const hasMore = stock?.pagination.mode === mode
    ? stock.pagination.hasMore
    : activeCount < activeTotal;

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore) {
      return;
    }

    await loadStockPage({
      append: true,
      loadingKind: 'more',
      page: pages[mode] + 1,
      targetMode: mode,
    });
  }, [hasMore, isLoadingMore, loadStockPage, mode, pages]);

  return {
    activeCount,
    activeTotal,
    enqueueStockAction,
    error,
    filters,
    hasMore,
    isCachedSnapshot: Boolean(lastCachedAt),
    isLoading,
    isLoadingMore,
    isRefreshing,
    isSyncingQueue,
    lastCachedAt,
    loadMore,
    mode,
    pendingActions,
    pendingActionCount: pendingActions.length,
    refreshStock,
    setFilters: updateFilters,
    setMode,
    syncPendingActions,
    stock,
  };
}

function mergeStockPage(
  current: WmsMobileStockResponse,
  next: WmsMobileStockResponse,
  mode: StockMode,
): WmsMobileStockResponse {
  return {
    ...next,
    putawayQueue: mode === 'putaway'
      ? mergeById(current.putawayQueue, next.putawayQueue)
      : current.putawayQueue,
    movableUnits: mode === 'move'
      ? mergeById(current.movableUnits, next.movableUnits)
      : current.movableUnits,
    bins: mode === 'bins'
      ? mergeById(current.bins, next.bins)
      : current.bins,
    recentTransfers: mode === 'recent'
      ? mergeById(current.recentTransfers, next.recentTransfers)
      : current.recentTransfers,
  };
}

function mergeById<T extends { id: string }>(current: T[], next: T[]) {
  const seen = new Set<string>();

  return [...current, ...next].filter((record) => {
    if (seen.has(record.id)) {
      return false;
    }

    seen.add(record.id);
    return true;
  });
}

function getModeRecords(stock: WmsMobileStockResponse, mode: StockMode) {
  if (mode === 'putaway') {
    return stock.putawayQueue;
  }

  if (mode === 'move') {
    return stock.movableUnits;
  }

  if (mode === 'bins') {
    return stock.bins;
  }

  return stock.recentTransfers;
}

function getModeTotal(stock: WmsMobileStockResponse, mode: StockMode) {
  if (mode === 'putaway') {
    return stock.summary.putawayBatches;
  }

  if (mode === 'move') {
    return stock.summary.movableUnits;
  }

  if (mode === 'bins') {
    return stock.summary.bins;
  }

  return stock.summary.transfers;
}

function resolveStockError(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Stock sync failed.';
}

function formatQueueDate(value: string) {
  return new Date(value).toISOString();
}
