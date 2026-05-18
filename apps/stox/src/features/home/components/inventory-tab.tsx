import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { BootstrapResponse, DeviceIdentity, StoredSession } from '@/src/features/auth/types';
import {
  canUseStoxStockMove,
  canUseStoxStockPutaway,
} from '@/src/features/home/rbac';
import { StockActionTile } from '@/src/features/stock/components/stock-action-tile';
import { StockExecutionPanel } from '@/src/features/stock/components/stock-execution-panel';
import { StockRecordCard } from '@/src/features/stock/components/stock-record-card';
import {
  StockScopeFilterChip,
  StockScopeFilterModal,
} from '@/src/features/stock/components/stock-scope-filter';
import { StockStateCard } from '@/src/features/stock/components/stock-state-card';
import { useStockWorkspace } from '@/src/features/stock/hooks/use-stock-workspace';
import type { StockMode, WmsMobileStockResponse } from '@/src/features/stock/types';
import {
  formatStockCount,
  formatStockDate,
  joinStockMeta,
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
import { tokens } from '@/src/shared/theme/tokens';
import { SectionLabel, TaskHeader, TaskHeaderIconButton } from './stox-primitives';

export function InventoryTab({
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
    activeCount,
    activeTotal,
    error,
    enqueueStockAction,
    hasMore,
    isCachedSnapshot,
    isLoading,
    isLoadingMore,
    isRefreshing,
    isSyncingQueue,
    lastCachedAt,
    filters,
    loadMore,
    mode,
    pendingActions,
    pendingActionCount,
    refreshStock,
    setFilters,
    setMode,
    syncPendingActions,
    stock,
  } = useStockWorkspace({
    bootstrap,
    device,
    session,
  });

  const storeName = resolveActiveStoreName(stock, bootstrap);
  const warehouseName = resolveActiveWarehouseName(stock, bootstrap);
  const partnerName = resolveActivePartnerName(stock, bootstrap, filters.tenantId);
  const summary = stock?.summary;
  const canFilterPartners = canFilterStockPartners(bootstrap);
  const canPutaway = canUseStoxStockPutaway(bootstrap);
  const canMove = canUseStoxStockMove(bootstrap);
  const [activeFilter, setActiveFilter] = useState<StockFilterKey | null>(null);
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
        title="Stock"
        action={(
          <TaskHeaderIconButton
            icon="refresh-cw"
            loading={isRefreshing || isSyncingQueue}
            onPress={handleSync}
          />
        )}
      />

      <SectionLabel title="Scope" />

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
          title={`${pendingActionCount} pending`}
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
          title="Offline view"
          value={`Last synced ${formatStockDate(lastCachedAt)}`}
        />
      ) : null}

      <SectionLabel
        title="Views"
        trailing={isRefreshing || isSyncingQueue ? 'Syncing' : undefined}
      />

      <View style={styles.actionRow}>
        <StockActionTile
          active={mode === 'putaway'}
          icon="inbox"
          label="Putaway"
          value={formatStockCount(summary?.putawayBatches ?? 0)}
          onPress={() => setMode('putaway')}
        />
        <StockActionTile
          active={mode === 'move'}
          icon="repeat"
          label="Move"
          value={formatStockCount(summary?.movableUnits ?? 0)}
          onPress={() => setMode('move')}
        />
      </View>

      <View style={styles.actionRow}>
        <StockActionTile
          active={mode === 'bins'}
          icon="map-pin"
          label="Bins"
          value={formatStockCount(summary?.bins ?? 0)}
          onPress={() => setMode('bins')}
        />
        <StockActionTile
          active={mode === 'recent'}
          icon="clock"
          label="Recent"
          value={formatStockCount(summary?.transfers ?? 0)}
          onPress={() => setMode('recent')}
        />
      </View>

      <SectionLabel
        title={modeCopy[mode].title}
        trailing={isLoading && !stock ? 'Loading' : formatLoadedCount(activeCount, activeTotal)}
      />

      {isLoading && !stock ? (
        <StockStateCard icon="loader" title="Loading" value="Syncing stock" />
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
          title="Access blocked"
          value="Use a WMS Web account with Stock access."
        />
      ) : null}

      {stock && stock.tenantReady && !isLoading
        ? renderStockMode({
            hasMore,
            isLoadingMore,
            mode,
            stock,
            onLoadMore: loadMore,
          })
        : null}

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

function renderStockMode({
  hasMore,
  isLoadingMore,
  mode,
  stock,
  onLoadMore,
}: {
  hasMore: boolean;
  isLoadingMore: boolean;
  mode: StockMode;
  stock: WmsMobileStockResponse;
  onLoadMore: () => Promise<void>;
}) {
  if (mode === 'putaway') {
    if (stock.putawayQueue.length === 0) {
      return <StockStateCard icon="check-circle" title="Clear" value="No putaway" />;
    }

    return (
      <View style={styles.list}>
        {stock.putawayQueue.map((batch) => (
          <StockRecordCard
            key={batch.id}
            badge={batch.statusLabel}
            icon="inbox"
            title={batch.code}
            subtitle={joinStockMeta([
              `${formatStockCount(batch.unitCount)} units`,
              batch.stagingLocation?.code ?? 'Stage',
            ])}
            meta={joinStockMeta([batch.warehouse.code, formatStockDate(batch.updatedAt)])}
          />
        ))}
        <StockListFooter
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          onLoadMore={onLoadMore}
        />
      </View>
    );
  }

  if (mode === 'move') {
    if (stock.movableUnits.length === 0) {
      return <StockStateCard icon="check-circle" title="Clear" value="No movable units" />;
    }

    return (
      <View style={styles.list}>
        {stock.movableUnits.map((unit) => (
          <StockRecordCard
            key={unit.id}
            badge={unit.statusLabel}
            icon="box"
            title={unit.code}
            subtitle={unit.name}
            meta={joinStockMeta([
              unit.currentLocation?.code ?? 'No bin',
              unit.warehouse.code,
              formatStockDate(unit.updatedAt),
            ])}
          />
        ))}
        <StockListFooter
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          onLoadMore={onLoadMore}
        />
      </View>
    );
  }

  if (mode === 'bins') {
    if (stock.bins.length === 0) {
      return <StockStateCard icon="map-pin" title="Empty" value="No bins" />;
    }

    return (
      <View style={styles.list}>
        {stock.bins.map((bin) => (
          <StockRecordCard
            key={bin.id}
            badge={formatBinBadge(bin)}
            icon="map-pin"
            title={bin.code}
            subtitle={bin.name}
            meta={joinStockMeta([bin.warehouse.code, bin.isFull ? 'Full' : 'Open'])}
          />
        ))}
        <StockListFooter
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          onLoadMore={onLoadMore}
        />
      </View>
    );
  }

  if (stock.recentTransfers.length === 0) {
    return <StockStateCard icon="clock" title="None" value="No moves yet" />;
  }

  return (
    <View style={styles.list}>
      {stock.recentTransfers.map((transfer) => (
        <StockRecordCard
          key={transfer.id}
          badge={`${formatStockCount(transfer.itemCount)} units`}
          icon="repeat"
          title={transfer.code}
          subtitle={`${transfer.fromLocation?.code ?? 'Origin'} > ${transfer.toLocation.code}`}
          meta={joinStockMeta([
            transfer.actor?.name ?? 'System',
            formatStockDate(transfer.createdAt),
          ])}
        />
      ))}
      <StockListFooter
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={onLoadMore}
      />
    </View>
  );
}

function StockListFooter({
  hasMore,
  isLoadingMore,
  onLoadMore,
}: {
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => Promise<void>;
}) {
  if (!hasMore) {
    return null;
  }

  return (
    <Pressable
      disabled={isLoadingMore}
      onPress={() => {
        void onLoadMore();
      }}
      style={({ pressed }) => [
        styles.loadMoreButton,
        pressed && !isLoadingMore ? styles.loadMoreButtonPressed : null,
        isLoadingMore ? styles.loadMoreButtonDisabled : null,
      ]}>
      <Text style={styles.loadMoreText}>{isLoadingMore ? 'Loading' : 'Load more'}</Text>
    </Pressable>
  );
}

function formatBinBadge(bin: WmsMobileStockResponse['bins'][number]) {
  if (bin.capacity === null) {
    return formatStockCount(bin.occupiedUnits);
  }

  return `${formatStockCount(bin.occupiedUnits)}/${formatStockCount(bin.capacity)}`;
}

function formatLoadedCount(loaded: number, total: number) {
  if (total > loaded) {
    return `${formatStockCount(loaded)}/${formatStockCount(total)}`;
  }

  return formatStockCount(loaded);
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

const modeCopy: Record<StockMode, { title: string }> = {
  putaway: { title: 'Putaway' },
  move: { title: 'Move' },
  bins: { title: 'Bins' },
  recent: { title: 'Recent' },
};

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
  },
  list: {
    gap: tokens.spacing.sm,
  },
  loadMoreButton: {
    alignItems: 'center',
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  loadMoreButtonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  loadMoreButtonDisabled: {
    opacity: 0.58,
  },
  loadMoreText: {
    color: tokens.colors.panel,
    fontSize: 13,
    fontWeight: '900',
  },
});
