import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { tokens } from '@/src/shared/theme/tokens';

type PrimaryButtonProps = {
  label: string;
  onPress: () => void | Promise<void>;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
};

export function PrimaryButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
}: PrimaryButtonProps) {
  const muted = disabled || loading;
  const secondary = variant === 'secondary';

  return (
    <Pressable
      onPress={() => {
        void onPress();
      }}
      disabled={muted}
      style={[
        styles.base,
        secondary ? styles.secondary : styles.primary,
        muted && styles.disabled,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={secondary ? tokens.colors.ink : tokens.colors.surface} />
      ) : (
        <Text
          adjustsFontSizeToFit
          numberOfLines={1}
          minimumFontScale={0.72}
          style={[styles.label, secondary ? styles.secondaryLabel : styles.primaryLabel]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    borderRadius: tokens.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.lg,
    shadowColor: tokens.colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    elevation: 4,
  },
  primary: {
    backgroundColor: tokens.colors.panel,
  },
  secondary: {
    backgroundColor: tokens.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    shadowOpacity: 0.4,
    elevation: 1,
  },
  disabled: {
    opacity: 0.6,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
  },
  primaryLabel: {
    color: tokens.colors.surface,
  },
  secondaryLabel: {
    color: tokens.colors.ink,
  },
});
