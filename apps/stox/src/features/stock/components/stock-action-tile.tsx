import type { ComponentProps } from 'react';
import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SurfaceCard } from '@/src/shared/components/surface-card';
import { tokens } from '@/src/shared/theme/tokens';

type StockActionTileProps = {
  active?: boolean;
  disabled?: boolean;
  icon: ComponentProps<typeof Feather>['name'];
  label: string;
  value: string;
  onPress: () => void;
};

export function StockActionTile({
  active = false,
  disabled = false,
  icon,
  label,
  value,
  onPress,
}: StockActionTileProps) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pressable,
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
      ]}>
      <SurfaceCard tone={active ? 'panel' : 'muted'} style={styles.card}>
        <View style={[styles.icon, active && styles.iconActive]}>
          <Feather
            name={icon}
            size={16}
            color={active ? tokens.colors.panel : tokens.colors.ink}
          />
        </View>
        <Text
          adjustsFontSizeToFit
          numberOfLines={1}
          minimumFontScale={0.68}
          style={[styles.label, active && styles.labelActive]}>
          {label}
        </Text>
        <Text numberOfLines={1} style={[styles.value, active && styles.valueActive]}>
          {value}
        </Text>
      </SurfaceCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    flex: 1,
    minWidth: 0,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.56,
  },
  card: {
    alignItems: 'center',
    gap: tokens.spacing.xs,
    minHeight: 98,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.md,
  },
  icon: {
    alignItems: 'center',
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  iconActive: {
    backgroundColor: tokens.colors.accentSoft,
  },
  label: {
    color: tokens.colors.ink,
    fontSize: 11,
    fontWeight: '800',
    maxWidth: '100%',
    textAlign: 'center',
    includeFontPadding: false,
  },
  labelActive: {
    color: tokens.colors.surface,
  },
  value: {
    color: tokens.colors.inkMuted,
    fontSize: 11,
    fontWeight: '700',
    maxWidth: '100%',
    textAlign: 'center',
  },
  valueActive: {
    color: tokens.colors.accentSoft,
  },
});
