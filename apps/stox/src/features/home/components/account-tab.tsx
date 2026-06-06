import { useEffect, useMemo, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { BootstrapResponse, DeviceIdentity, StoredSession } from '@/src/features/auth/types';
import { getInstalledStoxBuild } from '@/src/shared/config/app-release';
import { PrimaryButton } from '@/src/shared/components/primary-button';
import { SurfaceCard } from '@/src/shared/components/surface-card';
import { tokens } from '@/src/shared/theme/tokens';
import { fetchActiveStoxRelease, type WmsMobileActiveStoxReleaseResponse } from '../services/home-api';
import { getDisplayName, resolveEntityName } from '../utils';
import { SectionLabel, TaskHeaderIconButton } from './stox-primitives';

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
  const initials = displayName.slice(0, 2).toUpperCase();
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
      <View style={styles.profileHeader}>
        <TaskHeaderIconButton
          icon="refresh-cw"
          loading={isSubmitting}
          onPress={onRefresh}
        />
        <Text style={styles.profileHeaderTitle}>Profile</Text>
        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarText}>{initials}</Text>
        </View>
      </View>

      <SurfaceCard style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.profileCopy}>
          <Text style={styles.profileEyebrow}>WMS STAFF</Text>
          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profileEmail}>{bootstrap.user.email}</Text>
          <View style={styles.assignmentBadge}>
            <Feather name="briefcase" size={13} color="#6437F6" />
            <Text style={styles.assignmentBadgeText}>
              {assignment ? `${assignment} assigned` : 'No task assignment'}
            </Text>
          </View>
        </View>
      </SurfaceCard>

      <View style={styles.metaGrid}>
        <ProfileMetaCard icon="shopping-bag" label="Store" value={storeName} />
        <ProfileMetaCard icon="map-pin" label="Warehouse" value={warehouseName} />
        <ProfileMetaCard icon="shield" label="Permissions" value={`${bootstrap.access.permissions.length}`} />
      </View>

      <SectionLabel title="Session" trailing="STOX · WMS" />

      <SurfaceCard style={styles.infoCard}>
        <InfoRow icon="smartphone" label="Device" value={device?.name ?? 'Not available'} />
        <InfoRow icon="hash" label="Session ID" value={session.sessionId || 'Unavailable'} />
        <InfoRow icon="package" label="App Version" value={installedBuild.label} />
        <InfoRow icon="layers" label="Workspace" value="STOX · WMS" />
      </SurfaceCard>

      <SectionLabel title="App Release" />

      <SurfaceCard style={styles.releaseCard}>
        <View style={styles.releaseHeader}>
          <View style={styles.releaseIcon}>
            <Feather name="download-cloud" size={16} color="#F55DB8" />
          </View>
          <View style={styles.releaseCopy}>
            <Text style={styles.releaseTitle}>Latest Android release</Text>
            <Text style={styles.releaseValue}>
              {releaseState.latest
                ? `${releaseState.latest.version} (${releaseState.latest.buildNumber})`
                : 'Unavailable'}
            </Text>
          </View>
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
  icon,
  label,
  value,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Feather name={icon} size={14} color="#6437F6" />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text numberOfLines={1} style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

function ProfileMetaCard({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <SurfaceCard style={styles.metaCard}>
      <View style={styles.metaIcon}>
        <Feather name={icon} size={15} color="#F55DB8" />
      </View>
      <View style={styles.metaCopy}>
        <Text style={styles.metaLabel}>{label}</Text>
        <Text numberOfLines={1} style={styles.metaValue}>{value}</Text>
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  profileHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 2,
  },
  profileHeaderTitle: {
    color: '#24232D',
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  headerAvatar: {
    alignItems: 'center',
    backgroundColor: '#F7E4AF',
    borderColor: 'rgba(18,54,79,0.12)',
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  headerAvatarText: {
    color: '#24232D',
    fontSize: 13,
    fontWeight: '900',
  },
  profileCard: {
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderColor: 'transparent',
    borderRadius: 28,
    flexDirection: 'row',
    gap: tokens.spacing.md,
    paddingHorizontal: 18,
    paddingVertical: 18,
    shadowColor: '#A38BFF',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 22,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#6437F6',
    borderRadius: 24,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  profileCopy: {
    flex: 1,
    gap: 5,
    minWidth: 0,
  },
  profileEyebrow: {
    color: '#8F8AAB',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  profileName: {
    color: '#24232D',
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  profileEmail: {
    color: '#7B7791',
    fontSize: 14,
    fontWeight: '700',
  },
  assignmentBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#F4F0FF',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  assignmentBadgeText: {
    color: '#6437F6',
    fontSize: 12,
    fontWeight: '900',
  },
  metaGrid: {
    gap: 12,
  },
  metaCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: 'transparent',
    borderRadius: 24,
    flexDirection: 'row',
    gap: 14,
    minHeight: 74,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#A38BFF',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.07,
    shadowRadius: 20,
  },
  metaIcon: {
    alignItems: 'center',
    backgroundColor: '#FFE1F2',
    borderRadius: 12,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  metaCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  metaLabel: {
    color: '#8F8AAB',
    fontSize: 12,
    fontWeight: '800',
  },
  metaValue: {
    color: '#24232D',
    fontSize: 16,
    fontWeight: '800',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderColor: 'transparent',
    borderRadius: 24,
    gap: 14,
    shadowColor: '#A38BFF',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.07,
    shadowRadius: 20,
  },
  releaseCard: {
    backgroundColor: '#FFFFFF',
    borderColor: 'transparent',
    borderRadius: 24,
    gap: tokens.spacing.md,
    shadowColor: '#A38BFF',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.07,
    shadowRadius: 20,
  },
  releaseHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  releaseIcon: {
    alignItems: 'center',
    backgroundColor: '#FFE1F2',
    borderRadius: 14,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  releaseCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  releaseTitle: {
    color: '#8F8AAB',
    fontSize: 13,
    fontWeight: '800',
  },
  releaseValue: {
    color: '#24232D',
    fontSize: 15,
    fontWeight: '800',
  },
  releaseMuted: {
    color: '#7B7791',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  updateNotice: {
    backgroundColor: '#F4F0FF',
    borderColor: '#E1D8FF',
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
  },
  updateTitle: {
    color: '#6437F6',
    fontSize: 14,
    fontWeight: '800',
  },
  updateCopy: {
    color: '#524F66',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  updateNotes: {
    color: '#7B7791',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  rowIcon: {
    alignItems: 'center',
    backgroundColor: '#F4F0FF',
    borderRadius: 12,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  rowCopy: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  rowLabel: {
    color: '#8F8AAB',
    fontSize: 12,
    fontWeight: '800',
  },
  rowValue: {
    color: '#24232D',
    fontSize: 14,
    fontWeight: '800',
  },
  actions: {
    gap: 12,
  },
  button: {
    width: '100%',
  },
});
