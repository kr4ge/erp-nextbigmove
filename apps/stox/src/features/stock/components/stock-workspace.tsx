import { useEffect, useMemo, useState, type ComponentProps, type ReactNode } from 'react';
import { Feather } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { BootstrapResponse, DeviceIdentity, StoredSession } from '@/src/features/auth/types';
import type { WmsMobilePickingTask } from '@/src/features/picking/types';
import {
  canUseAssignedRtsWorkspace,
  canUseStoxStockMove,
  canUseStoxStockPutaway,
} from '@/src/features/home/rbac';
import type { InventoryTaskView } from '@/src/features/home/types';
import { RtsTab } from '@/src/features/home/components/rts-tab';
import { PrimaryButton } from '@/src/shared/components/primary-button';
import { SurfaceCard } from '@/src/shared/components/surface-card';
import { tokens } from '@/src/shared/theme/tokens';
import { TaskHeaderIconButton } from '@/src/features/home/components/stox-primitives';
import { useStockWorkspace } from '../hooks/use-stock-workspace';
import { StockCountWorkspace } from './stock-count-workspace';
import { StockExecutionPanel } from './stock-execution-panel';
import { StockRecordCard } from './stock-record-card';
import { StockScopeFilterModal } from './stock-scope-filter';
import { formatStockCount, formatStockDate, joinStockMeta } from '../utils/stock-formatters';
import {
  buildStockFilterOptions,
  canFilterStockPartners,
  resolveActivePartnerName,
  resolveActiveStoreName,
  resolveActiveWarehouseName,
  type StockFilterKey,
} from '../utils/stock-scope';
import type { StockMode, WmsMobileBin, WmsMobileTrackingReturnFlow } from '../types';

type StockWorkspaceProps = {
  bootstrap: BootstrapResponse;
  device: DeviceIdentity | null;
  initialView?: InventoryTaskView;
  routeKey?: number;
  rtsInitialTask?: WmsMobilePickingTask | null;
  rtsInitialReturnFlow?: WmsMobileTrackingReturnFlow | null;
  session: StoredSession;
  onBack?: () => void;
  onRefresh: () => Promise<void>;
  variant?: 'task' | 'utility';
};

const STOCK_TASK_MODE_META: Array<{
  mode: StockMode;
  icon: ComponentProps<typeof Feather>['name'];
  label: string;
  readValue: (workspace: ReturnType<typeof useStockWorkspace>) => string;
}> = [
  {
    mode: 'putaway',
    icon: 'inbox',
    label: 'Putaway',
    readValue: (workspace) => formatStockCount(workspace.stock?.summary.putawayBatches ?? 0),
  },
  {
    mode: 'move',
    icon: 'repeat',
    label: 'Move',
    readValue: (workspace) => formatStockCount(workspace.stock?.summary.movableUnits ?? 0),
  },
];

const STOCK_UTILITY_MODE_META: Array<{
  mode: StockMode;
  icon: ComponentProps<typeof Feather>['name'];
  label: string;
  readValue: (workspace: ReturnType<typeof useStockWorkspace>) => string;
}> = [
  {
    mode: 'bins',
    icon: 'map-pin',
    label: 'Bins',
    readValue: (workspace) => formatStockCount(workspace.stock?.summary.bins ?? 0),
  },
  {
    mode: 'recent',
    icon: 'clock',
    label: 'Recent',
    readValue: (workspace) => formatStockCount(workspace.stock?.summary.transfers ?? 0),
  },
];

export function StockWorkspace({
  bootstrap,
  device,
  initialView,
  routeKey,
  rtsInitialReturnFlow = null,
  rtsInitialTask = null,
  session,
  onBack,
  onRefresh,
  variant = 'task',
}: StockWorkspaceProps) {
  const workspace = useStockWorkspace({
    bootstrap,
    device,
    initialMode: variant === 'task' ? 'putaway' : 'bins',
    session,
  });
  const [inventoryView, setInventoryView] = useState<InventoryTaskView>(
    variant === 'task' ? initialView ?? 'stock' : 'stock',
  );
  const [activeFilter, setActiveFilter] = useState<StockFilterKey | null>(null);
  const canPutaway = canUseStoxStockPutaway(bootstrap);
  const canMove = canUseStoxStockMove(bootstrap);
  const canUseRts = variant === 'task' && canUseAssignedRtsWorkspace(bootstrap);
  const allowPartnerFilter = canFilterStockPartners(bootstrap);
  const workspaceMode = workspace.mode;
  const setWorkspaceMode = workspace.setMode;
  const stockModes = useMemo(
    () => (variant === 'task' ? STOCK_TASK_MODE_META : STOCK_UTILITY_MODE_META),
    [variant],
  );
  const filterOptions = useMemo(
    () => buildStockFilterOptions(activeFilter, workspace.stock, bootstrap, allowPartnerFilter),
    [activeFilter, allowPartnerFilter, bootstrap, workspace.stock],
  );

  const activePartnerName = useMemo(
    () => resolveActivePartnerName(workspace.stock, bootstrap, workspace.filters.tenantId),
    [bootstrap, workspace.filters.tenantId, workspace.stock],
  );
  const activeStoreName = useMemo(
    () => resolveActiveStoreName(workspace.stock, bootstrap),
    [bootstrap, workspace.stock],
  );
  const activeWarehouseName = useMemo(
    () => resolveActiveWarehouseName(workspace.stock, bootstrap),
    [bootstrap, workspace.stock],
  );

  const queueSummary = useMemo(() => {
    if (!workspace.stock) {
      return {
        pending: '--',
      };
    }

    return {
      pending: formatStockCount(workspace.pendingActionCount),
    };
  }, [workspace.pendingActionCount, workspace.stock]);

  useEffect(() => {
    if (!stockModes.some((item) => item.mode === workspaceMode)) {
      setWorkspaceMode(stockModes[0]?.mode ?? 'putaway');
    }
  }, [setWorkspaceMode, stockModes, workspaceMode]);

  useEffect(() => {
    if (variant === 'utility' && inventoryView !== 'stock') {
      setInventoryView('stock');
    }
  }, [inventoryView, variant]);

  useEffect(() => {
    if (variant !== 'task' || !initialView) {
      return;
    }

    setInventoryView(initialView);
  }, [initialView, routeKey, variant]);

  useEffect(() => {
    if (inventoryView === 'rts' && !canUseRts) {
      setInventoryView('stock');
    }
  }, [canUseRts, inventoryView]);

  const modeLabel = inventoryView === 'count'
    ? 'Cycle Count'
    : inventoryView === 'rts'
      ? 'RTS'
    : stockModes.find((item) => item.mode === workspace.mode)?.label ?? 'Inventory';
  const shouldShowExecution =
    variant === 'task'
    && inventoryView === 'stock'
    && (workspace.mode === 'putaway' || workspace.mode === 'move');
  const taskModeSwitcher = variant === 'task' ? (
    <InventoryTaskCarousel compact>
      {stockModes.map((item) => (
        <InventoryModeCard
          key={item.mode}
          active={inventoryView === 'stock' && workspace.mode === item.mode}
          compact
          disabled={
            (item.mode === 'putaway' && !canPutaway)
            || (item.mode === 'move' && !canMove)
          }
          label={item.label}
          value={item.readValue(workspace)}
          onPress={() => {
            setInventoryView('stock');
            workspace.setMode(item.mode);
          }}
        />
      ))}
      <InventoryModeCard
        active={inventoryView === 'count'}
        compact
        label="Cycle Count"
        value="Audit"
        onPress={() => {
          setInventoryView('count');
        }}
      />
      {canUseRts ? (
        <InventoryModeCard
          active={inventoryView === 'rts'}
          compact
          label="RTS"
          value="Returns"
          onPress={() => {
            setInventoryView('rts');
          }}
        />
      ) : null}
    </InventoryTaskCarousel>
  ) : null;

  if (variant === 'task' && inventoryView === 'rts' && canUseRts) {
    return (
      <View style={styles.root}>
        <RtsTab
          bootstrap={bootstrap}
          device={device}
          initialReturnFlow={rtsInitialReturnFlow}
          initialTask={rtsInitialTask}
          modeSwitcher={taskModeSwitcher}
          session={session}
          onRefresh={onRefresh}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.taskQueueHeader}>
        <View style={styles.headerActionGroup}>
          {variant === 'utility' && onBack ? (
            <TaskHeaderIconButton icon="chevron-left" onPress={onBack} />
          ) : null}
          <TaskHeaderIconButton
            icon="refresh-cw"
            loading={workspace.isRefreshing}
            onPress={async () => {
              await workspace.refreshStock();
              await onRefresh();
            }}
          />
        </View>
        <Text style={styles.taskQueueHeaderTitle}>
          {variant === 'task' ? 'Inventory Tasks' : 'Inventory'}
        </Text>
        {variant === 'utility' && workspace.pendingActionCount > 0 ? (
          <TaskHeaderIconButton
            icon="upload-cloud"
            loading={workspace.isSyncingQueue}
            onPress={workspace.syncPendingActions}
          />
        ) : (
          <View style={styles.queueBellButton}>
            <Feather name="bell" size={18} color="#1F1F28" />
            <View style={styles.queueBellDot} />
          </View>
        )}
      </View>

      <View style={styles.queueFilterStack}>
        {allowPartnerFilter ? (
          <InventoryScopeDropdownCard
            icon="briefcase"
            label="Partner"
            value={activePartnerName}
            onPress={() => setActiveFilter('tenant')}
          />
        ) : null}
        <InventoryScopeDropdownCard
          icon="shopping-bag"
          label="Store"
          value={activeStoreName}
          onPress={() => setActiveFilter('store')}
        />
        <InventoryScopeDropdownCard
          icon="map-pin"
          label="Warehouse"
          value={activeWarehouseName}
          onPress={() => setActiveFilter('warehouse')}
        />
      </View>

      {variant === 'task' ? taskModeSwitcher : (
        <InventoryTaskCarousel compact>
          {stockModes.map((item) => (
            <InventoryModeCard
              key={item.mode}
              active={inventoryView === 'stock' && workspace.mode === item.mode}
              compact
              label={item.label}
              value={item.readValue(workspace)}
              onPress={() => {
                setInventoryView('stock');
                workspace.setMode(item.mode);
              }}
            />
          ))}
        </InventoryTaskCarousel>
      )}

      {variant === 'task' && workspace.pendingActionCount > 0 ? (
        <SurfaceCard style={styles.syncCard}>
          <View style={styles.syncCardTopRow}>
            <View style={styles.syncIconWrap}>
              <Feather name="upload-cloud" size={16} color="#6437F6" />
            </View>
            <View style={styles.syncCopyWrap}>
              <Text style={styles.syncTitle}>Pending sync</Text>
              <Text style={styles.syncCopy}>
                {queueSummary.pending} action{workspace.pendingActionCount === 1 ? '' : 's'}
              </Text>
            </View>
          </View>
          <PrimaryButton
            label={workspace.isSyncingQueue ? 'Syncing…' : 'Sync now'}
            loading={workspace.isSyncingQueue}
            onPress={workspace.syncPendingActions}
            style={styles.syncButton}
            variant="secondary"
          />
        </SurfaceCard>
      ) : null}

      {inventoryView === 'count' ? (
        <StockCountWorkspace
          bootstrap={bootstrap}
          device={device}
          filters={workspace.filters}
          session={session}
        />
      ) : null}

      {inventoryView === 'stock' && shouldShowExecution ? (
        <StockExecutionPanel
          canMove={canMove}
          canPutaway={canPutaway}
          device={device}
          filters={workspace.filters}
          session={session}
          onExecuted={workspace.refreshStock}
          onQueued={workspace.enqueueStockAction}
        />
      ) : null}

      {inventoryView === 'stock' && workspace.error ? (
        <SurfaceCard style={styles.stateCard}>
          <Text style={styles.stateTitle}>Inventory error</Text>
          <Text style={styles.stateCopy}>{workspace.error}</Text>
        </SurfaceCard>
      ) : null}

      {inventoryView === 'stock' && workspace.isCachedSnapshot ? (
        <SurfaceCard style={styles.stateCard}>
          <Text style={styles.stateTitle}>Offline snapshot</Text>
          <Text style={styles.stateCopy}>
            Last cached {workspace.lastCachedAt ? formatStockDate(workspace.lastCachedAt) : 'unknown'}.
          </Text>
        </SurfaceCard>
      ) : null}

      {inventoryView === 'stock' ? (
        <View style={variant === 'task' ? styles.taskList : styles.recordList}>
          {renderModeRecords(workspace, modeLabel, variant)}
        </View>
      ) : null}

      {inventoryView === 'stock' && workspace.hasMore ? (
        <PrimaryButton
          label={workspace.isLoadingMore ? 'Loading…' : 'Load more'}
          loading={workspace.isLoadingMore}
          variant="secondary"
          onPress={workspace.loadMore}
        />
      ) : null}

      <StockScopeFilterModal
        options={filterOptions}
        title={activeFilter === 'tenant' ? 'Partner scope' : activeFilter === 'warehouse' ? 'Warehouse scope' : 'Store scope'}
        visible={activeFilter !== null}
        onClose={() => setActiveFilter(null)}
        onSelect={(value) => {
          if (activeFilter === 'tenant') {
            workspace.setFilters((current) => ({
              ...current,
              tenantId: value,
              storeId: null,
            }));
          }

          if (activeFilter === 'store') {
            workspace.setFilters((current) => ({
              ...current,
              storeId: value,
            }));
          }

          if (activeFilter === 'warehouse') {
            workspace.setFilters((current) => ({
              ...current,
              warehouseId: value,
            }));
          }

          setActiveFilter(null);
        }}
      />
    </View>
  );
}

function InventoryScopeDropdownCard({
  icon,
  label,
  value,
  onPress,
}: {
  icon: ComponentProps<typeof Feather>['name'];
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.scopeDropdownWrap, pressed ? styles.scopeDropdownWrapPressed : null]}>
      <SurfaceCard style={styles.scopeDropdownCard}>
        <View style={styles.scopeDropdownIcon}>
          <Feather name={icon} size={15} color="#F55DB8" />
        </View>
        <View style={styles.scopeDropdownCopy}>
          <Text style={styles.scopeDropdownLabel}>{label}</Text>
          <Text numberOfLines={1} style={styles.scopeDropdownValue}>{value}</Text>
        </View>
        <Feather name="chevron-down" size={18} color="#2B2836" />
      </SurfaceCard>
    </Pressable>
  );
}

function InventoryTaskCarousel({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.dateCarousel, compact ? styles.compactModeCarousel : null]}>
      {children}
    </ScrollView>
  );
}

function InventoryModeCard({
  active,
  compact = false,
  disabled = false,
  label,
  value,
  onPress,
}: {
  active: boolean;
  compact?: boolean;
  disabled?: boolean;
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.dateCard,
        compact ? styles.compactModeCard : null,
        active ? styles.dateCardActive : null,
        pressed ? styles.dateCardPressed : null,
        disabled ? styles.dateCardDisabled : null,
        !compact && label === 'Cycle Count' ? styles.dateCardWide : null,
      ]}>
      <Text numberOfLines={1} style={[styles.inventoryLaneTitle, compact ? styles.compactModeTitle : null, active ? styles.dateCardDayActive : null]}>{label}</Text>
      <Text numberOfLines={1} style={[styles.inventoryLaneMeta, compact ? styles.compactModeMeta : null, active ? styles.dateCardWeekdayActive : null]}>{value}</Text>
    </Pressable>
  );
}

function renderModeRecords(
  workspace: ReturnType<typeof useStockWorkspace>,
  modeLabel: string,
  variant: 'task' | 'utility',
) {
  if (!workspace.stock) {
    if (workspace.isLoading) {
      return (
        <SurfaceCard style={styles.stateCard}>
          <Text style={styles.stateTitle}>Loading inventory</Text>
        </SurfaceCard>
      );
    }

    return null;
  }

  if (workspace.mode === 'putaway') {
    if (workspace.stock.putawayQueue.length === 0) {
      return (
        <SurfaceCard style={variant === 'task' ? styles.emptyCard : styles.stateCard}>
          <Text style={variant === 'task' ? styles.emptyTitle : styles.stateTitle}>No putaway</Text>
          <Text style={variant === 'task' ? styles.emptyCopy : styles.stateCopy}>No staged units.</Text>
        </SurfaceCard>
      );
    }

    return workspace.stock.putawayQueue.map((batch) => (
      variant === 'task' ? (
        <InventoryTaskRecordCard
          key={batch.id}
          badge={batch.statusLabel}
          icon="inbox"
          accent="#F55DB8"
          accentSoft="#FFE1F2"
          topLabel={batch.store.name}
          title={batch.code}
          summary={batch.stagingLocation?.code ?? 'No staging bin'}
          meta={`${formatStockCount(batch.unitCount)} unit${batch.unitCount === 1 ? '' : 's'} · ${batch.warehouse.code}`}
          footer={formatStockDate(batch.updatedAt)}
        />
      ) : (
        <StockRecordCard
          key={batch.id}
          badge={batch.statusLabel}
          icon="inbox"
          title={batch.code}
          subtitle={joinStockMeta([
            batch.store.name,
            batch.warehouse.name,
            batch.stagingLocation?.code ?? 'No staging bin',
          ])}
          meta={`${formatStockCount(batch.unitCount)} unit${batch.unitCount === 1 ? '' : 's'} · Updated ${formatStockDate(batch.updatedAt)}`}
        />
      )
    ));
  }

  if (workspace.mode === 'move') {
    if (workspace.stock.movableUnits.length === 0) {
      return (
        <SurfaceCard style={variant === 'task' ? styles.emptyCard : styles.stateCard}>
          <Text style={variant === 'task' ? styles.emptyTitle : styles.stateTitle}>No moves</Text>
          <Text style={variant === 'task' ? styles.emptyCopy : styles.stateCopy}>No movable units.</Text>
        </SurfaceCard>
      );
    }

    return workspace.stock.movableUnits.map((unit) => (
      variant === 'task' ? (
        <InventoryTaskRecordCard
          key={unit.id}
          badge={unit.statusLabel}
          icon="repeat"
          accent="#9C83FF"
          accentSoft="#F1E9FF"
          topLabel={unit.warehouse.name}
          title={unit.code}
          summary={unit.name}
          meta={unit.currentLocation?.code ?? 'No bin'}
          footer={formatStockDate(unit.updatedAt)}
        />
      ) : (
        <StockRecordCard
          key={unit.id}
          badge={unit.statusLabel}
          icon="repeat"
          title={unit.code}
          subtitle={joinStockMeta([
            unit.name,
            unit.currentLocation?.code ?? 'No bin',
            unit.warehouse.code,
          ])}
          meta={`Updated ${formatStockDate(unit.updatedAt)}`}
        />
      )
    ));
  }

  if (workspace.mode === 'bins') {
    if (workspace.stock.bins.length === 0) {
      return (
        <SurfaceCard style={styles.stateCard}>
          <Text style={styles.stateTitle}>No bins</Text>
        </SurfaceCard>
      );
    }

    return workspace.stock.bins.map((bin) => {
      const occupancy = bin.capacity === null
        ? `${formatStockCount(bin.occupiedUnits)} unit${bin.occupiedUnits === 1 ? '' : 's'} on hand`
        : `${formatStockCount(bin.occupiedUnits)} / ${formatStockCount(bin.capacity)} occupied`;
      const statusBadge = buildBinStatusBadge(bin);

      return (
        <InventoryTaskRecordCard
          key={bin.id}
          badge={statusBadge}
          icon="map-pin"
          accent="#F55DB8"
          accentSoft="#FFE1F2"
          footer="Live bin"
          footerIcon="box"
          meta={buildBinMeta(bin)}
          summary={occupancy}
          title={buildBinDisplayTitle(bin)}
          topLabel={bin.warehouse.name}
        />
      );
    });
  }

  if (workspace.stock.recentTransfers.length === 0) {
    return (
      <SurfaceCard style={styles.stateCard}>
        <Text style={styles.stateTitle}>No recent moves</Text>
      </SurfaceCard>
    );
  }

  return workspace.stock.recentTransfers.map((transfer) => (
    <InventoryTaskRecordCard
      key={transfer.id}
      badge={transfer.statusLabel}
      icon="clock"
      accent="#9C83FF"
      accentSoft="#F1E9FF"
      footer={formatStockDate(transfer.createdAt)}
      meta={joinStockMeta([
        `${formatStockCount(transfer.itemCount)} item${transfer.itemCount === 1 ? '' : 's'}`,
        transfer.actor?.name ?? 'Unknown actor',
      ])}
      summary={transfer.toLocation.code}
      title={transfer.code}
      topLabel={transfer.warehouse.name}
    />
  ));
}

function buildBinDisplayTitle(bin: WmsMobileBin) {
  const code = bin.code.trim();
  const name = bin.name.trim();
  const sectionName = getLocationDisplayName(bin.section);
  const rackCode = bin.rack?.code.trim() ?? '';

  if (sectionName && code) {
    return joinLocationTitleParts([
      sectionName,
      rackCode && !startsWithLocationPrefix(code, rackCode) ? rackCode : null,
      code,
    ]);
  }

  if (!name || isSameLocationLabel(name, code)) {
    return code;
  }

  return `${name}-${code}`;
}

function buildBinMeta(bin: { availableUnits: number | null; code: string; label: string; warehouse: { code: string } }) {
  const parts = [
    bin.availableUnits === null
      ? null
      : `${formatStockCount(bin.availableUnits)} available`,
    bin.warehouse.code,
  ].filter((part): part is string => Boolean(part));

  return parts.join(' · ') || bin.warehouse.code;
}

function buildBinStatusBadge(bin: { isFull: boolean }) {
  if (bin.isFull) {
    return 'Full';
  }

  return undefined;
}

function getLocationDisplayName(location?: { code: string; name: string } | null) {
  if (!location) {
    return null;
  }

  const name = location.name.trim();
  const code = location.code.trim();

  return name && !isSameLocationLabel(name, code) ? name : code || null;
}

function joinLocationTitleParts(parts: (string | null)[]) {
  const uniqueParts: string[] = [];

  for (const part of parts) {
    const value = part?.trim();
    if (!value) {
      continue;
    }

    if (uniqueParts.some((existing) => isSameLocationLabel(existing, value))) {
      continue;
    }

    uniqueParts.push(value);
  }

  return uniqueParts.join('-');
}

function startsWithLocationPrefix(value: string, prefix: string) {
  const normalizedValue = normalizeLocationLabel(value);
  const normalizedPrefix = normalizeLocationLabel(prefix);

  return Boolean(normalizedPrefix) && normalizedValue.startsWith(normalizedPrefix);
}

function isSameLocationLabel(left: string, right: string) {
  return normalizeLocationLabel(left) === normalizeLocationLabel(right);
}

function normalizeLocationLabel(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function InventoryTaskRecordCard({
  accent,
  accentSoft,
  badge,
  footer,
  footerIcon = 'clock',
  icon,
  meta,
  summary,
  title,
  topLabel,
}: {
  accent: string;
  accentSoft: string;
  badge?: string;
  footer: string;
  footerIcon?: ComponentProps<typeof Feather>['name'];
  icon: ComponentProps<typeof Feather>['name'];
  meta: string;
  summary: string;
  title: string;
  topLabel: string;
}) {
  return (
    <SurfaceCard style={styles.compactTaskCard}>
      <View style={styles.compactTopRow}>
        <Text numberOfLines={1} style={styles.compactStoreLabel}>{topLabel}</Text>
        <View style={[styles.compactIconBadge, { backgroundColor: accentSoft }]}>
          <Feather name={icon} size={14} color={accent} />
        </View>
      </View>

      <Text numberOfLines={1} selectable style={styles.compactOrderTitle}>{title}</Text>
      <Text numberOfLines={1} style={[styles.compactSummary, { color: accent }]}>{summary}</Text>
      <Text numberOfLines={2} style={styles.compactMetaText}>{meta}</Text>

      <View style={styles.compactFooterRow}>
        <View style={styles.compactDateMeta}>
          <Feather name={footerIcon} size={13} color="#9C83FF" />
          <Text style={styles.compactDateValue}>{footer}</Text>
        </View>
        {badge ? (
          <View style={styles.inventoryStatusBadge}>
            <Text numberOfLines={1} style={styles.inventoryStatusBadgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: tokens.spacing.lg,
  },
  taskQueueHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 2,
  },
  taskQueueHeaderTitle: {
    alignItems: 'center',
    color: '#24232D',
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  headerActionGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  queueBellButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    position: 'relative',
    width: 44,
  },
  queueBellDot: {
    backgroundColor: '#6437F6',
    borderColor: '#FBFAFF',
    borderRadius: 5,
    borderWidth: 2,
    height: 10,
    position: 'absolute',
    right: 9,
    top: 8,
    width: 10,
  },
  queueFilterStack: {
    gap: 12,
    marginBottom: 4,
  },
  scopeDropdownWrap: {
    borderRadius: 24,
  },
  scopeDropdownWrapPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.995 }],
  },
  scopeDropdownCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowColor: '#A38BFF',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
  },
  scopeDropdownIcon: {
    alignItems: 'center',
    backgroundColor: '#FFE1F2',
    borderRadius: 12,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  scopeDropdownCopy: {
    flex: 1,
    minWidth: 0,
  },
  scopeDropdownLabel: {
    color: '#8F8AAB',
    fontSize: 14,
    fontWeight: '600',
  },
  scopeDropdownValue: {
    color: '#24232D',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  dateCarousel: {
    gap: 8,
    paddingBottom: 4,
  },
  compactModeCarousel: {
    paddingBottom: 0,
  },
  dateCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    height: 80,
    justifyContent: 'center',
    shadowColor: '#9C83FF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    width: 88,
  },
  dateCardWide: {
    width: 96,
  },
  compactModeCard: {
    backgroundColor: '#EEE9FF',
    borderRadius: 14,
    borderWidth: 0,
    height: 54,
    paddingHorizontal: 16,
    shadowOpacity: 0,
    width: 116,
  },
  dateCardActive: {
    backgroundColor: '#6437F6',
  },
  dateCardPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }],
  },
  dateCardDisabled: {
    opacity: 0.46,
  },
  inventoryLaneTitle: {
    color: '#24232D',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginTop: 4,
    textAlign: 'center',
  },
  inventoryLaneMeta: {
    color: '#9A8CB6',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
  },
  compactModeTitle: {
    color: '#6F5BCB',
    fontSize: 14,
    marginTop: 0,
  },
  compactModeMeta: {
    color: '#6F5BCB',
    fontSize: 10,
  },
  dateCardDayActive: {
    color: '#FFFFFF',
  },
  dateCardWeekdayActive: {
    color: 'rgba(255,255,255,0.82)',
  },
  syncCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 18,
    shadowColor: '#9C83FF',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
  },
  syncCardTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  syncIconWrap: {
    alignItems: 'center',
    backgroundColor: '#EEE9FF',
    borderRadius: 14,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  syncCopyWrap: {
    flex: 1,
    minWidth: 0,
  },
  syncTitle: {
    color: '#24232D',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  syncCopy: {
    color: '#7B7791',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 2,
  },
  syncButton: {
    minHeight: 52,
  },
  recordList: {
    gap: tokens.spacing.sm,
  },
  taskList: {
    gap: 18,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    gap: 8,
    paddingVertical: 20,
    shadowColor: '#9C83FF',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.07,
    shadowRadius: 20,
  },
  emptyTitle: {
    color: '#24232D',
    fontSize: 17,
    fontWeight: '800',
  },
  emptyCopy: {
    color: '#7B7791',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  stateCard: {
    gap: tokens.spacing.xs,
  },
  stateTitle: {
    color: tokens.colors.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  stateCopy: {
    color: tokens.colors.inkMuted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  compactTaskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 18,
    shadowColor: '#A38BFF',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 22,
  },
  compactTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  compactStoreLabel: {
    color: '#7B7791',
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    marginRight: 12,
  },
  compactIconBadge: {
    alignItems: 'center',
    borderRadius: 12,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  compactOrderTitle: {
    color: '#24232D',
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  compactSummary: {
    fontSize: 14,
    fontWeight: '700',
  },
  compactMetaText: {
    color: '#524F66',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  compactFooterRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  compactDateMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  compactDateValue: {
    color: '#8F8AAB',
    fontSize: 12,
    fontWeight: '700',
  },
  inventoryStatusBadge: {
    alignItems: 'center',
    backgroundColor: '#F4F0FF',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 28,
    paddingHorizontal: 10,
  },
  inventoryStatusBadgeText: {
    color: '#6437F6',
    fontSize: 11,
    fontWeight: '800',
  },
});
