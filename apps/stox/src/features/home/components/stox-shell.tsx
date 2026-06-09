import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Feather } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StoxTabKey } from '@/src/features/home/types';
import { tokens } from '@/src/shared/theme/tokens';
import { StoxBottomNav } from './stox-bottom-nav';

type StoxShellProps = {
  contextLabel?: string;
  displayName: string;
  profileInitials: string;
  activeTab: StoxTabKey;
  onChangeTab: (tab: StoxTabKey) => void;
  hideHeader?: boolean;
  children: ReactNode;
};

type StoxShellOverlaySetter = (overlay: ReactNode | null) => void;

const StoxShellOverlayContext = createContext<StoxShellOverlaySetter | null>(null);

export function useStoxShellOverlay() {
  return useContext(StoxShellOverlayContext);
}

export function StoxShell({
  contextLabel,
  displayName,
  profileInitials,
  activeTab,
  onChangeTab,
  hideHeader = false,
  children,
}: StoxShellProps) {
  const insets = useSafeAreaInsets();
  const [overlay, setOverlay] = useState<ReactNode | null>(null);
  const updateOverlay = useCallback<StoxShellOverlaySetter>((nextOverlay) => {
    setOverlay(nextOverlay);
  }, []);

  useEffect(() => {
    setOverlay(null);
  }, [activeTab]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StoxShellOverlayContext.Provider value={updateOverlay}>
        <View style={styles.root}>
          <View style={styles.topGlow} />
          <View style={styles.bottomGlow} />

          <ScrollView
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.content,
              overlay ? { paddingBottom: insets.bottom + 216 } : null,
            ]}>
            {!hideHeader ? (
              <View style={styles.header}>
                <View style={styles.copy}>
                  <Text style={styles.brand}>STOX</Text>
                  <Text numberOfLines={1} style={styles.title}>{displayName}</Text>
                  {contextLabel ? <Text numberOfLines={1} style={styles.context}>{contextLabel}</Text> : null}
                </View>

                <View style={styles.headerActions}>
                  <View style={styles.iconButton}>
                    <Feather name="bell" size={18} color={tokens.colors.panel} />
                  </View>

                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{profileInitials}</Text>
                  </View>
                </View>
              </View>
            ) : null}

            {children}
          </ScrollView>

          {overlay ? (
            <View pointerEvents="box-none" style={[styles.overlayDock, { bottom: insets.bottom + 108 }]}>
              {overlay}
            </View>
          ) : null}

          <SafeAreaView style={styles.navDock} edges={['bottom']}>
            <StoxBottomNav activeTab={activeTab} onChange={onChangeTab} />
          </SafeAreaView>
        </View>
      </StoxShellOverlayContext.Provider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FBFAFF',
  },
  root: {
    flex: 1,
    position: 'relative',
  },
  scroll: {
    flex: 1,
  },
  topGlow: {
    backgroundColor: 'rgba(125, 87, 255, 0.12)',
    borderRadius: 220,
    height: 210,
    opacity: 0.42,
    position: 'absolute',
    right: -82,
    top: -92,
    width: 210,
  },
  bottomGlow: {
    backgroundColor: 'rgba(255, 214, 140, 0.16)',
    borderRadius: 280,
    bottom: 88,
    height: 240,
    left: -128,
    opacity: 0.28,
    position: 'absolute',
    width: 240,
  },
  content: {
    gap: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.sm,
    paddingBottom: 112,
  },
  overlayDock: {
    alignItems: 'center',
    left: 0,
    paddingHorizontal: tokens.spacing.lg,
    position: 'absolute',
    right: 0,
    zIndex: 20,
    elevation: 20,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  copy: {
    flex: 1,
    gap: 2,
    paddingRight: tokens.spacing.md,
  },
  brand: {
    color: tokens.colors.accentStrong,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.8,
  },
  title: {
    color: tokens.colors.ink,
    fontSize: 29,
    fontWeight: '800',
    letterSpacing: -1.1,
  },
  context: {
    color: tokens.colors.inkMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: tokens.colors.accent,
    borderColor: 'rgba(18,54,79,0.12)',
    borderRadius: 22,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  avatarText: {
    color: tokens.colors.panel,
    fontSize: 14,
    fontWeight: '800',
  },
  navDock: {
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
});
