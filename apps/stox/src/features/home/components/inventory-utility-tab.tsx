import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BootstrapResponse, DeviceIdentity, StoredSession } from '@/src/features/auth/types';
import {
  canUseInventoryWorkspace,
  canUseStoxStockWorkspace,
} from '@/src/features/home/rbac';
import { StockWorkspace } from '@/src/features/stock/components/stock-workspace';
import { tokens } from '@/src/shared/theme/tokens';
import { BlockedTaskState, TaskHeaderIconButton } from './stox-primitives';

export function InventoryUtilityTab({
  bootstrap,
  device,
  session,
  onBack,
  onRefresh,
  onOpenRts,
}: {
  bootstrap: BootstrapResponse;
  device: DeviceIdentity | null;
  session: StoredSession;
  onBack: () => void;
  onRefresh: () => Promise<void>;
  onOpenRts?: () => void;
}) {
  const canUseInventory = canUseInventoryWorkspace(bootstrap);
  const canUseStockWorkspace = canUseStoxStockWorkspace(bootstrap);

  return (
    <View style={styles.root}>
      <View style={styles.shellHeader}>
        <TaskHeaderIconButton icon="chevron-left" onPress={onBack} />
        <Text style={styles.shellTitle}>Inventory</Text>
        <View style={styles.shellHeaderSpacer} />
      </View>

      {!canUseInventory ? (
        <BlockedTaskState copy="This account needs WMS inventory, receiving, or RTS read access to inspect inventory utility views." />
      ) : null}

      {canUseInventory && !canUseStockWorkspace ? (
        <>
          <BlockedTaskState
            title="Inventory utility unavailable"
            copy="This account can open return workflows, but it cannot inspect stock bins or recent movement yet."
          />
          {onOpenRts ? (
            <Pressable
              onPress={onOpenRts}
              style={({ pressed }) => [styles.rtsButton, pressed ? styles.pressed : null]}>
              <Feather name="corner-up-left" size={16} color={tokens.colors.accentStrong} />
              <Text style={styles.rtsButtonText}>Open RTS verification</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}

      {canUseInventory && canUseStockWorkspace ? (
        <StockWorkspace
          bootstrap={bootstrap}
          device={device}
          session={session}
          onRefresh={onRefresh}
          variant="utility"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: tokens.spacing.lg,
  },
  shellHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
    marginTop: 2,
  },
  shellTitle: {
    color: '#24232D',
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  shellHeaderSpacer: {
    width: 44,
  },
  rtsButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  rtsButtonText: {
    color: tokens.colors.accentStrong,
    fontSize: 13,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.84,
  },
});
