import { useCallback, useEffect, useMemo, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Pie, PolarChart } from 'victory-native';
import type { BootstrapResponse, DeviceIdentity, StoredSession } from '@/src/features/auth/types';
import { SurfaceCard } from '@/src/shared/components/surface-card';
import { tokens } from '@/src/shared/theme/tokens';
import type { StoxTabKey } from '../types';
import {
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
};

type HomeSnapshot = {
  stock: WmsMobileHomeInventorySummaryResponse | null;
  pickablePickTasks: number;
  packablePackTasks: number;
  completedPickToday: number;
  completedPackToday: number;
  taskGroups: {
    restocking: number;
    packingWithoutTracking: number;
    delivered: number;
    rts: number;
  };
};

const NUMBER_FORMATTER = new Intl.NumberFormat('en-US');

const IN_PROGRESS_CARD_META = {
  units: {
    accent: '#3B82F6',
    icon: 'archive',
    soft: '#EAF3FF',
  },
  dispatch: {
    accent: '#FF8250',
    icon: 'truck',
    soft: '#FFF0E8',
  },
  capacity: {
    accent: '#7B4DFF',
    icon: 'database',
    soft: '#F1EAFF',
  },
} as const;

export function HomeOverviewTab({
  bootstrap,
  device,
  session,
  onChangeTab,
  onOpenStock,
}: HomeOverviewTabProps) {
  const [snapshot, setSnapshot] = useState<HomeSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const displayName = getDisplayName(bootstrap.user);
  const initials = getInitials(displayName);
  const canLoadPick = canUsePickWorkspace(bootstrap);
  const canLoadPack = canUsePackWorkspace(bootstrap);
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
        canLoadPick || canLoadPack
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
    canLoadPack,
    canLoadPick,
    device,
    session.accessToken,
    storeId,
    tenantId,
    warehouseId,
  ]);

  useEffect(() => {
    void loadHome('initial');
  }, [loadHome]);

  const inventoryCards = useMemo(() => {
    const stock = snapshot?.stock;
    const summary = stock?.summary;

    return [
      {
        accent: IN_PROGRESS_CARD_META.units.accent,
        icon: IN_PROGRESS_CARD_META.units.icon,
        id: 'units',
        label: 'Units on Hand',
        soft: IN_PROGRESS_CARD_META.units.soft,
        value: stock ? formatCount(summary?.unitsOnHand ?? 0) : '--',
      },
      {
        accent: IN_PROGRESS_CARD_META.dispatch.accent,
        icon: IN_PROGRESS_CARD_META.dispatch.icon,
        id: 'dispatch',
        label: 'Dispatch Units',
        soft: IN_PROGRESS_CARD_META.dispatch.soft,
        value: stock ? formatCount(summary?.dispatchedUnits ?? 0) : '--',
      },
      {
        accent: IN_PROGRESS_CARD_META.capacity.accent,
        icon: IN_PROGRESS_CARD_META.capacity.icon,
        id: 'capacity',
        label: 'Warehouse Capacity',
        soft: IN_PROGRESS_CARD_META.capacity.soft,
        value: stock ? `${summary?.warehouseCapacity.utilizationPercent ?? 0}%` : '--',
      },
    ];
  }, [snapshot]);

  const heroIdentity = useMemo(() => {
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

    if (canLoadPick && !canLoadPack) {
      return 'pick';
    }

    if (canLoadPack && !canLoadPick) {
      return 'pack';
    }

    return 'all';
  }, [bootstrap.operations?.taskAssignment, bootstrap.user.role, canLoadPack, canLoadPick]);

  const heroSummary = useMemo(() => {
    const pickablePickTasks = snapshot?.pickablePickTasks ?? 0;
    const packablePackTasks = snapshot?.packablePackTasks ?? 0;
    const completedPickToday = snapshot?.completedPickToday ?? 0;
    const completedPackToday = snapshot?.completedPackToday ?? 0;

    if (heroIdentity === 'pick') {
      const total = pickablePickTasks + completedPickToday;
      const percent = total > 0 ? Math.min(100, Math.round((completedPickToday / total) * 100)) : 100;

      return {
        badge: 'Picker',
        cta: 'View Task',
        description: `${formatCount(completedPickToday)} of ${formatCount(total)} pickable tasks`,
        percent,
        title: total > 0
          ? percent >= 75
            ? 'Your pick queue is almost done!'
            : 'Your pick queue is moving well!'
          : 'Your pick queue is clear for now!',
      };
    }

    if (heroIdentity === 'pack') {
      const total = packablePackTasks + completedPackToday;
      const percent = total > 0 ? Math.min(100, Math.round((completedPackToday / total) * 100)) : 100;

      return {
        badge: 'Packer',
        cta: 'View Task',
        description: `${formatCount(completedPackToday)} of ${formatCount(total)} packable tasks`,
        percent,
        title: total > 0
          ? percent >= 75
            ? 'Your pack queue is almost done!'
            : 'Your pack queue is moving well!'
          : 'Your pack queue is clear for now!',
      };
    }

    const completed = completedPickToday + completedPackToday;
    const total = pickablePickTasks + packablePackTasks + completed;
    const percent = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 100;

    return {
      badge: 'All Staff',
      cta: 'View Task',
      description: `${formatCount(completed)} of ${formatCount(total)} warehouse tasks`,
      percent,
      title: total > 0
        ? percent >= 75
          ? "Today's warehouse flow is on track!"
          : "Today's warehouse flow is moving!"
        : 'Warehouse flow is clear for now!',
    };
  }, [
    heroIdentity,
    snapshot?.completedPackToday,
    snapshot?.completedPickToday,
    snapshot?.packablePackTasks,
    snapshot?.pickablePickTasks,
  ]);
  const taskGroups = useMemo(() => buildTaskGroups(heroIdentity, snapshot), [heroIdentity, snapshot]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerIdentity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>

          <View style={styles.headerCopy}>
            <Text style={styles.greeting}>Hello!</Text>
            <Text numberOfLines={1} style={styles.displayName}>{displayName}</Text>
          </View>
        </View>

        <Pressable style={({ pressed }) => [styles.bellButton, pressed ? styles.pressed : null]}>
          <Feather name="bell" size={21} color="#262B35" />
          <View style={styles.bellDot} />
        </Pressable>
      </View>

      <SurfaceCard style={styles.heroCard}>
        <View style={styles.heroCopyBlock}>
          <View style={styles.heroTopBlock}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>{heroSummary.badge}</Text>
            </View>
            <Text style={styles.heroTitle}>{heroSummary.title}</Text>
            <Text style={styles.heroMeta}>{heroSummary.description}</Text>
          </View>
          <Pressable
            onPress={() => onChangeTab('tasks')}
            style={({ pressed }) => [styles.heroButton, pressed ? styles.pressed : null]}>
            <Text style={styles.heroButtonText}>{heroSummary.cta}</Text>
          </Pressable>
        </View>

        <View style={styles.heroRight}>
          <Pressable
            onPress={onOpenStock}
            style={({ pressed }) => [styles.heroMenuButton, pressed ? styles.heroMenuButtonPressed : null]}>
            <Feather name="more-horizontal" size={16} color="#FFFFFF" />
          </Pressable>
          <ProgressRing value={heroSummary.percent} />
        </View>
      </SurfaceCard>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Inventory</Text>
        <Text style={styles.sectionCount}>3</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carousel}>
        {inventoryCards.map((card) => (
          <View
            key={card.id}
            style={styles.inventoryCardPressable}>
            <View style={[styles.inventoryCard, { backgroundColor: card.soft }]}>
              <View style={styles.inventoryCardHeader}>
                <Text style={styles.inventoryCardLabel}>{card.label}</Text>
                <View style={[styles.inventoryCardIcon, { backgroundColor: applyAlpha(card.accent, 0.18) }]}>
                  <Feather name={card.icon as never} size={15} color={card.accent} />
                </View>
              </View>

              <Text style={styles.inventoryCardValue}>{card.value}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Task Groups</Text>
        <Text style={styles.sectionCount}>{taskGroups.length}</Text>
      </View>

      <View style={styles.taskGroupList}>
        {taskGroups.map((group) => (
          <SurfaceCard key={group.id} style={styles.taskGroupCard}>
            <View style={[styles.taskGroupIcon, { backgroundColor: group.soft }]}>
              <Feather name={group.icon as never} size={20} color={group.accent} />
            </View>
            <View style={styles.taskGroupCopy}>
              <Text style={styles.taskGroupTitle}>{group.label}</Text>
              <Text style={styles.taskGroupMeta}>{group.caption}</Text>
            </View>
            <View style={[styles.taskGroupMetric, { backgroundColor: group.soft }]}>
              <Text style={styles.taskGroupMetricValue}>{formatCount(group.value)}</Text>
            </View>
          </SurfaceCard>
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
          <Text style={styles.loadingText}>Loading live warehouse view…</Text>
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

function ProgressRing({ value }: { value: number }) {
  const size = 104;
  const progress = Math.max(0, Math.min(100, value));
  const chartData = [
    {
      color: '#F7F1FF',
      label: 'Done',
      value: Math.max(progress, 0.001),
    },
    {
      color: 'rgba(255,255,255,0.24)',
      label: 'Remaining',
      value: Math.max(100 - progress, 0.001),
    },
  ];

  return (
    <View style={[styles.ringWrap, { height: size, width: size }]}>
      <PolarChart
        data={chartData}
        labelKey="label"
        valueKey="value"
        colorKey="color"
        containerStyle={styles.ringChartContainer}>
        <Pie.Chart
          innerRadius="68%"
          startAngle={-86}
          circleSweepDegrees={344}>
          {({ slice }) => (
            <Pie.Slice
              animate={{ type: 'spring' }}
              opacity={slice.label === 'Done' ? 1 : 0.78}
            />
          )}
        </Pie.Chart>
      </PolarChart>
      <Text style={styles.ringValue}>{Math.max(0, Math.min(100, value))}%</Text>
    </View>
  );
}

function buildTaskGroups(identity: 'all' | 'pick' | 'pack', snapshot: HomeSnapshot | null) {
  const groups = snapshot?.taskGroups ?? {
    delivered: 0,
    packingWithoutTracking: 0,
    restocking: 0,
    rts: 0,
  };
  const restocking = {
    accent: '#F66AAE',
    caption: 'Count',
    icon: 'refresh-cw',
    id: 'restocking',
    label: 'Restocking',
    soft: '#FFE2F0',
    value: groups.restocking,
  };
  const packingWithoutTracking = {
    accent: '#8C5CF6',
    caption: 'Count',
    icon: 'file-text',
    id: 'packing-without-tracking',
    label: 'Packing w/o tracking',
    soft: '#EDE4FF',
    value: groups.packingWithoutTracking,
  };
  const delivered = {
    accent: '#2CBF7B',
    caption: 'Count',
    icon: 'check-circle',
    id: 'delivered',
    label: 'Delivered',
    soft: '#DFF8ED',
    value: groups.delivered,
  };
  const rts = {
    accent: '#FF8A3D',
    caption: 'Count',
    icon: 'corner-up-left',
    id: 'rts',
    label: 'RTS',
    soft: '#FFE8D7',
    value: groups.rts,
  };

  if (identity === 'pick') {
    return [restocking, delivered, rts];
  }

  if (identity === 'pack') {
    return [packingWithoutTracking, delivered, rts];
  }

  return [restocking, packingWithoutTracking, delivered, rts];
}

function formatCount(value: number) {
  return NUMBER_FORMATTER.format(value);
}

function applyAlpha(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((char) => `${char}${char}`).join('')
    : normalized;
  const numericAlpha = Math.round(alpha * 255).toString(16).padStart(2, '0');

  return `#${value}${numericAlpha}`;
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
  heroCard: {
    alignItems: 'stretch',
    backgroundColor: '#6B3EF6',
    borderColor: '#6B3EF6',
    borderRadius: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 146,
    overflow: 'hidden',
    paddingHorizontal: 22,
    paddingVertical: 18,
    shadowColor: 'rgba(82, 41, 219, 0.34)',
    shadowOffset: {
      width: 0,
      height: 18,
    },
    shadowOpacity: 1,
    shadowRadius: 28,
  },
  heroCopyBlock: {
    flex: 1,
    justifyContent: 'space-between',
    maxWidth: 150,
    paddingVertical: 6,
  },
  heroTopBlock: {
    gap: 8,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  heroMeta: {
    color: 'rgba(255,255,255,0.84)',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  heroButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#F3EDFF',
    borderRadius: 14,
    minWidth: 122,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  heroButtonText: {
    color: '#6B3EF6',
    fontSize: 15,
    fontWeight: '800',
  },
  heroRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginLeft: 14,
  },
  heroMenuButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 12,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  heroMenuButtonPressed: {
    opacity: 0.84,
  },
  ringWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ringChartContainer: {
    ...StyleSheet.absoluteFillObject,
    height: 104,
    width: 104,
  },
  ringValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  sectionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  sectionTitle: {
    color: '#262B35',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  sectionCount: {
    backgroundColor: '#EEE9FF',
    borderRadius: 999,
    color: '#6B3EF6',
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  carousel: {
    gap: 14,
    paddingRight: 2,
  },
  inventoryCardPressable: {
    width: 276,
  },
  inventoryCard: {
    borderRadius: 22,
    minHeight: 118,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  inventoryCardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inventoryCardLabel: {
    color: '#6B7280',
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    paddingRight: 12,
  },
  inventoryCardIcon: {
    alignItems: 'center',
    borderRadius: 12,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  inventoryCardValue: {
    color: '#202431',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginTop: 12,
  },
  taskGroupList: {
    gap: 14,
  },
  taskGroupCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(244, 239, 252, 0.9)',
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 16,
    height: 66,
    paddingHorizontal: 15,
    paddingVertical: 0,
    shadowColor: 'rgba(103, 81, 134, 0.12)',
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 1,
    shadowRadius: 24,
    width: '100%',
  },
  taskGroupIcon: {
    alignItems: 'center',
    borderRadius: 13,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  taskGroupCopy: {
    flex: 1,
    minWidth: 0,
  },
  taskGroupTitle: {
    color: '#262B35',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  taskGroupMeta: {
    color: '#766F86',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  taskGroupMetric: {
    alignItems: 'center',
    borderRadius: 18,
    justifyContent: 'center',
    minWidth: 54,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  taskGroupMetricValue: {
    color: '#262B35',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
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
