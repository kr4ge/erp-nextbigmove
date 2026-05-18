import { useEffect, useMemo, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { tokens } from '@/src/shared/theme/tokens';
import type { StockScopeOption } from '../utils/stock-scope';

export function StockScopeFilterChip({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.filterChip, pressed ? styles.filterChipPressed : null]}>
      <Text numberOfLines={1} style={styles.filterLabel}>{label}</Text>
      <View style={styles.filterValueRow}>
        <Text numberOfLines={1} style={styles.filterValue}>{value}</Text>
        <Feather name="chevron-down" size={14} color={tokens.colors.inkMuted} />
      </View>
    </Pressable>
  );
}

export function StockScopeFilterModal({
  options,
  title,
  visible,
  onClose,
  onSelect,
}: {
  options: StockScopeOption[];
  title: string;
  visible: boolean;
  onClose: () => void;
  onSelect: (value: string | null) => void;
}) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!visible) {
      setQuery('');
    }
  }, [visible]);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) => {
      if (option.value === null) {
        return true;
      }

      return [option.label, option.meta]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalizedQuery));
    });
  }, [options, query]);

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Pressable onPress={onClose} style={styles.modalClose}>
              <Feather name="x" size={18} color={tokens.colors.ink} />
            </Pressable>
          </View>

          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Search"
            placeholderTextColor={tokens.colors.inkSoft}
            value={query}
            onChangeText={setQuery}
            style={styles.modalSearch}
          />

          <FlatList
            data={filteredOptions}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(option) => option.value ?? 'all'}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => onSelect(item.value)}
                style={({ pressed }) => [
                  styles.modalOption,
                  pressed ? styles.modalOptionPressed : null,
                ]}>
                <Text numberOfLines={1} style={styles.modalOptionLabel}>{item.label}</Text>
                {item.meta ? (
                  <Text numberOfLines={1} style={styles.modalOptionMeta}>{item.meta}</Text>
                ) : null}
              </Pressable>
            )}
            ListEmptyComponent={<Text style={styles.modalEmpty}>No match</Text>}
            ItemSeparatorComponent={() => <View style={styles.modalSeparator} />}
            initialNumToRender={14}
            maxToRenderPerBatch={16}
            windowSize={8}
            style={styles.modalOptions}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  filterChip: {
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    flexGrow: 1,
    minWidth: 104,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  filterChipPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  filterLabel: {
    color: tokens.colors.inkSoft,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  filterValueRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: tokens.spacing.xs,
    marginTop: 3,
  },
  filterValue: {
    color: tokens.colors.ink,
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    minWidth: 0,
  },
  modalBackdrop: {
    backgroundColor: 'rgba(18, 54, 79, 0.42)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: tokens.colors.surface,
    borderTopLeftRadius: tokens.radius.xl,
    borderTopRightRadius: tokens.radius.xl,
    gap: tokens.spacing.md,
    maxHeight: '72%',
    padding: tokens.spacing.lg,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalTitle: {
    color: tokens.colors.ink,
    fontSize: 20,
    fontWeight: '900',
  },
  modalClose: {
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: tokens.radius.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  modalSearch: {
    backgroundColor: tokens.colors.surfaceMuted,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    color: tokens.colors.ink,
    fontSize: 15,
    fontWeight: '700',
    minHeight: 48,
    paddingHorizontal: tokens.spacing.md,
  },
  modalOptions: {},
  modalOption: {
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: tokens.radius.md,
    justifyContent: 'center',
    minHeight: 58,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  modalOptionPressed: {
    opacity: 0.82,
  },
  modalSeparator: {
    height: tokens.spacing.sm,
  },
  modalEmpty: {
    color: tokens.colors.inkMuted,
    fontSize: 14,
    fontWeight: '700',
    paddingVertical: tokens.spacing.lg,
    textAlign: 'center',
  },
  modalOptionLabel: {
    color: tokens.colors.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  modalOptionMeta: {
    color: tokens.colors.inkMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
});
