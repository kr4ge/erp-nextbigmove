import type { ReactNode, ComponentProps } from 'react';
import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
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

export function TaskHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.taskHeader}>
      <Text style={styles.taskHeaderTitle}>{title}</Text>
      {action ? <View style={styles.taskHeaderAction}>{action}</View> : null}
    </View>
  );
}

export function TaskHeaderIconButton({
  disabled,
  icon,
  loading = false,
  onPress,
}: {
  disabled?: boolean;
  icon: IconName;
  loading?: boolean;
  onPress: () => void | Promise<void>;
}) {
  return (
    <Pressable
      disabled={disabled || loading}
      onPress={() => {
        void onPress();
      }}
      style={({ pressed }) => [
        styles.taskHeaderIconButton,
        pressed && !disabled && !loading ? styles.taskHeaderIconButtonPressed : null,
        disabled || loading ? styles.taskHeaderIconButtonDisabled : null,
      ]}>
      {loading ? (
        <ActivityIndicator color={tokens.colors.panel} size="small" />
      ) : (
        <Feather name={icon} size={18} color={tokens.colors.panel} />
      )}
    </Pressable>
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
  meta?: string;
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
      {meta ? <Text style={styles.actionMeta}>{meta}</Text> : null}
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

export function BlockedTaskState({
  copy,
  title = 'Access blocked',
}: {
  copy: string;
  title?: string;
}) {
  return (
    <SurfaceCard style={styles.blockedCard}>
      <View style={styles.blockedIconWrap}>
        <Feather name="shield-off" size={18} color={tokens.colors.danger} />
      </View>
      <Text style={styles.blockedTitle}>{title}</Text>
      <Text style={styles.blockedCopy}>{copy}</Text>
    </SurfaceCard>
  );
}

export function FloatingErrorBanner({
  message,
}: {
  message: string | null;
}) {
  if (!message) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={styles.floatingErrorWrap}>
      <SurfaceCard style={styles.floatingErrorCard}>
        <View style={styles.floatingErrorIconWrap}>
          <Feather name="alert-circle" size={18} color={tokens.colors.danger} />
        </View>
        <Text style={styles.floatingErrorText}>{message}</Text>
      </SurfaceCard>
    </View>
  );
}

const styles = StyleSheet.create({
  taskHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  taskHeaderTitle: {
    color: tokens.colors.ink,
    flex: 1,
    fontSize: 29,
    fontWeight: '900',
    letterSpacing: -1,
  },
  taskHeaderAction: {
    marginLeft: tokens.spacing.md,
  },
  taskHeaderIconButton: {
    alignItems: 'center',
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  taskHeaderIconButtonPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.98 }],
  },
  taskHeaderIconButtonDisabled: {
    opacity: 0.58,
  },
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
  blockedCard: {
    alignItems: 'flex-start',
    gap: tokens.spacing.sm,
  },
  blockedIconWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(211, 84, 69, 0.12)',
    borderRadius: tokens.radius.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  blockedTitle: {
    color: tokens.colors.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  blockedCopy: {
    color: tokens.colors.inkMuted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  floatingErrorWrap: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 40,
    elevation: 40,
  },
  floatingErrorCard: {
    alignItems: 'flex-start',
    backgroundColor: '#FFF5F3',
    borderColor: 'rgba(211, 84, 69, 0.24)',
    borderWidth: 1,
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    shadowColor: tokens.colors.danger,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
  },
  floatingErrorIconWrap: {
    paddingTop: 2,
  },
  floatingErrorText: {
    color: tokens.colors.danger,
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
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
