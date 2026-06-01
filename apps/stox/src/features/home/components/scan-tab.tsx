import { useEffect, useMemo, useRef, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { BootstrapResponse, DeviceIdentity, StoredSession } from '@/src/features/auth/types';
import { useUniversalScan } from '@/src/features/scan/hooks/use-universal-scan';
import type { UniversalScanResult } from '@/src/features/scan/types';
import type { WmsMobilePickingTask } from '@/src/features/picking/types';
import type { WmsMobileTrackingReturnFlow } from '@/src/features/stock/types';
import { canUseStoxScanWorkspace } from '@/src/features/home/rbac';
import type { StoxTabKey } from '@/src/features/home/types';
import { PrimaryButton } from '@/src/shared/components/primary-button';
import { SurfaceCard } from '@/src/shared/components/surface-card';
import { tokens } from '@/src/shared/theme/tokens';
import { StockScopeFilterModal } from '@/src/features/stock/components/stock-scope-filter';
import { BlockedTaskState, TaskHeaderIconButton, UtilityPill } from './stox-primitives';

type ScanTabProps = {
  bootstrap: BootstrapResponse;
  device: DeviceIdentity | null;
  session: StoredSession;
  onRefresh: () => Promise<void>;
  onChangeTab?: (tab: StoxTabKey) => void;
  onOpenRtsTask?: (task: WmsMobilePickingTask, returnFlow: WmsMobileTrackingReturnFlow | null) => void;
};

type ScanFocusKey = 'auto' | 'unit' | 'tracking' | 'basket' | 'bin';

type ScanFocusOption = {
  key: ScanFocusKey;
  icon: keyof typeof Feather.glyphMap;
  title: string;
  hint: string;
  placeholder: string;
};

const SCAN_FOCUS_OPTIONS: ScanFocusOption[] = [
  {
    key: 'auto',
    icon: 'maximize',
    title: 'Auto detect',
    hint: 'Scan anything and STOX routes it to the right lookup.',
    placeholder: 'Scan a unit, waybill, basket, or bin',
  },
  {
    key: 'unit',
    icon: 'hash',
    title: 'Unit',
    hint: 'Serialized unit lookup, current status, linked order, and sibling waybill units.',
    placeholder: 'Scan serialized unit barcode',
  },
  {
    key: 'tracking',
    icon: 'truck',
    title: 'Waybill',
    hint: 'Tracking status, packed items, and order progress from the printed waybill.',
    placeholder: 'Scan tracking or waybill barcode',
  },
  {
    key: 'basket',
    icon: 'archive',
    title: 'Basket',
    hint: 'See who owns the basket, which order it holds, and where it is in flow.',
    placeholder: 'Scan basket barcode',
  },
  {
    key: 'bin',
    icon: 'map-pin',
    title: 'Location',
    hint: 'Inspect a bin and see what units are currently inside.',
    placeholder: 'Scan bin or location barcode',
  },
];

export function ScanTab({
  bootstrap,
  device,
  session,
  onRefresh,
  onChangeTab,
  onOpenRtsTask,
}: ScanTabProps) {
  if (!canUseStoxScanWorkspace(bootstrap)) {
    return (
      <>
        <ScanCenteredHeader onRefresh={onRefresh} />
        <BlockedTaskState copy="This account needs WMS stock, fulfillment, or packing access to use Scan." />
      </>
    );
  }

  return (
    <ScanWorkspaceTab
      bootstrap={bootstrap}
      device={device}
      session={session}
      onRefresh={onRefresh}
      onChangeTab={onChangeTab}
      onOpenRtsTask={onOpenRtsTask}
    />
  );
}

function ScanWorkspaceTab({
  bootstrap,
  device,
  session,
  onRefresh,
  onChangeTab,
  onOpenRtsTask,
}: ScanTabProps) {
  const [tenantId, setTenantId] = useState<string | null>(bootstrap.tenant?.id ?? null);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [focusKey, setFocusKey] = useState<ScanFocusKey>('auto');
  const scan = useUniversalScan({
    device,
    filters: {
      tenantId,
    },
    session,
  });
  const inputRef = useRef<TextInput>(null);
  const lastAutoSubmittedCodeRef = useRef<string | null>(null);

  const activeFocus = SCAN_FOCUS_OPTIONS.find((option) => option.key === focusKey) ?? SCAN_FOCUS_OPTIONS[0];
  const tenantOptions = useMemo(
    () => (bootstrap.context.tenantOptions ?? []).map((tenant) => ({
      value: tenant.id,
      label: tenant.name,
    })),
    [bootstrap.context.tenantOptions],
  );
  const activeTenantName = useMemo(() => {
    if (!tenantId) {
      return bootstrap.tenant?.name ?? 'All partners';
    }

    return bootstrap.context.tenantOptions?.find((tenant) => tenant.id === tenantId)?.name
      ?? bootstrap.tenant?.name
      ?? 'Selected partner';
  }, [bootstrap.context.tenantOptions, bootstrap.tenant?.name, tenantId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 120);

    return () => clearTimeout(timer);
  }, [scan.result]);

  useEffect(() => {
    const nextCode = scan.code.trim();

    if (scan.isScanning || nextCode.length < 3 || lastAutoSubmittedCodeRef.current === nextCode) {
      return;
    }

    const timer = setTimeout(() => {
      lastAutoSubmittedCodeRef.current = nextCode;
      void scan.scan(nextCode);
    }, 220);

    return () => clearTimeout(timer);
  }, [scan.code, scan.isScanning, scan.scan]);

  useEffect(() => {
    if (!scan.code.trim()) {
      lastAutoSubmittedCodeRef.current = null;
    }
  }, [scan.code]);

  return (
    <>
      <ScanCenteredHeader onRefresh={onRefresh} />

      <SurfaceCard style={styles.scanHeroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroIconBubble}>
            <Feather name="maximize" size={22} color="#6C3EF4" />
          </View>
          <View style={styles.heroModePill}>
            <Text style={styles.heroModePillText}>
              {activeFocus.key === 'auto' ? 'Auto detect' : activeFocus.title}
            </Text>
          </View>
        </View>

        <ScopeDropdownCard
          label="Partner scope"
          value={activeTenantName}
          onPress={() => setScopeOpen(true)}
        />

        <View style={styles.inputShell}>
          <View style={styles.inputIconWrap}>
            <Feather name={activeFocus.icon} size={17} color="#8A6FFF" />
          </View>
          <TextInput
            ref={inputRef}
            autoCapitalize="characters"
            autoCorrect={false}
            blurOnSubmit={false}
            placeholder={activeFocus.placeholder}
            placeholderTextColor="#8C83B3"
            returnKeyType="search"
            selectTextOnFocus
            showSoftInputOnFocus={false}
            value={scan.code}
            onChangeText={scan.setCode}
            onSubmitEditing={() => {
              void scan.scan();
            }}
            style={styles.scanInput}
          />
          {scan.code ? (
            <Pressable
              onPress={scan.reset}
              style={({ pressed }) => [styles.clearInputButton, pressed ? styles.pressed : null]}>
              <Feather name="x" size={15} color="#7A719F" />
            </Pressable>
          ) : null}
        </View>

        <PrimaryButton
          label="Scan now"
          loading={scan.isScanning}
          onPress={() => void scan.scan()}
        />

        {scan.error ? <Text style={styles.errorText}>{scan.error}</Text> : null}
        {scan.message ? <Text style={styles.messageText}>{scan.message}</Text> : null}
      </SurfaceCard>

      <SectionHeader
        title="What you can scan"
        trailing={activeFocus.key === 'auto' ? 'Auto detect' : activeFocus.title}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.focusRail}>
        {SCAN_FOCUS_OPTIONS.map((option) => {
          const active = option.key === focusKey;

          return (
            <Pressable
              key={option.key}
              onPress={() => setFocusKey(option.key)}
              style={({ pressed }) => [
                styles.focusCard,
                active ? styles.focusCardActive : null,
                pressed ? styles.focusCardPressed : null,
              ]}>
              <View style={[styles.focusIconWrap, active ? styles.focusIconWrapActive : null]}>
                <Feather
                  name={option.icon}
                  size={16}
                  color={active ? '#6C3EF4' : '#8F82C0'}
                />
              </View>
              <Text style={[styles.focusCardTitle, active ? styles.focusCardTitleActive : null]}>
                {option.title}
              </Text>
              <Text style={[styles.focusCardCopy, active ? styles.focusCardCopyActive : null]}>
                {option.hint}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <SectionHeader
        title={scan.result ? `${scanLabel(scan.result.kind)} result` : 'Ready to inspect'}
        trailing={scan.result ? 'Live' : 'Waiting'}
      />

      {scan.result ? (
        <ScanResultCard
          result={scan.result}
          onChangeTab={onChangeTab}
          onOpenRtsTask={onOpenRtsTask}
          onReset={scan.reset}
        />
      ) : (
        <EmptyScanState focus={activeFocus} />
      )}

      <StockScopeFilterModal
        title="Partner"
        visible={scopeOpen}
        options={[
          { value: null, label: 'All partners' },
          ...tenantOptions,
        ]}
        onClose={() => setScopeOpen(false)}
        onSelect={(value) => {
          setTenantId(value);
          scan.reset();
          setScopeOpen(false);
        }}
      />
    </>
  );
}

function ScanCenteredHeader({
  onRefresh,
}: {
  onRefresh: () => Promise<void>;
}) {
  return (
    <View style={styles.centeredHeader}>
      <TaskHeaderIconButton icon="refresh-cw" onPress={onRefresh} />
      <Text style={styles.centeredHeaderTitle}>Universal Scan</Text>
      <View style={styles.centeredBellButton}>
        <Feather name="bell" size={18} color="#1F1F28" />
        <View style={styles.centeredBellDot} />
      </View>
    </View>
  );
}

function ScopeDropdownCard({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.scopeDropdownCard, pressed ? styles.scopeDropdownPressed : null]}>
      <View style={styles.scopeDropdownIcon}>
        <Feather name="shopping-bag" size={15} color="#F55DB8" />
      </View>
      <View style={styles.scopeDropdownCopy}>
        <Text style={styles.scopeDropdownLabel}>{label}</Text>
        <Text numberOfLines={1} style={styles.scopeDropdownValue}>{value}</Text>
      </View>
      <Feather name="chevron-down" size={18} color="#2B2836" />
    </Pressable>
  );
}

function EmptyScanState({
  focus,
}: {
  focus: ScanFocusOption;
}) {
  return (
    <SurfaceCard style={styles.emptyResultCard}>
      <View style={styles.emptyResultBadge}>
        <Feather name={focus.icon} size={18} color="#6C3EF4" />
      </View>
      <Text style={styles.emptyResultTitle}>Ready to inspect a code</Text>
      <Text style={styles.emptyResultCopy}>{focus.hint}</Text>
      <View style={styles.emptyHintPills}>
        <UtilityPill icon="hash" label="Serialized unit" />
        <UtilityPill icon="truck" label="Waybill" tone="accent" />
        <UtilityPill icon="archive" label="Basket" />
        <UtilityPill icon="map-pin" label="Bin" tone="accent" />
      </View>
    </SurfaceCard>
  );
}

function ScanResultCard({
  result,
  onChangeTab,
  onOpenRtsTask,
  onReset,
}: {
  result: UniversalScanResult;
  onChangeTab?: (tab: StoxTabKey) => void;
  onOpenRtsTask?: (task: WmsMobilePickingTask, returnFlow: WmsMobileTrackingReturnFlow | null) => void;
  onReset: () => void;
}) {
  if (result.kind === 'unit') {
    const relatedUnits = result.task
      ? flattenTaskUnits(result.task).filter((unit) => unit !== result.unit.code).slice(0, 6)
      : [];
    const latestMovement = result.unit.movements[0] ?? null;

    return (
      <SurfaceCard style={styles.resultCard}>
        <ResultHeader icon="hash" label="Serialized unit" />
        <Text style={styles.resultTitle}>{result.unit.code}</Text>
        <Text style={styles.resultLead}>{result.unit.name}</Text>

        <View style={styles.detailRow}>
          <UtilityPill icon="activity" label={result.unit.statusLabel} />
          <UtilityPill icon="map-pin" label={result.unit.currentLocation?.code ?? 'No bin'} tone="accent" />
          <UtilityPill icon="home" label={result.unit.warehouse.code} />
        </View>

        {result.task ? (
          <TaskLinkCard
            heading="Assigned order"
            task={result.task}
            onPressTasks={() => onChangeTab?.('tasks')}
          />
        ) : (
          <InlineNotice
            title="No linked order yet"
            copy="This unit is not currently tied to a picked or packed waybill in WMS."
          />
        )}

        {relatedUnits.length > 0 ? (
          <RelatedCodesBlock
            title="Other units in the same waybill"
            codes={relatedUnits}
          />
        ) : null}

        {latestMovement ? (
          <InlineNotice
            title={`Latest ${latestMovement.movementType.toLowerCase()}`}
            copy={latestMovement.notes ?? `${latestMovement.fromStatusLabel ?? 'Unknown'} to ${latestMovement.toStatusLabel ?? 'Unknown'}`}
          />
        ) : null}

        <ResultActionRow
          primaryLabel={result.task ? 'Open task' : undefined}
          onPrimaryPress={result.task ? () => onChangeTab?.('tasks') : undefined}
          onSecondaryPress={onReset}
        />
      </SurfaceCard>
    );
  }

  if (result.kind === 'tracking') {
    const relatedUnits = flattenTaskUnits(result.task).slice(0, 8);
    const hasReturnWorkflow = Boolean(result.returnFlow?.eligible);
    const returnNotice = getReturnNoticeCopy(result.returnFlow);

    return (
      <SurfaceCard style={styles.resultCard}>
        <ResultHeader icon="truck" label="Waybill" />
        <Text style={styles.resultTitle}>{result.task.tracking ?? 'Tracking pending'}</Text>
        <Text style={styles.resultLead}>Order {result.task.posOrderId}</Text>

        <View style={styles.detailRow}>
          <UtilityPill icon="activity" label={result.task.delivery?.label ?? result.task.statusLabel} />
          <UtilityPill icon="shopping-bag" label={result.task.store?.name ?? 'Store'} tone="accent" />
          <UtilityPill icon="package" label={`${result.task.totals.packed}/${result.task.totals.required} packed`} />
        </View>

        <TaskLinkCard
          heading="Order status"
          task={result.task}
          onPressTasks={() => onChangeTab?.('tasks')}
        />

        {hasReturnWorkflow ? (
          <InlineNotice
            title={result.returnFlow?.state === 'RETURNING' ? 'Return already in transit' : 'RTS workflow available'}
            copy={returnNotice}
          />
        ) : null}

        {relatedUnits.length > 0 ? (
          <RelatedCodesBlock
            title="Units included in this waybill"
            codes={relatedUnits}
          />
        ) : null}

        <ResultActionRow
          primaryLabel={hasReturnWorkflow ? 'Open RTS' : 'Open task'}
          onPrimaryPress={hasReturnWorkflow
            ? () => onOpenRtsTask?.(result.task, result.returnFlow ?? null)
            : () => onChangeTab?.('tasks')}
          onSecondaryPress={onReset}
        />
      </SurfaceCard>
    );
  }

  if (result.kind === 'basket') {
    return (
      <SurfaceCard style={styles.resultCard}>
        <ResultHeader icon="archive" label="Basket" />
        <Text style={styles.resultTitle}>{result.basket?.barcode ?? 'Basket not found'}</Text>
        <Text style={styles.resultLead}>{result.basket?.statusLabel ?? 'Unknown status'}</Text>

        <View style={styles.detailRow}>
          <UtilityPill icon="user" label={result.basket?.assignedPicker?.name ?? 'No picker'} />
          <UtilityPill icon="package" label={result.basket?.assignedPacker?.name ?? 'No packer'} tone="accent" />
          <UtilityPill icon="home" label={result.basket?.warehouse?.code ?? 'No warehouse'} />
        </View>

        {result.basket?.task ? (
          <TaskLinkCard
            heading="Current order"
            task={result.basket.task}
            onPressTasks={() => onChangeTab?.('tasks')}
          />
        ) : (
          <InlineNotice
            title="Basket is available"
            copy="This basket is not currently holding an active STOX order."
          />
        )}

        <ResultActionRow
          primaryLabel={result.basket?.task ? 'Open task' : undefined}
          onPrimaryPress={result.basket?.task ? () => onChangeTab?.('tasks') : undefined}
          onSecondaryPress={onReset}
        />
      </SurfaceCard>
    );
  }

  if (result.kind === 'bin') {
    return (
      <SurfaceCard style={styles.resultCard}>
        <ResultHeader icon="map-pin" label="Location" />
        <Text style={styles.resultTitle}>{result.bin.code}</Text>
        <Text style={styles.resultLead}>{result.bin.label}</Text>

        <View style={styles.detailRow}>
          <UtilityPill icon="archive" label={`${result.bin.occupiedUnits} occupied`} />
          <UtilityPill icon="layers" label={result.bin.capacity ? `${result.bin.capacity} capacity` : 'Open capacity'} tone="accent" />
          <UtilityPill icon="home" label={result.bin.warehouse.code} />
        </View>

        <RelatedCodesBlock
          title="Units inside this bin"
          codes={result.bin.units.slice(0, 8).map((unit) => unit.code)}
        />

        <ResultActionRow onSecondaryPress={onReset} />
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard style={styles.resultCard}>
      <ResultHeader icon="package" label="Receiving batch" />
      <Text style={styles.resultTitle}>{result.batch.code}</Text>
      <Text style={styles.resultLead}>{result.batch.statusLabel}</Text>

      <View style={styles.detailRow}>
        <UtilityPill icon="shopping-bag" label={result.batch.store.name} />
        <UtilityPill icon="home" label={result.batch.warehouse.code} tone="accent" />
        <UtilityPill icon="layers" label={`${result.batch.unitCount} units`} />
      </View>

      <RelatedCodesBlock
        title="Units in this batch"
        codes={result.batch.units.slice(0, 8).map((unit) => unit.code)}
      />

      <ResultActionRow onSecondaryPress={onReset} />
    </SurfaceCard>
  );
}

function ReturnVerificationPanel({
  flow,
  task,
  isVerifying,
  onVerifyReturnUnit,
}: {
  flow: WmsMobileTrackingReturnFlow;
  task: WmsMobilePickingTask;
  isVerifying: boolean;
  onVerifyReturnUnit?: (taskId: string, code: string) => Promise<boolean>;
}) {
  const [returnCode, setReturnCode] = useState('');
  const lastAutoSubmittedCodeRef = useRef<string | null>(null);

  useEffect(() => {
    setReturnCode('');
    lastAutoSubmittedCodeRef.current = null;
  }, [flow.state, flow.pendingUnits.length, flow.verifiedUnits.length, task.id]);

  useEffect(() => {
    const nextCode = returnCode.trim();
    if (!flow.canVerify || !onVerifyReturnUnit || isVerifying || nextCode.length < 3 || lastAutoSubmittedCodeRef.current === nextCode) {
      return;
    }

    const timer = setTimeout(() => {
      lastAutoSubmittedCodeRef.current = nextCode;
      void (async () => {
        const verified = await onVerifyReturnUnit(task.id, nextCode);
        if (verified) {
          setReturnCode('');
        }
      })();
    }, 220);

    return () => clearTimeout(timer);
  }, [flow.canVerify, isVerifying, onVerifyReturnUnit, returnCode, task.id]);

  useEffect(() => {
    if (!returnCode.trim()) {
      lastAutoSubmittedCodeRef.current = null;
    }
  }, [returnCode]);

  const handleVerify = () => {
    if (!onVerifyReturnUnit || !returnCode.trim() || isVerifying) {
      return;
    }

    void (async () => {
      const verified = await onVerifyReturnUnit(task.id, returnCode);
      if (verified) {
        setReturnCode('');
      }
    })();
  };

  return (
    <SurfaceCard tone="muted" style={styles.returnPanel}>
      <Text style={styles.returnPanelTitle}>{flow.label ?? 'RTS verification'}</Text>
      <Text style={styles.returnPanelCopy}>
        {flow.posStatusLabel ? `POS status: ${flow.posStatusLabel}. ` : ''}
        {flow.state === 'RETURNING'
          ? 'Wait until the order is marked Returned before receiving units back into warehouse flow.'
          : flow.state === 'VERIFIED'
            ? 'All dispatched units for this waybill have been verified and can now be reclassified.'
            : 'Verify each returned unit against the original dispatched waybill before final disposition.'}
      </Text>

      <View style={styles.detailRow}>
        <UtilityPill icon="refresh-ccw" label={`${flow.verifiedUnits.length}/${flow.expectedUnits} verified`} />
        <UtilityPill icon="user" label={`Picked ${task.claimedBy?.name ?? 'Unknown'}`} tone="accent" />
        <UtilityPill icon="shopping-bag" label={`Packed ${task.packedBy?.name ?? 'Unknown'}`} />
      </View>

      {flow.lastVerifiedAt ? (
        <Text style={styles.returnMetaText}>
          Last verification {formatScanDateTime(flow.lastVerifiedAt)}
          {flow.lastVerifiedBy ? ` by ${flow.lastVerifiedBy.name}` : ''}
        </Text>
      ) : null}

      {flow.pendingUnits.length > 0 ? (
        <RelatedCodesBlock
          title="Pending returned units"
          codes={flow.pendingUnits.map((unit) => unit.code)}
        />
      ) : null}

      {flow.verifiedUnits.length > 0 ? (
        <RelatedCodesBlock
          title="Verified returned units"
          codes={flow.verifiedUnits.map((unit) => unit.code)}
        />
      ) : null}

      {flow.canVerify && onVerifyReturnUnit ? (
        <View style={styles.returnInputWrap}>
          <Text style={styles.returnInputLabel}>Returned unit</Text>
          <View style={styles.returnInputRow}>
            <TextInput
              autoCapitalize="characters"
              autoCorrect={false}
              blurOnSubmit={false}
              placeholder="Scan returned serialized unit"
              placeholderTextColor="#8C83B3"
              returnKeyType="done"
              selectTextOnFocus
              showSoftInputOnFocus={false}
              value={returnCode}
              onChangeText={setReturnCode}
              onSubmitEditing={handleVerify}
              style={styles.returnInput}
            />
            <PrimaryButton
              label={isVerifying ? 'Checking' : 'Mark RTS'}
              loading={isVerifying}
              onPress={handleVerify}
              style={styles.returnVerifyButton}
            />
          </View>
        </View>
      ) : null}
    </SurfaceCard>
  );
}

function ResultHeader({
  icon,
  label,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
}) {
  return (
    <View style={styles.resultHeader}>
      <View style={styles.resultHeaderBadge}>
        <Feather name={icon} size={14} color="#6C3EF4" />
      </View>
      <Text style={styles.resultHeaderText}>{label}</Text>
    </View>
  );
}

function InlineNotice({
  title,
  copy,
}: {
  title: string;
  copy: string;
}) {
  return (
    <SurfaceCard tone="muted" style={styles.inlineNotice}>
      <Text style={styles.inlineNoticeTitle}>{title}</Text>
      <Text style={styles.inlineNoticeCopy}>{copy}</Text>
    </SurfaceCard>
  );
}

function RelatedCodesBlock({
  title,
  codes,
}: {
  title: string;
  codes: string[];
}) {
  return (
    <View style={styles.relatedBlock}>
      <Text style={styles.relatedTitle}>{title}</Text>
      <View style={styles.codeWrap}>
        {codes.map((code) => (
          <View key={code} style={styles.codeChip}>
            <Text style={styles.codeChipText}>{code}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ResultActionRow({
  primaryLabel,
  onPrimaryPress,
  onSecondaryPress,
}: {
  primaryLabel?: string;
  onPrimaryPress?: () => void;
  onSecondaryPress: () => void;
}) {
  return (
    <View style={styles.resultActionRow}>
      {primaryLabel && onPrimaryPress ? (
        <Pressable onPress={onPrimaryPress} style={({ pressed }) => [styles.primaryInlineAction, pressed ? styles.pressed : null]}>
          <Text style={styles.primaryInlineActionText}>{primaryLabel}</Text>
        </Pressable>
      ) : null}
      <Pressable onPress={onSecondaryPress} style={({ pressed }) => [styles.secondaryInlineAction, pressed ? styles.pressed : null]}>
        <Text style={styles.secondaryInlineActionText}>Scan again</Text>
      </Pressable>
    </View>
  );
}

function TaskLinkCard({
  heading,
  task,
  onPressTasks,
}: {
  heading: string;
  task: WmsMobilePickingTask;
  onPressTasks?: () => void;
}) {
  return (
    <SurfaceCard tone="muted" style={styles.taskLinkCard}>
      <View style={styles.taskLinkHead}>
        <View style={styles.taskLinkCopy}>
          <Text style={styles.taskLinkHeading}>{heading}</Text>
          <Text style={styles.taskLinkTitle}>{task.store?.name ?? 'Store not set'} · {task.posOrderId}</Text>
        </View>
        <Text style={styles.taskLinkStatus}>{task.delivery?.label ?? task.statusLabel}</Text>
      </View>
      <Text style={styles.taskLinkMeta}>
        {task.totals.required} units
        {task.tracking ? ` · Tracking ${task.tracking}` : ''}
      </Text>
      <Text style={styles.taskLinkProducts}>
        {task.lines.slice(0, 2).map((line) => `${line.required}x ${line.productName}`).join(' • ')}
      </Text>
      {onPressTasks ? (
        <Pressable onPress={onPressTasks} style={({ pressed }) => [styles.taskLinkButton, pressed ? styles.pressed : null]}>
          <Text style={styles.taskLinkButtonText}>Open tasks</Text>
        </Pressable>
      ) : null}
    </SurfaceCard>
  );
}

function SectionHeader({
  title,
  trailing,
}: {
  title: string;
  trailing?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderTitle}>{title}</Text>
      {trailing ? <Text style={styles.sectionHeaderTrailing}>{trailing}</Text> : null}
    </View>
  );
}

function flattenTaskUnits(task: WmsMobilePickingTask) {
  return task.lines.flatMap((line) => line.reservations.map((reservation) => reservation.unit.code));
}

function scanLabel(kind: UniversalScanResult['kind']) {
  switch (kind) {
    case 'unit':
      return 'Unit';
    case 'basket':
      return 'Basket';
    case 'bin':
      return 'Location';
    case 'batch':
      return 'Batch';
    case 'tracking':
      return 'Waybill';
    default:
      return 'Result';
  }
}

function getReturnNoticeCopy(flow: WmsMobileTrackingReturnFlow | null) {
  if (!flow) {
    return 'This waybill can be traced in Scan, but RTS starts from the dedicated Inventory return screen.';
  }

  if (flow.state === 'RETURNING') {
    return 'The order is already returning. Open RTS from Inventory to monitor it, then verify units once POS marks it Returned.';
  }

  if (flow.state === 'VERIFIED') {
    return 'All returned units were already verified. Continue in Inventory RTS to decide whether they go back to stock, deadstock, damage, or loss.';
  }

  return 'This waybill is ready for the dedicated RTS inventory workflow. Open RTS to verify returned serialized units one by one.';
}

function formatScanDateTime(value: string) {
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
  scanHeroCard: {
    gap: tokens.spacing.md,
    padding: 22,
  },
  heroTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroIconBubble: {
    alignItems: 'center',
    backgroundColor: '#EEE9FF',
    borderRadius: 18,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  heroModePill: {
    backgroundColor: '#F3F0FF',
    borderRadius: tokens.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  heroModePillText: {
    color: '#6C3EF4',
    fontSize: 12,
    fontWeight: '800',
  },
  scopeDropdownCard: {
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
  scopeDropdownPressed: {
    opacity: 0.9,
  },
  scopeDropdownIcon: {
    alignItems: 'center',
    backgroundColor: '#FFF1F8',
    borderRadius: 16,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  scopeDropdownCopy: {
    flex: 1,
    gap: 2,
  },
  scopeDropdownLabel: {
    color: '#958AB5',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  scopeDropdownValue: {
    color: tokens.colors.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  inputShell: {
    alignItems: 'center',
    backgroundColor: '#FFFDF8',
    borderColor: '#E6DDF6',
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    minHeight: 62,
    paddingHorizontal: 16,
  },
  inputIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanInput: {
    color: tokens.colors.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    minHeight: 56,
  },
  clearInputButton: {
    alignItems: 'center',
    backgroundColor: '#F5F0FF',
    borderRadius: 999,
    height: 28,
    justifyContent: 'center',
    width: 28,
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
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionHeaderTitle: {
    color: tokens.colors.ink,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  sectionHeaderTrailing: {
    color: '#8A6FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  focusRail: {
    gap: tokens.spacing.sm,
    paddingRight: tokens.spacing.md,
  },
  focusCard: {
    backgroundColor: '#FFFDF8',
    borderColor: '#ECE4FA',
    borderRadius: 24,
    borderWidth: 1,
    gap: 10,
    minHeight: 156,
    padding: 16,
    width: 176,
  },
  focusCardActive: {
    backgroundColor: '#F8F4FF',
    borderColor: '#CDBEFF',
    shadowColor: '#9C83FF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 4,
  },
  focusCardPressed: {
    opacity: 0.92,
  },
  focusIconWrap: {
    alignItems: 'center',
    backgroundColor: '#F2EDFF',
    borderRadius: 16,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  focusIconWrapActive: {
    backgroundColor: '#EEE6FF',
  },
  focusCardTitle: {
    color: tokens.colors.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  focusCardTitleActive: {
    color: '#6C3EF4',
  },
  focusCardCopy: {
    color: tokens.colors.inkMuted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  focusCardCopyActive: {
    color: '#716492',
  },
  emptyResultCard: {
    alignItems: 'flex-start',
    gap: tokens.spacing.md,
    minHeight: 200,
    justifyContent: 'center',
  },
  emptyResultBadge: {
    alignItems: 'center',
    backgroundColor: '#EEE9FF',
    borderRadius: 18,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  emptyResultTitle: {
    color: tokens.colors.ink,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  emptyResultCopy: {
    color: tokens.colors.inkMuted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  emptyHintPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
  },
  resultCard: {
    gap: tokens.spacing.md,
  },
  resultHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  resultHeaderBadge: {
    alignItems: 'center',
    backgroundColor: '#EEE9FF',
    borderRadius: 14,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  resultHeaderText: {
    color: '#8A6FFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  resultTitle: {
    color: tokens.colors.ink,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.9,
  },
  resultLead: {
    color: tokens.colors.inkMuted,
    fontSize: 15,
    fontWeight: '700',
  },
  detailRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
  },
  inlineNotice: {
    gap: tokens.spacing.xs,
    padding: tokens.spacing.md,
  },
  inlineNoticeTitle: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  inlineNoticeCopy: {
    color: tokens.colors.inkMuted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  relatedBlock: {
    gap: tokens.spacing.sm,
  },
  returnPanel: {
    gap: tokens.spacing.sm,
    padding: tokens.spacing.md,
  },
  returnPanelTitle: {
    color: tokens.colors.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  returnPanelCopy: {
    color: tokens.colors.inkMuted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  returnMetaText: {
    color: '#8C83B3',
    fontSize: 11,
    fontWeight: '700',
  },
  returnInputWrap: {
    gap: 8,
  },
  returnInputLabel: {
    color: '#8C83B3',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  returnInputRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  returnInput: {
    backgroundColor: '#FFFDF8',
    borderColor: '#E6DDF6',
    borderRadius: 18,
    borderWidth: 1,
    color: tokens.colors.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    minHeight: 54,
    paddingHorizontal: 14,
  },
  returnVerifyButton: {
    minHeight: 54,
    minWidth: 118,
    paddingHorizontal: 14,
  },
  relatedTitle: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  codeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
  },
  codeChip: {
    backgroundColor: '#F5F0FF',
    borderRadius: tokens.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  codeChipText: {
    color: tokens.colors.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  taskLinkCard: {
    gap: tokens.spacing.sm,
    padding: tokens.spacing.md,
  },
  taskLinkHead: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    justifyContent: 'space-between',
  },
  taskLinkCopy: {
    flex: 1,
    gap: 2,
  },
  taskLinkHeading: {
    color: '#8C83B3',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  taskLinkTitle: {
    color: tokens.colors.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  taskLinkStatus: {
    color: tokens.colors.success,
    fontSize: 12,
    fontWeight: '800',
  },
  taskLinkMeta: {
    color: tokens.colors.inkMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  taskLinkProducts: {
    color: tokens.colors.ink,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  taskLinkButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFDF8',
    borderColor: '#E0D7F0',
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  taskLinkButtonText: {
    color: '#6C3EF4',
    fontSize: 13,
    fontWeight: '800',
  },
  resultActionRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  primaryInlineAction: {
    alignItems: 'center',
    backgroundColor: '#6C3EF4',
    borderRadius: tokens.radius.pill,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  primaryInlineActionText: {
    color: '#FFFDF8',
    fontSize: 13,
    fontWeight: '800',
  },
  secondaryInlineAction: {
    alignItems: 'center',
    backgroundColor: '#F5F0FF',
    borderColor: '#E2D7F6',
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  secondaryInlineActionText: {
    color: '#6C3EF4',
    fontSize: 13,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.9,
  },
});
