import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { BootstrapResponse, DeviceIdentity, StoredSession } from '@/src/features/auth/types';
import {
  canUseStoxStockMove,
  canUseStoxStockPutaway,
} from '@/src/features/home/rbac';
import { tokens } from '@/src/shared/theme/tokens';
import { StockExecutionPanel } from '@/src/features/stock/components/stock-execution-panel';
import {
  StockScopeFilterChip,
  StockScopeFilterModal,
} from '@/src/features/stock/components/stock-scope-filter';
import { StockStateCard } from '@/src/features/stock/components/stock-state-card';
import { useStockWorkspace } from '@/src/features/stock/hooks/use-stock-workspace';
import {
  formatStockCount,
  formatStockDate,
} from '@/src/features/stock/utils/stock-formatters';
import {
  buildStockFilterOptions,
  canFilterStockPartners,
  resolveActivePartnerName,
  resolveActiveStoreName,
  resolveActiveWarehouseName,
  stockFilterTitle,
  type StockFilterKey,
} from '@/src/features/stock/utils/stock-scope';
import { SectionLabel, TaskHeader, TaskHeaderIconButton } from './stox-primitives';

export function ScanTab({
  bootstrap,
  device,
  session,
  onRefresh,
}: {
  bootstrap: BootstrapResponse;
  device: DeviceIdentity | null;
  session: StoredSession;
  onRefresh: () => Promise<void>;
}) {
  const {
    error,
    enqueueStockAction,
    filters,
    isCachedSnapshot,
    isLoading,
    isRefreshing,
    isSyncingQueue,
    lastCachedAt,
    pendingActions,
    pendingActionCount,
    refreshStock,
    setFilters,
    stock,
    syncPendingActions,
  } = useStockWorkspace({
    bootstrap,
    device,
    session,
  });

  const canFilterPartners = canFilterStockPartners(bootstrap);
  const canPutaway = canUseStoxStockPutaway(bootstrap);
  const canMove = canUseStoxStockMove(bootstrap);
  const [activeFilter, setActiveFilter] = useState<StockFilterKey | null>(null);
  const partnerName = resolveActivePartnerName(stock, bootstrap, filters.tenantId);
  const storeName = resolveActiveStoreName(stock, bootstrap);
  const warehouseName = resolveActiveWarehouseName(stock, bootstrap);
  const filterOptions = useMemo(
    () => buildStockFilterOptions(activeFilter, stock, bootstrap, canFilterPartners),
    [activeFilter, bootstrap, canFilterPartners, stock],
  );

  const handleSync = useCallback(async () => {
    await onRefresh();
    await refreshStock();
  }, [onRefresh, refreshStock]);

  return (
    <>
      <TaskHeader
        title="Scan"
        action={(
          <TaskHeaderIconButton
            icon="refresh-cw"
            loading={isRefreshing || isSyncingQueue}
            onPress={handleSync}
          />
        )}
      />

      <SectionLabel
        title="Scope"
        trailing={isRefreshing || isSyncingQueue ? 'Syncing' : undefined}
      />

      <View style={styles.filterRow}>
        {canFilterPartners ? (
          <StockScopeFilterChip
            label="Partner"
            value={partnerName}
            onPress={() => setActiveFilter('tenant')}
          />
        ) : null}
        <StockScopeFilterChip
          label="Store"
          value={storeName}
          onPress={() => setActiveFilter('store')}
        />
        <StockScopeFilterChip
          label="Warehouse"
          value={warehouseName}
          onPress={() => setActiveFilter('warehouse')}
        />
      </View>

      {isLoading && !stock ? (
        <StockStateCard icon="loader" title="Loading" value="Preparing stock context" />
      ) : null}

      {error ? (
        <StockStateCard
          icon="alert-circle"
          title="Sync failed"
          value={error}
          actionLabel="Retry"
          onPress={() => {
            void refreshStock();
          }}
        />
      ) : null}

      {stock && !stock.tenantReady && !isLoading ? (
        <StockStateCard
          icon="shield-off"
          title="Stock access not ready"
          value="Check this account's WMS inventory permissions."
        />
      ) : null}

      <StockExecutionPanel
        canMove={canMove}
        canPutaway={canPutaway}
        device={device}
        filters={filters}
        session={session}
        onExecuted={handleSync}
        onQueued={enqueueStockAction}
      />

      {pendingActionCount > 0 ? (
        <StockStateCard
          icon="upload-cloud"
          title={`${pendingActionCount} queued`}
          value={formatPendingActionMessage(pendingActions)}
          actionLabel={isSyncingQueue ? 'Syncing' : 'Sync'}
          onPress={() => {
            void syncPendingActions();
          }}
        />
      ) : null}

      {isCachedSnapshot && lastCachedAt ? (
        <StockStateCard
          icon="wifi-off"
          title="Offline context"
          value={`Last synced ${formatStockDate(lastCachedAt)}`}
          actionLabel="Sync"
          onPress={() => {
            void handleSync();
          }}
        />
      ) : null}

      <StockScopeFilterModal
        title={stockFilterTitle[activeFilter ?? 'store']}
        visible={activeFilter !== null}
        options={filterOptions}
        onClose={() => setActiveFilter(null)}
        onSelect={(value) => {
          if (activeFilter === 'tenant') {
            setFilters((current) => ({
              ...current,
              tenantId: value,
              storeId: null,
            }));
          }

          if (activeFilter === 'store') {
            setFilters((current) => ({
              ...current,
              storeId: value,
            }));
          }

          if (activeFilter === 'warehouse') {
            setFilters((current) => ({
              ...current,
              warehouseId: value,
            }));
          }

          setActiveFilter(null);
        }}
      />
    </>
  );
}

function formatPendingActionMessage(
  actions: Array<{ action: string; unitCode: string; targetCode: string; lastError?: string | null }>,
) {
  const failed = actions.find((action) => action.lastError);
  if (failed) {
    return `${failed.unitCode}: ${failed.lastError}`;
  }

  const next = actions[actions.length - 1] ?? actions[0];
  if (!next) {
    return 'Waiting for sync';
  }

  return `${next.action === 'putaway' ? 'Putaway' : 'Move'} ${next.unitCode} to ${next.targetCode}`;
}

const styles = StyleSheet.create({
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
  },
});
