import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { tokens } from '@/src/shared/theme/tokens';

type SurfaceCardProps = {
  children: ReactNode;
  tone?: 'default' | 'muted' | 'panel';
  style?: StyleProp<ViewStyle>;
};

export function SurfaceCard({
  children,
  tone = 'default',
  style,
}: SurfaceCardProps) {
  return (
    <View
      style={[
        styles.base,
        tone === 'muted' && styles.muted,
        tone === 'panel' && styles.panel,
        style,
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: tokens.spacing.lg,
    shadowColor: tokens.colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    elevation: 4,
  },
  muted: {
    backgroundColor: tokens.colors.surfaceMuted,
    borderColor: 'transparent',
    shadowOpacity: 0.6,
  },
  panel: {
    backgroundColor: tokens.colors.panel,
    borderColor: tokens.colors.panelMuted,
    shadowColor: 'rgba(18, 54, 79, 0.24)',
  },
});
