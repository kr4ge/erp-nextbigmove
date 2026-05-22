import { StyleSheet, Text, View } from 'react-native';
import type { BootstrapResponse, DeviceIdentity, StoredSession } from '@/src/features/auth/types';
import { PrimaryButton } from '@/src/shared/components/primary-button';
import { SurfaceCard } from '@/src/shared/components/surface-card';
import { tokens } from '@/src/shared/theme/tokens';
import { getDisplayName, resolveEntityName } from '../utils';
import { SectionLabel, TaskHeader, UtilityPill } from './stox-primitives';

type AccountTabProps = {
  bootstrap: BootstrapResponse;
  device: DeviceIdentity | null;
  isSubmitting: boolean;
  session: StoredSession;
  onRefresh: () => Promise<void>;
  onSignOut: () => Promise<void>;
};

export function AccountTab({
  bootstrap,
  device,
  isSubmitting,
  session,
  onRefresh,
  onSignOut,
}: AccountTabProps) {
  const displayName = getDisplayName(bootstrap.user);
  const warehouseName = resolveEntityName(
    bootstrap.context.warehouses,
    bootstrap.context.defaultWarehouseId,
    'name',
  );
  const storeName = resolveEntityName(bootstrap.context.stores, bootstrap.context.defaultStoreId);
  const assignment = bootstrap.operations?.taskAssignment;

  return (
    <>
      <TaskHeader title="Account" />

      <SurfaceCard style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{displayName.slice(0, 2).toUpperCase()}</Text>
        </View>
        <View style={styles.profileCopy}>
          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profileEmail}>{bootstrap.user.email}</Text>
        </View>
      </SurfaceCard>

      <View style={styles.metaRow}>
        <UtilityPill icon="briefcase" label={assignment ? `${assignment} assigned` : 'No task assignment'} />
        <UtilityPill icon="shopping-bag" label={storeName} tone="accent" />
        <UtilityPill icon="map-pin" label={warehouseName} />
      </View>

      <SectionLabel title="Session" />

      <SurfaceCard style={styles.infoCard}>
        <InfoRow label="Device" value={device?.name ?? 'Not available'} />
        <InfoRow label="Session ID" value={session.sessionId || 'Unavailable'} />
        <InfoRow label="Permissions" value={`${bootstrap.access.permissions.length}`} />
        <InfoRow label="Workspace" value="STOX · WMS" />
      </SurfaceCard>

      <SectionLabel title="Actions" />

      <View style={styles.actions}>
        <PrimaryButton
          label="Sync workspace"
          variant="secondary"
          loading={isSubmitting}
          onPress={onRefresh}
          style={styles.button}
        />
        <PrimaryButton
          label="Log out"
          loading={isSubmitting}
          onPress={onSignOut}
          style={styles.button}
        />
      </View>
    </>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: tokens.spacing.md,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: tokens.colors.accent,
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  avatarText: {
    color: tokens.colors.panel,
    fontSize: 18,
    fontWeight: '900',
  },
  profileCopy: {
    flex: 1,
    gap: 2,
  },
  profileName: {
    color: tokens.colors.ink,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  profileEmail: {
    color: tokens.colors.inkMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
  },
  infoCard: {
    gap: tokens.spacing.md,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: tokens.spacing.md,
    justifyContent: 'space-between',
  },
  rowLabel: {
    color: tokens.colors.inkMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  rowValue: {
    color: tokens.colors.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
  },
  actions: {
    gap: tokens.spacing.md,
  },
  button: {
    width: '100%',
  },
});
