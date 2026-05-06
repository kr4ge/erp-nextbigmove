import { useCallback, useEffect, useMemo, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { BootstrapResponse, DeviceIdentity, StoredSession } from '@/src/features/auth/types';
import { StockActionTile } from '@/src/features/stock/components/stock-action-tile';
import { StockExecutionPanel } from '@/src/features/stock/components/stock-execution-panel';
import { StockRecordCard } from '@/src/features/stock/components/stock-record-card';
import { useStockWorkspace } from '@/src/features/stock/hooks/use-stock-workspace';
import type { StockMode, WmsMobileStockResponse } from '@/src/features/stock/types';
import {
  formatStockCount,
  formatStockDate,
  joinStockMeta,
} from '@/src/features/stock/utils/stock-formatters';
import { SurfaceCard } from '@/src/shared/components/surface-card';
import { tokens } from '@/src/shared/theme/tokens';
import { resolveEntityName } from '../utils';
import { SectionLabel, UtilityPill } from './stox-primitives';

type FilterKey = 'tenant' | 'store' | 'warehouse';

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
  const canFilterPartners = bootstrap.user.role === 'SUPER_ADMIN';
  const [activeFilter, setActiveFilter] = useState<FilterKey | null>(null);
  const filterOptions = useMemo(
    () => buildFilterOptions(activeFilter, stock, bootstrap, canFilterPartners),
    [activeFilter, bootstrap, canFilterPartners, stock],
  );

  const handleSync = useCallback(async () => {
    await onRefresh();
    await refreshStock();
  }, [onRefresh, refreshStock]);

  return (
    <>
      <SurfaceCard tone="panel" style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>Stock</Text>
            <View style={styles.heroPills}>
              <UtilityPill icon="map-pin" label={warehouseName} tone="panel" />
              <UtilityPill icon="shopping-bag" label={storeName} tone="panel" />
            </View>
          </View>

          <View style={styles.heroIcon}>
            <Feather name="box" size={22} color={tokens.colors.panel} />
          </View>
        </View>

        <View style={styles.heroMetrics}>
          <HeroMetric label="Units" value={formatStockCount(summary?.totalUnits ?? 0)} />
          <HeroMetric label="Staged" value={formatStockCount(summary?.stagedUnits ?? 0)} />
          <HeroMetric label="Ready" value={formatStockCount(summary?.movableUnits ?? 0)} />
        </View>
      </SurfaceCard>

      <SectionLabel title="Scope" />

      <View style={styles.filterRow}>
        {canFilterPartners ? (
          <StockFilterChip
            label="Partner"
            value={partnerName}
            onPress={() => setActiveFilter('tenant')}
          />
        ) : null}
        <StockFilterChip
          label="Store"
          value={storeName}
          onPress={() => setActiveFilter('store')}
        />
        <StockFilterChip
          label="Warehouse"
          value={warehouseName}
          onPress={() => setActiveFilter('warehouse')}
        />
      </View>

      <StockExecutionPanel
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
        title="Actions"
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
        <StockActionTile
          disabled={isRefreshing || isSyncingQueue}
          icon="refresh-cw"
          label="Sync"
          value={isRefreshing || isSyncingQueue ? '...' : pendingActionCount > 0 ? `${pendingActionCount}` : 'Now'}
          onPress={() => {
            void handleSync();
          }}
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

      <StockFilterModal
        title={filterTitle[activeFilter ?? 'store']}
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

function HeroMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.heroMetric}>
      <Text numberOfLines={1} style={styles.heroMetricValue}>{value}</Text>
      <Text numberOfLines={1} style={styles.heroMetricLabel}>{label}</Text>
    </View>
  );
}

function StockStateCard({
  actionLabel,
  icon,
  onPress,
  title,
  value,
}: {
  actionLabel?: string;
  icon: keyof typeof Feather.glyphMap;
  onPress?: () => void;
  title: string;
  value: string;
}) {
  return (
    <SurfaceCard style={styles.stateCard}>
      <View style={styles.stateIcon}>
        <Feather name={icon} size={18} color={tokens.colors.panel} />
      </View>
      <View style={styles.stateCopy}>
        <Text numberOfLines={1} style={styles.stateTitle}>{title}</Text>
        <Text numberOfLines={2} style={styles.stateValue}>{value}</Text>
      </View>
      {actionLabel && onPress ? (
        <Text onPress={onPress} style={styles.stateAction}>{actionLabel}</Text>
      ) : null}
    </SurfaceCard>
  );
}

function StockFilterChip({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.filterChip, pressed ? styles.filterChipPressed : null]}>
      <Text numberOfLines={1} style={styles.filterLabel}>{label}</Text>
      <View style={styles.filterValueRow}>
        <Text numberOfLines={1} style={styles.filterValue}>{value}</Text>
        <Feather name="chevron-down" size={14} color={tokens.colors.inkMuted} />
      </View>
    </Pressable>
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

function StockFilterModal({
  options,
  title,
  visible,
  onClose,
  onSelect,
}: {
  options: Array<{ label: string; value: string | null; meta?: string }>;
  title: string;
  visible: boolean;
  onClose: () => void;
  onSelect: (value: string | null) => void;
}) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!visible) {
      setQuery('');
    }
  }, [visible]);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) => {
      if (option.value === null) {
        return true;
      }

      return [option.label, option.meta]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalizedQuery));
    });
  }, [options, query]);

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Pressable onPress={onClose} style={styles.modalClose}>
              <Feather name="x" size={18} color={tokens.colors.ink} />
            </Pressable>
          </View>

          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Search"
            placeholderTextColor={tokens.colors.inkSoft}
            value={query}
            onChangeText={setQuery}
            style={styles.modalSearch}
          />

          <FlatList
            data={filteredOptions}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(option) => option.value ?? 'all'}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => onSelect(item.value)}
                style={({ pressed }) => [
                  styles.modalOption,
                  pressed ? styles.modalOptionPressed : null,
                ]}>
                <Text numberOfLines={1} style={styles.modalOptionLabel}>{item.label}</Text>
                {item.meta ? (
                  <Text numberOfLines={1} style={styles.modalOptionMeta}>{item.meta}</Text>
                ) : null}
              </Pressable>
            )}
            ListEmptyComponent={<Text style={styles.modalEmpty}>No match</Text>}
            ItemSeparatorComponent={() => <View style={styles.modalSeparator} />}
            initialNumToRender={14}
            maxToRenderPerBatch={16}
            windowSize={8}
            style={styles.modalOptions}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function buildFilterOptions(
  activeFilter: FilterKey | null,
  stock: WmsMobileStockResponse | null,
  bootstrap: BootstrapResponse,
  canFilterPartners: boolean,
) {
  if (activeFilter === 'tenant' && canFilterPartners) {
    const stockPartners = stock?.context.tenantOptions ?? [];
    const bootstrapPartners = bootstrap.context.tenantOptions ?? [];
    const partners = stockPartners.length > 0 ? stockPartners : bootstrapPartners;

    return [
      { label: 'All partners', value: null },
      ...partners.map((partner) => ({
        label: partner.name,
        value: partner.id,
        meta: partner.slug,
      })),
    ];
  }

  if (activeFilter === 'warehouse') {
    const stockWarehouses = stock?.context.warehouses ?? [];
    const warehouses = stockWarehouses.length > 0 ? stockWarehouses : bootstrap.context.warehouses;

    return [
      { label: 'All warehouses', value: null },
      ...warehouses.map((warehouse) => ({
        label: warehouse.name,
        value: warehouse.id,
        meta: warehouse.code,
      })),
    ];
  }

  const stockStores = stock?.context.stores ?? [];
  const stores = stockStores.length > 0 ? stockStores : bootstrap.context.stores;

  return [
    { label: 'All stores', value: null },
    ...stores.map((store) => ({
      label: store.name,
      value: store.id,
      meta: 'tenantName' in store && typeof store.tenantName === 'string'
        ? store.tenantName
        : undefined,
    })),
  ];
}

function resolveActivePartnerName(
  stock: WmsMobileStockResponse | null,
  bootstrap: BootstrapResponse,
  activeTenantId: string | null,
) {
  if (!activeTenantId) {
    return 'All partners';
  }

  const stockPartners = stock?.context.tenantOptions ?? [];
  const bootstrapPartners = bootstrap.context.tenantOptions ?? [];
  const partners = stockPartners.length > 0 ? stockPartners : bootstrapPartners;
  const activePartner = partners.find((partner) => partner.id === activeTenantId);

  return activePartner?.name ?? 'Partner';
}

function resolveActiveStoreName(stock: WmsMobileStockResponse | null, bootstrap: BootstrapResponse) {
  if (stock && !stock.context.activeStoreId) {
    return 'All stores';
  }

  const stockStores = stock?.context.stores ?? [];
  const stores = stockStores.length > 0 ? stockStores : bootstrap.context.stores;
  const activeStoreId = stock?.context.activeStoreId ?? bootstrap.context.defaultStoreId;
  const activeStore = stores.find((store) => store.id === activeStoreId);

  return activeStore?.name ?? resolveEntityName(bootstrap.context.stores, bootstrap.context.defaultStoreId);
}

function resolveActiveWarehouseName(stock: WmsMobileStockResponse | null, bootstrap: BootstrapResponse) {
  if (stock && !stock.context.activeWarehouseId) {
    return 'All warehouses';
  }

  const stockWarehouses = stock?.context.warehouses ?? [];
  const warehouses = stockWarehouses.length > 0 ? stockWarehouses : bootstrap.context.warehouses;
  const activeWarehouseId = stock?.context.activeWarehouseId ?? bootstrap.context.defaultWarehouseId;
  const activeWarehouse = warehouses.find((warehouse) => warehouse.id === activeWarehouseId);

  return (
    activeWarehouse?.name
    ?? resolveEntityName(bootstrap.context.warehouses, bootstrap.context.defaultWarehouseId, 'name')
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

const filterTitle: Record<FilterKey, string> = {
  tenant: 'Partner',
  store: 'Store',
  warehouse: 'Warehouse',
};

const styles = StyleSheet.create({
  heroCard: {
    gap: tokens.spacing.lg,
  },
  heroHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroCopy: {
    flex: 1,
    gap: tokens.spacing.sm,
    paddingRight: tokens.spacing.md,
  },
  heroTitle: {
    color: tokens.colors.surface,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -1,
  },
  heroPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: tokens.colors.accentSoft,
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  heroMetrics: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  heroMetric: {
    backgroundColor: 'rgba(255,255,255,0.11)',
    borderRadius: tokens.radius.md,
    flex: 1,
    minWidth: 0,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.sm,
  },
  heroMetricValue: {
    color: tokens.colors.surface,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  heroMetricLabel: {
    color: tokens.colors.accentSoft,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
  },
  filterChip: {
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    flexGrow: 1,
    minWidth: 104,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  filterChipPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  filterLabel: {
    color: tokens.colors.inkSoft,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  filterValueRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: tokens.spacing.xs,
    marginTop: 3,
  },
  filterValue: {
    color: tokens.colors.ink,
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    minWidth: 0,
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
  stateCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: tokens.spacing.md,
    minHeight: 82,
  },
  stateIcon: {
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: tokens.radius.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  stateCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  stateTitle: {
    color: tokens.colors.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  stateValue: {
    color: tokens.colors.inkMuted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  stateAction: {
    color: tokens.colors.accentStrong,
    fontSize: 13,
    fontWeight: '900',
  },
  modalBackdrop: {
    backgroundColor: 'rgba(18, 54, 79, 0.42)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: tokens.colors.surface,
    borderTopLeftRadius: tokens.radius.xl,
    borderTopRightRadius: tokens.radius.xl,
    gap: tokens.spacing.md,
    maxHeight: '72%',
    padding: tokens.spacing.lg,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalTitle: {
    color: tokens.colors.ink,
    fontSize: 20,
    fontWeight: '900',
  },
  modalClose: {
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: tokens.radius.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  modalSearch: {
    backgroundColor: tokens.colors.surfaceMuted,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    color: tokens.colors.ink,
    fontSize: 15,
    fontWeight: '700',
    minHeight: 48,
    paddingHorizontal: tokens.spacing.md,
  },
  modalOptions: {},
  modalOption: {
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: tokens.radius.md,
    minHeight: 58,
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  modalOptionPressed: {
    opacity: 0.82,
  },
  modalSeparator: {
    height: tokens.spacing.sm,
  },
  modalEmpty: {
    color: tokens.colors.inkMuted,
    fontSize: 14,
    fontWeight: '700',
    paddingVertical: tokens.spacing.lg,
    textAlign: 'center',
  },
  modalOptionLabel: {
    color: tokens.colors.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  modalOptionMeta: {
    color: tokens.colors.inkMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
});
