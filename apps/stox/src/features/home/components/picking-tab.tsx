import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Feather } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { BootstrapResponse, DeviceIdentity, StoredSession } from '@/src/features/auth/types';
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
  StockScopeFilterChip,
  StockScopeFilterModal,
} from '@/src/features/stock/components/stock-scope-filter';
import type { StockScopeOption } from '@/src/features/stock/utils/stock-scope';
import { SectionLabel, TaskHeader, TaskHeaderIconButton, UtilityPill } from './stox-primitives';

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
  { label: 'Ready', value: 'READY' },
  { label: 'Partial', value: 'PARTIAL' },
  { label: 'Restocking', value: 'RESTOCKING' },
  { label: 'Issue', value: 'ISSUE' },
  { label: 'Picking', value: 'IN_PICKING' },
];

export function PickingTab({ bootstrap, device, session }: PickingTabProps) {
  const [activeFilter, setActiveFilter] = useState<PickingFilterKey | null>(null);
  const [activeTab, setActiveTab] = useState<PickTabKey>('list');
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
      <TaskHeader
        title="Pick"
        action={(
          <TaskHeaderIconButton
            icon="refresh-cw"
            loading={isRefreshing}
            onPress={refreshPicking}
          />
        )}
      />

      {!activeTask ? (
        <View style={styles.filterRow}>
          {bootstrap.user.role === 'SUPER_ADMIN' ? (
            <StockScopeFilterChip
              label="Partner"
              value={activePartnerName}
              onPress={() => setActiveFilter('tenant')}
            />
          ) : null}

          <StockScopeFilterChip
            label="Store"
            value={activeStoreName}
            onPress={() => setActiveFilter('store')}
          />
        </View>
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
                hasMore={Boolean(picking?.pagination.hasMore)}
                isLoadingMore={isLoadingMore}
                tasks={picking?.tasks ?? []}
                total={picking?.pagination.total ?? 0}
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
              tasks={picking?.pickedHistory ?? []}
              title="Picked"
              trailing={`${picking?.pickedHistory.length ?? 0}`}
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
  hasMore,
  isLoadingMore,
  tasks,
  total,
  onLoadMore,
  onSelect,
}: {
  activeTaskId: string | null;
  hasMore: boolean;
  isLoadingMore: boolean;
  tasks: WmsMobilePickingTask[];
  total: number;
  onLoadMore: () => void | Promise<void>;
  onSelect: (taskId: string) => void;
}) {
  return (
    <>
      <TaskCollectionSection
        activeTaskId={activeTaskId}
        emptyCopy="Confirmed orders will show here after sync."
        emptyTitle="No pick tasks"
        tasks={tasks}
        title="Orders"
        trailing={`${tasks.length}/${total}`}
        onSelect={onSelect}
      />

      {hasMore ? (
        <PrimaryButton
          label="Load more"
          loading={isLoadingMore}
          onPress={onLoadMore}
          variant="secondary"
        />
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
    <View style={styles.pickTabs}>
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
    </View>
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
    <View style={styles.statusFilterRow}>
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
    </View>
  );
}

function TaskCollectionSection({
  activeTaskId,
  emptyCopy,
  emptyTitle,
  tasks,
  title,
  trailing,
  onSelect,
}: {
  activeTaskId: string | null;
  emptyCopy: string;
  emptyTitle: string;
  tasks: WmsMobilePickingTask[];
  title: string;
  trailing?: string;
  onSelect: (taskId: string) => void;
}) {
  return (
    <>
      <SectionLabel title={title} trailing={trailing} />

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
  const extraLines = Math.max(visibleLines.length - 2, 0);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.taskPressable,
        pressed ? styles.pressed : null,
        active ? styles.activeTaskPressable : null,
      ]}>
      <SurfaceCard style={styles.compactTaskCard}>
        <View style={styles.compactDateRow}>
          <Text style={styles.compactDateLabel}>Date</Text>
          <Text numberOfLines={1} style={styles.compactDateValue}>
            {formatPickOrderDate(task.orderDateLocal ?? task.orderDate)}
          </Text>
        </View>

        <View style={styles.compactMainRow}>
          <Text numberOfLines={1} style={styles.compactOrderTitle}>
            {task.store?.name ?? 'Store'} - {task.posOrderId}
          </Text>
          <StatusBadge status={task.status} label={task.statusLabel} />
        </View>

        <Text style={styles.compactUnitCount}>
          {task.totals.required} required unit{task.totals.required === 1 ? '' : 's'}
          {task.totals.picked > 0 ? ` · ${task.totals.picked} picked` : ''}
        </Text>

        <View style={styles.compactLineList}>
          {visibleLines.slice(0, 2).map((line) => (
            <Text key={line.id} numberOfLines={1} style={styles.compactLineText}>
              {line.required} - {line.productName}
            </Text>
          ))}
          {extraLines > 0 ? (
            <Text style={styles.compactMoreText}>+{extraLines} more item{extraLines === 1 ? '' : 's'}</Text>
          ) : null}
        </View>

        {shortageNote ? (
          <Text numberOfLines={2} style={styles.compactIssueText}>{shortageNote}</Text>
        ) : null}

        {task.basket ? (
          <Text numberOfLines={1} style={styles.basketMeta}>
            Basket {task.basket.barcode}
            {task.basket.assignedPacker ? ` · Packer ${task.basket.assignedPacker.name}` : ` · ${task.basket.statusLabel}`}
          </Text>
        ) : null}
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
    backgroundColor: tokens.colors.surfaceMuted,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 4,
  },
  pickTabButton: {
    alignItems: 'center',
    borderRadius: tokens.radius.pill,
    flex: 1,
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.sm,
  },
  pickTabButtonActive: {
    backgroundColor: tokens.colors.panel,
  },
  pickTabText: {
    color: tokens.colors.inkMuted,
    fontSize: 12,
    fontWeight: '900',
  },
  pickTabTextActive: {
    color: tokens.colors.surface,
  },
  statusFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.xs,
  },
  statusFilterChip: {
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusFilterChipActive: {
    backgroundColor: tokens.colors.accentSoft,
    borderColor: tokens.colors.accentSoft,
  },
  statusFilterText: {
    color: tokens.colors.inkMuted,
    fontSize: 11,
    fontWeight: '900',
  },
  statusFilterTextActive: {
    color: tokens.colors.panel,
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
    gap: tokens.spacing.xs,
  },
  emptyTitle: {
    color: tokens.colors.ink,
    fontSize: 18,
    fontWeight: '800',
  },
  emptyCopy: {
    color: tokens.colors.inkMuted,
    fontSize: 13,
    fontWeight: '600',
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
    gap: tokens.spacing.sm,
  },
  availableBasketCard: {
    flexBasis: '47%',
    flexGrow: 1,
    gap: 2,
    paddingVertical: tokens.spacing.md,
  },
  availableBasketCode: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  availableBasketMeta: {
    color: tokens.colors.inkMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  taskList: {
    gap: tokens.spacing.md,
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
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.md,
  },
  compactDateRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: tokens.spacing.xs,
  },
  compactDateLabel: {
    color: tokens.colors.inkSoft,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  compactDateValue: {
    color: tokens.colors.inkMuted,
    fontSize: 11,
    fontWeight: '900',
  },
  compactMainRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    justifyContent: 'space-between',
  },
  compactOrderTitle: {
    color: tokens.colors.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
  },
  compactUnitCount: {
    color: tokens.colors.panel,
    fontSize: 12,
    fontWeight: '900',
  },
  compactLineList: {
    gap: 2,
  },
  compactLineText: {
    color: tokens.colors.inkMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  compactMoreText: {
    color: tokens.colors.inkSoft,
    fontSize: 11,
    fontWeight: '900',
  },
  compactIssueText: {
    color: tokens.colors.danger,
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 15,
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
    borderRadius: tokens.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusReady: {
    backgroundColor: 'rgba(15, 157, 122, 0.12)',
  },
  statusWarn: {
    backgroundColor: 'rgba(240, 197, 82, 0.22)',
  },
  statusDanger: {
    backgroundColor: 'rgba(211, 84, 69, 0.12)',
  },
  statusText: {
    color: tokens.colors.inkMuted,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  statusTextReady: {
    color: tokens.colors.success,
  },
  statusTextWarn: {
    color: tokens.colors.accentStrong,
  },
  statusTextDanger: {
    color: tokens.colors.danger,
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
