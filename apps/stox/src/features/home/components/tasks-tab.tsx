import { useMemo, useState } from 'react';
import type { BootstrapResponse, DeviceIdentity, StoredSession } from '@/src/features/auth/types';
import { canUsePackWorkspace, canUsePickWorkspace } from '../rbac';
import { PackingTab } from './packing-tab';
import { PickingTab } from './picking-tab';
import { BlockedTaskState } from './stox-primitives';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { tokens } from '@/src/shared/theme/tokens';

type TasksTabProps = {
  bootstrap: BootstrapResponse;
  device: DeviceIdentity | null;
  session: StoredSession;
};

type TaskMode = 'pick' | 'pack';

export function TasksTab({ bootstrap, device, session }: TasksTabProps) {
  const canPick = canUsePickWorkspace(bootstrap);
  const canPack = canUsePackWorkspace(bootstrap);
  const defaultMode: TaskMode = bootstrap.operations?.taskAssignment === 'PACK' && canPack
    ? 'pack'
    : 'pick';
  const [mode, setMode] = useState<TaskMode>(defaultMode);

  const canSwitchModes = canPick && canPack;
  const visibleMode = useMemo(() => {
    if (mode === 'pack' && !canPack && canPick) {
      return 'pick';
    }
    if (mode === 'pick' && !canPick && canPack) {
      return 'pack';
    }
    return mode;
  }, [canPack, canPick, mode]);

  if (!canPick && !canPack) {
    return (
      <BlockedTaskState copy="This account is not assigned to a PICK or PACK workstation right now." />
    );
  }

  return (
    <>
      {canSwitchModes ? (
        <View style={styles.modeRow}>
          <ModeChip active={visibleMode === 'pick'} label="Pick queue" onPress={() => setMode('pick')} />
          <ModeChip active={visibleMode === 'pack'} label="Pack queue" onPress={() => setMode('pack')} />
        </View>
      ) : null}

      {visibleMode === 'pick' ? (
        <PickingTab bootstrap={bootstrap} device={device} session={session} />
      ) : null}

      {visibleMode === 'pack' ? (
        <PackingTab bootstrap={bootstrap} device={device} session={session} />
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
