import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { tokens } from '@/src/shared/theme/tokens';

type TextFieldProps = TextInputProps & {
  label: string;
};

export function TextField({ label, style, ...props }: TextFieldProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        style={[styles.input, style]}
        placeholderTextColor={tokens.colors.inkMuted}
        autoCapitalize="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: tokens.spacing.sm,
  },
  label: {
    color: tokens.colors.inkMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    minHeight: 56,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceMuted,
    color: tokens.colors.ink,
    fontSize: 16,
    paddingHorizontal: tokens.spacing.md,
  },
});
