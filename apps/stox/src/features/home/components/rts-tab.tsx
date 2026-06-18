import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { BootstrapResponse, DeviceIdentity, StoredSession } from '@/src/features/auth/types';
import { canDispositionStoxRts, canUseStoxRtsWorkspace, canVerifyStoxRts } from '@/src/features/home/rbac';
import type { WmsMobilePickingTask } from '@/src/features/picking/types';
import { StockScopeFilterModal } from '@/src/features/stock/components/stock-scope-filter';
import type { StockScopeOption } from '@/src/features/stock/utils/stock-scope';
import {
  dispositionMobileTrackingReturnUnit,
  fetchMobileRtsTasks,
  lookupMobileTrackingOrder,
  verifyMobileTrackingReturnUnit,
} from '@/src/features/stock/services/stock-api';
import type {
  WmsMobileRtsTasksResponse,
  WmsMobileTrackingReturnDispositionAction,
  WmsMobileTrackingReturnFlow,
} from '@/src/features/stock/types';
import { normalizeScannedCode } from '@/src/features/stock/hooks/use-stock-execution';
import { PrimaryButton } from '@/src/shared/components/primary-button';
import { SurfaceCard } from '@/src/shared/components/surface-card';
import { tokens } from '@/src/shared/theme/tokens';
import { RtsDispositionPanel } from './rts-disposition-panel';
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
  const [waybillCode, setWaybillCode] = useState('');
  const [verifiedWaybillCode, setVerifiedWaybillCode] = useState<string | null>(
    initialTask?.tracking && initialReturnFlow?.eligible
      ? normalizeScannedCode(initialTask.tracking)
      : null,
  );
  const [returnCode, setReturnCode] = useState('');
  const [task, setTask] = useState<WmsMobilePickingTask | null>(initialTask ?? null);
  const [returnFlow, setReturnFlow] = useState<WmsMobileTrackingReturnFlow | null>(initialReturnFlow ?? null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isRefreshingTask, setIsRefreshingTask] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isDispositing, setIsDispositing] = useState(false);
  const [queue, setQueue] = useState<RtsQueueEntry[]>([]);
  const [queueStores, setQueueStores] = useState<WmsMobileRtsTasksResponse['context']['stores']>([]);
  const [queuePage, setQueuePage] = useState(1);
  const [queueHasMore, setQueueHasMore] = useState(false);
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);
  const [isLoadingMoreQueue, setIsLoadingMoreQueue] = useState(false);
  const [selectedDispositionUnitId, setSelectedDispositionUnitId] = useState<string | null>(null);
  const [dispositionAction, setDispositionAction] = useState<WmsMobileTrackingReturnDispositionAction | null>(null);
  const [dispositionTargetCode, setDispositionTargetCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const waybillInputRef = useRef<TextInput>(null);
  const returnInputRef = useRef<TextInput>(null);
  const dispositionInputRef = useRef<TextInput>(null);
  const lastWaybillSubmitRef = useRef<string | null>(null);
  const lastReturnSubmitRef = useRef<string | null>(null);
  const lastDispositionSubmitRef = useRef<string | null>(null);
  const canVerify = canVerifyStoxRts(bootstrap);
  const canDispose = canDispositionStoxRts(bootstrap);
  const awaitingDispositionUnits = useMemo(
    () => (returnFlow?.verifiedUnits ?? []).filter((unit) => unit.status === 'RTS'),
    [returnFlow?.verifiedUnits],
  );
  const processedUnits = useMemo(
    () => (returnFlow?.verifiedUnits ?? []).filter((unit) => unit.status !== 'RTS'),
    [returnFlow?.verifiedUnits],
  );
  const activeDispositionUnit = useMemo(() => {
    if (!awaitingDispositionUnits.length) {
      return null;
    }

    return awaitingDispositionUnits.find((unit) => unit.id === selectedDispositionUnitId)
      ?? awaitingDispositionUnits[0]
      ?? null;
  }, [awaitingDispositionUnits, selectedDispositionUnitId]);
  const mustFinishDisposition = awaitingDispositionUnits.length > 0;
  const isWaybillVerifiedForTask = Boolean(
    task?.tracking
    && verifiedWaybillCode
    && normalizeScannedCode(task.tracking) === verifiedWaybillCode,
  );
  const hasNoLinkedUnits = Boolean(
    task
    && returnFlow
    && returnFlow.state === 'NONE'
    && returnFlow.expectedUnits === 0,
  );
  const isWaybillMissing = Boolean(
    task
    && returnFlow?.canVerify
    && !task.tracking,
  );
  const isAlreadyVerified = Boolean(
    task
    && returnFlow
    && returnFlow.expectedUnits > 0
    && returnFlow.pendingUnits.length === 0
    && awaitingDispositionUnits.length === 0,
  );
  const focusWaybillField = useCallback(() => {
    setTimeout(() => {
      waybillInputRef.current?.focus();
    }, 80);
  }, []);
  const focusReturnField = useCallback(() => {
    setTimeout(() => {
      returnInputRef.current?.focus();
    }, 80);
  }, []);
  const focusDispositionField = useCallback(() => {
    setTimeout(() => {
      dispositionInputRef.current?.focus();
    }, 80);
  }, []);
  const clearWaybillEntry = useCallback(() => {
    setWaybillCode('');
    lastWaybillSubmitRef.current = null;
  }, []);
  const clearReturnEntry = useCallback(() => {
    setReturnCode('');
    lastReturnSubmitRef.current = null;
  }, []);
  const clearDispositionEntry = useCallback(() => {
    setDispositionTargetCode('');
    lastDispositionSubmitRef.current = null;
  }, []);

  useEffect(() => {
    setTask(initialTask ?? null);
    setReturnFlow(initialReturnFlow ?? null);
    setTenantId(initialTask?.store?.tenantId ?? bootstrap.tenant?.id ?? null);
    setStoreId(initialTask?.store?.id ?? null);
    setWaybillCode('');
    setVerifiedWaybillCode(
      initialTask?.tracking && initialReturnFlow?.eligible
        ? normalizeScannedCode(initialTask.tracking)
        : null,
    );
    setReturnCode('');
    setSelectedDispositionUnitId(
      (initialReturnFlow?.verifiedUnits ?? []).find((unit) => unit.status === 'RTS')?.id ?? null,
    );
    setDispositionAction(null);
    setDispositionTargetCode('');
    setError(null);
    setMessage(null);
    lastWaybillSubmitRef.current = null;
    lastReturnSubmitRef.current = null;
    lastDispositionSubmitRef.current = null;
  }, [bootstrap.tenant?.id, initialReturnFlow, initialTask]);

  useEffect(() => {
    if (!awaitingDispositionUnits.length) {
      setSelectedDispositionUnitId(null);
      setDispositionTargetCode('');
      lastDispositionSubmitRef.current = null;
      return;
    }

    if (!selectedDispositionUnitId || !awaitingDispositionUnits.some((unit) => unit.id === selectedDispositionUnitId)) {
      setSelectedDispositionUnitId(awaitingDispositionUnits[0]?.id ?? null);
    }
  }, [awaitingDispositionUnits, selectedDispositionUnitId]);

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
    if (!task || !task.tracking) {
      return;
    }

    const timer = setTimeout(() => {
      if (mustFinishDisposition && canDispose) {
        if (dispositionAction) {
          dispositionInputRef.current?.focus();
        }
        return;
      }

      if (!returnFlow?.canVerify) {
        return;
      }

      if (!isWaybillVerifiedForTask) {
        waybillInputRef.current?.focus();
        return;
      }

      returnInputRef.current?.focus();
    }, 120);

    return () => clearTimeout(timer);
  }, [canDispose, dispositionAction, isWaybillVerifiedForTask, mustFinishDisposition, returnFlow?.canVerify, task]);

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

  const lookupWaybill = useCallback(async (code: string, options?: { markVerified?: boolean }) => {
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
        setVerifiedWaybillCode(null);
        setError(`No packed waybill matched ${normalized}.`);
        return;
      }

      setTask(response.task);
      setReturnFlow(response.returnFlow);
      setSelectedDispositionUnitId(
        (response.returnFlow?.verifiedUnits ?? []).find((unit) => unit.status === 'RTS')?.id ?? null,
      );
      setDispositionAction(null);
      setDispositionTargetCode('');
      lastDispositionSubmitRef.current = null;
      setVerifiedWaybillCode(
        options?.markVerified === false || !response.returnFlow?.eligible || !response.task.tracking
          ? null
          : normalizeScannedCode(response.task.tracking),
      );

      if (!response.returnFlow?.eligible) {
        setMessage('Order is not in return status.');
        return;
      }

      if (response.returnFlow.state === 'RETURNING') {
        setMessage('Still returning.');
        return;
      }

      if (response.returnFlow.expectedUnits === 0) {
        setMessage('No dispatched units are linked to this returned order yet.');
        return;
      }

      if (response.returnFlow.canVerify && !response.task.tracking) {
        setMessage('This returned order has no waybill yet.');
        return;
      }

      if (
        !response.returnFlow.canVerify
        && response.returnFlow.pendingUnits.length === 0
        && !(response.returnFlow.verifiedUnits ?? []).some((unit) => unit.status === 'RTS')
      ) {
        setMessage('All returned units for this waybill are already processed.');
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
      await lookupWaybill(trackingCode, {
        markVerified: isWaybillVerifiedForTask,
      });
    } finally {
      setIsRefreshingTask(false);
    }
  }, [isWaybillVerifiedForTask, loadQueue, lookupWaybill, onRefresh, task?.tracking]);

  const confirmWaybill = useCallback(async (nextCode?: string) => {
    if (!task || !returnFlow) {
      setError('Load an RTS task first.');
      clearWaybillEntry();
      focusWaybillField();
      return false;
    }

    const normalized = normalizeScannedCode(nextCode ?? waybillCode);
    if (!normalized) {
      setError('Scan or enter a waybill.');
      clearWaybillEntry();
      focusWaybillField();
      return false;
    }

    const expected = normalizeScannedCode(task.tracking ?? '');
    if (!expected) {
      setError('This order has no waybill yet.');
      clearWaybillEntry();
      return false;
    }

    if (normalized !== expected) {
      setError(`Waybill ${normalized} does not match order ${task.posOrderId}.`);
      clearWaybillEntry();
      focusWaybillField();
      return false;
    }

    setVerifiedWaybillCode(expected);
    clearWaybillEntry();
    setError(null);
    setMessage(
      returnFlow.pendingUnits.length > 0
        ? `Waybill verified. ${returnFlow.pendingUnits.length} unit${returnFlow.pendingUnits.length === 1 ? '' : 's'} ready.`
        : 'Waybill verified.',
    );
    focusReturnField();
    return true;
  }, [clearWaybillEntry, focusReturnField, focusWaybillField, returnFlow, task, waybillCode]);

  const verifyReturnUnit = useCallback(async (nextCode?: string) => {
    if (!task || !returnFlow) {
      setError('Load an RTS task first.');
      clearReturnEntry();
      return false;
    }

    const normalized = normalizeScannedCode(nextCode ?? returnCode);
    if (!device) {
      setError('Device is not ready.');
      clearReturnEntry();
      return false;
    }

    if (!normalized) {
      setError('Scan or enter a returned unit.');
      clearReturnEntry();
      focusReturnField();
      return false;
    }

    if (!canVerify) {
      setError('This account can inspect returns but cannot verify RTS units.');
      clearReturnEntry();
      return false;
    }

    if (!isWaybillVerifiedForTask) {
      setError('Scan the waybill first.');
      clearReturnEntry();
      focusWaybillField();
      return false;
    }

    if (mustFinishDisposition) {
      setError('Finish the current returned unit placement first.');
      clearReturnEntry();
      if (canDispose && dispositionAction) {
        focusDispositionField();
      }
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
      const nextReturnFlow = response.returnFlow ?? returnFlow;

      if (response.task) {
        setTask(response.task);
      }
      setReturnFlow(nextReturnFlow);
      setSelectedDispositionUnitId(response.unit.id);
      setDispositionTargetCode('');
      lastDispositionSubmitRef.current = null;
      clearReturnEntry();
      setMessage(
        canDispose
          ? `Verified ${response.unit.code}. Choose where to place it next.`
          : `Verified ${response.unit.code}. ${nextReturnFlow.verifiedUnits.length}/${nextReturnFlow.expectedUnits}`,
      );
      if (canDispose) {
        if (dispositionAction) {
          focusDispositionField();
        }
      } else if (nextReturnFlow.canVerify) {
        focusReturnField();
      }
      void loadQueue('replace');
      return true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to verify the returned unit.');
      clearReturnEntry();
      focusReturnField();
      return false;
    } finally {
      setIsVerifying(false);
    }
  }, [
    canVerify,
    clearReturnEntry,
    device,
    focusReturnField,
    focusWaybillField,
    focusDispositionField,
    isWaybillVerifiedForTask,
    loadQueue,
    mustFinishDisposition,
    returnCode,
    returnFlow,
    session.accessToken,
    task,
    tenantId,
    dispositionAction,
    canDispose,
  ]);

  const applyDisposition = useCallback(async (nextTargetCode?: string) => {
    if (!task || !returnFlow) {
      setError('Load an RTS task first.');
      clearDispositionEntry();
      return false;
    }

    if (!device) {
      setError('Device is not ready.');
      clearDispositionEntry();
      return false;
    }

    if (!canDispose) {
      setError('This account cannot place returned units.');
      clearDispositionEntry();
      return false;
    }

    if (!activeDispositionUnit) {
      setError('No returned unit is waiting for placement.');
      clearDispositionEntry();
      return false;
    }

    if (!dispositionAction) {
      setError('Choose where to place this returned unit first.');
      focusDispositionField();
      return false;
    }

    const normalized = normalizeScannedCode(nextTargetCode ?? dispositionTargetCode);
    if (!normalized) {
      setError('Scan the destination location.');
      clearDispositionEntry();
      focusDispositionField();
      return false;
    }

    setIsDispositing(true);
    setError(null);
    setMessage(null);

    try {
      const response = await dispositionMobileTrackingReturnUnit({
        accessToken: session.accessToken,
        device,
        taskId: task.id,
        unitId: activeDispositionUnit.id,
        disposition: dispositionAction,
        targetCode: normalized,
        tenantId,
      });
      const nextReturnFlow = response.returnFlow ?? returnFlow;
      const nextAwaiting = (nextReturnFlow.verifiedUnits ?? []).filter((unit) => unit.status === 'RTS');

      if (response.task) {
        setTask(response.task);
      }
      setReturnFlow(nextReturnFlow);
      setSelectedDispositionUnitId(nextAwaiting[0]?.id ?? null);
      clearDispositionEntry();
      setMessage(
        `${response.unit.code} moved to ${response.unit.currentLocation?.code ?? normalized} as ${formatDispositionLabel(dispositionAction)}.`,
      );

      if (nextAwaiting.length > 0) {
        if (dispositionAction) {
          focusDispositionField();
        }
      } else if (nextReturnFlow.canVerify) {
        focusReturnField();
      }

      void loadQueue('replace');
      return true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to place the returned unit.');
      clearDispositionEntry();
      focusDispositionField();
      return false;
    } finally {
      setIsDispositing(false);
    }
  }, [
    activeDispositionUnit,
    canDispose,
    clearDispositionEntry,
    device,
    dispositionAction,
    dispositionTargetCode,
    focusDispositionField,
    focusReturnField,
    loadQueue,
    returnFlow,
    session.accessToken,
    task,
    tenantId,
  ]);

  useEffect(() => {
    const nextCode = waybillCode.trim();

    if (
      !task
      || !returnFlow?.canVerify
      || isWaybillVerifiedForTask
      || nextCode.length < 3
      || lastWaybillSubmitRef.current === nextCode
    ) {
      return;
    }

    const timer = setTimeout(() => {
      lastWaybillSubmitRef.current = nextCode;
      void (async () => {
        const success = await confirmWaybill(nextCode);
        if (success) {
          setWaybillCode('');
        }
      })();
    }, 220);

    return () => clearTimeout(timer);
  }, [confirmWaybill, isWaybillVerifiedForTask, returnFlow?.canVerify, task, waybillCode]);

  useEffect(() => {
    if (!waybillCode.trim()) {
      lastWaybillSubmitRef.current = null;
    }
  }, [waybillCode]);

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

  useEffect(() => {
    const nextCode = dispositionTargetCode.trim();

    if (
      !activeDispositionUnit
      || !dispositionAction
      || !canDispose
      || isDispositing
      || nextCode.length < 3
      || lastDispositionSubmitRef.current === nextCode
    ) {
      return;
    }

    const timer = setTimeout(() => {
      lastDispositionSubmitRef.current = nextCode;
      void (async () => {
        const success = await applyDisposition(nextCode);
        if (success) {
          setDispositionTargetCode('');
        }
      })();
    }, 220);

    return () => clearTimeout(timer);
  }, [
    activeDispositionUnit,
    applyDisposition,
    canDispose,
    dispositionAction,
    dispositionTargetCode,
    isDispositing,
  ]);

  useEffect(() => {
    if (!dispositionTargetCode.trim()) {
      lastDispositionSubmitRef.current = null;
    }
  }, [dispositionTargetCode]);

  const resetTask = () => {
    setTask(null);
    setReturnFlow(null);
    setWaybillCode('');
    setVerifiedWaybillCode(null);
    setReturnCode('');
    setSelectedDispositionUnitId(null);
    setDispositionAction(null);
    setDispositionTargetCode('');
    setError(null);
    setMessage(null);
    lastDispositionSubmitRef.current = null;
  };

  const openQueueTask = useCallback((entry: RtsQueueEntry) => {
    setTask(entry.task);
    setReturnFlow(entry.returnFlow);
    clearWaybillEntry();
    setVerifiedWaybillCode(null);
    clearReturnEntry();
    setSelectedDispositionUnitId(
      (entry.returnFlow?.verifiedUnits ?? []).find((unit) => unit.status === 'RTS')?.id ?? null,
    );
    setDispositionAction(null);
    setDispositionTargetCode('');
    setError(null);
    setMessage(null);
  }, [clearReturnEntry, clearWaybillEntry]);

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
                <Text style={styles.blockedCopy}>
                  Wait until the waybill reaches the warehouse return stage, then refresh this task.
                </Text>
                <PrimaryButton label="Refresh" onPress={refreshTask} variant="secondary" />
              </View>
            ) : hasNoLinkedUnits ? (
              <View style={styles.blockedPanel}>
                <Text style={styles.blockedTitle}>No linked units</Text>
                <Text style={styles.blockedCopy}>
                  This returned order does not have any dispatched units linked for RTS yet.
                </Text>
                <PrimaryButton label="Refresh" onPress={refreshTask} variant="secondary" />
              </View>
            ) : isWaybillMissing ? (
              <View style={styles.blockedPanel}>
                <Text style={styles.blockedTitle}>Waybill missing</Text>
                <Text style={styles.blockedCopy}>
                  Add or sync the waybill first before starting RTS verification for this order.
                </Text>
                <PrimaryButton label="Refresh" onPress={refreshTask} variant="secondary" />
              </View>
            ) : mustFinishDisposition ? (
              canDispose ? (
                <RtsDispositionPanel
                  canSubmit={Boolean(activeDispositionUnit && dispositionAction && dispositionTargetCode.trim())}
                  disposition={dispositionAction}
                  inputRef={dispositionInputRef}
                  isSubmitting={isDispositing}
                  pendingCount={awaitingDispositionUnits.length}
                  targetCode={dispositionTargetCode}
                  unit={activeDispositionUnit}
                  onChangeTargetCode={(value) => setDispositionTargetCode(normalizeScannedCode(value))}
                  onSelectDisposition={(value) => {
                    setDispositionAction(value);
                    setError(null);
                    setMessage(null);
                    focusDispositionField();
                  }}
                  onSubmit={() => void applyDisposition()}
                />
              ) : (
                <View style={styles.blockedPanel}>
                  <Text style={styles.blockedTitle}>Placement permission required</Text>
                  <Text style={styles.blockedCopy}>
                    A supervisor needs to place these returned units into bin, deadstock, or damage.
                  </Text>
                </View>
              )
            ) : isAlreadyVerified ? (
              <View style={styles.blockedPanel}>
                <Text style={styles.blockedTitle}>RTS complete</Text>
                <Text style={styles.blockedCopy}>
                  All returned units linked to this waybill were already checked and placed.
                </Text>
                <PrimaryButton label="Back to queue" onPress={resetTask} variant="secondary" />
              </View>
            ) : returnFlow.canVerify ? (
              canVerify ? (
                <View style={styles.scanPanel}>
                  {!isWaybillVerifiedForTask ? (
                    <>
                      <View style={styles.nextUnitCard}>
                        <Text style={styles.scanLabel}>Waybill</Text>
                        <Text numberOfLines={1} style={styles.nextUnitCode}>
                          {task.tracking ?? 'Tracking pending'}
                        </Text>
                        <Text numberOfLines={1} style={styles.nextUnitName}>
                          Scan this first before returned units
                        </Text>
                      </View>

                      <View style={styles.scanInputWrap}>
                        <Text style={styles.scanInputLabel}>Waybill</Text>
                        <View style={styles.scanInputRow}>
                          <TextInput
                            ref={waybillInputRef}
                            autoCapitalize="characters"
                            autoCorrect={false}
                            blurOnSubmit={false}
                            caretHidden
                            contextMenuHidden
                            placeholder="Scan waybill"
                            placeholderTextColor={tokens.colors.inkSoft}
                            returnKeyType="done"
                            selectTextOnFocus={false}
                            showSoftInputOnFocus={false}
                            value={waybillCode}
                            onChangeText={(value) => setWaybillCode(normalizeScannedCode(value))}
                            onSubmitEditing={() => {
                              void confirmWaybill();
                            }}
                            style={styles.scanInput}
                          />
                          <Pressable
                            onPress={() => {
                              void confirmWaybill();
                            }}
                            style={styles.scanSubmit}>
                            <Feather name="corner-down-left" size={18} color={tokens.colors.surface} />
                          </Pressable>
                        </View>
                      </View>

                      <PrimaryButton
                        label="Confirm waybill"
                        onPress={() => void confirmWaybill()}
                      />
                    </>
                  ) : (
                    <>
                      <View style={styles.nextUnitCard}>
                        <Text style={styles.scanLabel}>Next unit</Text>
                        <Text numberOfLines={1} style={styles.nextUnitCode}>
                          {returnFlow.pendingUnits[0]?.barcode ?? returnFlow.pendingUnits[0]?.code ?? 'Ready'}
                        </Text>
                        <Text numberOfLines={1} style={styles.nextUnitName}>
                          {returnFlow.pendingUnits[0]?.code ?? `${returnFlow.pendingUnits.length} pending`}
                        </Text>
                      </View>

                      {returnFlow.pendingUnits.length ? (
                        <View style={styles.rtsInlineUnitList}>
                          <View style={styles.rtsInlineUnitListHeader}>
                            <Text style={styles.rtsInlineUnitListTitle}>Units in waybill</Text>
                            <Text style={styles.rtsInlineUnitListCount}>{returnFlow.pendingUnits.length}</Text>
                          </View>
                          <View style={styles.rtsInlineUnitListBody}>
                            {returnFlow.pendingUnits.map((unit) => (
                              <View key={unit.id} style={styles.rtsInlineUnitRow}>
                                <Text numberOfLines={1} style={styles.rtsInlineUnitBarcode}>
                                  {unit.barcode}
                                </Text>
                                <Text numberOfLines={1} style={styles.rtsInlineUnitCode}>
                                  {unit.code}
                                </Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      ) : null}

                      <View style={styles.scanInputWrap}>
                        <Text style={styles.scanInputLabel}>Unit</Text>
                        <View style={styles.scanInputRow}>
                          <TextInput
                            ref={returnInputRef}
                            autoCapitalize="characters"
                            autoCorrect={false}
                            blurOnSubmit={false}
                            caretHidden
                            contextMenuHidden
                            placeholder="Scan returned unit"
                            placeholderTextColor={tokens.colors.inkSoft}
                            returnKeyType="done"
                            selectTextOnFocus={false}
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
                    </>
                  )}
                </View>
              ) : (
                <View style={styles.blockedPanel}>
                  <Text style={styles.blockedTitle}>Verification permission required</Text>
                </View>
              )
            ) : (
              <View style={styles.blockedPanel}>
                <Text style={styles.blockedTitle}>RTS not actionable</Text>
                <Text style={styles.blockedCopy}>
                  Refresh this task to load the latest return state before continuing.
                </Text>
                <PrimaryButton label="Refresh" onPress={refreshTask} variant="secondary" />
              </View>
            )}
          </SurfaceCard>

          <RtsUnitSection
            state="READY_TO_VERIFY"
            title="Pending"
            units={returnFlow.pendingUnits}
          />

          <RtsUnitSection
            selectedUnitId={selectedDispositionUnitId}
            state="READY_TO_VERIFY"
            title="Awaiting placement"
            units={awaitingDispositionUnits}
            onSelect={(unitId) => {
              setSelectedDispositionUnitId(unitId);
              setError(null);
              setMessage(null);
            }}
          />

          <RtsUnitSection
            state="VERIFIED"
            title="Placed"
            units={processedUnits}
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
  onSelect,
  selectedUnitId,
  state,
  title,
  units,
}: {
  onSelect?: (unitId: string) => void;
  selectedUnitId?: string | null;
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
          <Pressable
            key={unit.id}
            disabled={!onSelect}
            onPress={() => onSelect?.(unit.id)}
            style={({ pressed }) => [
              styles.unitPressable,
              pressed && onSelect ? styles.pressed : null,
            ]}>
            <SurfaceCard
              tone="muted"
              style={[
                styles.itemCard,
                selectedUnitId === unit.id ? styles.itemCardSelected : null,
              ]}>
              <View style={styles.itemHeader}>
                <Text numberOfLines={1} style={styles.itemName}>{unit.barcode || unit.code}</Text>
                <RtsStateBadge state={state} label={unit.statusLabel} compact />
              </View>
              <Text numberOfLines={1} style={styles.itemMeta}>{unit.code}</Text>
              <Text numberOfLines={1} style={styles.itemSubMeta}>{unit.name}</Text>
              {unit.currentLocation ? (
                <Text numberOfLines={1} style={styles.itemLocation}>
                  {unit.currentLocation.code} · {unit.currentLocation.name}
                </Text>
              ) : null}
            </SurfaceCard>
          </Pressable>
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
  const awaitingPlacementCount = returnFlow.verifiedUnits.filter((unit) => unit.status === 'RTS').length;
  const summary = `${returnFlow.verifiedUnits.length}/${returnFlow.expectedUnits}`;
  const issue = awaitingPlacementCount > 0
    ? `${awaitingPlacementCount} awaiting placement`
    : returnFlow.state === 'RETURNING'
    ? 'Returning'
    : returnFlow.state === 'NONE' && returnFlow.expectedUnits === 0
      ? 'No linked units'
      : returnFlow.state === 'VERIFIED'
        ? 'Processed'
    : returnFlow.state === 'PARTIAL'
      ? `${pendingCount} pending`
      : returnFlow.state === 'READY_TO_VERIFY' && !task.tracking
        ? 'Waybill missing'
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

function formatDispositionLabel(value: WmsMobileTrackingReturnDispositionAction) {
  if (value === 'PUTAWAY') {
    return 'putaway';
  }

  if (value === 'DEADSTOCK') {
    return 'deadstock';
  }

  return 'damage';
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
  blockedCopy: {
    color: tokens.colors.inkMuted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
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
  rtsInlineUnitList: {
    backgroundColor: tokens.colors.surfaceMuted,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    gap: 10,
    padding: tokens.spacing.md,
  },
  rtsInlineUnitListHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rtsInlineUnitListTitle: {
    color: tokens.colors.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  rtsInlineUnitListCount: {
    color: tokens.colors.accent,
    fontSize: 12,
    fontWeight: '900',
  },
  rtsInlineUnitListBody: {
    gap: 8,
  },
  rtsInlineUnitRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  rtsInlineUnitBarcode: {
    color: tokens.colors.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
  },
  rtsInlineUnitCode: {
    color: tokens.colors.inkMuted,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
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
  unitPressable: {
    borderRadius: tokens.radius.lg,
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
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 6,
    padding: tokens.spacing.md,
  },
  itemCardSelected: {
    borderColor: '#CFC3FF',
    shadowColor: '#B39DFF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
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
  itemSubMeta: {
    color: tokens.colors.inkMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  itemLocation: {
    color: '#6F5BCB',
    fontSize: 12,
    fontWeight: '700',
  },
});
