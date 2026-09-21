import { useMemo, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { WmsFulfillmentItemChange } from '@/src/features/picking/types';
import { tokens } from '@/src/shared/theme/tokens';

type OrderDetachmentPanelProps = {
  change: WmsFulfillmentItemChange;
  canDetach: boolean;
  disabled: boolean;
  onStart?: (confirmation: string, reason: string) => Promise<boolean>;
  onReturnUnit?: (binCode: string, unitCode: string) => Promise<boolean>;
};

export function OrderDetachmentPanel({
  change,
  canDetach,
  disabled,
  onStart,
  onReturnUnit,
}: OrderDetachmentPanelProps) {
  const [confirming, setConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [reason, setReason] = useState('');
  const [binCode, setBinCode] = useState('');
  const [unitCode, setUnitCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const detachment = change.detachment;
  const hasUnavailablePick = useMemo(
    () => change.pickSteps.some((step) => step.unallocatedQuantity > 0),
    [change.pickSteps],
  );

  if (!detachment && (!canDetach || !onStart || !hasUnavailablePick)) {
    return null;
  }

  const startDetachment = async () => {
    const normalizedConfirmation = confirmation.trim();
    const normalizedReason = reason.trim();
    if (normalizedConfirmation !== change.order.posOrderId) {
      setValidationError(`Type ${change.order.posOrderId} exactly to confirm this order.`);
      return;
    }
    if (normalizedReason.length < 10) {
      setValidationError('Explain why this order is being detached using at least 10 characters.');
      return;
    }
    if (!onStart || submitting || disabled) return;
    setSubmitting(true);
    setValidationError(null);
    try {
      if (await onStart(normalizedConfirmation, normalizedReason)) {
        setConfirming(false);
        setConfirmation('');
        setReason('');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const returnUnit = async () => {
    const normalizedBin = binCode.trim();
    const normalizedUnit = unitCode.trim();
    if (!normalizedBin || !normalizedUnit) {
      setValidationError('Scan both the destination bin and serialized unit.');
      return;
    }
    if (!onReturnUnit || submitting || disabled) return;
    setSubmitting(true);
    setValidationError(null);
    try {
      if (await onReturnUnit(normalizedBin, normalizedUnit)) {
        setBinCode('');
        setUnitCode('');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!detachment) {
    return (
      <View style={styles.decisionCard}>
        <View style={styles.titleRow}>
          <View style={styles.iconCircle}>
            <Feather name="archive" size={16} color={tokens.colors.danger} />
          </View>
          <View style={styles.copy}>
            <Text style={styles.title}>Replacement stock is unavailable</Text>
            <Text style={styles.body}>
              A supervisor can isolate only this order. The rest of the basket continues after every serialized unit below is validated back into its original bin.
            </Text>
          </View>
        </View>

        {confirming ? (
          <View style={styles.form}>
            <Text style={styles.label}>Confirm affected order</Text>
            <Text style={styles.helper}>Type {change.order.posOrderId} to confirm. This does not cancel the POS order.</Text>
            <TextInput
              autoCapitalize="characters"
              editable={!disabled && !submitting}
              onChangeText={setConfirmation}
              placeholder={change.order.posOrderId}
              placeholderTextColor={tokens.colors.inkSoft}
              style={styles.input}
              value={confirmation}
            />
            <Text style={styles.label}>Reason</Text>
            <TextInput
              editable={!disabled && !submitting}
              multiline
              onChangeText={setReason}
              placeholder="Example: Added item has no available putaway stock."
              placeholderTextColor={tokens.colors.inkSoft}
              style={[styles.input, styles.reasonInput]}
              value={reason}
            />
            {validationError ? <Text style={styles.error}>{validationError}</Text> : null}
            <View style={styles.actions}>
              <Pressable
                disabled={submitting}
                onPress={() => {
                  setConfirming(false);
                  setValidationError(null);
                }}
                style={styles.cancelButton}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={disabled || submitting}
                onPress={() => void startDetachment()}
                style={styles.confirmButton}>
                {submitting ? (
                  <ActivityIndicator color={tokens.colors.surface} size="small" />
                ) : (
                  <Text style={styles.confirmText}>Confirm & show returns</Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            disabled={disabled}
            onPress={() => setConfirming(true)}
            style={styles.startButton}>
            <Feather name="corner-up-left" size={16} color={tokens.colors.danger} />
            <Text style={styles.startText}>Detach this order from the basket</Text>
          </Pressable>
        )}
      </View>
    );
  }

  const pendingUnits = detachment.units.filter((unit) => !unit.returnedAt);
  return (
    <View style={styles.returnCard}>
      <View style={styles.titleRow}>
        <View style={styles.iconCircle}>
          <Feather name="rotate-ccw" size={16} color={tokens.colors.danger} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>Detach order #{change.order.posOrderId}</Text>
          <Text style={styles.body}>
            {detachment.returnedUnits}/{detachment.totalUnits} returned. The order detaches and resyncs to Restocking automatically after the last validated return.
          </Text>
        </View>
      </View>

      <View style={styles.reasonCard}>
        <Text style={styles.label}>Supervisor reason</Text>
        <Text style={styles.body}>{detachment.reason}</Text>
      </View>

      {detachment.units.map((unit) => (
        <View key={unit.basketUnitId} style={[styles.unitRow, unit.returnedAt ? styles.unitReturned : null]}>
          <View style={styles.unitStatus}>
            <Feather
              name={unit.returnedAt ? 'check-circle' : 'circle'}
              size={17}
              color={unit.returnedAt ? tokens.colors.success : tokens.colors.danger}
            />
          </View>
          <View style={styles.copy}>
            <Text style={styles.unitName}>{unit.productName}</Text>
            <Text selectable style={styles.unitCode}>{unit.code ?? unit.barcode ?? 'Serialized label unavailable'}</Text>
          </View>
          <View style={styles.binCopy}>
            <Text style={styles.label}>Return to</Text>
            <Text style={styles.binCode}>{unit.destinationBin?.code ?? 'Bin unavailable'}</Text>
          </View>
        </View>
      ))}

      {pendingUnits.length > 0 && onReturnUnit ? (
        <View style={styles.form}>
          <Text style={styles.title}>Validate the physical return</Text>
          <Text style={styles.helper}>At the destination bin, scan the bin first and then the serialized unit.</Text>
          <TextInput
            autoCapitalize="characters"
            editable={!disabled && !submitting}
            onChangeText={setBinCode}
            placeholder={`Destination bin, e.g. ${pendingUnits[0]?.destinationBin?.code ?? 'D1-S02'}`}
            placeholderTextColor={tokens.colors.inkSoft}
            style={styles.input}
            value={binCode}
          />
          <TextInput
            autoCapitalize="characters"
            editable={!disabled && !submitting}
            onChangeText={setUnitCode}
            onSubmitEditing={() => void returnUnit()}
            placeholder="Serialized unit code"
            placeholderTextColor={tokens.colors.inkSoft}
            style={styles.input}
            value={unitCode}
          />
          {validationError ? <Text style={styles.error}>{validationError}</Text> : null}
          <Pressable
            disabled={disabled || submitting || !binCode.trim() || !unitCode.trim()}
            onPress={() => void returnUnit()}
            style={styles.confirmButton}>
            {submitting ? (
              <ActivityIndicator color={tokens.colors.surface} size="small" />
            ) : (
              <Text style={styles.confirmText}>Validate return</Text>
            )}
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  decisionCard: {
    backgroundColor: '#FFF8EC',
    borderColor: '#F2C878',
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    gap: tokens.spacing.sm,
    padding: tokens.spacing.sm,
  },
  returnCard: {
    backgroundColor: '#FFF4EF',
    borderColor: '#F2B8A9',
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    gap: tokens.spacing.sm,
    padding: tokens.spacing.sm,
  },
  titleRow: { alignItems: 'flex-start', flexDirection: 'row', gap: tokens.spacing.xs },
  iconCircle: {
    alignItems: 'center',
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.pill,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  copy: { flex: 1 },
  title: { color: tokens.colors.ink, fontSize: 13, fontWeight: '900' },
  body: { color: tokens.colors.inkMuted, fontSize: 12, lineHeight: 18, marginTop: 2 },
  helper: { color: tokens.colors.inkMuted, fontSize: 11, lineHeight: 16 },
  label: { color: tokens.colors.inkMuted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  form: { gap: tokens.spacing.xs },
  input: {
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    color: tokens.colors.ink,
    fontSize: 13,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  reasonInput: { minHeight: 72, paddingTop: 10, textAlignVertical: 'top' },
  error: { color: tokens.colors.danger, fontSize: 11, fontWeight: '700', lineHeight: 16 },
  actions: { flexDirection: 'row', gap: tokens.spacing.xs, justifyContent: 'flex-end' },
  cancelButton: {
    alignItems: 'center',
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
  },
  cancelText: { color: tokens.colors.inkMuted, fontSize: 12, fontWeight: '800' },
  confirmButton: {
    alignItems: 'center',
    backgroundColor: tokens.colors.danger,
    borderRadius: tokens.radius.sm,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
  },
  confirmText: { color: tokens.colors.surface, fontSize: 12, fontWeight: '900' },
  startButton: {
    alignItems: 'center',
    backgroundColor: tokens.colors.surface,
    borderColor: '#F2B8A9',
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: tokens.spacing.xs,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  startText: { color: tokens.colors.danger, fontSize: 12, fontWeight: '900' },
  reasonCard: { backgroundColor: tokens.colors.surface, borderRadius: tokens.radius.sm, padding: tokens.spacing.xs },
  unitRow: {
    alignItems: 'center',
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: tokens.spacing.xs,
    padding: tokens.spacing.xs,
  },
  unitReturned: { opacity: 0.58 },
  unitStatus: { alignItems: 'center', justifyContent: 'center', width: 24 },
  unitName: { color: tokens.colors.ink, fontSize: 12, fontWeight: '800' },
  unitCode: { color: tokens.colors.inkMuted, fontSize: 11, fontWeight: '700', marginTop: 2 },
  binCopy: { alignItems: 'flex-end', flexShrink: 0 },
  binCode: { color: tokens.colors.panel, fontSize: 12, fontWeight: '900', marginTop: 2 },
});
