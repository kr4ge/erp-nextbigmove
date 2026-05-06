import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { tokens } from '@/src/shared/theme/tokens';

type InfoCardProps = {
  title: string;
  caption?: string;
  accent?: boolean;
  children: ReactNode;
};

export function InfoCard({ title, caption, accent = false, children }: InfoCardProps) {
  return (
    <View style={[styles.card, accent && styles.accentCard]}>
      <View style={styles.header}>
        <Text style={[styles.title, accent && styles.accentTitle]}>{title}</Text>
        {caption ? <Text style={[styles.caption, accent && styles.accentCaption]}>{caption}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: tokens.spacing.md,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    padding: tokens.spacing.lg,
  },
  accentCard: {
    backgroundColor: tokens.colors.panel,
    borderColor: tokens.colors.panelMuted,
  },
  header: {
    gap: 4,
  },
  title: {
    color: tokens.colors.ink,
    fontSize: 19,
    fontWeight: '800',
  },
  accentTitle: {
    color: tokens.colors.surface,
  },
  caption: {
    color: tokens.colors.inkMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  accentCaption: {
    color: 'rgba(255,255,255,0.72)',
  },
});
