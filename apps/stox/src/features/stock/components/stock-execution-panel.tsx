import { useEffect, useRef, type RefObject } from 'react';
import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { DeviceIdentity, StoredSession } from '@/src/features/auth/types';
import { PrimaryButton } from '@/src/shared/components/primary-button';
import { SurfaceCard } from '@/src/shared/components/surface-card';
import { tokens } from '@/src/shared/theme/tokens';
import { SectionLabel } from '../../home/components/stox-primitives';
import { useStockExecution, type StockScanTarget } from '../hooks/use-stock-execution';
import type { QueuedStockAction } from '../services/stock-offline-store';
import type { StockFilters, WmsMobileStockMovement } from '../types';
import { formatStockDate, joinStockMeta } from '../utils/stock-formatters';

type StockExecutionPanelProps = {
  device: DeviceIdentity | null;
  filters: StockFilters;
  session: StoredSession;
  onExecuted: () => Promise<void>;
  onQueued: (action: QueuedStockAction) => Promise<void>;
};

export function StockExecutionPanel({
  device,
  filters,
  session,
  onExecuted,
  onQueued,
}: StockExecutionPanelProps) {
  const execution = useStockExecution({
    device,
    filters,
    session,
    onExecuted,
    onQueued,
  });
  const lookupInputRef = useRef<TextInput>(null);
  const targetInputRef = useRef<TextInput>(null);
  const lastAutoSubmittedCodeRef = useRef<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (execution.scanTarget === 'target') {
        targetInputRef.current?.focus();
        return;
      }

      lookupInputRef.current?.focus();
    }, 120);

    return () => clearTimeout(timer);
  }, [execution.scanTarget, execution.result]);

  useEffect(() => {
    const code = execution.scanCode.trim();

    if (
      execution.scanTarget !== 'lookup'
      || execution.isScanning
      || code.length < 3
      || lastAutoSubmittedCodeRef.current === code
    ) {
      return;
    }

    const timer = setTimeout(() => {
      lastAutoSubmittedCodeRef.current = code;
      void execution.scan(code);
    }, 220);

    return () => clearTimeout(timer);
  }, [execution.isScanning, execution.scan, execution.scanCode, execution.scanTarget]);

  useEffect(() => {
    if (!execution.scanCode.trim()) {
      lastAutoSubmittedCodeRef.current = null;
    }
  }, [execution.scanCode]);

  return (
    <SurfaceCard style={styles.card}>
      <SectionLabel
        title="Scan"
        trailing={execution.isScanning ? 'Checking' : scanTargetCopy[execution.scanTarget]}
      />

      <View style={styles.inputRow}>
        <TextInput
          ref={lookupInputRef}
          autoCapitalize="characters"
          autoCorrect={false}
          blurOnSubmit={false}
          placeholder="Unit, bin, or batch"
          placeholderTextColor={tokens.colors.inkSoft}
          returnKeyType="search"
          selectTextOnFocus
          showSoftInputOnFocus={false}
          value={execution.scanCode}
          onChangeText={execution.setScanCode}
          onSubmitEditing={() => {
            void execution.scan();
          }}
          style={styles.input}
        />
        <Pressable
          disabled={execution.isScanning}
          onPress={() => {
            void execution.scan();
          }}
          style={({ pressed }) => [
            styles.scanButton,
            pressed && !execution.isScanning ? styles.pressed : null,
            execution.isScanning ? styles.disabled : null,
          ]}>
          <Feather name="search" size={18} color={tokens.colors.surface} />
        </Pressable>
      </View>

      {execution.error ? <Text style={styles.error}>{execution.error}</Text> : null}
      {execution.message ? <Text style={styles.success}>{execution.message}</Text> : null}

      {execution.result?.found && execution.result.type === 'unit' ? (
        <UnitExecutionCard
          isSubmitting={execution.isSubmitting}
          targetCode={execution.targetCode}
          unit={execution.result.unit}
          onChangeTargetCode={execution.setTargetCode}
          onScanAnother={execution.resetLookup}
          onMove={execution.executeMove}
          onPutaway={execution.executePutaway}
          targetInputRef={targetInputRef}
        />
      ) : null}

      {execution.result?.found && (execution.result.type === 'bin' || execution.result.type === 'location') ? (
        <BinResultCard
          bin={execution.result.bin}
          onSelectUnit={execution.scanRelatedUnit}
        />
      ) : null}

      {execution.result?.found && execution.result.type === 'batch' ? (
        <BatchResultCard
          batch={execution.result.batch}
          onSelectUnit={execution.scanRelatedUnit}
        />
      ) : null}
    </SurfaceCard>
  );
}

function UnitExecutionCard({
  isSubmitting,
  targetCode,
  unit,
  onChangeTargetCode,
  onScanAnother,
  onMove,
  onPutaway,
  targetInputRef,
}: {
  isSubmitting: boolean;
  targetCode: string;
  unit: import('../types').WmsMobileStockUnitDetail;
  onChangeTargetCode: (value: string) => void;
  onScanAnother: () => void;
  onMove: () => Promise<void>;
  onPutaway: () => Promise<void>;
  targetInputRef: RefObject<TextInput | null>;
}) {
  return (
    <View style={styles.resultBlock}>
      <View style={styles.resultHeader}>
        <View style={styles.resultIcon}>
          <Feather name="box" size={16} color={tokens.colors.panel} />
        </View>
        <View style={styles.resultCopy}>
          <Text selectable style={styles.resultTitle}>{unit.code}</Text>
          <Text numberOfLines={2} style={styles.resultMeta}>
            {joinStockMeta([unit.statusLabel, unit.currentLocation?.code ?? 'No bin', unit.warehouse.code])}
          </Text>
        </View>
      </View>

      <Text numberOfLines={2} style={styles.productName}>{unit.name}</Text>

      <TextInput
        ref={targetInputRef}
        autoCapitalize="characters"
        autoCorrect={false}
        blurOnSubmit={false}
        placeholder="Target bin/location"
        placeholderTextColor={tokens.colors.inkSoft}
        selectTextOnFocus
        showSoftInputOnFocus={false}
        value={targetCode}
        onChangeText={onChangeTargetCode}
        style={styles.targetInput}
      />

      <View style={styles.actionRow}>
        {unit.allowedActions.putaway ? (
          <PrimaryButton
            disabled={isSubmitting}
            label="Putaway"
            loading={isSubmitting}
            onPress={onPutaway}
            style={styles.actionButton}
          />
        ) : null}
        {unit.allowedActions.move ? (
          <PrimaryButton
            disabled={isSubmitting}
            label="Move"
            loading={isSubmitting}
            variant={unit.allowedActions.putaway ? 'secondary' : 'primary'}
            onPress={onMove}
            style={styles.actionButton}
          />
        ) : null}
      </View>

      {!unit.allowedActions.putaway && !unit.allowedActions.move ? (
        <Text style={styles.blockedActionText}>No mobile stock action is available for this unit.</Text>
      ) : null}

      <Pressable
        onPress={onScanAnother}
        style={({ pressed }) => [styles.scanAnother, pressed ? styles.pressed : null]}>
        <Feather name="rotate-ccw" size={14} color={tokens.colors.panel} />
        <Text style={styles.scanAnotherText}>Scan another unit</Text>
      </Pressable>

      {unit.movements.length > 0 ? (
        <View style={styles.timeline}>
          <Text style={styles.timelineTitle}>History</Text>
          {unit.movements.slice(0, 4).map((movement) => (
            <MovementRow key={movement.id} movement={movement} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function BinResultCard({
  bin,
  onSelectUnit,
}: {
  bin: import('../types').WmsMobileStockBinDetail;
  onSelectUnit: (code: string) => Promise<void>;
}) {
  return (
    <View style={styles.resultBlock}>
      <View style={styles.resultHeader}>
        <View style={styles.resultIcon}>
          <Feather name="archive" size={16} color={tokens.colors.panel} />
        </View>
        <View style={styles.resultCopy}>
          <Text selectable style={styles.resultTitle}>{bin.code}</Text>
          <Text numberOfLines={2} style={styles.resultMeta}>
            {joinStockMeta([
              bin.kind,
              `${bin.occupiedUnits}/${bin.capacity ?? '-'} units`,
              bin.warehouse.code,
            ])}
          </Text>
        </View>
      </View>

      <View style={styles.compactList}>
        {bin.units.length === 0 ? <Text style={styles.emptyText}>No units in this location.</Text> : null}
        {bin.units.slice(0, 8).map((unit) => (
          <Pressable
            key={unit.id}
            onPress={() => {
              void onSelectUnit(unit.code);
            }}
            style={({ pressed }) => [styles.compactRow, pressed ? styles.pressed : null]}>
            <Text selectable style={styles.compactTitle}>{unit.code}</Text>
            <Text numberOfLines={1} style={styles.compactMeta}>{unit.statusLabel}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function BatchResultCard({
  batch,
  onSelectUnit,
}: {
  batch: import('../types').WmsMobileStockBatchDetail;
  onSelectUnit: (code: string) => Promise<void>;
}) {
  return (
    <View style={styles.resultBlock}>
      <View style={styles.resultHeader}>
        <View style={styles.resultIcon}>
          <Feather name="inbox" size={16} color={tokens.colors.panel} />
        </View>
        <View style={styles.resultCopy}>
          <Text selectable style={styles.resultTitle}>{batch.code}</Text>
          <Text numberOfLines={2} style={styles.resultMeta}>
            {joinStockMeta([batch.statusLabel, `${batch.unitCount} units`, batch.warehouse.code])}
          </Text>
        </View>
      </View>

      <View style={styles.compactList}>
        {batch.units.length === 0 ? <Text style={styles.emptyText}>No units in this batch.</Text> : null}
        {batch.units.slice(0, 10).map((unit) => (
          <Pressable
            key={unit.id}
            onPress={() => {
              void onSelectUnit(unit.code);
            }}
            style={({ pressed }) => [styles.compactRow, pressed ? styles.pressed : null]}>
            <Text selectable style={styles.compactTitle}>{unit.code}</Text>
            <Text numberOfLines={1} style={styles.compactMeta}>{unit.statusLabel}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function MovementRow({ movement }: { movement: WmsMobileStockMovement }) {
  return (
    <View style={styles.movementRow}>
      <Text numberOfLines={1} style={styles.movementTitle}>
        {movement.movementType}
      </Text>
      <Text numberOfLines={2} style={styles.movementMeta}>
        {joinStockMeta([
          `${movement.fromLocation?.code ?? 'Origin'} > ${movement.toLocation?.code ?? 'Target'}`,
          movement.actor?.name ?? 'System',
          formatStockDate(movement.createdAt),
        ])}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: tokens.spacing.md,
  },
  inputRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  input: {
    backgroundColor: tokens.colors.surfaceMuted,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    color: tokens.colors.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    minHeight: 52,
    paddingHorizontal: tokens.spacing.md,
  },
  scanButton: {
    alignItems: 'center',
    backgroundColor: tokens.colors.panel,
    borderRadius: tokens.radius.lg,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.58,
  },
  error: {
    color: tokens.colors.danger,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  success: {
    color: tokens.colors.success,
    fontSize: 13,
    fontWeight: '800',
  },
  resultBlock: {
    backgroundColor: tokens.colors.surfaceMuted,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    gap: tokens.spacing.md,
    padding: tokens.spacing.md,
  },
  resultHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  resultIcon: {
    alignItems: 'center',
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  resultCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  resultTitle: {
    color: tokens.colors.ink,
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 21,
  },
  resultMeta: {
    color: tokens.colors.inkMuted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  productName: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
  },
  targetInput: {
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    color: tokens.colors.ink,
    fontSize: 15,
    fontWeight: '700',
    minHeight: 50,
    paddingHorizontal: tokens.spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  actionButton: {
    flex: 1,
    minHeight: 50,
  },
  blockedActionText: {
    color: tokens.colors.inkMuted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  scanAnother: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.xs,
  },
  scanAnotherText: {
    color: tokens.colors.panel,
    fontSize: 13,
    fontWeight: '900',
  },
  timeline: {
    gap: tokens.spacing.sm,
  },
  timelineTitle: {
    color: tokens.colors.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  movementRow: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.md,
    gap: 2,
    padding: tokens.spacing.sm,
  },
  movementTitle: {
    color: tokens.colors.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  movementMeta: {
    color: tokens.colors.inkMuted,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
  },
  compactList: {
    gap: tokens.spacing.sm,
  },
  compactRow: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.md,
    gap: 2,
    padding: tokens.spacing.sm,
  },
  compactTitle: {
    color: tokens.colors.ink,
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 18,
  },
  compactMeta: {
    color: tokens.colors.inkMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  emptyText: {
    color: tokens.colors.inkMuted,
    fontSize: 13,
    fontWeight: '700',
  },
});

const scanTargetCopy: Record<StockScanTarget, string> = {
  lookup: 'Scan item',
  target: 'Scan target',
};
