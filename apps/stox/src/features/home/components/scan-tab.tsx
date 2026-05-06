import type { ComponentProps } from 'react';
import { Feather } from '@expo/vector-icons';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@/src/shared/components/primary-button';
import { SurfaceCard } from '@/src/shared/components/surface-card';
import { tokens } from '@/src/shared/theme/tokens';
import { SectionLabel } from './stox-primitives';

export function ScanTab() {
  const handlePlaceholder = (title: string) => {
    Alert.alert(title, 'Next phase');
  };

  return (
    <>
      <SurfaceCard tone="panel" style={styles.heroCard}>
        <View style={styles.scanFrame}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />

          <View style={styles.scanOrb}>
            <Feather name="maximize" size={32} color={tokens.colors.panel} />
          </View>
        </View>

        <Text style={styles.heroTitle}>Scan</Text>

        <PrimaryButton
          label="Open scanner"
          variant="secondary"
          onPress={async () => {
            handlePlaceholder('Scan');
          }}
        />
      </SurfaceCard>

      <SurfaceCard style={styles.quickCard}>
        <SectionLabel title="Quick" />

        <View style={styles.quickRow}>
          <QuickChip icon="box" label="Unit" />
          <QuickChip icon="archive" label="Bin" />
          <QuickChip icon="inbox" label="Batch" />
        </View>
      </SurfaceCard>
    </>
  );
}

function QuickChip({
  icon,
  label,
}: {
  icon: ComponentProps<typeof Feather>['name'];
  label: string;
}) {
  return (
    <View style={styles.quickChip}>
      <Feather name={icon} size={16} color={tokens.colors.panel} />
      <Text style={styles.quickLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    gap: tokens.spacing.lg,
  },
  scanFrame: {
    alignItems: 'center',
    alignSelf: 'center',
    height: 188,
    justifyContent: 'center',
    position: 'relative',
    width: '100%',
  },
  corner: {
    borderColor: 'rgba(255,255,255,0.78)',
    height: 46,
    position: 'absolute',
    width: 46,
  },
  topLeft: {
    borderLeftWidth: 2,
    borderTopWidth: 2,
    borderTopLeftRadius: 18,
    left: 24,
    top: 24,
  },
  topRight: {
    borderRightWidth: 2,
    borderTopWidth: 2,
    borderTopRightRadius: 18,
    right: 24,
    top: 24,
  },
  bottomLeft: {
    borderBottomLeftRadius: 18,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    bottom: 24,
    left: 24,
  },
  bottomRight: {
    borderBottomRightRadius: 18,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    bottom: 24,
    right: 24,
  },
  scanOrb: {
    alignItems: 'center',
    backgroundColor: tokens.colors.accentSoft,
    borderRadius: 40,
    height: 80,
    justifyContent: 'center',
    width: 80,
  },
  heroTitle: {
    color: tokens.colors.surface,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -1,
    textAlign: 'center',
  },
  quickCard: {
    gap: tokens.spacing.md,
  },
  quickRow: {
    flexDirection: 'row',
    gap: tokens.spacing.md,
  },
  quickChip: {
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: tokens.radius.lg,
    flex: 1,
    gap: tokens.spacing.sm,
    justifyContent: 'center',
    minHeight: 78,
  },
  quickLabel: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
});
