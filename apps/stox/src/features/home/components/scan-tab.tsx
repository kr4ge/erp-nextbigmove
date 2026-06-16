import { useEffect, useMemo, useRef, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
import { BlockedTaskState, TaskHeaderIconButton } from './stox-primitives';

type ScanTabProps = {
  bootstrap: BootstrapResponse;
  device: DeviceIdentity | null;
  session: StoredSession;
  onRefresh: () => Promise<void>;
  onChangeTab?: (tab: StoxTabKey) => void;
  onOpenRtsTask?: (task: WmsMobilePickingTask, returnFlow: WmsMobileTrackingReturnFlow | null) => void;
};

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
  const scan = useUniversalScan({
    device,
    filters: {
      tenantId,
    },
    session,
  });
  const inputRef = useRef<TextInput>(null);
  const lastAutoSubmittedCodeRef = useRef<string | null>(null);

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
        <ScopeDropdownCard
          value={activeTenantName}
          onPress={() => setScopeOpen(true)}
        />

        <View style={styles.inputShell}>
          <View style={styles.inputIconWrap}>
            <Feather name="maximize" size={18} color="#8A6FFF" />
          </View>
          <TextInput
            ref={inputRef}
            autoCapitalize="characters"
            autoCorrect={false}
            blurOnSubmit={false}
            caretHidden
            contextMenuHidden
            placeholder="Scan barcode"
            placeholderTextColor="#8C83B3"
            returnKeyType="search"
            selectTextOnFocus={false}
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

      {scan.result ? (
        <ScanResultCard
          result={scan.result}
          onChangeTab={onChangeTab}
          onOpenRtsTask={onOpenRtsTask}
          onReset={scan.reset}
        />
      ) : null}

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
      <Text style={styles.centeredHeaderTitle}>Scan</Text>
      <View style={styles.centeredBellButton}>
        <Feather name="bell" size={18} color="#1F1F28" />
        <View style={styles.centeredBellDot} />
      </View>
    </View>
  );
}

function ScopeDropdownCard({
  value,
  onPress,
}: {
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.scopeDropdownCard, pressed ? styles.scopeDropdownPressed : null]}>
      <View style={styles.scopeDropdownIcon}>
        <Feather name="shopping-bag" size={15} color="#F55DB8" />
      </View>
      <View style={styles.scopeDropdownCopy}>
        <Text numberOfLines={1} style={styles.scopeDropdownValue}>{value}</Text>
      </View>
      <Feather name="chevron-down" size={18} color="#2B2836" />
    </Pressable>
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
  let icon: keyof typeof Feather.glyphMap = 'maximize';
  let label = 'Result';
  let title = '';
  let lead: string | null = null;
  let primaryLabel: string | undefined;
  let onPrimaryPress: (() => void) | undefined;
  const facts: Array<{ label: string; value: string | null | undefined }> = [];
  const detailSections: Array<{ label: string; values: string[] }> = [];

  if (result.kind === 'unit') {
    icon = 'hash';
    label = 'Unit';
    title = result.unit.code;
    lead = result.unit.statusLabel;
    facts.push(
      { label: 'Product', value: result.unit.name },
      { label: 'Bin', value: result.unit.currentLocation?.code ?? 'No bin' },
      { label: 'Warehouse', value: result.unit.warehouse.code },
      { label: 'Order', value: result.task?.posOrderId ?? 'None' },
    );
    if (result.task) {
      primaryLabel = 'Open task';
      onPrimaryPress = () => onChangeTab?.('tasks');
    }
  } else if (result.kind === 'tracking') {
    const hasReturnWorkflow = Boolean(result.returnFlow?.eligible);
    icon = 'truck';
    label = 'Waybill';
    title = result.task.tracking ?? 'Tracking pending';
    lead = result.task.delivery?.label ?? result.task.statusLabel;
    facts.push(
      { label: 'Order', value: result.task.posOrderId },
      { label: 'Store', value: result.task.store?.name ?? 'Store' },
      { label: 'Units', value: `${result.task.totals.packed}/${result.task.totals.required}` },
      { label: 'RTS', value: result.returnFlow?.label ?? 'None' },
    );
    if (result.task.basket) {
      detailSections.push({
        label: 'Basket',
        values: [
          `${result.task.basket.barcode}${result.task.basket.statusLabel ? ` · ${result.task.basket.statusLabel}` : ''}`,
        ],
      });
    }
    primaryLabel = hasReturnWorkflow ? 'Open RTS' : 'Open task';
    onPrimaryPress = hasReturnWorkflow
      ? () => onOpenRtsTask?.(result.task, result.returnFlow ?? null)
      : () => onChangeTab?.('tasks');
  } else if (result.kind === 'basket') {
    const basketOrders = result.basket?.orders ?? [];
    icon = 'archive';
    label = 'Basket';
    title = result.basket?.barcode ?? 'Basket not found';
    lead = result.basket?.statusLabel ?? 'Unknown status';
    facts.push(
      { label: 'Orders', value: result.basket ? `${result.basket.activeFulfillmentOrders}/${result.basket.maxFulfillmentOrders}` : '0' },
      { label: 'Picker', value: result.basket?.assignedPicker?.name ?? 'None' },
      { label: 'Packer', value: result.basket?.assignedPacker?.name ?? 'None' },
      { label: 'Order', value: result.basket?.task?.posOrderId ?? basketOrders[0]?.posOrderId ?? 'None' },
    );
    const basketTrackingValues = basketOrders.map((order) => {
      if (order.tracking) {
        return order.posOrderId ? `${order.tracking} · ${order.posOrderId}` : order.tracking;
      }

      return order.posOrderId ? `${order.posOrderId} · Awaiting tracking` : 'Awaiting tracking';
    });
    if (basketTrackingValues.length > 0) {
      detailSections.push({
        label: 'Tracking in basket',
        values: basketTrackingValues,
      });
    }
    if (result.basket?.task) {
      primaryLabel = 'Open task';
      onPrimaryPress = () => onChangeTab?.('tasks');
    }
  } else if (result.kind === 'bin') {
    icon = 'map-pin';
    label = 'Bin';
    title = result.bin.code;
    lead = result.bin.label;
    facts.push(
      { label: 'Units', value: `${result.bin.occupiedUnits}` },
      { label: 'Capacity', value: result.bin.capacity ? `${result.bin.capacity}` : 'Open' },
      { label: 'Warehouse', value: result.bin.warehouse.code },
      { label: 'First unit', value: result.bin.units[0]?.code ?? 'Empty' },
    );
  } else {
    icon = 'package';
    label = 'Batch';
    title = result.batch.code;
    lead = result.batch.statusLabel;
    facts.push(
      { label: 'Units', value: `${result.batch.unitCount}` },
      { label: 'Store', value: result.batch.store.name },
      { label: 'Warehouse', value: result.batch.warehouse.code },
      { label: 'Location', value: result.batch.stagingLocation?.code ?? 'None' },
    );
  }

  return (
    <SurfaceCard style={styles.resultCard}>
      <ResultHeader icon={icon} label={label} />
      <Text selectable style={styles.resultTitle}>{title}</Text>
      {lead ? <Text style={styles.resultLead}>{lead}</Text> : null}

      <View style={styles.factList}>
        {facts.map((fact) => (
          <FactRow key={fact.label} label={fact.label} value={fact.value ?? '-'} />
        ))}
      </View>

      {detailSections.map((section) => (
        <ResultDetailSection key={section.label} label={section.label} values={section.values} />
      ))}

      <ResultActionRow
        primaryLabel={primaryLabel}
        onPrimaryPress={onPrimaryPress}
        onSecondaryPress={onReset}
      />
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

function FactRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.factRow}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.factValue}>{value}</Text>
    </View>
  );
}

function ResultDetailSection({
  label,
  values,
}: {
  label: string;
  values: string[];
}) {
  return (
    <View style={styles.detailSection}>
      <Text style={styles.detailSectionLabel}>{label}</Text>
      <View style={styles.detailSectionList}>
        {values.map((value, index) => (
          <View
            key={`${label}-${value}-${index}`}
            style={[
              styles.detailSectionRow,
              index === values.length - 1 ? styles.detailSectionRowLast : null,
            ]}>
            <Text selectable style={styles.detailSectionValue}>{value}</Text>
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
    gap: tokens.spacing.sm,
    padding: 16,
  },
  scopeDropdownCard: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFFDF8',
    borderColor: '#E8DFF8',
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 40,
    paddingHorizontal: 12,
  },
  scopeDropdownPressed: {
    opacity: 0.9,
  },
  scopeDropdownIcon: {
    alignItems: 'center',
    backgroundColor: '#FFF1F8',
    borderRadius: tokens.radius.pill,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  scopeDropdownCopy: {
    gap: 2,
  },
  scopeDropdownValue: {
    color: tokens.colors.ink,
    fontSize: 13,
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
    minHeight: 58,
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
    minHeight: 52,
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
  factList: {
    borderColor: '#ECE4FA',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  factRow: {
    alignItems: 'center',
    backgroundColor: '#FFFDF8',
    borderBottomColor: '#F0EAF8',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: tokens.spacing.md,
    justifyContent: 'space-between',
    minHeight: 46,
    paddingHorizontal: 14,
  },
  factLabel: {
    color: tokens.colors.inkMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  factValue: {
    color: tokens.colors.ink,
    flex: 1,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
  },
  detailSection: {
    gap: 8,
  },
  detailSectionLabel: {
    color: '#8A6FFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  detailSectionList: {
    borderColor: '#ECE4FA',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  detailSectionRow: {
    backgroundColor: '#FFFDF8',
    borderBottomColor: '#F0EAF8',
    borderBottomWidth: 1,
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  detailSectionRowLast: {
    borderBottomWidth: 0,
  },
  detailSectionValue: {
    color: tokens.colors.ink,
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
