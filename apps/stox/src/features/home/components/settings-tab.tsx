import { StyleSheet, Text, View } from 'react-native';
import type { BootstrapResponse, DeviceIdentity, StoredSession } from '@/src/features/auth/types';
import { PrimaryButton } from '@/src/shared/components/primary-button';
import { SurfaceCard } from '@/src/shared/components/surface-card';
import { tokens } from '@/src/shared/theme/tokens';
import { getDisplayName, resolveEntityName } from '../utils';
import { UtilityPill } from './stox-primitives';

export function SettingsTab({
  bootstrap,
  device,
  isSubmitting,
  session,
  onRefresh,
  onSignOut,
}: {
  bootstrap: BootstrapResponse;
  device: DeviceIdentity | null;
  isSubmitting: boolean;
  session: StoredSession;
  onRefresh: () => Promise<void>;
  onSignOut: () => Promise<void>;
}) {
  const displayName = getDisplayName(bootstrap.user);
  const warehouseName = resolveEntityName(
    bootstrap.context.warehouses,
    bootstrap.context.defaultWarehouseId,
    'name',
  );
  const storeName = resolveEntityName(bootstrap.context.stores, bootstrap.context.defaultStoreId);

  return (
    <>
      <SurfaceCard tone="panel" style={styles.heroCard}>
        <Text style={styles.heroTitle}>{displayName}</Text>
        <View style={styles.pillRow}>
          <UtilityPill icon="shopping-bag" label={storeName} tone="panel" />
          <UtilityPill icon="map-pin" label={warehouseName} tone="panel" />
        </View>
        {device ? <Text style={styles.metaText}>{device.name}</Text> : null}
      </SurfaceCard>

      <SurfaceCard style={styles.scopeCard}>
        <Row label="Session" value={session.sessionId || 'Unavailable'} />
        <Row label="Access" value={`${bootstrap.access.permissions.length} permissions`} />
      </SurfaceCard>

      <View style={styles.actions}>
        <PrimaryButton
          label="Sync"
          variant="secondary"
          loading={isSubmitting}
          onPress={onRefresh}
          style={styles.actionButton}
        />
        <PrimaryButton
          label="Log out"
          loading={isSubmitting}
          onPress={onSignOut}
          style={styles.actionButton}
        />
      </View>
    </>
  );
}

function Row({
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
  heroCard: {
    gap: tokens.spacing.md,
  },
  heroTitle: {
    color: tokens.colors.surface,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -1,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
  },
  metaText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 14,
    fontWeight: '600',
  },
  scopeCard: {
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
    fontWeight: '600',
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
  actionButton: {
    width: '100%',
  },
});
