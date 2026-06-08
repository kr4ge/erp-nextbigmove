import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BootstrapResponse, DeviceIdentity, StoredSession } from '@/src/features/auth/types';
import {
  canUseInventoryWorkspace,
  canUseStoxStockWorkspace,
} from '@/src/features/home/rbac';
import { StockWorkspace } from '@/src/features/stock/components/stock-workspace';
import { tokens } from '@/src/shared/theme/tokens';
import { BlockedTaskState } from './stox-primitives';

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
          onBack={onBack}
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
