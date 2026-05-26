import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { BootstrapResponse, DeviceIdentity, StoredSession } from '@/src/features/auth/types';
import { fetchMobileHistoryFeed } from '@/src/features/history/services/history-api';
import type {
  HistoryActivityFilter,
  WmsMobileHistoryActorOption,
  WmsMobileHistoryItem,
} from '@/src/features/history/types';
import {
  canUseStoxHistoryWorkspace,
  canViewAllStoxHistory,
} from '@/src/features/home/rbac';
import { StockScopeFilterModal } from '@/src/features/stock/components/stock-scope-filter';
import { SurfaceCard } from '@/src/shared/components/surface-card';
import { tokens } from '@/src/shared/theme/tokens';
import { BlockedTaskState, TaskHeaderIconButton } from './stox-primitives';

type HistoryTabProps = {
  bootstrap: BootstrapResponse;
  device: DeviceIdentity | null;
  session: StoredSession;
};

type HistoryFilterOption = {
  key: HistoryActivityFilter;
  label: string;
};

const HISTORY_FILTER_OPTIONS: HistoryFilterOption[] = [
  { key: 'ALL', label: 'All' },
  { key: 'PICK', label: 'Pick' },
  { key: 'PACK', label: 'Pack' },
  { key: 'DISPATCH', label: 'Dispatch' },
  { key: 'SCAN', label: 'Scan' },
  { key: 'VOID', label: 'Void' },
  { key: 'ISSUE', label: 'Issues' },
];

const HISTORY_CATEGORY_META = {
  pick: { icon: 'package', tone: '#6C3EF4', soft: '#F2EBFF' },
  pack: { icon: 'shopping-bag', tone: '#3F65F5', soft: '#EBF1FF' },
  dispatch: { icon: 'truck', tone: '#1989D6', soft: '#E6F6FF' },
  scan: { icon: 'maximize', tone: '#A155F7', soft: '#F3EAFF' },
  void: { icon: 'slash', tone: '#F57A3F', soft: '#FFF0E8' },
  issue: { icon: 'alert-circle', tone: '#E05353', soft: '#FFECEC' },
} as const;

export function HistoryTab({ bootstrap, device, session }: HistoryTabProps) {
  if (!canUseStoxHistoryWorkspace(bootstrap)) {
    return (
      <>
        <HistoryCenteredHeader />
        <BlockedTaskState copy="This account needs STOX task or history access to open the activity feed." />
      </>
    );
  }

  return (
    <HistoryFeedTab
      bootstrap={bootstrap}
      device={device}
      session={session}
    />
  );
}

function HistoryFeedTab({ bootstrap, device, session }: HistoryTabProps) {
  const [filter, setFilter] = useState<HistoryActivityFilter>('ALL');
  const [selectedActorId, setSelectedActorId] = useState<string | null>(
    canViewAllStoxHistory(bootstrap) ? null : bootstrap.user.id,
  );
  const [actorPickerOpen, setActorPickerOpen] = useState(false);
  const [items, setItems] = useState<WmsMobileHistoryItem[]>([]);
  const [actorOptions, setActorOptions] = useState<WmsMobileHistoryActorOption[]>([]);
  const [canViewAll, setCanViewAll] = useState(canViewAllStoxHistory(bootstrap));
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextCursorRef = useRef<string | null>(null);
  const canViewAllRef = useRef(canViewAllStoxHistory(bootstrap));
  const requestContextRef = useRef(0);
  const loadMoreInFlightRef = useRef(false);

  const tenantId = bootstrap.tenant?.id ?? null;

  const selectedActorLabel = useMemo(() => {
    if (!canViewAll) {
      return 'My activity';
    }

    if (!selectedActorId) {
      return 'All users';
    }

    return actorOptions.find((option) => option.id === selectedActorId)?.name ?? 'Selected user';
  }, [actorOptions, canViewAll, selectedActorId]);

  const loadHistory = useCallback(async (mode: 'initial' | 'refresh' | 'more' = 'initial') => {
    if (!device) {
      setError('Device is not ready yet.');
      setIsLoading(false);
      return;
    }

    if (mode === 'more') {
      if (loadMoreInFlightRef.current || !nextCursorRef.current) {
        return;
      }
      loadMoreInFlightRef.current = true;
    } else {
      requestContextRef.current += 1;
    }

    const activeRequestContext = requestContextRef.current;

    if (mode === 'initial') {
      setIsLoading(true);
    } else if (mode === 'refresh') {
      setIsRefreshing(true);
    } else {
      setIsLoadingMore(true);
    }

    setError(null);

    try {
      const response = await fetchMobileHistoryFeed({
        accessToken: session.accessToken,
        actorId: canViewAllRef.current ? selectedActorId : null,
        cursor: mode === 'more' ? nextCursorRef.current : null,
        device,
        limit: 20,
        tenantId,
        type: filter,
      });

      if (activeRequestContext !== requestContextRef.current) {
        return;
      }

      canViewAllRef.current = response.filters.canViewAll;
      setCanViewAll(response.filters.canViewAll);
      setActorOptions(response.filters.actorOptions);
      nextCursorRef.current = response.pagination.nextCursor;
      setHasMore(response.pagination.hasMore);
      setItems((current) => (
        mode === 'more' ? mergeHistoryItems(current, response.items) : response.items
      ));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load activity history.');
    } finally {
      if (mode === 'more') {
        loadMoreInFlightRef.current = false;
      }
      setIsLoading(false);
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  }, [device, filter, selectedActorId, session.accessToken, tenantId]);

  useEffect(() => {
    void loadHistory('initial');
  }, [loadHistory]);

  return (
    <>
      <HistoryCenteredHeader
        loading={isRefreshing}
        onRefresh={() => loadHistory('refresh')}
      />

      {canViewAll ? (
        <HistoryDropdownCard
          icon="users"
          label="User"
          value={selectedActorLabel}
          onPress={() => setActorPickerOpen(true)}
        />
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRail}>
        {HISTORY_FILTER_OPTIONS.map((option) => (
          <Pressable
            key={option.key}
            onPress={() => setFilter(option.key)}
            style={({ pressed }) => [
              styles.filterChip,
              filter === option.key ? styles.filterChipActive : null,
              pressed ? styles.pressed : null,
            ]}>
            <Text
              style={[
                styles.filterChipText,
                filter === option.key ? styles.filterChipTextActive : null,
              ]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Latest activity</Text>
        <Text style={styles.sectionTrailing}>{items.length}</Text>
      </View>

      {error ? (
        <SurfaceCard style={styles.stateCard}>
          <Text style={styles.stateTitle}>History needs attention</Text>
          <Text style={styles.stateCopy}>{error}</Text>
        </SurfaceCard>
      ) : null}

      {!error && !isLoading && items.length === 0 ? (
        <SurfaceCard style={styles.stateCard}>
          <Text style={styles.stateTitle}>No activity yet</Text>
          <Text style={styles.stateCopy}>
            Latest STOX work will appear here after this user starts scanning, picking, packing, or voiding orders.
          </Text>
        </SurfaceCard>
      ) : null}

      <View style={styles.feed}>
        {items.map((item) => (
          <HistoryItemCard
            key={item.id}
            item={item}
            showActor={canViewAll}
          />
        ))}
      </View>

      {!error && hasMore ? (
        <Pressable
          onPress={() => {
            void loadHistory('more');
          }}
          style={({ pressed }) => [
            styles.loadMoreButton,
            pressed ? styles.pressed : null,
          ]}>
          <Text style={styles.loadMoreButtonText}>
            {isLoadingMore ? 'Loading more…' : 'Load more'}
          </Text>
        </Pressable>
      ) : null}

      <StockScopeFilterModal
        title="User"
        visible={actorPickerOpen}
        options={[
          { value: null, label: 'All users' },
          ...actorOptions.map((option) => ({
            value: option.id,
            label: option.name,
          })),
        ]}
        onClose={() => setActorPickerOpen(false)}
        onSelect={(value) => {
          setSelectedActorId(value);
          setActorPickerOpen(false);
        }}
      />
    </>
  );
}

function mergeHistoryItems(current: WmsMobileHistoryItem[], incoming: WmsMobileHistoryItem[]) {
  if (current.length === 0) {
    return incoming;
  }

  const seen = new Set(current.map((item) => item.id));
  const appended = incoming.filter((item) => !seen.has(item.id));
  return appended.length > 0 ? [...current, ...appended] : current;
}

function HistoryCenteredHeader({
  loading = false,
  onRefresh,
}: {
  loading?: boolean;
  onRefresh?: () => void | Promise<void>;
}) {
  return (
    <View style={styles.centeredHeader}>
      <TaskHeaderIconButton
        disabled={!onRefresh}
        icon="refresh-cw"
        loading={loading}
        onPress={async () => {
          await onRefresh?.();
        }}
      />
      <Text style={styles.centeredHeaderTitle}>History</Text>
      <View style={styles.centeredBellButton}>
        <Feather name="bell" size={18} color="#1F1F28" />
        <View style={styles.centeredBellDot} />
      </View>
    </View>
  );
}

function HistoryDropdownCard({
  icon,
  label,
  value,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.dropdownCard,
        pressed ? styles.pressed : null,
      ]}>
      <View style={styles.dropdownIcon}>
        <Feather name={icon} size={16} color="#F55DB8" />
      </View>
      <View style={styles.dropdownCopy}>
        <Text style={styles.dropdownLabel}>{label}</Text>
        <Text numberOfLines={1} style={styles.dropdownValue}>{value}</Text>
      </View>
      <Feather name="chevron-down" size={18} color="#2B2836" />
    </Pressable>
  );
}

function HistoryItemCard({
  item,
  showActor,
}: {
  item: WmsMobileHistoryItem;
  showActor: boolean;
}) {
  const tone = HISTORY_CATEGORY_META[item.category];

  return (
    <SurfaceCard style={styles.itemCard}>
      <View style={styles.itemHead}>
        <View style={[styles.itemIconWrap, { backgroundColor: tone.soft }]}>
          <Feather name={tone.icon} size={16} color={tone.tone} />
        </View>
        <View style={styles.itemCopy}>
          <Text style={styles.itemEyebrow}>{formatHistoryEyebrow(item.category)}</Text>
          <Text style={styles.itemTitle}>{item.title}</Text>
          <Text style={styles.itemSubject}>{item.subject}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: tone.soft }]}>
          <Text style={[styles.badgeText, { color: tone.tone }]}>
            {formatOutcomeLabel(item)}
          </Text>
        </View>
      </View>

      {item.supporting ? <Text style={styles.itemSupporting}>{item.supporting}</Text> : null}

      <View style={styles.itemFooter}>
        <Text style={styles.itemTimestamp}>{formatHistoryDateTime(item.occurredAt)}</Text>
        {showActor && item.actor ? (
          <Text style={styles.itemActor}>by {item.actor.name}</Text>
        ) : null}
      </View>
    </SurfaceCard>
  );
}

function formatHistoryEyebrow(category: WmsMobileHistoryItem['category']) {
  switch (category) {
    case 'pick':
      return 'Pick';
    case 'pack':
      return 'Pack';
    case 'dispatch':
      return 'Dispatch';
    case 'scan':
      return 'Scan';
    case 'void':
      return 'Void';
    case 'issue':
      return 'Issue';
    default:
      return 'Activity';
  }
}

function formatOutcomeLabel(item: WmsMobileHistoryItem) {
  if (item.outcome === 'REJECTED') {
    return 'Rejected';
  }

  if (item.outcome === 'EXCEPTION') {
    return 'Exception';
  }

  if (item.category === 'void') {
    return 'Void';
  }

  return 'Done';
}

function formatHistoryDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  centeredHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  centeredHeaderTitle: {
    color: tokens.colors.ink,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  centeredBellButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    position: 'relative',
    width: 44,
  },
  centeredBellDot: {
    backgroundColor: '#6C3EF4',
    borderColor: '#FFFDF8',
    borderRadius: 999,
    borderWidth: 2,
    height: 10,
    position: 'absolute',
    right: 10,
    top: 8,
    width: 10,
  },
  dropdownCard: {
    alignItems: 'center',
    backgroundColor: '#FFFDF8',
    borderColor: '#E8DFF8',
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 16,
    shadowColor: '#B8A4FF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 3,
  },
  dropdownIcon: {
    alignItems: 'center',
    backgroundColor: '#FFF1F8',
    borderRadius: 16,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  dropdownCopy: {
    flex: 1,
    gap: 2,
  },
  dropdownLabel: {
    color: '#958AB5',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  dropdownValue: {
    color: tokens.colors.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  filterRail: {
    gap: tokens.spacing.sm,
    paddingRight: tokens.spacing.md,
  },
  filterChip: {
    backgroundColor: '#EEE9FF',
    borderRadius: tokens.radius.pill,
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  filterChipActive: {
    backgroundColor: '#6C3EF4',
    shadowColor: '#8A6FFF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 4,
  },
  filterChipText: {
    color: '#6C52C8',
    fontSize: 15,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: '#FFFDF8',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: tokens.colors.ink,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  sectionTrailing: {
    backgroundColor: '#F0E9FF',
    borderRadius: 999,
    color: '#6C3EF4',
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  stateCard: {
    gap: tokens.spacing.sm,
    padding: 20,
  },
  stateTitle: {
    color: tokens.colors.ink,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  stateCopy: {
    color: tokens.colors.inkMuted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  feed: {
    gap: tokens.spacing.md,
  },
  itemCard: {
    gap: tokens.spacing.sm,
    padding: 18,
  },
  itemHead: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  itemIconWrap: {
    alignItems: 'center',
    borderRadius: 16,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  itemCopy: {
    flex: 1,
    gap: 3,
  },
  itemEyebrow: {
    color: '#8C83B3',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  itemTitle: {
    color: tokens.colors.ink,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  itemSubject: {
    color: tokens.colors.inkMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  badge: {
    alignItems: 'center',
    borderRadius: 999,
    minHeight: 28,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  itemSupporting: {
    color: tokens.colors.ink,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  itemFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: tokens.spacing.sm,
  },
  itemTimestamp: {
    color: tokens.colors.inkSoft,
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  itemActor: {
    color: '#6C3EF4',
    fontSize: 12,
    fontWeight: '800',
  },
  loadMoreButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#FFFDF8',
    borderColor: '#E2D7F6',
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: 'center',
    marginBottom: tokens.spacing.sm,
    paddingHorizontal: 18,
  },
  loadMoreButtonText: {
    color: '#6C3EF4',
    fontSize: 13,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.9,
  },
});
