import type { ComponentProps } from 'react';
import { Feather } from '@expo/vector-icons';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SurfaceCard } from '@/src/shared/components/surface-card';
import { tokens } from '@/src/shared/theme/tokens';
import { SectionLabel, TaskHeader } from './stox-primitives';

export function PackingTab() {
  const handlePlaceholder = (title: string) => {
    Alert.alert(title, 'Next phase');
  };

  return (
    <>
      <TaskHeader title="Pack" />

      <SectionLabel title="Ready" />

      <View style={styles.grid}>
        <MiniTile
          icon="tag"
          label="Station"
          onPress={() => {
            handlePlaceholder('Station');
          }}
        />
        <MiniTile
          icon="archive"
          label="Seal"
          onPress={() => {
            handlePlaceholder('Seal');
          }}
        />
        <MiniTile
          icon="alert-triangle"
          label="Hold"
          onPress={() => {
            handlePlaceholder('Hold');
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
