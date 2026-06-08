import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { BootstrapResponse, DeviceIdentity, StoredSession } from '@/src/features/auth/types';
import { canUseStoxRtsWorkspace, canVerifyStoxRts } from '@/src/features/home/rbac';
import type { WmsMobilePickingTask } from '@/src/features/picking/types';
import { StockScopeFilterModal } from '@/src/features/stock/components/stock-scope-filter';
import type { StockScopeOption } from '@/src/features/stock/utils/stock-scope';
import {
  fetchMobileRtsTasks,
  lookupMobileTrackingOrder,
  verifyMobileTrackingReturnUnit,
} from '@/src/features/stock/services/stock-api';
import type { WmsMobileRtsTasksResponse, WmsMobileTrackingReturnFlow } from '@/src/features/stock/types';
import { normalizeScannedCode } from '@/src/features/stock/hooks/use-stock-execution';
import { PrimaryButton } from '@/src/shared/components/primary-button';
import { SurfaceCard } from '@/src/shared/components/surface-card';
import { tokens } from '@/src/shared/theme/tokens';
import { BlockedTaskState, TaskHeader, TaskHeaderIconButton } from './stox-primitives';

type RtsTabProps = {
  bootstrap: BootstrapResponse;
  device: DeviceIdentity | null;
  session: StoredSession;
  onRefresh: () => Promise<void>;
  onBack?: () => void;
  modeSwitcher?: ReactNode;
  initialTask?: WmsMobilePickingTask | null;
  initialReturnFlow?: WmsMobileTrackingReturnFlow | null;
};

type RtsQueueEntry = WmsMobileRtsTasksResponse['tasks'][number];
type RtsFilterKey = 'tenant' | 'store';
type RtsQueueState = WmsMobileTrackingReturnFlow['state'];
type RtsQueueFilter = 'ALL' | 'RETURNING' | 'READY_TO_VERIFY' | 'PROCESSED';

const RTS_STATE_FILTERS: Array<{ key: RtsQueueFilter; label: string }> = [
  { key: 'ALL', label: 'All' },
  { key: 'RETURNING', label: 'Returning' },
  { key: 'READY_TO_VERIFY', label: 'Returned' },
  { key: 'PROCESSED', label: 'Processed' },
];

export function RtsTab({
  bootstrap,
  device,
  session,
  onRefresh,
  onBack,
  modeSwitcher,
  initialTask = null,
  initialReturnFlow = null,
}: RtsTabProps) {
  if (!canUseStoxRtsWorkspace(bootstrap)) {
    return (
      <>
        <TaskHeader title="RTS" />
        <BlockedTaskState copy="This account needs WMS inventory or dispatch access to inspect return-to-sender tasks." />
      </>
    );
  }

  return (
    <RtsWorkspaceTab
      bootstrap={bootstrap}
      device={device}
      initialReturnFlow={initialReturnFlow}
      initialTask={initialTask}
      modeSwitcher={modeSwitcher}
      onBack={onBack}
      onRefresh={onRefresh}
      session={session}
    />
  );
}

function RtsWorkspaceTab({
  bootstrap,
  device,
  initialReturnFlow,
  initialTask,
  modeSwitcher,
  onBack,
  onRefresh,
  session,
}: RtsTabProps) {
  const [tenantId, setTenantId] = useState<string | null>(
    initialTask?.store?.tenantId ?? bootstrap.tenant?.id ?? null,
  );
  const [storeId, setStoreId] = useState<string | null>(initialTask?.store?.id ?? null);
  const [activeFilter, setActiveFilter] = useState<RtsFilterKey | null>(null);
  const [queueStateFilter, setQueueStateFilter] = useState<RtsQueueFilter>('ALL');
  const [returnCode, setReturnCode] = useState('');
  const [task, setTask] = useState<WmsMobilePickingTask | null>(initialTask ?? null);
  const [returnFlow, setReturnFlow] = useState<WmsMobileTrackingReturnFlow | null>(initialReturnFlow ?? null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isRefreshingTask, setIsRefreshingTask] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [queue, setQueue] = useState<RtsQueueEntry[]>([]);
  const [queueStores, setQueueStores] = useState<WmsMobileRtsTasksResponse['context']['stores']>([]);
  const [queuePage, setQueuePage] = useState(1);
  const [queueHasMore, setQueueHasMore] = useState(false);
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);
  const [isLoadingMoreQueue, setIsLoadingMoreQueue] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const returnInputRef = useRef<TextInput>(null);
  const lastReturnSubmitRef = useRef<string | null>(null);
  const canVerify = canVerifyStoxRts(bootstrap);

  useEffect(() => {
    setTask(initialTask ?? null);
    setReturnFlow(initialReturnFlow ?? null);
    setTenantId(initialTask?.store?.tenantId ?? bootstrap.tenant?.id ?? null);
    setStoreId(initialTask?.store?.id ?? null);
    setReturnCode('');
    setError(null);
    setMessage(null);
    lastReturnSubmitRef.current = null;
  }, [bootstrap.tenant?.id, initialReturnFlow, initialTask]);

  const loadQueue = useCallback(async (mode: 'replace' | 'append' = 'replace') => {
    if (!device) {
      return;
    }

    if (mode === 'replace') {
      setIsLoadingQueue(true);
    } else {
      setIsLoadingMoreQueue(true);
    }

    try {
      const nextPage = mode === 'append' ? queuePage + 1 : 1;
      const response = await fetchMobileRtsTasks({
        accessToken: session.accessToken,
        device,
        tenantId,
        storeId,
        page: nextPage,
        pageSize: 10,
      });

      setQueue((current) => {
        if (mode === 'replace') {
          return response.tasks;
        }

        const seen = new Set(current.map((entry) => entry.task.id));
        return [
          ...current,
          ...response.tasks.filter((entry) => !seen.has(entry.task.id)),
        ];
      });
      setQueuePage(response.pagination.page);
      setQueueHasMore(response.pagination.hasMore);
      setQueueStores(response.context.stores);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load RTS tasks.');
    } finally {
      setIsLoadingQueue(false);
      setIsLoadingMoreQueue(false);
    }
  }, [device, queuePage, session.accessToken, storeId, tenantId]);

  useEffect(() => {
    void loadQueue('replace');
  }, [loadQueue]);

  useEffect(() => {
    if (!task || !returnFlow?.canVerify) {
      return;
    }

    const timer = setTimeout(() => {
      returnInputRef.current?.focus();
    }, 120);

    return () => clearTimeout(timer);
  }, [returnFlow?.canVerify, task]);

  const filterOptions = useMemo(
    () => buildRtsFilterOptions(activeFilter, queueStores, bootstrap, bootstrap.user.role === 'SUPER_ADMIN'),
    [activeFilter, bootstrap, queueStores],
  );

  const activeTenantName = useMemo(() => {
    if (!tenantId) {
      return bootstrap.tenant?.name ?? 'All partners';
    }

    return bootstrap.context.tenantOptions?.find((tenant) => tenant.id === tenantId)?.name
      ?? bootstrap.tenant?.name
      ?? 'Selected partner';
  }, [bootstrap.context.tenantOptions, bootstrap.tenant?.name, tenantId]);
  const activeStoreName = useMemo(() => {
    if (!storeId) {
      return 'All stores';
    }

    return queueStores.find((store) => store.id === storeId)?.name
      ?? bootstrap.context.stores?.find((store) => store.id === storeId)?.name
      ?? 'Store';
  }, [bootstrap.context.stores, queueStores, storeId]);
  const filteredQueue = useMemo(() => {
    if (queueStateFilter === 'ALL') {
      return queue;
    }

    if (queueStateFilter === 'PROCESSED') {
      return queue.filter((entry) => (
        entry.returnFlow.state === 'PARTIAL' || entry.returnFlow.state === 'VERIFIED'
      ));
    }

    return queue.filter((entry) => entry.returnFlow.state === queueStateFilter);
  }, [queue, queueStateFilter]);

  const updateFilter = (value: string | null) => {
    if (activeFilter === 'tenant') {
      setTenantId(value);
      setStoreId(null);
    }

    if (activeFilter === 'store') {
      setStoreId(value);
    }

    resetTask();
  };

  const lookupWaybill = useCallback(async (code: string) => {
    const normalized = normalizeScannedCode(code);
    if (!device) {
      setError('Device is not ready.');
      return;
    }

    if (!normalized) {
      setError('Scan or enter a waybill.');
      return;
    }

    setIsLookingUp(true);
    setError(null);
    setMessage(null);

    try {
      const response = await lookupMobileTrackingOrder({
        accessToken: session.accessToken,
        code: normalized,
        device,
        tenantId,
      });

      if (!response.found || !response.task) {
        setTask(null);
        setReturnFlow(null);
        setError(`No packed waybill matched ${normalized}.`);
        return;
      }

      setTask(response.task);
      setReturnFlow(response.returnFlow);

      if (!response.returnFlow?.eligible) {
        setMessage('Not ready for RTS.');
        return;
      }

      if (response.returnFlow.state === 'RETURNING') {
        setMessage('Still returning.');
        return;
      }

      setMessage(null);
      void loadQueue('replace');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load the RTS task.');
    } finally {
      setIsLookingUp(false);
    }
  }, [device, loadQueue, session.accessToken, tenantId]);

  const refreshTask = useCallback(async () => {
    await onRefresh();

    const trackingCode = task?.tracking?.trim();
    if (!trackingCode) {
      await loadQueue('replace');
      return;
    }

    setIsRefreshingTask(true);
    try {
      await lookupWaybill(trackingCode);
    } finally {
      setIsRefreshingTask(false);
    }
  }, [loadQueue, lookupWaybill, onRefresh, task?.tracking]);

  const verifyReturnUnit = useCallback(async (nextCode?: string) => {
    if (!task || !returnFlow) {
      setError('Load an RTS task first.');
      return false;
    }

    const normalized = normalizeScannedCode(nextCode ?? returnCode);
    if (!device) {
      setError('Device is not ready.');
      return false;
    }

    if (!normalized) {
      setError('Scan or enter a returned unit.');
      return false;
    }

    if (!canVerify) {
      setError('This account can inspect returns but cannot verify RTS units.');
      return false;
    }

    setIsVerifying(true);
    setError(null);
    setMessage(null);

    try {
      const response = await verifyMobileTrackingReturnUnit({
        accessToken: session.accessToken,
        code: normalized,
        device,
        taskId: task.id,
        tenantId,
      });

      if (response.task) {
        setTask(response.task);
      }
      setReturnFlow(response.returnFlow);
      setReturnCode('');
      setMessage(`Verified ${response.unit.code}.`);
      void loadQueue('replace');
      return true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to verify the returned unit.');
      return false;
    } finally {
      setIsVerifying(false);
    }
  }, [canVerify, device, loadQueue, returnCode, returnFlow, session.accessToken, task, tenantId]);

  useEffect(() => {
    const nextCode = returnCode.trim();

    if (
      !task
      || !returnFlow?.canVerify
      || !canVerify
      || isVerifying
      || nextCode.length < 3
      || lastReturnSubmitRef.current === nextCode
    ) {
      return;
    }

    const timer = setTimeout(() => {
      lastReturnSubmitRef.current = nextCode;
      void (async () => {
        const success = await verifyReturnUnit(nextCode);
        if (success) {
          setReturnCode('');
        }
      })();
    }, 220);

    return () => clearTimeout(timer);
  }, [canVerify, isVerifying, returnCode, returnFlow?.canVerify, task, verifyReturnUnit]);

  useEffect(() => {
    if (!returnCode.trim()) {
      lastReturnSubmitRef.current = null;
    }
  }, [returnCode]);

  const resetTask = () => {
    setTask(null);
    setReturnFlow(null);
    setReturnCode('');
    setError(null);
    setMessage(null);
  };

  const openQueueTask = useCallback((entry: RtsQueueEntry) => {
    setTask(entry.task);
    setReturnFlow(entry.returnFlow);
    setReturnCode('');
    setError(null);
    setMessage(null);
  }, []);

  return (
    <>
      {!task ? (
        <>
          {onBack ? (
            <View style={styles.topActionRow}>
              <Pressable
                onPress={onBack}
                style={({ pressed }) => [styles.backChip, pressed ? styles.backChipPressed : null]}>
                <Feather name="arrow-left" size={16} color={tokens.colors.panel} />
                <Text style={styles.backChipText}>Inventory</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.queueHeaderBar}>
            <TaskHeaderIconButton
              icon="refresh-cw"
              loading={isRefreshingTask || isLookingUp || isLoadingQueue}
              onPress={refreshTask}
            />
            <Text style={styles.queueHeaderTitle}>RTS Tasks</Text>
            <View style={styles.queueBellButton}>
              <Feather name="bell" size={18} color="#1F1F28" />
              <View style={styles.queueBellDot} />
            </View>
          </View>

          <View style={styles.queueFilterStack}>
            {bootstrap.user.role === 'SUPER_ADMIN' ? (
              <ScopeDropdownCard
                icon="briefcase"
                label="Partner"
                value={activeTenantName}
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

          {modeSwitcher ? (
            <View style={styles.modeSwitcherSlot}>
              {modeSwitcher}
            </View>
          ) : null}

          <RtsStatusFilterRow value={queueStateFilter} onChange={setQueueStateFilter} />
        </>
      ) : (
        <View style={styles.executionHeader}>
          <Pressable onPress={resetTask} style={styles.backButton}>
            <Feather name="chevron-left" size={20} color={tokens.colors.ink} />
          </Pressable>
          <View style={styles.executionTitleGroup}>
            <Text numberOfLines={1} style={styles.executionTitle}>
              {task.tracking ?? `#${task.posOrderId}`}
            </Text>
            <Text numberOfLines={1} style={styles.executionMeta}>
              {task.store?.name ?? `Order ${task.posOrderId}`}
            </Text>
          </View>
          <RtsStateBadge state={returnFlow?.state ?? 'NONE'} label={returnFlow?.label ?? (returnFlow?.posStatusLabel ?? 'RTS')} />
        </View>
      )}

      {error ? (
        <SurfaceCard tone="muted" style={styles.noticeCard}>
          <Text style={styles.errorText}>{error}</Text>
        </SurfaceCard>
      ) : null}

      {message ? (
        <SurfaceCard tone="muted" style={styles.noticeCard}>
          <Text style={styles.messageText}>{message}</Text>
        </SurfaceCard>
      ) : null}

      {!task ? (
        <>
          {isLoadingQueue ? (
            <SurfaceCard style={styles.loadingCard}>
              <ActivityIndicator color={tokens.colors.panel} />
              <Text style={styles.loadingText}>Loading RTS tasks</Text>
            </SurfaceCard>
          ) : null}

          <RtsTaskList
            activeTaskId={null}
            hasMore={queueHasMore}
            isLoadingMore={isLoadingMoreQueue}
            scopeLabel={storeId ? activeStoreName : 'All stores'}
            tasks={filteredQueue}
            onLoadMore={() => void loadQueue('append')}
            onSelect={(entry) => openQueueTask(entry)}
          />
        </>
      ) : null}

      {task && returnFlow ? (
        <>
          <SurfaceCard style={styles.executionCard}>
            <View style={styles.taskProgressRow}>
              <View>
                <Text style={styles.bigProgress}>{returnFlow.verifiedUnits.length}/{returnFlow.expectedUnits}</Text>
                <Text style={styles.progressLabel}>verified</Text>
              </View>
              <RtsStateBadge state={returnFlow.state} label={returnFlow.posStatusLabel ?? task.delivery?.label ?? 'RTS'} compact />
            </View>

            <View style={styles.rtsFactGrid}>
              <RtsFact label="Picked" value={task.claimedBy?.name ?? 'Unknown'} />
              <RtsFact label="Packed" value={task.packedBy?.name ?? 'Unknown'} />
              {task.tracking ? (
                <RtsFact label="Waybill" value={task.tracking} />
              ) : null}
              {returnFlow.lastVerifiedAt ? (
                <RtsFact label="Last scan" value={formatRtsDateTime(returnFlow.lastVerifiedAt)} />
              ) : null}
            </View>

            {returnFlow.state === 'RETURNING' ? (
              <View style={styles.blockedPanel}>
                <Text style={styles.blockedTitle}>Return in transit</Text>
                <PrimaryButton label="Refresh" onPress={refreshTask} variant="secondary" />
              </View>
            ) : null}

            {returnFlow.canVerify ? (
              canVerify ? (
                <View style={styles.scanPanel}>
                  <View style={styles.nextUnitCard}>
                    <Text style={styles.scanLabel}>Next unit</Text>
                    <Text numberOfLines={1} style={styles.nextUnitCode}>
                      {returnFlow.pendingUnits[0]?.code ?? 'Ready'}
                    </Text>
                    <Text numberOfLines={1} style={styles.nextUnitName}>
                      {returnFlow.pendingUnits[0]?.name ?? `${returnFlow.pendingUnits.length} pending`}
                    </Text>
                  </View>

                  <View style={styles.scanInputWrap}>
                    <Text style={styles.scanInputLabel}>Unit</Text>
                    <View style={styles.scanInputRow}>
                      <TextInput
                        ref={returnInputRef}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        blurOnSubmit={false}
                        placeholder="Scan returned unit"
                        placeholderTextColor={tokens.colors.inkSoft}
                        returnKeyType="done"
                        selectTextOnFocus
                        showSoftInputOnFocus={false}
                        value={returnCode}
                        onChangeText={(value) => setReturnCode(normalizeScannedCode(value))}
                        onSubmitEditing={() => {
                          void verifyReturnUnit();
                        }}
                        style={styles.scanInput}
                      />
                      <Pressable
                        disabled={isVerifying}
                        onPress={() => {
                          void verifyReturnUnit();
                        }}
                        style={[styles.scanSubmit, isVerifying ? styles.scanSubmitDisabled : null]}>
                        {isVerifying ? (
                          <ActivityIndicator color={tokens.colors.surface} size="small" />
                        ) : (
                          <Feather name="corner-down-left" size={18} color={tokens.colors.surface} />
                        )}
                      </Pressable>
                    </View>
                  </View>

                  <PrimaryButton
                    label={isVerifying ? 'Checking…' : 'Verify'}
                    loading={isVerifying}
                    onPress={() => void verifyReturnUnit()}
                  />
                </View>
              ) : (
                <View style={styles.blockedPanel}>
                  <Text style={styles.blockedTitle}>Verification permission required</Text>
                </View>
              )
            ) : null}
          </SurfaceCard>

          <RtsUnitSection
            state="READY_TO_VERIFY"
            title="Pending"
            units={returnFlow.pendingUnits}
          />

          <RtsUnitSection
            state="VERIFIED"
            title="Verified"
            units={returnFlow.verifiedUnits}
          />

          <PrimaryButton
            label="Back"
            onPress={resetTask}
            variant="secondary"
          />
        </>
      ) : null}

      <StockScopeFilterModal
        title={activeFilter === 'store' ? 'Store' : 'Partner'}
        visible={activeFilter !== null}
        options={filterOptions}
        onClose={() => {
          setActiveFilter(null);
        }}
        onSelect={(value) => {
          updateFilter(value);
          setActiveFilter(null);
        }}
      />
    </>
  );
}

function RtsTaskList({
  activeTaskId,
  hasMore,
  isLoadingMore,
  scopeLabel,
  tasks,
  onLoadMore,
  onSelect,
}: {
  activeTaskId: string | null;
  hasMore: boolean;
  isLoadingMore: boolean;
  scopeLabel: string;
  tasks: RtsQueueEntry[];
  onLoadMore: () => void;
  onSelect: (entry: RtsQueueEntry) => void;
}) {
  return (
    <>
      {tasks.length === 0 ? (
        <SurfaceCard style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No RTS tasks</Text>
          <Text style={styles.emptyMeta}>{scopeLabel}</Text>
        </SurfaceCard>
      ) : null}

      <View style={styles.taskList}>
        {tasks.map((entry) => (
          <RtsTaskCard
            key={entry.task.id}
            active={activeTaskId === entry.task.id}
            entry={entry}
            onPress={() => onSelect(entry)}
          />
        ))}
      </View>

      {hasMore ? (
        <PrimaryButton
          label={isLoadingMore ? 'Loading…' : 'Load more'}
          loading={isLoadingMore}
          onPress={onLoadMore}
          variant="secondary"
        />
      ) : null}
    </>
  );
}

function RtsStatusFilterRow({
  value,
  onChange,
}: {
  value: RtsQueueFilter;
  onChange: (value: RtsQueueFilter) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.statusFilterRow}>
      {RTS_STATE_FILTERS.map((filter) => {
        const active = value === filter.key;
        return (
          <Pressable
            key={filter.key}
            onPress={() => onChange(filter.key)}
            style={[styles.statusFilterChip, active ? styles.statusFilterChipActive : null]}>
            <Text style={[styles.statusFilterText, active ? styles.statusFilterTextActive : null]}>
              {filter.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function RtsFact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.rtsFact}>
      <Text style={styles.rtsFactLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.rtsFactValue}>{value}</Text>
    </View>
  );
}

function RtsUnitSection({
  state,
  title,
  units,
}: {
  state: RtsQueueState;
  title: string;
  units: WmsMobileTrackingReturnFlow['pendingUnits'];
}) {
  if (units.length === 0) {
    return null;
  }

  return (
    <View style={styles.unitSection}>
      <View style={styles.unitSectionHeader}>
        <Text style={styles.unitSectionTitle}>{title}</Text>
        <Text style={styles.unitSectionCount}>{units.length}</Text>
      </View>
      <View style={styles.itemList}>
        {units.map((unit) => (
          <SurfaceCard key={unit.id} tone="muted" style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <Text numberOfLines={1} style={styles.itemName}>{unit.code}</Text>
              <RtsStateBadge state={state} label={unit.statusLabel} compact />
            </View>
            <Text numberOfLines={1} style={styles.itemMeta}>{unit.name}</Text>
          </SurfaceCard>
        ))}
      </View>
    </View>
  );
}

function ScopeDropdownCard({
  icon,
  label,
  onPress,
  value,
}: {
  icon: ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
  value: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.scopeDropdownWrap,
        pressed ? styles.scopeDropdownWrapPressed : null,
      ]}>
      <SurfaceCard style={styles.scopeDropdownCard}>
        <View style={styles.scopeDropdownIcon}>
          <Feather name={icon} size={16} color="#F766B4" />
        </View>
        <View style={styles.scopeDropdownCopy}>
          <Text style={styles.scopeDropdownLabel}>{label}</Text>
          <Text numberOfLines={1} style={styles.scopeDropdownValue}>{value}</Text>
        </View>
        <Feather name="chevron-down" size={18} color="#8C83B3" />
      </SurfaceCard>
    </Pressable>
  );
}

function RtsTaskCard({
  active,
  entry,
  onPress,
}: {
  active: boolean;
  entry: RtsQueueEntry;
  onPress: () => void;
}) {
  const { task, returnFlow } = entry;
  const pendingCount = Math.max(returnFlow.expectedUnits - returnFlow.verifiedUnits.length, 0);
  const summary = `${returnFlow.verifiedUnits.length}/${returnFlow.expectedUnits}`;
  const issue = returnFlow.state === 'RETURNING'
    ? 'Returning'
    : returnFlow.state === 'PARTIAL'
      ? `${pendingCount} pending`
      : null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.taskPressable,
        pressed ? styles.pressed : null,
        active ? styles.activeTaskPressable : null,
      ]}>
      <SurfaceCard tone="muted" style={styles.compactTaskCard}>
        <View style={styles.compactTopRow}>
          <Text numberOfLines={1} style={styles.compactStoreLabel}>
            {task.store?.name ?? 'Store'}
          </Text>
          <View style={styles.compactIconBadge}>
            <Feather name="refresh-ccw" size={14} color="#F55DB8" />
          </View>
        </View>

        <Text numberOfLines={1} style={styles.compactOrderTitle}>
          {task.tracking ?? `Order ${task.posOrderId}`}
        </Text>

        <Text numberOfLines={2} style={styles.compactSummary}>
          {summary}
        </Text>

        {issue ? (
          <Text numberOfLines={2} style={styles.compactIssueText}>{issue}</Text>
        ) : (
          <Text numberOfLines={1} style={styles.compactSubMeta}>
            {task.claimedBy?.name ?? 'Unknown'} · {task.packedBy?.name ?? 'Unknown'}
          </Text>
        )}

        <View style={styles.compactFooterRow}>
          <View style={styles.compactDateMeta}>
            <Feather name="clock" size={13} color="#9C83FF" />
            <Text style={styles.compactDateValue}>
              {formatRtsQueueDate(task.delivery?.deliveredAt ?? task.completedAt ?? task.createdAt)}
            </Text>
          </View>
          <RtsStateBadge state={returnFlow.state} label={returnFlow.label ?? 'RTS'} compact />
        </View>
      </SurfaceCard>
    </Pressable>
  );
}

function RtsStateBadge({
  state,
  label,
  compact = false,
}: {
  state: RtsQueueState | 'NONE';
  label: string;
  compact?: boolean;
}) {
  const tone = getRtsStateTone(state);

  return (
    <View style={[
      styles.stateBadge,
      compact ? styles.stateBadgeCompact : null,
      tone === 'ready' ? styles.stateBadgeReady : null,
      tone === 'warn' ? styles.stateBadgeWarn : null,
      tone === 'danger' ? styles.stateBadgeDanger : null,
    ]}>
      <Text style={[
        styles.stateBadgeText,
        compact ? styles.stateBadgeTextCompact : null,
        tone === 'ready' ? styles.stateBadgeTextReady : null,
        tone === 'warn' ? styles.stateBadgeTextWarn : null,
        tone === 'danger' ? styles.stateBadgeTextDanger : null,
      ]}>
        {label}
      </Text>
    </View>
  );
}

function buildRtsFilterOptions(
  activeFilter: RtsFilterKey | null,
  stores: WmsMobileRtsTasksResponse['context']['stores'],
  bootstrap: BootstrapResponse,
  canFilterPartners: boolean,
): StockScopeOption[] {
  if (activeFilter === 'tenant' && canFilterPartners) {
    const partners = bootstrap.context.tenantOptions ?? [];
    return [
      { label: 'All partners', value: null },
      ...partners.map((partner) => ({
        label: partner.name,
        value: partner.id,
        meta: partner.slug,
      })),
    ];
  }

  const storeOptions = stores.length ? stores : bootstrap.context.stores.map((store) => ({
    id: store.id,
    name: store.shopName || store.name,
    tenantName: undefined,
  }));

  return [
    { label: 'All stores', value: null },
    ...storeOptions.map((store) => ({
      label: store.name,
      value: store.id,
      meta: store.tenantName ?? undefined,
    })),
  ];
}

function getRtsStateTone(state: RtsQueueState | 'NONE') {
  if (state === 'VERIFIED' || state === 'PARTIAL') {
    return 'ready';
  }

  if (state === 'RETURNING') {
    return 'warn';
  }

  return 'danger';
}

function formatRtsDateTime(value: string) {
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

function formatRtsQueueDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'No date';
  }

  return date.toLocaleDateString('en-PH', {
    month: 'short',
    day: '2-digit',
  });
}

const styles = StyleSheet.create({
  topActionRow: {
    marginBottom: 12,
  },
  backChip: {
    alignItems: 'center',
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  backChipPressed: {
    opacity: 0.84,
  },
  backChipText: {
    color: tokens.colors.panel,
    fontSize: 13,
    fontWeight: '800',
  },
  queueHeaderBar: {
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
  modeSwitcherSlot: {
    marginBottom: 4,
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
  statusFilterRow: {
    gap: 10,
    marginTop: 4,
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
  noticeCard: {
    gap: tokens.spacing.xs,
    padding: tokens.spacing.md,
  },
  errorText: {
    color: '#D95445',
    fontSize: 13,
    fontWeight: '700',
  },
  messageText: {
    color: tokens.colors.success,
    fontSize: 13,
    fontWeight: '700',
  },
  loadingCard: {
    alignItems: 'center',
    gap: tokens.spacing.sm,
    justifyContent: 'center',
    minHeight: 140,
  },
  loadingText: {
    color: tokens.colors.inkMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    alignItems: 'center',
    gap: 4,
    justifyContent: 'center',
    minHeight: 120,
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
  emptyMeta: {
    color: '#7B7791',
    fontSize: 13,
    fontWeight: '600',
  },
  taskList: {
    gap: 18,
  },
  taskPressable: {
    borderRadius: 24,
  },
  activeTaskPressable: {
    opacity: 0.92,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
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
    backgroundColor: '#FFE1F2',
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
    color: '#524F66',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  compactIssueText: {
    color: '#E8735B',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  compactSubMeta: {
    color: '#7B7791',
    fontSize: 12,
    fontWeight: '600',
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
  stateBadge: {
    borderRadius: tokens.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  stateBadgeCompact: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  stateBadgeReady: {
    backgroundColor: '#E9FAF2',
  },
  stateBadgeWarn: {
    backgroundColor: '#FFF2D9',
  },
  stateBadgeDanger: {
    backgroundColor: '#F7E8FF',
  },
  stateBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  stateBadgeTextCompact: {
    fontSize: 11,
  },
  stateBadgeTextReady: {
    color: '#0F9F61',
  },
  stateBadgeTextWarn: {
    color: '#B96B00',
  },
  stateBadgeTextDanger: {
    color: '#7C3AED',
  },
  executionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: tokens.spacing.md,
    marginBottom: 16,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: tokens.radius.pill,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  executionTitleGroup: {
    flex: 1,
  },
  executionTitle: {
    color: tokens.colors.ink,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  executionMeta: {
    color: tokens.colors.inkMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  executionCard: {
    gap: tokens.spacing.lg,
  },
  taskProgressRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bigProgress: {
    color: tokens.colors.ink,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -1,
  },
  progressLabel: {
    color: tokens.colors.inkMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  rtsFactGrid: {
    gap: 8,
  },
  rtsFact: {
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceMuted,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    justifyContent: 'space-between',
    minHeight: 38,
    paddingHorizontal: tokens.spacing.sm,
  },
  rtsFactLabel: {
    color: tokens.colors.inkMuted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  rtsFactValue: {
    color: tokens.colors.ink,
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
  },
  blockedPanel: {
    alignItems: 'flex-start',
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
  scanInputWrap: {
    backgroundColor: tokens.colors.surfaceMuted,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    gap: 10,
    padding: tokens.spacing.md,
  },
  scanInputLabel: {
    color: '#8C83B3',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  scanInputRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  scanInput: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E6DDF6',
    borderRadius: 18,
    borderWidth: 1,
    color: tokens.colors.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    minHeight: 52,
    paddingHorizontal: 16,
  },
  scanSubmit: {
    alignItems: 'center',
    backgroundColor: tokens.colors.panel,
    borderRadius: 18,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  scanSubmitDisabled: {
    opacity: 0.6,
  },
  itemList: {
    gap: tokens.spacing.sm,
  },
  unitSection: {
    gap: tokens.spacing.sm,
  },
  unitSectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  unitSectionTitle: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  unitSectionCount: {
    color: '#6F5BCB',
    fontSize: 12,
    fontWeight: '900',
  },
  itemCard: {
    gap: 6,
    padding: tokens.spacing.md,
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
    fontSize: 14,
    fontWeight: '800',
  },
  itemMeta: {
    color: tokens.colors.inkMuted,
    fontSize: 12,
    fontWeight: '700',
  },
});
