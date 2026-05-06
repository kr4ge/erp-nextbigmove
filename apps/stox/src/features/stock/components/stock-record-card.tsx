import type { ComponentProps } from 'react';
import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SurfaceCard } from '@/src/shared/components/surface-card';
import { tokens } from '@/src/shared/theme/tokens';

type StockRecordCardProps = {
  badge?: string;
  icon: ComponentProps<typeof Feather>['name'];
  meta?: string;
  title: string;
  subtitle: string;
  onPress?: () => void;
};

export function StockRecordCard({
  badge,
  icon,
  meta,
  title,
  subtitle,
  onPress,
}: StockRecordCardProps) {
  const card = (
    <SurfaceCard tone="muted" style={styles.card}>
      <View style={styles.icon}>
        <Feather name={icon} size={16} color={tokens.colors.panel} />
      </View>

      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text selectable style={styles.title}>{title}</Text>
          {badge ? <Text numberOfLines={1} style={styles.badge}>{badge}</Text> : null}
        </View>
        <Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Text>
        {meta ? <Text numberOfLines={1} style={styles.meta}>{meta}</Text> : null}
      </View>
    </SurfaceCard>
  );

  if (!onPress) {
    return card;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [pressed ? styles.pressed : null]}>
      {card}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.99 }],
  },
  card: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: tokens.spacing.md,
    minHeight: 88,
    paddingVertical: tokens.spacing.md,
  },
  icon: {
    alignItems: 'center',
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  copy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  titleRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
  },
  title: {
    color: tokens.colors.ink,
    flexBasis: '100%',
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  badge: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.pill,
    color: tokens.colors.inkMuted,
    fontSize: 11,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  subtitle: {
    color: tokens.colors.inkMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  meta: {
    color: tokens.colors.inkSoft,
    fontSize: 12,
    fontWeight: '600',
  },
});
