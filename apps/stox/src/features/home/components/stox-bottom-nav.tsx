import type { ComponentProps } from 'react';
import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StoxTabKey } from '@/src/features/home/types';
import { tokens } from '@/src/shared/theme/tokens';

const navItems: Array<{
  key: StoxTabKey;
  label: string;
  icon: ComponentProps<typeof Feather>['name'];
  emphasis?: boolean;
}> = [
  { key: 'stock', label: 'Stock', icon: 'box' },
  { key: 'scan', label: 'Scan', icon: 'maximize' },
  { key: 'pick', label: 'Pick', icon: 'navigation', emphasis: true },
  { key: 'pack', label: 'Pack', icon: 'package' },
  { key: 'me', label: 'Me', icon: 'user' },
];

export function StoxBottomNav({
  activeTab,
  allowedTabs,
  onChange,
}: {
  activeTab: StoxTabKey;
  allowedTabs: StoxTabKey[];
  onChange: (tab: StoxTabKey) => void;
}) {
  const visibleNavItems = navItems.filter((item) => allowedTabs.includes(item.key));

  return (
    <View style={styles.shell}>
      <View style={styles.bar}>
        {visibleNavItems.map((item) => {
          const active = item.key === activeTab;
          const center = item.emphasis === true;

          return (
            <Pressable
              key={item.key}
              onPress={() => {
                onChange(item.key);
              }}
              style={[styles.item, center && styles.centerItem]}>
              {center ? (
                <View style={[styles.centerBubble, active && styles.centerBubbleActive]}>
                  <Feather
                    name={item.icon}
                    size={22}
                    color={tokens.colors.surface}
                  />
                </View>
              ) : (
                <View style={styles.iconWrap}>
                  <Feather
                    name={item.icon}
                    size={20}
                    color={active ? tokens.colors.panel : tokens.colors.inkSoft}
                  />
                </View>
              )}

              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  active && styles.activeLabel,
                  center && styles.centerLabel,
                ]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: tokens.colors.surface,
    borderTopColor: tokens.colors.border,
    borderTopWidth: 1,
    paddingTop: 0,
    paddingHorizontal: 8,
  },
  bar: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 56,
  },
  item: {
    alignItems: 'center',
    flex: 1,
    gap: 1,
    justifyContent: 'flex-end',
    minHeight: 44,
    paddingBottom: 2,
    paddingHorizontal: 2,
  },
  centerItem: {
    justifyContent: 'flex-start',
    marginTop: -12,
    minHeight: 66,
  },
  iconWrap: {
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
  },
  centerBubble: {
    alignItems: 'center',
    backgroundColor: tokens.colors.panelMuted,
    borderColor: tokens.colors.surface,
    borderRadius: 28,
    borderWidth: 4,
    height: 54,
    justifyContent: 'center',
    shadowColor: tokens.colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    width: 54,
    elevation: 8,
  },
  centerBubbleActive: {
    backgroundColor: tokens.colors.panel,
  },
  label: {
    color: tokens.colors.inkSoft,
    fontSize: 10,
    fontWeight: '700',
    maxWidth: '100%',
  },
  activeLabel: {
    color: tokens.colors.panel,
  },
  centerLabel: {
    color: tokens.colors.ink,
    fontSize: 12,
    marginTop: -4,
  },
});
