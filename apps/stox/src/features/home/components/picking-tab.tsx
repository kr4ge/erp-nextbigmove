import type { ComponentProps } from 'react';
import { Feather } from '@expo/vector-icons';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { BootstrapResponse } from '@/src/features/auth/types';
import { SurfaceCard } from '@/src/shared/components/surface-card';
import { tokens } from '@/src/shared/theme/tokens';
import { SectionLabel, UtilityPill } from './stox-primitives';

export function PickingTab({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const handlePlaceholder = (title: string) => {
    Alert.alert(title, 'Next phase');
  };

  return (
    <>
      <SurfaceCard tone="panel" style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>Pick</Text>
            <View style={styles.pillRow}>
              <UtilityPill icon="bookmark" label="Queue" tone="panel" />
              <UtilityPill icon="package" label="Tote" tone="panel" />
              <UtilityPill icon="crosshair" label="Unit" tone="panel" />
            </View>
          </View>

          <View style={styles.heroIcon}>
            <Feather name="navigation" size={22} color={tokens.colors.panel} />
          </View>
        </View>
      </SurfaceCard>

      <SectionLabel title="Ready" />

      <View style={styles.grid}>
        <MiniTile
          icon="navigation"
          label="Next"
          onPress={() => {
            handlePlaceholder('Next');
          }}
        />
        <MiniTile
          icon="alert-circle"
          label="Hold"
          onPress={() => {
            handlePlaceholder('Hold');
          }}
        />
        <MiniTile
          icon="home"
          label={String(bootstrap.context.warehouses.length)}
          onPress={() => {
            handlePlaceholder('Warehouse');
          }}
        />
      </View>
    </>
  );
}

function MiniTile({
  icon,
  label,
  onPress,
}: {
  icon: ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.tilePressable}>
      <SurfaceCard tone="muted" style={styles.tile}>
        <Feather name={icon} size={18} color={tokens.colors.panel} />
        <Text style={styles.tileLabel}>{label}</Text>
      </SurfaceCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    gap: tokens.spacing.lg,
  },
  heroHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroCopy: {
    flex: 1,
    gap: tokens.spacing.sm,
    paddingRight: tokens.spacing.md,
  },
  heroTitle: {
    color: tokens.colors.surface,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -1,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: tokens.colors.accentSoft,
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  grid: {
    flexDirection: 'row',
    gap: tokens.spacing.md,
  },
  tilePressable: {
    flex: 1,
  },
  tile: {
    alignItems: 'center',
    gap: tokens.spacing.sm,
    minHeight: 104,
    justifyContent: 'center',
  },
  tileLabel: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
});
