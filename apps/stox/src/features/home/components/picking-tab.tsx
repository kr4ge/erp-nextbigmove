import { useEffect, useMemo, useRef, useState, type ComponentProps, type RefObject } from 'react';
import { Feather } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { BootstrapResponse, DeviceIdentity, StoredSession } from '@/src/features/auth/types';
import { canUsePickWorkspace } from '@/src/features/home/rbac';
import { usePickingWorkspace } from '@/src/features/picking/hooks/use-picking-workspace';
import type {
  PickingFilters,
  PickingStatus,
  WmsMobilePickBasket,
  WmsMobilePickingPackerOption,
  WmsMobilePickingTask,
} from '@/src/features/picking/types';
import { PrimaryButton } from '@/src/shared/components/primary-button';
import { SurfaceCard } from '@/src/shared/components/surface-card';
import { tokens } from '@/src/shared/theme/tokens';
import {
  StockScopeFilterModal,
} from '@/src/features/stock/components/stock-scope-filter';
import type { StockScopeOption } from '@/src/features/stock/utils/stock-scope';
import { BlockedTaskState, SectionLabel, TaskHeader, TaskHeaderIconButton, UtilityPill } from './stox-primitives';

type PickingTabProps = {
  bootstrap: BootstrapResponse;
  device: DeviceIdentity | null;
  session: StoredSession;
};

type PickingFilterKey = 'tenant' | 'store';
type PickTabKey = 'list' | 'picked' | 'baskets';

const PICK_TABS: Array<{ key: PickTabKey; label: string }> = [
  { key: 'list', label: 'Pick list' },
  { key: 'picked', label: 'Picked' },
  { key: 'baskets', label: 'Baskets' },
];

const PICK_STATUS_FILTERS: Array<{ label: string; value: PickingStatus | null }> = [
  { label: 'All', value: null },
  { label: 'To do', value: 'READY' },
  { label: 'Partial', value: 'PARTIAL' },
  { label: 'Restocking', value: 'RESTOCKING' },
  { label: 'Issues', value: 'ISSUE' },
  { label: 'In Progress', value: 'IN_PICKING' },
];
const PICK_LIST_PAGE_SIZE = 10;

export function PickingTab({ bootstrap, device, session }: PickingTabProps) {
  if (!canUsePickWorkspace(bootstrap)) {
    return (
      <>
        <TaskHeader title="Pick" />
        <BlockedTaskState copy="This account needs WMS fulfillment write or edit permission and a PICK task assignment in WMS Web." />
      </>
    );
  }

  return <PickingWorkspaceTab bootstrap={bootstrap} device={device} session={session} />;
}

function PickingWorkspaceTab({ bootstrap, device, session }: PickingTabProps) {
  const [activeFilter, setActiveFilter] = useState<PickingFilterKey | null>(null);
  const [activeTab, setActiveTab] = useState<PickTabKey>('list');
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const {
    activeBin,
    activeTask,
    activeTaskId,
    claimTask,
    error,
    filters,
    handoffTask,
    isLoading,
    isLoadingMore,
    isRefreshing,
    isSubmitting,
    loadMore,
    picking,
    refreshPicking,
    scanBasket,
    scanBin,
    scanUnit,
    setActiveBin,
    setActiveTaskId,
    setFilters,
    setStatusFilter,
    statusFilter,
  } = usePickingWorkspace({ bootstrap, device, session });

  const filterOptions = useMemo(
    () => buildPickingFilterOptions(activeFilter, picking, bootstrap, bootstrap.user.role === 'SUPER_ADMIN'),
    [activeFilter, bootstrap, picking],
  );
  const activePartnerName = resolveActivePartnerName(picking, bootstrap, filters.tenantId);
  const activeStoreName = resolveActiveStoreName(picking, bootstrap, filters.storeId);
  const taskPool = useMemo(() => {
    if (activeTab === 'picked') {
      return picking?.pickedHistory ?? [];
    }

    if (activeTab === 'list') {
      return picking?.tasks ?? [];
    }

    return [];
  }, [activeTab, picking?.pickedHistory, picking?.tasks]);
  const dateOptions = useMemo(() => buildPickDateOptions(taskPool), [taskPool]);
  const totalPickTasks = picking?.pagination.total ?? 0;
  const filteredTaskPool = useMemo(() => {
    if (!selectedDateKey || activeTab === 'baskets') {
      return taskPool;
    }

    return taskPool.filter((task) => getPickTaskDateKey(task) === selectedDateKey);
  }, [activeTab, selectedDateKey, taskPool]);
  const hiddenTaskCount = Math.max(taskPool.length - filteredTaskPool.length, 0);

  useEffect(() => {
    if (activeTab === 'baskets') {
      if (selectedDateKey !== null) {
        setSelectedDateKey(null);
      }
      return;
    }

    if (dateOptions.length === 0) {
      if (selectedDateKey !== null) {
        setSelectedDateKey(null);
      }
      return;
    }

    if (selectedDateKey && dateOptions.some((option) => option.key === selectedDateKey)) {
      return;
    }

    if (selectedDateKey !== null) {
      setSelectedDateKey(null);
    }
  }, [activeTab, dateOptions, selectedDateKey]);

  const updateFilter = (value: string | null) => {
    setFilters((current) => {
      if (activeFilter === 'tenant') {
        return {
          tenantId: value,
          storeId: null,
        };
      }

      return {
        ...current,
        storeId: value,
      };
    });
    setActiveFilter(null);
  };

  if (isLoading && !picking) {
    return (
      <SurfaceCard style={styles.loadingCard}>
        <ActivityIndicator color={tokens.colors.panel} />
        <Text style={styles.loadingText}>Loading picks</Text>
      </SurfaceCard>
    );
  }

  return (
    <>
      {!activeTask ? (
        <>
          <View style={styles.queueHeader}>
            <TaskHeaderIconButton
              icon="refresh-cw"
              loading={isRefreshing}
              onPress={refreshPicking}
            />
            <Text style={styles.queueHeaderTitle}>Pick Tasks</Text>
            <View style={styles.queueBellButton}>
              <Feather name="bell" size={18} color="#1F1F28" />
            <View style={styles.queueBellDot} />
          </View>
          </View>

          {activeTab !== 'baskets' && dateOptions.length > 0 ? (
            <TaskDateCarousel
              options={dateOptions}
              value={selectedDateKey}
              onChange={setSelectedDateKey}
            />
          ) : null}

          <View style={styles.queueFilterStack}>
            {bootstrap.user.role === 'SUPER_ADMIN' ? (
              <ScopeDropdownCard
                icon="briefcase"
                label="Partner"
                value={activePartnerName}
                onPress={() => setActiveFilter('tenant')}
              />
            ) : null}

            <ScopeDropdownCard
              icon="shopping-bag"
              label="Store"
              value={activeStoreName}
              onPress={() => setActiveFilter('store')}
            />
          </View>
        </>
      ) : null}

      {error ? (
        <SurfaceCard style={styles.errorCard}>
          <Feather name="alert-circle" size={18} color={tokens.colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </SurfaceCard>
      ) : null}

      {!activeTask ? <PickTabSwitcher activeTab={activeTab} onChange={setActiveTab} /> : null}

      {activeTask ? (
        <PickExecutionCard
          activeBin={activeBin}
          currentUserEmail={bootstrap.user.email}
          isSubmitting={isSubmitting}
          task={activeTask}
          onBack={() => {
            setActiveTaskId(null);
            setActiveBin(null);
          }}
          onClaim={claimTask}
          onRefresh={refreshPicking}
          onHandoff={handoffTask}
          packerOptions={picking?.context.packerOptions ?? []}
          onScanBasket={scanBasket}
          onScanBin={scanBin}
          onScanUnit={scanUnit}
        />
      ) : (
        <>
          {activeTab === 'list' ? (
            <>
              <PickStatusFilterRow value={statusFilter} onChange={setStatusFilter} />
              <PickTaskList
                activeTaskId={activeTaskId}
                hiddenCount={hiddenTaskCount}
                hasMore={Boolean(picking?.pagination.hasMore)}
                isLoadingMore={isLoadingMore}
                loadedCount={taskPool.length}
                onClearDateFilter={() => setSelectedDateKey(null)}
                tasks={filteredTaskPool}
                total={totalPickTasks}
                onLoadMore={loadMore}
                onSelect={setActiveTaskId}
              />
            </>
          ) : null}

          {activeTab === 'picked' ? (
            <TaskCollectionSection
              activeTaskId={activeTaskId}
              emptyCopy="Picked baskets stay here until they are handed off to a packer."
              emptyTitle="No picked baskets"
              showHeader={false}
              tasks={filteredTaskPool}
              title="Picked"
              trailing={`${filteredTaskPool.length}`}
              onSelect={setActiveTaskId}
            />
          ) : null}

          {activeTab === 'baskets' ? (
            <AvailableBasketSection baskets={picking?.availableBaskets ?? []} />
          ) : null}
        </>
      )}

      <StockScopeFilterModal
        options={filterOptions}
        title={activeFilter === 'tenant' ? 'Partner' : 'Store'}
        visible={activeFilter !== null}
        onClose={() => setActiveFilter(null)}
        onSelect={updateFilter}
      />
    </>
  );
}

function PickTaskList({
  activeTaskId,
  hiddenCount,
  hasMore,
  isLoadingMore,
  loadedCount,
  onClearDateFilter,
  tasks,
  total,
  onLoadMore,
  onSelect,
}: {
  activeTaskId: string | null;
  hiddenCount: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadedCount: number;
  onClearDateFilter: () => void;
  tasks: WmsMobilePickingTask[];
  total: number;
  onLoadMore: () => void | Promise<void>;
  onSelect: (taskId: string) => void;
}) {
  const remaining = Math.max(total - loadedCount, 0);

  return (
    <>
      <TaskCollectionSection
        activeTaskId={activeTaskId}
        emptyCopy={hiddenCount > 0
          ? 'Loaded orders are currently hidden by the selected date. Show all loaded dates or choose another day.'
          : 'Confirmed orders will show here after sync.'}
        emptyTitle={hiddenCount > 0 ? 'No tasks on this date' : 'No pick tasks'}
        showHeader={false}
        tasks={tasks}
        title="Orders"
        trailing={`${tasks.length}/${total}`}
        onSelect={onSelect}
      />

      {(loadedCount > 0 || hasMore) ? (
        <SurfaceCard style={styles.paginationCard}>
          <View style={styles.paginationTopRow}>
            <View style={styles.paginationIconWrap}>
              <Feather name="layers" size={16} color="#6437F6" />
            </View>
            <View style={styles.paginationCopyWrap}>
              <Text style={styles.paginationTitle}>
                {loadedCount >= total && total > 0
                  ? `All ${total} queued orders are loaded`
                  : `${loadedCount} of ${total} queued orders loaded`}
              </Text>
              <Text style={styles.paginationCopy}>
                {hiddenCount > 0
                  ? `${tasks.length} visible now · ${hiddenCount} hidden by date filter`
                  : `${tasks.length} visible in the current view`}
              </Text>
            </View>
          </View>

          {hiddenCount > 0 ? (
            <Pressable onPress={onClearDateFilter} style={styles.paginationHintButton}>
              <Feather name="calendar" size={14} color="#6437F6" />
              <Text style={styles.paginationHintText}>Show all loaded dates</Text>
            </Pressable>
          ) : null}

          {hasMore ? (
            <PrimaryButton
              label={`Load ${Math.min(PICK_LIST_PAGE_SIZE, remaining)} more order${Math.min(PICK_LIST_PAGE_SIZE, remaining) === 1 ? '' : 's'}`}
              loading={isLoadingMore}
              onPress={onLoadMore}
              style={styles.paginationButton}
              variant="secondary"
            />
          ) : (
            <View style={styles.paginationDoneRow}>
              <Feather name="check-circle" size={15} color="#2DAA73" />
              <Text style={styles.paginationDoneText}>You have reached the end of the loaded queue.</Text>
            </View>
          )}
        </SurfaceCard>
      ) : null}
    </>
  );
}

function PickTabSwitcher({
  activeTab,
  onChange,
}: {
  activeTab: PickTabKey;
  onChange: (tab: PickTabKey) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.pickTabs}>
      {PICK_TABS.map((tab) => {
        const active = activeTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={[styles.pickTabButton, active ? styles.pickTabButtonActive : null]}>
            <Text style={[styles.pickTabText, active ? styles.pickTabTextActive : null]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function PickStatusFilterRow({
  value,
  onChange,
}: {
  value: PickingStatus | null;
  onChange: (status: PickingStatus | null) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.statusFilterRow}>
      {PICK_STATUS_FILTERS.map((option) => {
        const active = value === option.value;
        return (
          <Pressable
            key={option.label}
            onPress={() => onChange(option.value)}
            style={[styles.statusFilterChip, active ? styles.statusFilterChipActive : null]}>
            <Text style={[styles.statusFilterText, active ? styles.statusFilterTextActive : null]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function TaskCollectionSection({
  activeTaskId,
  emptyCopy,
  emptyTitle,
  showHeader,
  tasks,
  title,
  trailing,
  onSelect,
}: {
  activeTaskId: string | null;
  emptyCopy: string;
  emptyTitle: string;
  showHeader?: boolean;
  tasks: WmsMobilePickingTask[];
  title: string;
  trailing?: string;
  onSelect: (taskId: string) => void;
}) {
  return (
    <>
      {showHeader !== false ? <SectionLabel title={title} trailing={trailing} /> : null}

      {tasks.length === 0 ? (
        <SurfaceCard style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>{emptyTitle}</Text>
          <Text style={styles.emptyCopy}>{emptyCopy}</Text>
        </SurfaceCard>
      ) : null}

      <View style={styles.taskList}>
        {tasks.map((task) => (
          <PickTaskCard
            key={task.id}
            active={activeTaskId === task.id}
            task={task}
            onPress={() => onSelect(task.id)}
          />
        ))}
      </View>
    </>
  );
}

function AvailableBasketSection({ baskets }: { baskets: WmsMobilePickBasket[] }) {
  return (
    <>
      <SectionLabel title="Available Baskets" trailing={`${baskets.length}`} />

      {baskets.length === 0 ? (
        <SurfaceCard style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No baskets free</Text>
          <Text style={styles.emptyCopy}>Register or release baskets in WMS Warehouses before picking.</Text>
        </SurfaceCard>
      ) : (
        <View style={styles.availableBasketGrid}>
          {baskets.slice(0, 8).map((basket) => (
            <SurfaceCard key={basket.id} tone="muted" style={styles.availableBasketCard}>
              <Text numberOfLines={1} style={styles.availableBasketCode}>{basket.barcode}</Text>
              <Text numberOfLines={1} style={styles.availableBasketMeta}>
                {basket.warehouse?.code ?? 'Warehouse'}
              </Text>
            </SurfaceCard>
          ))}
        </View>
      )}
    </>
  );
}

function ScopeDropdownCard({
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

function TaskDateCarousel({
  options,
  value,
  onChange,
}: {
  options: Array<{ key: string; month: string; day: string; weekday: string }>;
  value: string | null;
  onChange: (key: string | null) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.dateCarousel}>
      <Pressable
        onPress={() => onChange(null)}
        style={({ pressed }) => [
          styles.dateCard,
          value === null ? styles.dateCardActive : null,
          pressed ? styles.dateCardPressed : null,
          styles.dateCardAll,
        ]}>
        <Text style={[styles.dateCardAllLabel, value === null ? styles.dateCardAllLabelActive : null]}>All</Text>
        <Text style={[styles.dateCardAllMeta, value === null ? styles.dateCardAllMetaActive : null]}>Dates</Text>
      </Pressable>

      {options.map((option) => {
        const active = value === option.key;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            style={({ pressed }) => [
              styles.dateCard,
              active ? styles.dateCardActive : null,
              pressed ? styles.dateCardPressed : null,
            ]}>
            <Text style={[styles.dateCardMonth, active ? styles.dateCardMonthActive : null]}>{option.month}</Text>
            <Text style={[styles.dateCardDay, active ? styles.dateCardDayActive : null]}>{option.day}</Text>
            <Text style={[styles.dateCardWeekday, active ? styles.dateCardWeekdayActive : null]}>{option.weekday}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function PickTaskCard({
  active,
  task,
  onPress,
}: {
  active: boolean;
  task: WmsMobilePickingTask;
  onPress: () => void;
}) {
  const visibleLines = getVisiblePickLines(task.lines);
  const shortageNote = visibleLines.find((line) => line.issueReason)?.issueReason ?? null;
  const summary = visibleLines
    .slice(0, 2)
    .map((line) => `${line.required}x ${line.productName}`)
    .join(' • ');

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.taskPressable,
        pressed ? styles.pressed : null,
        active ? styles.activeTaskPressable : null,
      ]}>
      <SurfaceCard style={styles.compactTaskCard}>
        <View style={styles.compactTopRow}>
          <Text numberOfLines={1} style={styles.compactStoreLabel}>
            {task.store?.name ?? 'Store'}
          </Text>
          <View style={styles.compactIconBadge}>
            <Feather name="shopping-bag" size={14} color="#F55DB8" />
          </View>
        </View>

        <Text numberOfLines={1} style={styles.compactOrderTitle}>{task.posOrderId}</Text>

        <Text numberOfLines={2} style={styles.compactSummary}>
          {summary || `${task.totals.required} required unit${task.totals.required === 1 ? '' : 's'}`}
        </Text>

        {shortageNote ? (
          <Text numberOfLines={2} style={styles.compactIssueText}>{shortageNote}</Text>
        ) : null}

        <View style={styles.compactFooterRow}>
          <View style={styles.compactDateMeta}>
            <Feather name="clock" size={13} color="#9C83FF" />
            <Text style={styles.compactDateValue}>
              {formatPickQueueDate(task.orderDateLocal ?? task.orderDate)}
            </Text>
          </View>
          <StatusBadge status={task.status} label={mapPickCardStatus(task.status, task.statusLabel)} />
        </View>
      </SurfaceCard>
    </Pressable>
  );
}

function PickExecutionCard({
  activeBin,
  currentUserEmail,
  isSubmitting,
  onHandoff,
  task,
  onBack,
  onClaim,
  packerOptions,
  onRefresh,
  onScanBasket,
  onScanBin,
  onScanUnit,
}: {
  activeBin: { id: string; code: string; name: string } | null;
  currentUserEmail: string;
  isSubmitting: boolean;
  onHandoff: (taskId: string, packerId: string) => Promise<boolean>;
  task: WmsMobilePickingTask;
  onBack: () => void;
  onClaim: (taskId: string) => Promise<void>;
  packerOptions: WmsMobilePickingPackerOption[];
  onRefresh: () => Promise<void>;
  onScanBasket: (taskId: string, code: string) => Promise<boolean>;
  onScanBin: (taskId: string, code: string) => Promise<boolean>;
  onScanUnit: (taskId: string, code: string) => Promise<boolean>;
}) {
  const [basketCode, setBasketCode] = useState('');
  const [binCode, setBinCode] = useState('');
  const [unitCode, setUnitCode] = useState('');
  const basketInputRef = useRef<TextInput>(null);
  const binInputRef = useRef<TextInput>(null);
  const unitInputRef = useRef<TextInput>(null);
  const basketSubmitInFlightRef = useRef(false);
  const binSubmitInFlightRef = useRef(false);
  const unitSubmitInFlightRef = useRef(false);
  const [handoffVisible, setHandoffVisible] = useState(false);
  const nextPick = task.nextPick;
  const claimedByEmail = task.claimedBy?.email?.trim().toLowerCase() ?? null;
  const isClaimedByMe = Boolean(claimedByEmail && claimedByEmail === currentUserEmail.trim().toLowerCase());
  const isClaimedByAnotherPicker = task.status === 'READY' && Boolean(task.claimedBy) && !isClaimedByMe;
  const canClaim = task.status === 'READY' && !task.claimedBy;
  const canScanBasket = task.status === 'READY' && isClaimedByMe && !task.basket;
  const canScan = task.status === 'IN_PICKING';
  const hasBasket = Boolean(task.basket);
  const isBlocked = task.status === 'PARTIAL' || task.status === 'RESTOCKING' || task.status === 'ISSUE';
  const isPicked = task.status === 'READY_FOR_PACK' || task.status === 'PICKED';
  const canHandoff = isPicked && isClaimedByMe && Boolean(task.basket);
  const handoffOptions: StockScopeOption[] = packerOptions.map((packer) => ({
    label: packer.name,
    value: packer.id,
    meta: packer.employeeId ? `${packer.email} · ${packer.employeeId}` : packer.email,
  }));

  useEffect(() => {
    if (!canScanBasket && (!canScan || !nextPick)) {
      return;
    }

    const timer = setTimeout(() => {
      if (canScanBasket || !hasBasket) {
        basketInputRef.current?.focus();
      } else if (activeBin) {
        unitInputRef.current?.focus();
      } else {
        binInputRef.current?.focus();
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [activeBin, canScan, canScanBasket, hasBasket, nextPick]);

  const submitBasket = async () => {
    if (basketSubmitInFlightRef.current || isSubmitting) {
      return;
    }

    const code = basketCode.trim();
    if (!code) {
      basketInputRef.current?.focus();
      return;
    }

    basketSubmitInFlightRef.current = true;
    try {
      const ok = await onScanBasket(task.id, code);
      if (ok) {
        setBasketCode('');
        setTimeout(() => binInputRef.current?.focus(), 80);
      }
    } finally {
      basketSubmitInFlightRef.current = false;
    }
  };

  const submitBin = async () => {
    if (binSubmitInFlightRef.current || isSubmitting) {
      return;
    }

    const code = binCode.trim();
    if (!code) {
      binInputRef.current?.focus();
      return;
    }

    binSubmitInFlightRef.current = true;
    try {
      const ok = await onScanBin(task.id, code);
      if (ok) {
        setBinCode('');
        setTimeout(() => unitInputRef.current?.focus(), 80);
      }
    } finally {
      binSubmitInFlightRef.current = false;
    }
  };

  const submitUnit = async () => {
    if (unitSubmitInFlightRef.current || isSubmitting) {
      return;
    }

    const code = unitCode.trim();
    if (!code) {
      unitInputRef.current?.focus();
      return;
    }

    unitSubmitInFlightRef.current = true;
    try {
      const ok = await onScanUnit(task.id, code);
      if (ok) {
        setUnitCode('');
        setTimeout(() => unitInputRef.current?.focus(), 80);
      }
    } finally {
      unitSubmitInFlightRef.current = false;
    }
  };

  return (
    <>
      <View style={styles.executionHeader}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Feather name="chevron-left" size={20} color={tokens.colors.ink} />
        </Pressable>
        <View style={styles.executionTitleGroup}>
          <Text numberOfLines={1} style={styles.executionTitle}>#{task.posOrderId}</Text>
          <Text numberOfLines={1} style={styles.executionMeta}>
            {task.customer.name ?? task.store?.name ?? 'Pick task'}
          </Text>
        </View>
        <StatusBadge status={task.status} label={task.statusLabel} />
      </View>

      <SurfaceCard style={styles.executionCard}>
        <View style={styles.taskProgressRow}>
          <View>
            <Text style={styles.bigProgress}>{task.totals.picked}/{task.totals.required}</Text>
            <Text style={styles.progressLabel}>units picked</Text>
          </View>
          <UtilityPill icon="package" label={`${task.totals.allocated} reserved`} />
        </View>

        {task.basket ? (
          <View style={styles.basketSummary}>
            <Text style={styles.basketLabel}>Basket {task.basket.barcode}</Text>
            <Text style={styles.historyMeta}>
              {task.basket.statusLabel}
              {task.basket.fullAt ? ` · full ${formatPickOrderDate(task.basket.fullAt)}` : ''}
            </Text>
          </View>
        ) : null}

        {canClaim ? (
          <PrimaryButton
            label="Claim order"
            loading={isSubmitting}
            onPress={() => onClaim(task.id)}
          />
        ) : null}

        {canScanBasket ? (
          <View style={styles.scanPanel}>
            <ScannerInput
              autoSubmit
              inputRef={basketInputRef}
              label="Basket"
              placeholder="Scan basket barcode"
              value={basketCode}
              disabled={isSubmitting}
              helper="Scan an available basket to start picking this order."
              onChangeText={setBasketCode}
              onSubmit={submitBasket}
            />
          </View>
        ) : null}

        {isClaimedByAnotherPicker ? (
          <View style={styles.blockedPanel}>
            <Text style={styles.blockedTitle}>Claimed</Text>
            <Text style={styles.blockedCopy}>
              This order is already claimed by {task.claimedBy?.name ?? task.claimedBy?.email ?? 'another picker'}.
            </Text>
            <PrimaryButton label="Resync" onPress={onRefresh} variant="secondary" />
          </View>
        ) : null}

        {isBlocked ? (
          <View style={styles.blockedPanel}>
            <Text style={styles.blockedTitle}>
              {task.status === 'RESTOCKING' ? 'Needs stock' : task.statusLabel}
            </Text>
            <Text style={styles.blockedCopy}>
              {task.issueReason ?? 'This order is not ready because one or more products are short.'}
            </Text>
            <PrimaryButton label="Resync" onPress={onRefresh} variant="secondary" />
          </View>
        ) : null}

        {isPicked ? (
          <View style={styles.donePanel}>
            <Feather name="check-circle" size={28} color={tokens.colors.success} />
            <Text style={styles.doneTitle}>{task.status === 'READY_FOR_PACK' ? 'Ready for Pack' : 'Picked'}</Text>
            {task.basket ? (
              <Text style={styles.doneCopy}>
                Basket {task.basket.barcode} is now held for pack handoff.
              </Text>
            ) : null}
            {task.basket?.assignedPacker ? (
              <Text style={styles.doneCopy}>
                Assigned to {task.basket.assignedPacker.name} for packing.
              </Text>
            ) : (
              <Text style={styles.doneCopy}>
                Assign a packer to complete the handoff from picking.
              </Text>
            )}
            {canHandoff ? (
              <PrimaryButton
                disabled={handoffOptions.length === 0}
                label={task.basket?.assignedPacker ? 'Change packer' : 'Assign packer'}
                loading={isSubmitting}
                onPress={() => setHandoffVisible(true)}
                variant="secondary"
              />
            ) : null}
            {canHandoff && handoffOptions.length === 0 ? (
              <Text style={styles.handoffHint}>No active WMS packers with packing permission are available.</Text>
            ) : null}
          </View>
        ) : null}

        {canScan && !task.basket ? (
          <View style={styles.scanPanel}>
            <ScannerInput
              autoSubmit
              inputRef={basketInputRef}
              label="Basket"
              placeholder="Scan basket barcode"
              value={basketCode}
              disabled={isSubmitting}
              helper="Scan a registered available basket before bin and unit scans."
              onChangeText={setBasketCode}
              onSubmit={submitBasket}
            />
          </View>
        ) : null}

        {canScan && nextPick && task.basket ? (
          <View style={styles.scanPanel}>
            <View style={styles.nextUnitCard}>
              <Text style={styles.scanLabel}>Next</Text>
              <Text numberOfLines={1} style={styles.nextUnitCode}>{nextPick.unit.code}</Text>
              <Text numberOfLines={1} style={styles.nextUnitName}>{nextPick.unit.name}</Text>
              <Text numberOfLines={1} style={styles.nextUnitBin}>
                {nextPick.unit.currentLocation?.code ?? 'No bin'}
              </Text>
            </View>

            <ScannerInput
              autoSubmit
              inputRef={binInputRef}
              label="Bin"
              placeholder={nextPick.unit.currentLocation?.code ?? 'Scan bin'}
              value={binCode}
              disabled={isSubmitting}
              onChangeText={setBinCode}
              onSubmit={submitBin}
            />

            <ScannerInput
              autoSubmit
              inputRef={unitInputRef}
              label="Unit"
              placeholder="Scan unit"
              value={unitCode}
              disabled={isSubmitting || !activeBin}
              helper={activeBin ? `Bin ${activeBin.code}` : 'Scan the bin first'}
              onChangeText={setUnitCode}
              onSubmit={submitUnit}
            />
          </View>
        ) : null}
      </SurfaceCard>

      <SectionLabel title="Items" />
      <View style={styles.itemList}>
        {getVisiblePickLines(task.lines).map((line) => (
          <SurfaceCard key={line.id} tone="muted" style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <Text numberOfLines={1} style={styles.itemName}>{line.productName}</Text>
              <Text style={styles.itemQty}>{line.picked}/{line.required}</Text>
            </View>
            <Text numberOfLines={1} style={styles.itemMeta}>
              {line.shortage > 0 ? `${line.shortage} short` : `${line.allocated} reserved`}
            </Text>
          </SurfaceCard>
        ))}
      </View>

      <StockScopeFilterModal
        options={handoffOptions}
        title="Assign packer"
        visible={handoffVisible}
        onClose={() => setHandoffVisible(false)}
        onSelect={(value) => {
          if (!value) {
            setHandoffVisible(false);
            return;
          }

          void onHandoff(task.id, value).then((ok) => {
            if (ok) {
              setHandoffVisible(false);
            }
          });
        }}
      />
    </>
  );
}

function getVisiblePickLines(lines: WmsMobilePickingTask['lines']) {
  return lines.filter((line) => line.status !== 'CANCELED' && line.required > 0);
}

function ScannerInput({
  autoSubmit = false,
  autoSubmitDelayMs = 120,
  autoSubmitMinLength = 3,
  disabled,
  helper,
  inputRef,
  label,
  placeholder,
  value,
  onChangeText,
  onSubmit,
}: {
  autoSubmit?: boolean;
  autoSubmitDelayMs?: number;
  autoSubmitMinLength?: number;
  disabled?: boolean;
  helper?: string;
  inputRef: RefObject<TextInput | null>;
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  onSubmit: () => void | Promise<void>;
}) {
  const submitRef = useRef(onSubmit);
  const lastAutoSubmittedRef = useRef<string | null>(null);

  useEffect(() => {
    submitRef.current = onSubmit;
  }, [onSubmit]);

  useEffect(() => {
    const cleaned = value.trim();
    if (!cleaned) {
      lastAutoSubmittedRef.current = null;
      return;
    }

    if (
      !autoSubmit
      || disabled
      || cleaned.length < autoSubmitMinLength
      || lastAutoSubmittedRef.current === cleaned
    ) {
      return;
    }

    const timer = setTimeout(() => {
      lastAutoSubmittedRef.current = cleaned;
      void submitRef.current();
    }, autoSubmitDelayMs);

    return () => clearTimeout(timer);
  }, [autoSubmit, autoSubmitDelayMs, autoSubmitMinLength, disabled, value]);

  return (
    <View style={[styles.scanInputWrap, disabled ? styles.scanInputDisabled : null]}>
      <Text style={styles.scanInputLabel}>{label}</Text>
      <View style={styles.scanInputRow}>
        <TextInput
          ref={inputRef}
          autoCapitalize="characters"
          autoCorrect={false}
          blurOnSubmit={false}
          editable={!disabled}
          placeholder={placeholder}
          placeholderTextColor={tokens.colors.inkSoft}
          returnKeyType="done"
          selectTextOnFocus
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={() => {
            void onSubmit();
          }}
          style={styles.scanInput}
        />
        <Pressable
          disabled={disabled}
          onPress={() => {
            void onSubmit();
          }}
          style={styles.scanSubmit}>
          <Feather name="corner-down-left" size={18} color={tokens.colors.surface} />
        </Pressable>
      </View>
      {helper ? <Text style={styles.scanHelper}>{helper}</Text> : null}
    </View>
  );
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const tone = getStatusTone(status);

  return (
    <View style={[styles.statusBadge, tone === 'ready' && styles.statusReady, tone === 'warn' && styles.statusWarn, tone === 'danger' && styles.statusDanger]}>
      <Text style={[styles.statusText, tone === 'ready' && styles.statusTextReady, tone === 'warn' && styles.statusTextWarn, tone === 'danger' && styles.statusTextDanger]}>
        {label}
      </Text>
    </View>
  );
}

function buildPickingFilterOptions(
  activeFilter: PickingFilterKey | null,
  picking: {
    context: {
      tenantOptions?: Array<{ id: string; name: string; slug: string }>;
      stores: Array<{ id: string; name: string; tenantName?: string | null }>;
    };
  } | null,
  bootstrap: BootstrapResponse,
  canFilterPartners: boolean,
): StockScopeOption[] {
  if (activeFilter === 'tenant' && canFilterPartners) {
    const partners = picking?.context.tenantOptions ?? bootstrap.context.tenantOptions ?? [];
    return [
      { label: 'All partners', value: null },
      ...partners.map((partner) => ({
        label: partner.name,
        value: partner.id,
        meta: partner.slug,
      })),
    ];
  }

  const stores = picking?.context.stores ?? bootstrap.context.stores;
  return [
    { label: 'All stores', value: null },
    ...stores.map((store) => ({
      label: 'shopName' in store ? store.shopName || store.name : store.name,
      value: store.id,
      meta: 'tenantName' in store && typeof store.tenantName === 'string' ? store.tenantName : undefined,
    })),
  ];
}

function resolveActivePartnerName(
  picking: { context: { tenantOptions?: Array<{ id: string; name: string }> } } | null,
  bootstrap: BootstrapResponse,
  tenantId: PickingFilters['tenantId'],
) {
  if (!tenantId) {
    return 'All partners';
  }

  const partners = picking?.context.tenantOptions ?? bootstrap.context.tenantOptions ?? [];
  return partners.find((partner) => partner.id === tenantId)?.name ?? 'Partner';
}

function resolveActiveStoreName(
  picking: { context: { stores: Array<{ id: string; name: string }> } } | null,
  bootstrap: BootstrapResponse,
  storeId: PickingFilters['storeId'],
) {
  if (!storeId) {
    return 'All stores';
  }

  const stores = picking?.context.stores ?? bootstrap.context.stores;
  return stores.find((store) => store.id === storeId)?.name ?? 'Store';
}

function buildPickDateOptions(tasks: WmsMobilePickingTask[]) {
  const seen = new Map<string, { key: string; month: string; day: string; weekday: string; isToday: boolean; sort: number }>();
  const todayKey = buildDateKey(new Date());

  for (const task of tasks) {
    const parsed = parsePickDate(task.orderDateLocal ?? task.orderDate);
    if (!parsed) {
      continue;
    }

    const key = buildDateKey(parsed);
    if (seen.has(key)) {
      continue;
    }

    seen.set(key, {
      key,
      month: parsed.toLocaleDateString('en-PH', { month: 'short' }),
      day: parsed.toLocaleDateString('en-PH', { day: '2-digit' }),
      weekday: parsed.toLocaleDateString('en-PH', { weekday: 'short' }),
      isToday: key === todayKey,
      sort: parsed.getTime(),
    });
  }

  return Array.from(seen.values())
    .sort((left, right) => left.sort - right.sort)
    .map(({ sort, ...option }) => option);
}

function getPickTaskDateKey(task: WmsMobilePickingTask) {
  const parsed = parsePickDate(task.orderDateLocal ?? task.orderDate);
  return parsed ? buildDateKey(parsed) : null;
}

function parsePickDate(value: string) {
  if (!value) {
    return null;
  }

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (dateOnlyMatch) {
    return new Date(
      Number(dateOnlyMatch[1]),
      Number(dateOnlyMatch[2]) - 1,
      Number(dateOnlyMatch[3]),
    );
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function buildDateKey(date: Date) {
  return [
    date.getFullYear(),
    `${date.getMonth() + 1}`.padStart(2, '0'),
    `${date.getDate()}`.padStart(2, '0'),
  ].join('-');
}

function getStatusTone(status: string) {
  if (status === 'READY' || status === 'AVAILABLE' || status === 'IN_PICKING' || status === 'READY_FOR_PACK' || status === 'PICKED') {
    return 'ready';
  }

  if (status === 'ISSUE' || status === 'DAMAGED' || status === 'RETIRED') {
    return 'danger';
  }

  return 'warn';
}

function formatPickOrderDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'No date';
  }

  return date.toLocaleString('en-PH', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

function formatPickQueueDate(value: string) {
  const parsed = parsePickDate(value);
  if (!parsed) {
    return 'No date';
  }

  return parsed.toLocaleDateString('en-PH', {
    hour: undefined,
    minute: undefined,
    month: 'short',
    day: '2-digit',
  });
}

function mapPickCardStatus(status: PickingStatus, fallback: string) {
  if (status === 'READY') {
    return 'To do';
  }
  if (status === 'IN_PICKING') {
    return 'In Progress';
  }
  if (status === 'READY_FOR_PACK' || status === 'PICKED') {
    return 'Picked';
  }
  if (status === 'RESTOCKING') {
    return 'Restocking';
  }
  if (status === 'ISSUE') {
    return 'Issues';
  }
  return fallback;
}

const styles = StyleSheet.create({
  loadingCard: {
    alignItems: 'center',
    gap: tokens.spacing.sm,
    minHeight: 140,
    justifyContent: 'center',
  },
  loadingText: {
    color: tokens.colors.inkMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
  },
  pickTabs: {
    gap: 10,
    paddingBottom: 2,
  },
  pickTabButton: {
    alignItems: 'center',
    backgroundColor: '#EEE9FF',
    borderRadius: 16,
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  pickTabButtonActive: {
    backgroundColor: '#6437F6',
    shadowColor: '#6437F6',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
  },
  pickTabText: {
    color: '#6F5BCB',
    fontSize: 15,
    fontWeight: '700',
  },
  pickTabTextActive: {
    color: '#FFFFFF',
  },
  statusFilterRow: {
    gap: 10,
    paddingBottom: 4,
  },
  statusFilterChip: {
    alignItems: 'center',
    backgroundColor: '#EEE9FF',
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 18,
  },
  statusFilterChipActive: {
    backgroundColor: '#6437F6',
  },
  statusFilterText: {
    color: '#6F5BCB',
    fontSize: 15,
    fontWeight: '700',
  },
  statusFilterTextActive: {
    color: '#FFFFFF',
  },
  queueHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 2,
  },
  queueHeaderTitle: {
    color: '#24232D',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  queueBellButton: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    position: 'relative',
    width: 34,
  },
  queueBellDot: {
    backgroundColor: '#6437F6',
    borderColor: '#FBFAFF',
    borderRadius: 5,
    borderWidth: 2,
    height: 10,
    position: 'absolute',
    right: 5,
    top: 4,
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
    width: 56,
  },
  dateCardActive: {
    backgroundColor: '#6437F6',
  },
  dateCardPressed: {
    opacity: 0.92,
  },
  dateCardAll: {
    width: 68,
  },
  dateCardAllLabel: {
    color: '#24232D',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  dateCardAllLabelActive: {
    color: '#FFFFFF',
  },
  dateCardAllMeta: {
    color: '#6A6680',
    fontSize: 12,
    fontWeight: '600',
  },
  dateCardAllMetaActive: {
    color: '#F4EEFF',
  },
  dateCardMonth: {
    color: '#353346',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  dateCardMonthActive: {
    color: '#F4EEFF',
  },
  dateCardDay: {
    color: '#24232D',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  dateCardDayActive: {
    color: '#FFFFFF',
  },
  dateCardWeekday: {
    color: '#59556D',
    fontSize: 12,
    fontWeight: '600',
  },
  dateCardWeekdayActive: {
    color: '#F4EEFF',
  },
  errorCard: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  errorText: {
    color: tokens.colors.danger,
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
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
  lookupCard: {
    gap: tokens.spacing.md,
  },
  lookupResult: {
    borderColor: tokens.colors.border,
    borderTopWidth: 1,
    gap: tokens.spacing.sm,
    paddingTop: tokens.spacing.md,
  },
  lookupCopy: {
    color: tokens.colors.inkMuted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  lookupClear: {
    alignSelf: 'flex-start',
  },
  lookupClearText: {
    color: tokens.colors.panel,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  availableBasketGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  availableBasketCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    flexBasis: '47%',
    flexGrow: 1,
    gap: 4,
    paddingVertical: 18,
    shadowColor: '#9C83FF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
  },
  availableBasketCode: {
    color: '#24232D',
    fontSize: 14,
    fontWeight: '800',
  },
  availableBasketMeta: {
    color: '#8F8AAB',
    fontSize: 11,
    fontWeight: '700',
  },
  taskList: {
    gap: 18,
  },
  paginationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    gap: 14,
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 18,
    shadowColor: '#9C83FF',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
  },
  paginationTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  paginationIconWrap: {
    alignItems: 'center',
    backgroundColor: '#EEE9FF',
    borderRadius: 14,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  paginationCopyWrap: {
    flex: 1,
    minWidth: 0,
  },
  paginationTitle: {
    color: '#24232D',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  paginationCopy: {
    color: '#7B7791',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 2,
  },
  paginationHintButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 8,
  },
  paginationHintText: {
    color: '#6437F6',
    fontSize: 12,
    fontWeight: '800',
  },
  paginationButton: {
    minHeight: 52,
  },
  paginationDoneRow: {
    alignItems: 'center',
    backgroundColor: '#EEF9F3',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 14,
  },
  paginationDoneText: {
    color: '#227E56',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  taskPressable: {},
  activeTaskPressable: {
    opacity: 0.92,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  taskCard: {
    gap: tokens.spacing.md,
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
  compactOrderTitle: {
    color: '#24232D',
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  compactIssueText: {
    color: '#E8735B',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
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
    backgroundColor: '#FFE1F2',
    borderRadius: 12,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  compactSummary: {
    color: '#524F66',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  compactFooterRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  compactDateMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  compactDateValue: {
    color: '#9C83FF',
    fontSize: 13,
    fontWeight: '700',
  },
  taskHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: tokens.spacing.md,
    justifyContent: 'space-between',
  },
  taskTitleGroup: {
    flex: 1,
    minWidth: 0,
  },
  taskId: {
    color: tokens.colors.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  taskStore: {
    color: tokens.colors.inkMuted,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  taskDate: {
    color: tokens.colors.inkSoft,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 3,
  },
  basketLabel: {
    color: tokens.colors.panel,
    fontSize: 16,
    fontWeight: '900',
  },
  basketMeta: {
    color: tokens.colors.inkSoft,
    fontSize: 12,
    fontWeight: '800',
  },
  historyMeta: {
    color: tokens.colors.inkMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  taskProgress: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: tokens.spacing.xs,
  },
  progressValue: {
    color: tokens.colors.panel,
    fontSize: 24,
    fontWeight: '900',
  },
  progressLabel: {
    color: tokens.colors.inkMuted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  linePreview: {
    gap: 4,
  },
  linePreviewText: {
    color: tokens.colors.inkMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  statusReady: {
    backgroundColor: '#EAF8F3',
  },
  statusWarn: {
    backgroundColor: '#FFF1E8',
  },
  statusDanger: {
    backgroundColor: '#FFE8E4',
  },
  statusText: {
    color: '#6C6882',
    fontSize: 11,
    fontWeight: '700',
  },
  statusTextReady: {
    color: '#17B57C',
  },
  statusTextWarn: {
    color: '#F28B50',
  },
  statusTextDanger: {
    color: '#E8735B',
  },
  executionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  executionTitleGroup: {
    flex: 1,
    minWidth: 0,
  },
  executionTitle: {
    color: tokens.colors.ink,
    fontSize: 20,
    fontWeight: '900',
  },
  executionMeta: {
    color: tokens.colors.inkMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  executionCard: {
    gap: tokens.spacing.lg,
  },
  basketHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: tokens.spacing.md,
    justifyContent: 'space-between',
  },
  basketSummary: {
    backgroundColor: tokens.colors.surfaceMuted,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    gap: 4,
    padding: tokens.spacing.md,
  },
  taskProgressRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bigProgress: {
    color: tokens.colors.ink,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1,
  },
  blockedPanel: {
    backgroundColor: tokens.colors.surfaceMuted,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    gap: tokens.spacing.sm,
    padding: tokens.spacing.md,
  },
  blockedTitle: {
    color: tokens.colors.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  blockedCopy: {
    color: tokens.colors.inkMuted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  donePanel: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 157, 122, 0.10)',
    borderRadius: tokens.radius.lg,
    gap: tokens.spacing.sm,
    padding: tokens.spacing.lg,
  },
  doneTitle: {
    color: tokens.colors.success,
    fontSize: 20,
    fontWeight: '900',
  },
  doneCopy: {
    color: tokens.colors.success,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  handoffHint: {
    color: tokens.colors.inkMuted,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  scanPanel: {
    gap: tokens.spacing.md,
  },
  nextUnitCard: {
    backgroundColor: tokens.colors.panel,
    borderRadius: tokens.radius.lg,
    gap: 4,
    padding: tokens.spacing.md,
  },
  scanLabel: {
    color: tokens.colors.accent,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  nextUnitCode: {
    color: tokens.colors.surface,
    fontSize: 20,
    fontWeight: '900',
  },
  nextUnitName: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    fontWeight: '700',
  },
  nextUnitBin: {
    color: tokens.colors.accent,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 4,
  },
  scanInputWrap: {
    gap: tokens.spacing.xs,
  },
  scanInputDisabled: {
    opacity: 0.62,
  },
  scanInputLabel: {
    color: tokens.colors.inkMuted,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  scanInputRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  scanInput: {
    backgroundColor: tokens.colors.surfaceMuted,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    color: tokens.colors.ink,
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    minHeight: 54,
    paddingHorizontal: tokens.spacing.md,
  },
  scanSubmit: {
    alignItems: 'center',
    backgroundColor: tokens.colors.panel,
    borderRadius: tokens.radius.lg,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  scanHelper: {
    color: tokens.colors.inkMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  itemList: {
    gap: tokens.spacing.sm,
  },
  itemCard: {
    gap: tokens.spacing.xs,
  },
  itemHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    justifyContent: 'space-between',
  },
  itemName: {
    color: tokens.colors.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
  },
  itemQty: {
    color: tokens.colors.panel,
    fontSize: 16,
    fontWeight: '900',
  },
  itemMeta: {
    color: tokens.colors.inkMuted,
    fontSize: 12,
    fontWeight: '700',
  },
});
