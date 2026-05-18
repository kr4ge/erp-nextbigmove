import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SurfaceCard } from '@/src/shared/components/surface-card';
import { tokens } from '@/src/shared/theme/tokens';

export function StockStateCard({
  actionLabel,
  icon,
  onPress,
  title,
  value,
}: {
  actionLabel?: string;
  icon: keyof typeof Feather.glyphMap;
  onPress?: () => void;
  title: string;
  value: string;
}) {
  return (
    <SurfaceCard style={styles.card}>
      <View style={styles.icon}>
        <Feather name={icon} size={18} color={tokens.colors.panel} />
      </View>
      <View style={styles.copy}>
        <Text numberOfLines={1} style={styles.title}>{title}</Text>
        <Text numberOfLines={2} style={styles.value}>{value}</Text>
      </View>
      {actionLabel && onPress ? (
        <Pressable onPress={onPress} style={styles.actionButton}>
          <Text style={styles.action}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: tokens.spacing.md,
    minHeight: 82,
  },
  icon: {
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: tokens.radius.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  copy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  title: {
    color: tokens.colors.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  value: {
    color: tokens.colors.inkMuted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  actionButton: {
    paddingHorizontal: tokens.spacing.xs,
    paddingVertical: tokens.spacing.sm,
  },
  action: {
    color: tokens.colors.accentStrong,
    fontSize: 13,
    fontWeight: '900',
  },
});
