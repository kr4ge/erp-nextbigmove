import { useEffect, useMemo, useState } from 'react';
import type { BootstrapResponse, DeviceIdentity, StoredSession } from '@/src/features/auth/types';
import {
  canUseAssignedRtsWorkspace,
  canUseAssignedInventoryWorkspace,
  canUsePackWorkspace,
  canUsePickWorkspace,
} from '../rbac';
import type { StoxTaskMode, StoxTaskRoute } from '../types';
import { InventoryTab } from './inventory-tab';
import { PackingTab } from './packing-tab';
import { PickingTab } from './picking-tab';
import { BlockedTaskState } from './stox-primitives';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { tokens } from '@/src/shared/theme/tokens';

type TasksTabProps = {
  bootstrap: BootstrapResponse;
  device: DeviceIdentity | null;
  session: StoredSession;
  onRefresh: () => Promise<void>;
  route?: StoxTaskRoute | null;
  onRouteConsumed?: () => void;
};

export function TasksTab({ bootstrap, device, session, onRefresh, route, onRouteConsumed }: TasksTabProps) {
  const canPick = canUsePickWorkspace(bootstrap);
  const canPack = canUsePackWorkspace(bootstrap);
  const canInventoryTasks = canUseAssignedInventoryWorkspace(bootstrap);
  const canInventory = canInventoryTasks || canUseAssignedRtsWorkspace(bootstrap);
  const availableModes = useMemo(
    () => [
      canPick ? 'pick' : null,
      canPack ? 'pack' : null,
      canInventory ? 'inventory' : null,
    ].filter((mode): mode is StoxTaskMode => mode !== null),
    [canInventory, canPack, canPick],
  );
  const defaultMode = useMemo<StoxTaskMode>(() => {
    if (route?.mode && availableModes.includes(route.mode)) {
      return route.mode;
    }

    if (bootstrap.operations?.taskAssignment === 'INVENTORY' && canInventory) {
      return 'inventory';
    }

    if (bootstrap.operations?.taskAssignment === 'PACK' && canPack) {
      return 'pack';
    }

    if (canPick) {
      return 'pick';
    }

    return availableModes[0] ?? 'pick';
  }, [availableModes, bootstrap.operations?.taskAssignment, canInventory, canPack, canPick, route?.mode]);
  const [mode, setMode] = useState<StoxTaskMode>(defaultMode);
  const [activeRoute, setActiveRoute] = useState<StoxTaskRoute | null>(route ?? null);

  useEffect(() => {
    if (!route || !availableModes.includes(route.mode)) {
      return;
    }

    setActiveRoute(route);
    setMode(route.mode);
    onRouteConsumed?.();
  }, [availableModes, onRouteConsumed, route]);

  const canSwitchModes = availableModes.length > 1;
  const visibleMode = useMemo(() => {
    if (availableModes.includes(mode)) {
      return mode;
    }

    return availableModes[0] ?? 'pick';
  }, [availableModes, mode]);

  if (availableModes.length === 0) {
    return (
      <BlockedTaskState copy="This account is not assigned to a PICK, PACK, or INVENTORY workstation right now." />
    );
  }

  return (
    <>
      {canSwitchModes ? (
        <View style={styles.modeRow}>
          {availableModes.includes('pick') ? (
            <ModeChip
              active={visibleMode === 'pick'}
              label="Pick queue"
              onPress={() => {
                setActiveRoute(null);
                setMode('pick');
              }}
            />
          ) : null}
          {availableModes.includes('pack') ? (
            <ModeChip
              active={visibleMode === 'pack'}
              label="Pack queue"
              onPress={() => {
                setActiveRoute(null);
                setMode('pack');
              }}
            />
          ) : null}
          {availableModes.includes('inventory') ? (
            <ModeChip
              active={visibleMode === 'inventory'}
              label="Inventory"
              onPress={() => {
                setActiveRoute(null);
                setMode('inventory');
              }}
            />
          ) : null}
        </View>
      ) : null}

      {visibleMode === 'pick' ? (
        <PickingTab bootstrap={bootstrap} device={device} session={session} />
      ) : null}

      {visibleMode === 'pack' ? (
        <PackingTab bootstrap={bootstrap} device={device} session={session} />
      ) : null}

      {visibleMode === 'inventory' ? (
        <InventoryTab
          bootstrap={bootstrap}
          device={device}
          session={session}
          onRefresh={onRefresh}
          route={activeRoute?.mode === 'inventory' ? activeRoute : null}
        />
      ) : null}
    </>
  );
}

function ModeChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.modeChip, active ? styles.modeChipActive : null]}>
      <Text style={[styles.modeChipText, active ? styles.modeChipTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  modeRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  modeChip: {
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modeChipActive: {
    backgroundColor: tokens.colors.panel,
  },
  modeChipText: {
    color: tokens.colors.inkMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  modeChipTextActive: {
    color: tokens.colors.surface,
  },
});
