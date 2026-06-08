import { useCallback, useEffect, useMemo, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { BootstrapResponse, DeviceIdentity, StoredSession } from '@/src/features/auth/types';
import { SurfaceCard } from '@/src/shared/components/surface-card';
import { tokens } from '@/src/shared/theme/tokens';
import type { InventoryTaskView, StoxTabKey, StoxTaskMode } from '../types';
import {
  canUseAssignedRtsWorkspace,
  canUseAssignedInventoryWorkspace,
  canUseInventoryWorkspace,
  canUsePackWorkspace,
  canUsePickWorkspace,
} from '../rbac';
import {
  fetchMobileHomeInventorySummary,
  fetchMobileHomeTaskSummary,
  type WmsMobileHomeInventorySummaryResponse,
} from '../services/home-api';
import { getDisplayName, getInitials } from '../utils';

type HomeOverviewTabProps = {
  bootstrap: BootstrapResponse;
  device: DeviceIdentity | null;
  session: StoredSession;
  onChangeTab: (tab: StoxTabKey) => void;
  onOpenStock: () => void;
  onOpenTaskRoute: (route: { inventoryView?: InventoryTaskView; mode: StoxTaskMode }) => void;
  onOpenRts: () => void;
};

type HomeSnapshot = {
  stock: WmsMobileHomeInventorySummaryResponse | null;
  pickablePickTasks: number;
  packablePackTasks: number;
  completedPickToday: number;
  completedPackToday: number;
  pickFilters: {
    todo: number;
    partial: number;
    inProgress: number;
    picked: number;
  };
  packFilters: {
    awaiting: number;
    packing: number;
    noTracking: number;
    packed: number;
  };
  inventoryGroups: {
    putaway: number;
    move: number;
    cycleCount: number;
  };
  taskGroups: {
    restocking: number;
    packingWithoutTracking: number;
    delivered: number;
    rts: number;
  };
};

type HomeIdentity = 'all' | 'pick' | 'pack' | 'inventory';
type HomeActionTarget =
  | 'inventory-count'
  | 'inventory-tasks'
  | 'inventory-utility'
  | 'pack-tasks'
  | 'pick-tasks'
  | 'rts';
type HomeActionCard = {
  accent: string;
  icon: keyof typeof Feather.glyphMap;
  id: string;
  label: string;
  soft: string;
  target: HomeActionTarget;
  value: number;
};
type HomePrimarySummary = {
  badge: string;
  label: string;
  target: HomeActionTarget;
  value: number;
};

const NUMBER_FORMATTER = new Intl.NumberFormat('en-US');

export function HomeOverviewTab({
  bootstrap,
  device,
  session,
  onChangeTab,
  onOpenStock,
  onOpenTaskRoute,
  onOpenRts,
}: HomeOverviewTabProps) {
  const [snapshot, setSnapshot] = useState<HomeSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const displayName = getDisplayName(bootstrap.user);
  const initials = getInitials(displayName);
  const canLoadPick = canUsePickWorkspace(bootstrap);
  const canLoadPack = canUsePackWorkspace(bootstrap);
  const canLoadInventory = canUseInventoryWorkspace(bootstrap);
  const canLoadInventoryTask = canUseAssignedInventoryWorkspace(bootstrap);
  const canLoadRts = canUseAssignedRtsWorkspace(bootstrap);
  const tenantId = bootstrap.tenant?.id ?? null;
  const storeId = bootstrap.context.defaultStoreId ?? null;
  const warehouseId = bootstrap.context.defaultWarehouseId ?? null;

  const loadHome = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (!device) {
      setError('Device is not ready yet.');
      setIsLoading(false);
      return;
    }

    if (mode === 'initial') {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    setError(null);

    try {
      const [stockResult, taskSummaryResult] = await Promise.allSettled([
        fetchMobileHomeInventorySummary({
          accessToken: session.accessToken,
          device,
          storeId,
          tenantId,
          warehouseId,
        }),
        canLoadPick || canLoadPack || canLoadRts || canLoadInventory || canLoadInventoryTask
          ? fetchMobileHomeTaskSummary({
            accessToken: session.accessToken,
            device,
            tenantId,
            storeId: null,
          })
          : Promise.resolve(null),
      ]);

      const stock = stockResult.status === 'fulfilled' ? stockResult.value : null;
      const taskSummary = taskSummaryResult.status === 'fulfilled' ? taskSummaryResult.value : null;
      const completedToday = taskSummary?.summary.completedToday ?? { packed: 0, picked: 0 };

      const errors = [
        stockResult.status === 'rejected' ? stockResult.reason : null,
        taskSummaryResult.status === 'rejected' ? taskSummaryResult.reason : null,
      ].filter(Boolean);

      setSnapshot({
        completedPackToday: completedToday.packed,
        completedPickToday: completedToday.picked,
        pickFilters: {
          inProgress: canLoadPick ? taskSummary?.summary.pick.inPicking ?? 0 : 0,
          partial: canLoadPick ? taskSummary?.summary.pick.partial ?? 0 : 0,
          picked: canLoadPick
            ? (taskSummary?.summary.pick.readyForPack ?? 0) + (taskSummary?.summary.pick.picked ?? 0)
            : 0,
          todo: canLoadPick ? taskSummary?.summary.pick.ready ?? 0 : 0,
        },
        packFilters: {
          awaiting: canLoadPack ? taskSummary?.summary.pack.picked ?? 0 : 0,
          packing: canLoadPack ? taskSummary?.summary.pack.packing ?? 0 : 0,
          noTracking: canLoadPack ? taskSummary?.summary.pack.awaitingTracking ?? 0 : 0,
          packed: canLoadPack ? taskSummary?.summary.pack.packed ?? 0 : 0,
        },
        inventoryGroups: {
          cycleCount: stock ? stock.summary.unitsOnHand ?? 0 : 0,
          move: stock ? stock.summary.movableUnits ?? 0 : 0,
          putaway: stock ? stock.summary.stagedUnits ?? 0 : 0,
        },
        packablePackTasks: canLoadPack ? taskSummary?.summary.pack.total ?? 0 : 0,
        pickablePickTasks: canLoadPick ? taskSummary?.summary.pick.total ?? 0 : 0,
        stock,
        taskGroups: taskSummary?.summary.groups ?? {
          delivered: 0,
          packingWithoutTracking: 0,
          restocking: 0,
          rts: 0,
        },
      });

      setError(
        errors.length > 0
          ? errors[0] instanceof Error
            ? errors[0].message
            : 'Some live Home data could not be loaded.'
          : null,
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load Home.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [
    canLoadInventory,
    canLoadInventoryTask,
    canLoadPack,
    canLoadPick,
    canLoadRts,
    device,
    session.accessToken,
    storeId,
    tenantId,
    warehouseId,
  ]);

  useEffect(() => {
    void loadHome('initial');
  }, [loadHome]);

  const homeIdentity = useMemo(() => {
    const assignment = bootstrap.operations?.taskAssignment;
    const isSuperAdmin = bootstrap.user.role === 'SUPER_ADMIN';

    if (isSuperAdmin || (canLoadPick && canLoadPack && !assignment)) {
      return 'all';
    }

    if (assignment === 'PICK') {
      return 'pick';
    }

    if (assignment === 'PACK') {
      return 'pack';
    }

    if (assignment === 'INVENTORY') {
      return 'inventory';
    }

    if (canLoadPick && !canLoadPack) {
      return 'pick';
    }

    if (canLoadPack && !canLoadPick) {
      return 'pack';
    }

    if (canLoadInventoryTask && !canLoadPick && !canLoadPack) {
      return 'inventory';
    }

    if (canLoadInventory && !canLoadPick && !canLoadPack) {
      return 'inventory';
    }

    return 'all';
  }, [bootstrap.operations?.taskAssignment, bootstrap.user.role, canLoadInventory, canLoadInventoryTask, canLoadPack, canLoadPick]);

  const primarySummary = useMemo(
    () => buildPrimarySummary(homeIdentity, snapshot, {
      canLoadInventory,
      canLoadInventoryTask,
      canLoadPack,
      canLoadPick,
      canLoadRts,
    }),
    [canLoadInventory, canLoadInventoryTask, canLoadPack, canLoadPick, canLoadRts, homeIdentity, snapshot],
  );
  const actionCards = useMemo(
    () => buildHomeActionCards(homeIdentity, snapshot, {
      canLoadInventory,
      canLoadInventoryTask,
      canLoadPack,
      canLoadPick,
      canLoadRts,
    }),
    [canLoadInventory, canLoadInventoryTask, canLoadPack, canLoadPick, canLoadRts, homeIdentity, snapshot],
  );

  const openHomeTarget = useCallback((target: HomeActionTarget) => {
    if (target === 'inventory-utility') {
      onOpenStock();
      return;
    }

    if (target === 'inventory-tasks') {
      onOpenTaskRoute({ inventoryView: 'stock', mode: 'inventory' });
      return;
    }

    if (target === 'inventory-count') {
      onOpenTaskRoute({ inventoryView: 'count', mode: 'inventory' });
      return;
    }

    if (target === 'rts') {
      onOpenRts();
      return;
    }

    if (target === 'pack-tasks') {
      onOpenTaskRoute({ mode: 'pack' });
      return;
    }

    if (target === 'pick-tasks') {
      onOpenTaskRoute({ mode: 'pick' });
      return;
    }

    onChangeTab('tasks');
  }, [onChangeTab, onOpenRts, onOpenStock, onOpenTaskRoute]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerIdentity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>

          <View style={styles.headerCopy}>
            <Text style={styles.greeting}>{primarySummary.badge}</Text>
            <Text numberOfLines={1} style={styles.displayName}>{displayName}</Text>
          </View>
        </View>

        <Pressable style={({ pressed }) => [styles.bellButton, pressed ? styles.pressed : null]}>
          <Feather name="bell" size={21} color="#262B35" />
          <View style={styles.bellDot} />
        </Pressable>
      </View>

      <SurfaceCard style={styles.statusCard}>
        <View style={styles.statusCopy}>
          <Text style={styles.statusBadge}>{primarySummary.badge}</Text>
          <Text style={styles.statusValue}>{formatCount(primarySummary.value)}</Text>
          <Text style={styles.statusLabel}>{primarySummary.label}</Text>
        </View>
        <Pressable
          onPress={() => openHomeTarget(primarySummary.target)}
          style={({ pressed }) => [styles.statusButton, pressed ? styles.pressed : null]}>
          <Text style={styles.statusButtonText}>Open</Text>
          <Feather name="arrow-right" size={15} color="#FFFFFF" />
        </Pressable>
      </SurfaceCard>

      <View style={styles.actionGrid}>
        {actionCards.map((card) => (
          <Pressable
            key={card.id}
            onPress={() => openHomeTarget(card.target)}
            style={({ pressed }) => [styles.actionCardPressable, pressed ? styles.pressed : null]}>
            <SurfaceCard style={styles.actionCard}>
              <View style={[styles.actionIcon, { backgroundColor: card.soft }]}>
                <Feather name={card.icon} size={18} color={card.accent} />
              </View>
              <Text style={styles.actionValue}>{formatCount(card.value)}</Text>
              <Text numberOfLines={1} style={styles.actionLabel}>{card.label}</Text>
            </SurfaceCard>
          </Pressable>
        ))}
      </View>

      {error ? (
        <SurfaceCard style={styles.errorCard}>
          <Text style={styles.errorTitle}>Home needs attention</Text>
          <Text style={styles.errorCopy}>{error}</Text>
        </SurfaceCard>
      ) : null}

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#6B3EF6" size="small" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : null}

      {!isLoading ? (
        <Pressable
          onPress={() => {
            void loadHome('refresh');
          }}
          style={({ pressed }) => [
            styles.refreshButton,
            pressed ? styles.pressed : null,
          ]}>
          <Feather name="refresh-cw" size={15} color="#6B3EF6" />
          <Text style={styles.refreshButtonText}>{isRefreshing ? 'Refreshing…' : 'Refresh Home'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function buildPrimarySummary(
  identity: HomeIdentity,
  snapshot: HomeSnapshot | null,
  access: {
    canLoadInventory: boolean;
    canLoadInventoryTask: boolean;
    canLoadPack: boolean;
    canLoadPick: boolean;
    canLoadRts: boolean;
  },
): HomePrimarySummary {
  if (identity === 'pick') {
    return {
      badge: 'Picker',
      label: 'Pick tasks',
      target: 'pick-tasks',
      value: snapshot?.pickablePickTasks ?? 0,
    };
  }

  if (identity === 'pack') {
    return {
      badge: 'Packer',
      label: 'Pack tasks',
      target: 'pack-tasks',
      value: snapshot?.packablePackTasks ?? 0,
    };
  }

  if (identity === 'inventory') {
    return {
      badge: 'Inventory',
      label: access.canLoadInventoryTask ? 'Inventory tasks' : 'Units on hand',
      target: access.canLoadInventoryTask ? 'inventory-tasks' : 'inventory-utility',
      value: access.canLoadInventoryTask
        ? (snapshot?.inventoryGroups.putaway ?? 0) + (snapshot?.taskGroups.rts ?? 0) + (snapshot?.taskGroups.restocking ?? 0)
        : snapshot?.stock?.summary.unitsOnHand ?? 0,
    };
  }

  const adminTarget: HomeActionTarget = access.canLoadPick
    ? 'pick-tasks'
    : access.canLoadPack
      ? 'pack-tasks'
      : access.canLoadInventoryTask
        ? 'inventory-tasks'
        : access.canLoadInventory
          ? 'inventory-utility'
          : access.canLoadRts
            ? 'rts'
            : 'pick-tasks';

  return {
    badge: 'Admin',
    label: 'Open work',
    target: adminTarget,
    value: (snapshot?.pickablePickTasks ?? 0) + (snapshot?.packablePackTasks ?? 0) + (snapshot?.taskGroups.rts ?? 0),
  };
}

function buildHomeActionCards(
  identity: HomeIdentity,
  snapshot: HomeSnapshot | null,
  access: {
    canLoadInventory: boolean;
    canLoadInventoryTask: boolean;
    canLoadPack: boolean;
    canLoadPick: boolean;
    canLoadRts: boolean;
  },
): HomeActionCard[] {
  const groups = snapshot?.taskGroups ?? {
    delivered: 0,
    packingWithoutTracking: 0,
    restocking: 0,
    rts: 0,
  };
  const pickFilters = snapshot?.pickFilters ?? {
    inProgress: 0,
    partial: 0,
    picked: 0,
    todo: 0,
  };
  const packFilters = snapshot?.packFilters ?? {
    awaiting: 0,
    noTracking: 0,
    packed: 0,
    packing: 0,
  };
  const inventoryGroups = snapshot?.inventoryGroups ?? {
    cycleCount: 0,
    move: 0,
    putaway: 0,
  };
  const restocking: HomeActionCard = {
    accent: '#F66AAE',
    icon: 'refresh-cw',
    id: 'restocking',
    label: 'Restocking',
    soft: '#FFE2F0',
    target: 'pick-tasks',
    value: groups.restocking,
  };
  const packingWithoutTracking: HomeActionCard = {
    accent: '#8C5CF6',
    icon: 'file-text',
    id: 'packing-without-tracking',
    label: 'No tracking',
    soft: '#EDE4FF',
    target: 'pack-tasks',
    value: groups.packingWithoutTracking,
  };
  const rts: HomeActionCard = {
    accent: '#FF8A3D',
    icon: 'corner-up-left',
    id: 'rts',
    label: 'RTS',
    soft: '#FFE8D7',
    target: 'rts',
    value: groups.rts,
  };
  const putaway: HomeActionCard = {
    accent: '#F66AAE',
    icon: 'inbox',
    id: 'inventory-putaway',
    label: 'Putaway',
    soft: '#FFE2F0',
    target: 'inventory-tasks',
    value: inventoryGroups.putaway,
  };
  const move: HomeActionCard = {
    accent: '#8C5CF6',
    icon: 'repeat',
    id: 'inventory-move',
    label: 'Move',
    soft: '#EDE4FF',
    target: 'inventory-tasks',
    value: inventoryGroups.move,
  };
  const cycleCount: HomeActionCard = {
    accent: '#2CBF7B',
    icon: 'clipboard',
    id: 'inventory-cycle-count',
    label: 'Stock count',
    soft: '#DFF8ED',
    target: 'inventory-count',
    value: inventoryGroups.cycleCount,
  };
  const unitsOnHand: HomeActionCard = {
    accent: '#3B82F6',
    icon: 'archive',
    id: 'inventory-units',
    label: 'Units',
    soft: '#EAF3FF',
    target: 'inventory-utility',
    value: snapshot?.stock?.summary.unitsOnHand ?? 0,
  };
  const pickTodo: HomeActionCard = {
    accent: '#F66AAE',
    icon: 'list',
    id: 'pick-todo',
    label: 'To do',
    soft: '#FFE2F0',
    target: 'pick-tasks',
    value: pickFilters.todo,
  };
  const pickPartial: HomeActionCard = {
    accent: '#FF8A3D',
    icon: 'alert-circle',
    id: 'pick-partial',
    label: 'Partial',
    soft: '#FFE8D7',
    target: 'pick-tasks',
    value: pickFilters.partial,
  };
  const pickInProgress: HomeActionCard = {
    accent: '#8C5CF6',
    icon: 'activity',
    id: 'pick-in-progress',
    label: 'Picking',
    soft: '#EDE4FF',
    target: 'pick-tasks',
    value: pickFilters.inProgress,
  };
  const pickPicked: HomeActionCard = {
    accent: '#2CBF7B',
    icon: 'check-circle',
    id: 'pick-picked',
    label: 'Picked',
    soft: '#DFF8ED',
    target: 'pick-tasks',
    value: pickFilters.picked,
  };
  const awaitingPack: HomeActionCard = {
    accent: '#F66AAE',
    icon: 'inbox',
    id: 'pack-awaiting',
    label: 'Awaiting',
    soft: '#FFE2F0',
    target: 'pack-tasks',
    value: packFilters.awaiting,
  };
  const packing: HomeActionCard = {
    accent: '#8C5CF6',
    icon: 'package',
    id: 'pack-packing',
    label: 'Packing',
    soft: '#EDE4FF',
    target: 'pack-tasks',
    value: packFilters.packing,
  };
  const noTracking: HomeActionCard = {
    accent: '#FF8A3D',
    icon: 'file-text',
    id: 'pack-no-tracking',
    label: 'No tracking',
    soft: '#FFE8D7',
    target: 'pack-tasks',
    value: packFilters.noTracking,
  };
  const packed: HomeActionCard = {
    accent: '#2CBF7B',
    icon: 'check-circle',
    id: 'pack-packed',
    label: 'Packed',
    soft: '#DFF8ED',
    target: 'pack-tasks',
    value: packFilters.packed,
  };

  if (identity === 'pick') {
    return [pickTodo, pickPartial, pickInProgress, pickPicked, restocking];
  }

  if (identity === 'pack') {
    return [awaitingPack, packing, noTracking, packed];
  }

  if (identity === 'inventory') {
    return access.canLoadRts
      ? [putaway, move, cycleCount, rts]
      : [putaway, move, cycleCount, restocking];
  }

  const adminCards: HomeActionCard[] = [];

  if (access.canLoadPick) {
    adminCards.push({
      accent: '#F66AAE',
      icon: 'shopping-bag',
      id: 'admin-pick',
      label: 'Pick',
      soft: '#FFE2F0',
      target: 'pick-tasks',
      value: snapshot?.pickablePickTasks ?? 0,
    });
  }

  if (access.canLoadPack) {
    adminCards.push({
      accent: '#8C5CF6',
      icon: 'package',
      id: 'admin-pack',
      label: 'Pack',
      soft: '#EDE4FF',
      target: 'pack-tasks',
      value: snapshot?.packablePackTasks ?? 0,
    });
  }

  if (access.canLoadInventory || access.canLoadInventoryTask) {
    adminCards.push(unitsOnHand);
  }

  if (access.canLoadRts) {
    adminCards.push(rts);
  }

  if (adminCards.length > 0) {
    return adminCards;
  }

  return [restocking, packingWithoutTracking];
}

function formatCount(value: number) {
  return NUMBER_FORMATTER.format(value);
}

const styles = StyleSheet.create({
  root: {
    gap: 22,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  headerIdentity: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
    gap: 14,
    minWidth: 0,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#1AA8C7',
    borderRadius: 21,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  headerCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  greeting: {
    color: '#262B35',
    fontSize: 15,
    fontWeight: '500',
  },
  displayName: {
    color: '#262B35',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  bellButton: {
    alignItems: 'center',
    height: 30,
    justifyContent: 'center',
    position: 'relative',
    width: 30,
  },
  bellDot: {
    backgroundColor: '#6B3EF6',
    borderColor: '#FBFAFF',
    borderRadius: 5,
    borderWidth: 2,
    height: 10,
    position: 'absolute',
    right: 1,
    top: 2,
    width: 10,
  },
  statusCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#EEE7FA',
    borderRadius: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 118,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  statusCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  statusBadge: {
    color: '#8A6FFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  statusValue: {
    color: '#262B35',
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -1.4,
  },
  statusLabel: {
    color: '#766F86',
    fontSize: 14,
    fontWeight: '800',
  },
  statusButton: {
    alignItems: 'center',
    backgroundColor: '#6B3EF6',
    borderRadius: tokens.radius.pill,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 18,
  },
  statusButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCardPressable: {
    flexBasis: '47%',
    flexGrow: 1,
  },
  actionCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EEE7FA',
    borderRadius: 18,
    gap: 8,
    minHeight: 126,
    padding: 14,
  },
  actionIcon: {
    alignItems: 'center',
    borderRadius: 13,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  actionValue: {
    color: '#262B35',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  actionLabel: {
    color: '#766F86',
    fontSize: 13,
    fontWeight: '800',
  },
  errorCard: {
    gap: 8,
  },
  errorTitle: {
    color: tokens.colors.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  errorCopy: {
    color: tokens.colors.inkMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  loadingWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    paddingBottom: 2,
  },
  loadingText: {
    color: '#8B90A1',
    fontSize: 13,
    fontWeight: '700',
  },
  refreshButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#F3EDFF',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  refreshButtonText: {
    color: '#6B3EF6',
    fontSize: 13,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
});
