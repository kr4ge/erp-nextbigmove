import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { StoxTabKey } from '@/src/features/home/types';
import { tokens } from '@/src/shared/theme/tokens';
import { StoxBottomNav } from './stox-bottom-nav';

type StoxShellProps = {
  title: string;
  contextLabel?: string;
  profileInitials: string;
  activeTab: StoxTabKey;
  allowedTabs: StoxTabKey[];
  onChangeTab: (tab: StoxTabKey) => void;
  children: ReactNode;
};

export function StoxShell({
  title,
  contextLabel,
  profileInitials,
  activeTab,
  allowedTabs,
  onChangeTab,
  children,
}: StoxShellProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.root}>
        <View style={styles.topGlow} />
        <View style={styles.bottomGlow} />

        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <View style={styles.copy}>
              <Text style={styles.brand}>STOX</Text>
              <Text numberOfLines={1} style={styles.title}>{title}</Text>
              {contextLabel ? <Text numberOfLines={1} style={styles.context}>{contextLabel}</Text> : null}
            </View>

            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{profileInitials}</Text>
            </View>
          </View>

          {children}
        </ScrollView>

        <SafeAreaView style={styles.navDock} edges={['bottom']}>
          <StoxBottomNav activeTab={activeTab} allowedTabs={allowedTabs} onChange={onChangeTab} />
        </SafeAreaView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  root: {
    flex: 1,
    position: 'relative',
  },
  scroll: {
    flex: 1,
  },
  topGlow: {
    backgroundColor: tokens.colors.accentSoft,
    borderRadius: 220,
    height: 220,
    opacity: 0.55,
    position: 'absolute',
    right: -70,
    top: -80,
    width: 220,
  },
  bottomGlow: {
    backgroundColor: tokens.colors.backgroundMuted,
    borderRadius: 280,
    bottom: 80,
    height: 280,
    left: -120,
    opacity: 0.45,
    position: 'absolute',
    width: 280,
  },
  content: {
    gap: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.md,
    paddingBottom: tokens.spacing.xl,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  copy: {
    flex: 1,
    gap: 4,
    paddingRight: tokens.spacing.md,
  },
  brand: {
    color: tokens.colors.accentStrong,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2.4,
  },
  title: {
    color: tokens.colors.ink,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1.2,
  },
  context: {
    color: tokens.colors.inkMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: tokens.colors.panel,
    borderColor: 'rgba(255,255,255,0.36)',
    borderRadius: tokens.radius.pill,
    borderWidth: 3,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  avatarText: {
    color: tokens.colors.surface,
    fontSize: 16,
    fontWeight: '800',
  },
  navDock: {
    backgroundColor: tokens.colors.surface,
  },
});
