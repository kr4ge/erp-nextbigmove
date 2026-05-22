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
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'tasks', label: 'Tasks', icon: 'calendar' },
  { key: 'scan', label: 'Scan', icon: 'maximize', emphasis: true },
  { key: 'history', label: 'History', icon: 'file-text' },
  { key: 'account', label: 'Account', icon: 'users' },
];

export function StoxBottomNav({
  activeTab,
  onChange,
}: {
  activeTab: StoxTabKey;
  onChange: (tab: StoxTabKey) => void;
}) {
  return (
    <View style={styles.shell}>
      <View style={styles.bar}>
        {navItems.map((item) => {
          const active = item.key === activeTab;
          const center = item.emphasis === true;

          return (
            <Pressable
              key={item.key}
              accessibilityLabel={item.label}
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
                <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
                  <Feather
                    name={item.icon}
                    size={19}
                    color={active ? '#6437F6' : '#B19CF2'}
                  />
                </View>
              )}

            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: 'transparent',
  },
  bar: {
    alignItems: 'flex-start',
    backgroundColor: '#EEE9FF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    flexDirection: 'row',
    height: 56,
    justifyContent: 'space-between',
    overflow: 'visible',
    paddingHorizontal: 22,
    paddingTop: 10,
    width: '100%',
  },
  item: {
    alignItems: 'flex-end',
    flex: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 2,
  },
  centerItem: {
    justifyContent: 'flex-start',
    marginTop: -42,
    minHeight: 88,
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  iconWrapActive: {
    backgroundColor: 'rgba(100, 55, 246, 0.12)',
    shadowColor: 'rgba(94, 52, 240, 0.15)',
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 4,
  },
  centerBubble: {
    alignItems: 'center',
    backgroundColor: '#6437F6',
    borderColor: '#F6F1FF',
    borderRadius: 32,
    borderWidth: 6,
    height: 64,
    justifyContent: 'center',
    shadowColor: 'rgba(100, 55, 246, 0.38)',
    shadowOpacity: 1,
    shadowRadius: 22,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    width: 64,
    elevation: 12,
  },
  centerBubbleActive: {
    backgroundColor: '#5B30EE',
  },
});
