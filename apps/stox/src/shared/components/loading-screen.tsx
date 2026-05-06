import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { tokens } from '@/src/shared/theme/tokens';

type LoadingScreenProps = {
  label: string;
};

export function LoadingScreen({ label }: LoadingScreenProps) {
  return (
    <View style={styles.container}>
      <View style={styles.topGlow} />
      <View style={styles.bottomGlow} />
      <View style={styles.badge}>
        <Text style={styles.badgeText}>STOX</Text>
      </View>
      <ActivityIndicator size="large" color={tokens.colors.panel} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.lg,
    padding: tokens.spacing.xl,
    position: 'relative',
  },
  topGlow: {
    backgroundColor: tokens.colors.accentSoft,
    borderRadius: 220,
    height: 220,
    opacity: 0.5,
    position: 'absolute',
    right: -80,
    top: -90,
    width: 220,
  },
  bottomGlow: {
    backgroundColor: tokens.colors.backgroundMuted,
    borderRadius: 240,
    bottom: -100,
    height: 240,
    left: -90,
    opacity: 0.42,
    position: 'absolute',
    width: 240,
  },
  badge: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.panel,
  },
  badgeText: {
    color: tokens.colors.surface,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
  },
  label: {
    color: tokens.colors.inkMuted,
    fontSize: 15,
    fontWeight: '600',
  },
});
