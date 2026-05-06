import type { ComponentProps } from 'react';
import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SurfaceCard } from '@/src/shared/components/surface-card';
import { tokens } from '@/src/shared/theme/tokens';

type IconName = ComponentProps<typeof Feather>['name'];

export function SectionLabel({
  title,
  trailing,
}: {
  title: string;
  trailing?: string;
}) {
  return (
    <View style={styles.sectionLabel}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {trailing ? <Text style={styles.sectionTrailing}>{trailing}</Text> : null}
    </View>
  );
}

export function UtilityPill({
  icon,
  label,
  tone = 'default',
}: {
  icon: IconName;
  label: string;
  tone?: 'default' | 'accent' | 'panel';
}) {
  return (
    <View
      style={[
        styles.pill,
        tone === 'accent' && styles.pillAccent,
        tone === 'panel' && styles.pillPanel,
      ]}>
      <Feather
        name={icon}
        size={14}
        color={tone === 'panel' ? tokens.colors.surface : tokens.colors.inkMuted}
      />
      <Text
        style={[
          styles.pillLabel,
          tone === 'accent' && styles.pillLabelAccent,
          tone === 'panel' && styles.pillLabelPanel,
        ]}>
        {label}
      </Text>
    </View>
  );
}

export function MetricTile({
  icon,
  label,
  value,
  note,
}: {
  icon: IconName;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <SurfaceCard style={styles.metricTile}>
      <View style={styles.metricIcon}>
        <Feather name={icon} size={16} color={tokens.colors.panel} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricNote}>{note}</Text>
    </SurfaceCard>
  );
}

export function ActionTile({
  icon,
  title,
  meta,
  status,
  onPress,
  style,
}: {
  icon: IconName;
  title: string;
  meta: string;
  status?: string;
  onPress?: () => void | Promise<void>;
  style?: StyleProp<ViewStyle>;
}) {
  const interactive = Boolean(onPress);

  const content = (
    <SurfaceCard tone="muted" style={[styles.actionTile, style]}>
      <View style={styles.actionHeader}>
        <View style={styles.actionIcon}>
          <Feather name={icon} size={16} color={tokens.colors.panel} />
        </View>
        {status ? <Text style={styles.actionStatus}>{status}</Text> : null}
      </View>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionMeta}>{meta}</Text>
    </SurfaceCard>
  );

  if (!interactive) {
    return content;
  }

  return (
    <Pressable
      onPress={() => {
        void onPress?.();
      }}
      style={styles.pressableCard}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: tokens.colors.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  sectionTrailing: {
    color: tokens.colors.inkSoft,
    fontSize: 13,
    fontWeight: '600',
  },
  pill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.pill,
    flexDirection: 'row',
    gap: tokens.spacing.xs,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pillAccent: {
    backgroundColor: tokens.colors.accentSoft,
  },
  pillPanel: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  pillLabel: {
    color: tokens.colors.inkMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  pillLabelAccent: {
    color: tokens.colors.ink,
  },
  pillLabelPanel: {
    color: tokens.colors.surface,
  },
  metricTile: {
    flex: 1,
    gap: tokens.spacing.xs,
    minWidth: 0,
  },
  metricIcon: {
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: tokens.radius.pill,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  metricValue: {
    color: tokens.colors.ink,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  metricLabel: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  metricNote: {
    color: tokens.colors.inkSoft,
    fontSize: 13,
  },
  pressableCard: {
    flex: 1,
  },
  actionTile: {
    flex: 1,
    gap: tokens.spacing.sm,
    minHeight: 124,
  },
  actionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionIcon: {
    alignItems: 'center',
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  actionStatus: {
    color: tokens.colors.accentStrong,
    fontSize: 12,
    fontWeight: '700',
  },
  actionTitle: {
    color: tokens.colors.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  actionMeta: {
    color: tokens.colors.inkMuted,
    fontSize: 13,
    lineHeight: 18,
  },
});
