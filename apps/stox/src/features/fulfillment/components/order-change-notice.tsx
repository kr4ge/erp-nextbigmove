import { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { WmsFulfillmentItemChange } from '@/src/features/picking/types';
import { tokens } from '@/src/shared/theme/tokens';

export function OrderChangeNotice({
  change,
  disabled = false,
  onReturnUnit,
}: {
  change: WmsFulfillmentItemChange | null;
  disabled?: boolean;
  onReturnUnit?: (code: string) => Promise<boolean>;
}) {
  const [returnCode, setReturnCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  if (!change) return null;

  const needsReturn = change.requiresAction && change.returnUnitsRemaining > 0 && onReturnUnit;
  const submitReturn = async () => {
    const code = returnCode.trim();
    if (!code || submitting || disabled || !onReturnUnit) return;
    setSubmitting(true);
    try {
      if (await onReturnUnit(code)) setReturnCode('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, change.requiresAction ? styles.actionContainer : styles.infoContainer]}>
      <View style={styles.titleRow}>
        <View style={styles.iconCircle}>
          <Feather
            name={change.requiresAction ? 'alert-triangle' : 'refresh-cw'}
            size={17}
            color={change.requiresAction ? tokens.colors.danger : tokens.colors.panel}
          />
        </View>
        <View style={styles.titleCopy}>
          <Text style={styles.title}>{change.title}</Text>
          <Text style={styles.message}>{change.message}</Text>
        </View>
      </View>

      <View style={styles.metricsRow}>
        {change.addedUnits > 0 ? (
          <View style={styles.metricPill}><Text style={styles.metricText}>+{change.addedUnits} to pick</Text></View>
        ) : null}
        {change.removedUnits > 0 ? (
          <View style={styles.metricPill}><Text style={styles.metricText}>−{change.removedUnits} removed</Text></View>
        ) : null}
        {change.returnUnitsRemaining > 0 ? (
          <View style={styles.returnPill}><Text style={styles.returnText}>{change.returnUnitsRemaining} to return</Text></View>
        ) : null}
      </View>

      {needsReturn ? (
        <View style={styles.returnSection}>
          <Text style={styles.stepTitle}>First, scan the excess or replaced item</Text>
          <Text style={styles.stepCopy}>The item will be removed from this basket and returned to its original bin.</Text>
          <View style={styles.inputRow}>
            <TextInput
              autoCapitalize="characters"
              editable={!disabled && !submitting}
              onChangeText={setReturnCode}
              onSubmitEditing={() => void submitReturn()}
              placeholder="Scan item code"
              placeholderTextColor={tokens.colors.inkSoft}
              style={styles.input}
              value={returnCode}
            />
            <Pressable
              disabled={!returnCode.trim() || disabled || submitting}
              onPress={() => void submitReturn()}
              style={({ pressed }) => [styles.returnButton, pressed && styles.returnButtonPressed]}
            >
              {submitting ? (
                <ActivityIndicator color={tokens.colors.surface} size="small" />
              ) : (
                <Feather name="corner-down-left" size={18} color={tokens.colors.surface} />
              )}
            </Pressable>
          </View>
        </View>
      ) : change.requiresAction ? (
        <Text style={styles.nextStep}>Continue with the refreshed pick list below. Packing stays blocked until it is complete.</Text>
      ) : (
        <Text style={styles.nextStep}>No manual sync is needed. Continue using the refreshed quantities below.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    gap: tokens.spacing.sm,
    marginBottom: tokens.spacing.md,
    padding: tokens.spacing.md,
  },
  actionContainer: { backgroundColor: '#FFF4EF', borderColor: '#F2B8A9' },
  infoContainer: { backgroundColor: tokens.colors.accentSoft, borderColor: tokens.colors.accentStrong },
  titleRow: { alignItems: 'flex-start', flexDirection: 'row', gap: tokens.spacing.sm },
  iconCircle: {
    alignItems: 'center',
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  titleCopy: { flex: 1, gap: 3 },
  title: { color: tokens.colors.ink, fontSize: 15, fontWeight: '800' },
  message: { color: tokens.colors.inkMuted, fontSize: 13, lineHeight: 19 },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.xs },
  metricPill: { backgroundColor: tokens.colors.surface, borderRadius: tokens.radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  metricText: { color: tokens.colors.panel, fontSize: 12, fontWeight: '700' },
  returnPill: { backgroundColor: '#FBE0DA', borderRadius: tokens.radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  returnText: { color: tokens.colors.danger, fontSize: 12, fontWeight: '800' },
  returnSection: { borderTopColor: '#F0D3CA', borderTopWidth: 1, gap: 4, paddingTop: tokens.spacing.sm },
  stepTitle: { color: tokens.colors.ink, fontSize: 13, fontWeight: '800' },
  stepCopy: { color: tokens.colors.inkMuted, fontSize: 12, lineHeight: 18 },
  inputRow: { flexDirection: 'row', gap: tokens.spacing.xs, marginTop: tokens.spacing.xs },
  input: {
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    color: tokens.colors.ink,
    flex: 1,
    fontSize: 14,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  returnButton: {
    alignItems: 'center',
    backgroundColor: tokens.colors.panel,
    borderRadius: tokens.radius.sm,
    justifyContent: 'center',
    width: 48,
  },
  returnButtonPressed: { opacity: 0.8 },
  nextStep: { color: tokens.colors.inkMuted, fontSize: 12, lineHeight: 18 },
});
