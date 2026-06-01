import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BootstrapResponse, DeviceIdentity, StoredSession } from '@/src/features/auth/types';
import {
  canUseStoxRtsWorkspace,
  canUseStoxStockWorkspace,
} from '@/src/features/home/rbac';
import { tokens } from '@/src/shared/theme/tokens';
import {
  ActionTile,
  BlockedTaskState,
  SectionLabel,
  TaskHeader,
  TaskHeaderIconButton,
} from './stox-primitives';

export function InventoryTab({
  bootstrap,
  device: _device,
  session: _session,
  onRefresh,
  onBack,
  onOpenRts,
}: {
  bootstrap: BootstrapResponse;
  device: DeviceIdentity | null;
  session: StoredSession;
  onRefresh: () => Promise<void>;
  onBack?: () => void;
  onOpenRts?: () => void;
}) {
  const canUseInventory = canUseStoxStockWorkspace(bootstrap) || canUseStoxRtsWorkspace(bootstrap);

  if (!canUseInventory) {
    return (
      <>
        <TaskHeader title="Inventory" />
        <BlockedTaskState copy="This account needs WMS inventory, receiving, or RTS access to use Inventory tasks." />
      </>
    );
  }

  return (
    <>
      <TaskHeader
        title="Inventory"
        action={(
          <View style={styles.headerActions}>
            {onBack ? (
              <Pressable
                onPress={onBack}
                style={({ pressed }) => [styles.backChip, pressed ? styles.backChipPressed : null]}>
                <Feather name="arrow-left" size={16} color={tokens.colors.panel} />
                <Text style={styles.backChipText}>Home</Text>
              </Pressable>
            ) : null}
            <TaskHeaderIconButton icon="refresh-cw" onPress={onRefresh} />
          </View>
        )}
      />

      <SectionLabel title="Inventory Tasks" trailing="RTS" />

      <ActionTile
        icon="refresh-ccw"
        title="RTS Verification"
        status="Open"
        onPress={onOpenRts}
      />

      <View style={styles.taskGrid}>
        <ActionTile
          icon="inbox"
          title="Putaway"
          status="Soon"
        />
        <ActionTile
          icon="repeat"
          title="Move"
          status="Soon"
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  backChip: {
    alignItems: 'center',
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  backChipPressed: {
    opacity: 0.84,
  },
  backChipText: {
    color: tokens.colors.panel,
    fontSize: 13,
    fontWeight: '800',
  },
  taskGrid: {
    gap: tokens.spacing.md,
  },
});
