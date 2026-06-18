import type { RefObject } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type {
  WmsMobileTrackingReturnDispositionAction,
  WmsMobileTrackingReturnUnit,
} from '@/src/features/stock/types';
import { PrimaryButton } from '@/src/shared/components/primary-button';
import { SurfaceCard } from '@/src/shared/components/surface-card';
import { tokens } from '@/src/shared/theme/tokens';

const DISPOSITION_OPTIONS: Array<{
  value: WmsMobileTrackingReturnDispositionAction;
  label: string;
  hint: string;
  submitLabel: string;
  targetPlaceholder: string;
}> = [
  {
    value: 'PUTAWAY',
    label: 'Putaway',
    hint: 'Scan the bin for this returned unit.',
    submitLabel: 'Put away unit',
    targetPlaceholder: 'Scan destination bin',
  },
  {
    value: 'DEADSTOCK',
    label: 'Deadstock',
    hint: 'Send this returned unit to a deadstock bin.',
    submitLabel: 'Move to deadstock',
    targetPlaceholder: 'Scan deadstock bin',
  },
  {
    value: 'DAMAGE',
    label: 'Damage',
    hint: 'Send this returned unit to damage or quarantine.',
    submitLabel: 'Mark as damaged',
    targetPlaceholder: 'Scan damage or quarantine',
  },
];

type RtsDispositionPanelProps = {
  unit: WmsMobileTrackingReturnUnit | null;
  pendingCount: number;
  disposition: WmsMobileTrackingReturnDispositionAction | null;
  targetCode: string;
  isSubmitting: boolean;
  canSubmit: boolean;
  inputRef: RefObject<TextInput | null>;
  onChangeTargetCode: (value: string) => void;
  onSelectDisposition: (value: WmsMobileTrackingReturnDispositionAction) => void;
  onSubmit: () => void;
};

export function RtsDispositionPanel({
  unit,
  pendingCount,
  disposition,
  targetCode,
  isSubmitting,
  canSubmit,
  inputRef,
  onChangeTargetCode,
  onSelectDisposition,
  onSubmit,
}: RtsDispositionPanelProps) {
  if (!unit) {
    return null;
  }

  const selectedOption = DISPOSITION_OPTIONS.find((option) => option.value === disposition) ?? null;

  return (
    <SurfaceCard style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Placement</Text>
          <Text style={styles.title}>Finish this returned unit</Text>
        </View>
        <View style={styles.countPill}>
          <Text style={styles.countText}>{pendingCount}</Text>
        </View>
      </View>

      <View style={styles.unitCard}>
        <Text numberOfLines={1} style={styles.unitBarcode}>
          {unit.barcode || unit.code}
        </Text>
        <Text numberOfLines={1} style={styles.unitCode}>
          {unit.code}
        </Text>
        <Text numberOfLines={2} style={styles.unitName}>
          {unit.name}
        </Text>
        {unit.currentLocation ? (
          <Text numberOfLines={1} style={styles.unitLocation}>
            {unit.currentLocation.code} · {unit.currentLocation.name}
          </Text>
        ) : null}
      </View>

      <View style={styles.optionRow}>
        {DISPOSITION_OPTIONS.map((option) => {
          const active = disposition === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onSelectDisposition(option.value)}
              style={[styles.optionChip, active ? styles.optionChipActive : null]}>
              <Text style={[styles.optionChipText, active ? styles.optionChipTextActive : null]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.hintText}>
        {selectedOption?.hint ?? 'Choose how to place this returned unit.'}
      </Text>

      <View style={styles.inputWrap}>
        <Text style={styles.inputLabel}>Target</Text>
        <View style={styles.inputRow}>
          <TextInput
            ref={inputRef}
            autoCapitalize="characters"
            autoCorrect={false}
            blurOnSubmit={false}
            caretHidden
            contextMenuHidden
            editable={Boolean(disposition) && !isSubmitting}
            placeholder={selectedOption?.targetPlaceholder ?? 'Choose an action first'}
            placeholderTextColor={tokens.colors.inkSoft}
            returnKeyType="done"
            selectTextOnFocus={false}
            showSoftInputOnFocus={false}
            value={targetCode}
            onChangeText={onChangeTargetCode}
            onSubmitEditing={onSubmit}
            style={[
              styles.input,
              !disposition ? styles.inputDisabled : null,
            ]}
          />
          <Pressable
            disabled={!canSubmit || isSubmitting}
            onPress={onSubmit}
            style={[styles.submit, (!canSubmit || isSubmitting) ? styles.submitDisabled : null]}>
            {isSubmitting ? (
              <ActivityIndicator color={tokens.colors.surface} size="small" />
            ) : (
              <Feather name="corner-down-left" size={18} color={tokens.colors.surface} />
            )}
          </Pressable>
        </View>
      </View>

      <PrimaryButton
        disabled={!canSubmit}
        label={selectedOption?.submitLabel ?? 'Choose an action'}
        loading={isSubmitting}
        onPress={onSubmit}
      />
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: tokens.spacing.md,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  eyebrow: {
    color: tokens.colors.accent,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: tokens.colors.ink,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.4,
    marginTop: 2,
  },
  countPill: {
    alignItems: 'center',
    backgroundColor: '#EEE9FF',
    borderRadius: tokens.radius.pill,
    justifyContent: 'center',
    minWidth: 36,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  countText: {
    color: '#6F5BCB',
    fontSize: 13,
    fontWeight: '900',
  },
  unitCard: {
    backgroundColor: tokens.colors.surfaceMuted,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    gap: 4,
    padding: tokens.spacing.md,
  },
  unitBarcode: {
    color: tokens.colors.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  unitCode: {
    color: tokens.colors.inkMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  unitName: {
    color: tokens.colors.ink,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  unitLocation: {
    color: tokens.colors.inkMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  optionChip: {
    alignItems: 'center',
    backgroundColor: '#EEE9FF',
    borderRadius: 14,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 12,
  },
  optionChipActive: {
    backgroundColor: '#6437F6',
  },
  optionChipText: {
    color: '#6F5BCB',
    fontSize: 14,
    fontWeight: '800',
  },
  optionChipTextActive: {
    color: '#FFFFFF',
  },
  hintText: {
    color: tokens.colors.inkMuted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  inputWrap: {
    backgroundColor: tokens.colors.surfaceMuted,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    gap: 10,
    padding: tokens.spacing.md,
  },
  inputLabel: {
    color: '#8C83B3',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  inputRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  input: {
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
  inputDisabled: {
    opacity: 0.6,
  },
  submit: {
    alignItems: 'center',
    backgroundColor: tokens.colors.panel,
    borderRadius: 18,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  submitDisabled: {
    opacity: 0.6,
  },
});
