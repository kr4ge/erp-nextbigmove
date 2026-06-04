import { useEffect, useMemo, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import type { BootstrapResponse, DeviceIdentity, StoredSession } from '@/src/features/auth/types';
import { getInstalledStoxBuild } from '@/src/shared/config/app-release';
import { PrimaryButton } from '@/src/shared/components/primary-button';
import { SurfaceCard } from '@/src/shared/components/surface-card';
import { tokens } from '@/src/shared/theme/tokens';
import { fetchActiveStoxRelease, type WmsMobileActiveStoxReleaseResponse } from '../services/home-api';
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
  const [releaseState, setReleaseState] = useState<{
    latest: WmsMobileActiveStoxReleaseResponse['release'];
    error: string | null;
  }>({
    latest: null,
    error: null,
  });
  const displayName = getDisplayName(bootstrap.user);
  const warehouseName = resolveEntityName(
    bootstrap.context.warehouses,
    bootstrap.context.defaultWarehouseId,
    'name',
  );
  const storeName = resolveEntityName(bootstrap.context.stores, bootstrap.context.defaultStoreId);
  const assignment = bootstrap.operations?.taskAssignment;
  const installedBuild = useMemo(() => getInstalledStoxBuild(), []);
  const hasTrackedInstalledBuild = installedBuild.buildNumber !== null;
  const installedBuildNumber = installedBuild.buildNumber ?? 0;

  useEffect(() => {
    let isMounted = true;

    fetchActiveStoxRelease({
      accessToken: session.accessToken,
      device: device ?? {
        id: 'unknown-device',
        name: 'Unknown device',
      },
    })
      .then((response) => {
        if (isMounted) {
          setReleaseState({
            latest: response.release,
            error: null,
          });
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setReleaseState({
            latest: null,
            error: error instanceof Error ? error.message : 'Unable to check the latest STOX release.',
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [device, session.accessToken]);

  const isUpdateAvailable = Boolean(
    releaseState.latest
    && hasTrackedInstalledBuild
    && releaseState.latest.buildNumber > installedBuildNumber,
  );

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
        <InfoRow label="App Version" value={installedBuild.label} />
        <InfoRow label="Device" value={device?.name ?? 'Not available'} />
        <InfoRow label="Session ID" value={session.sessionId || 'Unavailable'} />
        <InfoRow label="Permissions" value={`${bootstrap.access.permissions.length}`} />
        <InfoRow label="Workspace" value="STOX · WMS" />
      </SurfaceCard>

      <SectionLabel title="App Release" />

      <SurfaceCard style={styles.releaseCard}>
        <View style={styles.releaseHeader}>
          <Text style={styles.releaseTitle}>Latest Android release</Text>
          <Text style={styles.releaseValue}>
            {releaseState.latest
              ? `${releaseState.latest.version} (${releaseState.latest.buildNumber})`
              : 'Unavailable'}
          </Text>
        </View>

        {isUpdateAvailable ? (
          <View style={styles.updateNotice}>
            <Text style={styles.updateTitle}>Update available</Text>
            <Text style={styles.updateCopy}>
              Installed build {installedBuild.label} is behind the active WMS release.
            </Text>
            {releaseState.latest?.releaseNotes ? (
              <Text style={styles.updateNotes}>{releaseState.latest.releaseNotes}</Text>
            ) : null}
          </View>
        ) : releaseState.latest && !hasTrackedInstalledBuild ? (
          <Text style={styles.releaseMuted}>
            This session is running a local or untracked build. Install the active WMS APK to validate production rollout.
          </Text>
        ) : releaseState.latest ? (
          <Text style={styles.releaseMuted}>
            This device is on the latest tracked STOX release.
          </Text>
        ) : (
          <Text style={styles.releaseMuted}>
            {releaseState.error || 'No active STOX release is currently published in WMS.'}
          </Text>
        )}
      </SurfaceCard>

      <SectionLabel title="Actions" />

      <View style={styles.actions}>
        {isUpdateAvailable && releaseState.latest?.downloadUrl ? (
          <PrimaryButton
            label="Download latest STOX"
            variant="secondary"
            loading={isSubmitting}
            onPress={async () => {
              await Linking.openURL(releaseState.latest!.downloadUrl!);
            }}
            style={styles.button}
          />
        ) : null}
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
  releaseCard: {
    gap: tokens.spacing.md,
  },
  releaseHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  releaseTitle: {
    color: tokens.colors.inkMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  releaseValue: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  releaseMuted: {
    color: tokens.colors.inkMuted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  updateNotice: {
    backgroundColor: '#FFF6E6',
    borderColor: '#F2D49B',
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
  },
  updateTitle: {
    color: '#8A6814',
    fontSize: 14,
    fontWeight: '800',
  },
  updateCopy: {
    color: '#805F11',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  updateNotes: {
    color: '#7A5A0F',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
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
