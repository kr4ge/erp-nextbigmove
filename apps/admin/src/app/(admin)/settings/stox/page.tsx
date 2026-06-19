'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, History, Plus, RefreshCcw, Smartphone } from 'lucide-react';
import { readStoredAdminUser, readStoredPermissions, type StoredAdminUser } from '@/lib/admin-session';
import {
  hasAnyAdminPermission,
  WMS_STOX_READ_PERMISSIONS,
  WMS_STOX_WRITE_PERMISSIONS,
} from '@/lib/wms-permissions';
import {
  activateWmsStoxRelease,
  createWmsStoxRelease,
  fetchWmsStoxReleases,
} from '../_services/settings.service';
import type {
  CreateWmsStoxReleaseInput,
  WmsStoxRelease,
  WmsStoxReleasesResponse,
} from '../_types/settings';
import {
  SettingsBadge,
  SettingsNotice,
  SettingsPageFrame,
  SettingsStatCard,
} from '../_components/settings-panels';
import { WmsCompactPanel } from '../../_components/wms-compact-panel';
import { WmsStoxReleaseFormModal } from '../_components/wms-stox-release-form-modal';

export default function SettingsStoxPage() {
  const [user, setUser] = useState<StoredAdminUser | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [data, setData] = useState<WmsStoxReleasesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isActivatingId, setIsActivatingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    setUser(readStoredAdminUser());
    setPermissions(readStoredPermissions());
    setHasHydrated(true);
  }, []);

  const canRead = useMemo(
    () => hasAnyAdminPermission(user?.role, permissions, WMS_STOX_READ_PERMISSIONS),
    [permissions, user?.role],
  );
  const canWrite = useMemo(
    () => hasAnyAdminPermission(user?.role, permissions, WMS_STOX_WRITE_PERMISSIONS),
    [permissions, user?.role],
  );

  const loadReleases = useCallback(async () => {
    const response = await fetchWmsStoxReleases();
    setData(response);
  }, []);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    if (!user || !canRead) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    loadReleases()
      .catch((loadError: unknown) => {
        if (isMounted) {
          setError(getErrorMessage(loadError, 'Unable to load STOX releases.'));
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [canRead, hasHydrated, loadReleases, user]);

  const latestRelease = data?.latestRelease ?? null;
  const activeCount = data?.releases.filter((release) => release.isActive).length ?? 0;

  const handleUpload = async (input: CreateWmsStoxReleaseInput) => {
    setIsSubmitting(true);
    setModalError(null);
    try {
      await createWmsStoxRelease(input);
      await loadReleases();
      setIsModalOpen(false);
    } catch (submitError: unknown) {
      setModalError(getErrorMessage(submitError, 'Unable to upload the STOX Android release.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleActivate = async (release: WmsStoxRelease) => {
    setIsActivatingId(release.id);
    setError(null);
    try {
      await activateWmsStoxRelease(release.id);
      await loadReleases();
    } catch (activationError: unknown) {
      setError(getErrorMessage(activationError, 'Unable to activate this STOX release.'));
    } finally {
      setIsActivatingId(null);
    }
  };

  const handleDownload = (release: WmsStoxRelease) => {
    if (!release.downloadUrl) {
      setError('The signed STOX download link is unavailable. Check object storage and refresh this page.');
      return;
    }

    window.open(release.downloadUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <SettingsPageFrame
      eyebrow="WMS Settings"
      title="STOX"
      description="Internal Android releases for the WMS STOX app. Download links are private to authorized WMS users."
      actions={
        canWrite ? (
          <button
            type="button"
            onClick={() => {
              setModalError(null);
              setIsModalOpen(true);
            }}
            className="btn btn-md btn-primary btn-icon"
          >
            <Plus className="h-3.5 w-3.5" />
            Upload Release
          </button>
        ) : null
      }
    >
      {!hasHydrated ? (
        <SettingsNotice title="Loading STOX" message="Checking your WMS access for internal app releases." />
      ) : !canRead ? (
        <SettingsNotice
          tone="danger"
          title="Access blocked"
          message="Your WMS role does not include STOX release access."
        />
      ) : error ? (
        <SettingsNotice tone="danger" title="Unable to load STOX releases" message={error} />
      ) : isLoading ? (
        <SettingsNotice title="Loading STOX" message="Fetching the latest Android release and download metadata." />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <SettingsStatCard label="Latest Version" value={latestRelease?.version ?? 'None'} tone="blue" />
            <SettingsStatCard label="Latest Build" value={latestRelease?.buildNumber ?? '—'} tone="gold" />
            <SettingsStatCard label="Active Releases" value={activeCount} />
            <SettingsStatCard label="Release History" value={data?.releases.length ?? 0} />
          </div>

          {latestRelease ? (
            <WmsCompactPanel
              title="Latest APK"
              icon={<Smartphone className="panel-icon" />}
            >
              <div className="space-y-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <h2 className="text-2xl font-semibold tracking-[-0.03em] text-primary">
                  Version {latestRelease.version} · Build {latestRelease.buildNumber}
                </h2>

                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => void loadReleases()}
                      className="btn btn-md btn-outline btn-icon"
                    >
                      <RefreshCcw className="h-3.5 w-3.5" />
                      Refresh
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownload(latestRelease)}
                      className="btn btn-md btn-primary btn-icon"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download APK
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <SettingsBadge tone={latestRelease.isActive ? 'success' : 'warning'}>
                    {latestRelease.isActive ? 'Active WMS download' : 'Uploaded only'}
                  </SettingsBadge>
                  <SettingsBadge>{formatBytes(latestRelease.byteSize)}</SettingsBadge>
                  <SettingsBadge>{latestRelease.downloadFileName}</SettingsBadge>
                </div>

                {latestRelease.releaseNotes ? (
                  <p className="max-w-3xl text-sm leading-6 text-[#637786]">
                    {latestRelease.releaseNotes}
                  </p>
                ) : (
                  <p className="text-sm leading-6 text-[#8a9ba8]">
                    No release notes were added for this build.
                  </p>
                )}

                <div className="grid gap-3 text-sm text-[#637786] sm:grid-cols-3">
                  <ReleaseMeta
                    label="Uploaded"
                    value={`${formatDateTime(latestRelease.createdAt)}${latestRelease.createdBy ? ` · ${latestRelease.createdBy.displayName}` : ''}`}
                  />
                  <ReleaseMeta
                    label="Activated"
                    value={latestRelease.activatedAt
                      ? `${formatDateTime(latestRelease.activatedAt)}${latestRelease.activatedBy ? ` · ${latestRelease.activatedBy.displayName}` : ''}`
                      : 'Not activated yet'}
                  />
                  <ReleaseMeta
                    label="Original file"
                    value={latestRelease.originalFileName ?? latestRelease.downloadFileName}
                  />
                </div>
              </div>
            </WmsCompactPanel>
          ) : (
            <SettingsNotice
              title="No STOX release yet"
              message="Upload the first internal Android APK so WMS users can download STOX from this page."
            />
          )}

          {data?.releases.length ? (
            <WmsCompactPanel title="Version History" icon={<History className='panel-icon' />} className="overflow-hidden">
              <div className="-m-3 overflow-x-auto xl:overflow-visible">
                <table className="w-full min-w-[980px] border-separate border-spacing-0 xl:min-w-full">
                  <thead>
                    <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                      <th className="px-5 py-4">Release</th>
                      <th className="px-5 py-4">Notes</th>
                      <th className="px-5 py-4">Uploaded</th>
                      <th className="px-5 py-4">Status</th>
                      <th className="px-5 py-4">File</th>
                      <th className="w-[150px] px-5 py-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf2f6]">
                    {data.releases.map((release) => (
                      <tr key={release.id} className="align-top text-sm text-primary">
                        <td className="px-5 py-4">
                          <div className="space-y-1">
                            <p className="font-semibold">Version {release.version}</p>
                            <p className="text-xs text-[#637786]">Build {release.buildNumber}</p>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-[#637786]">
                          {release.releaseNotes || '—'}
                        </td>
                        <td className="px-5 py-4 text-[#637786]">
                          <div className="space-y-1">
                            <p>{formatDateTime(release.createdAt)}</p>
                            <p className="text-xs">
                              {release.createdBy?.displayName ?? 'Unknown'}
                            </p>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="space-y-2">
                            <SettingsBadge tone={release.isActive ? 'success' : 'neutral'}>
                              {release.isActive ? 'Active' : 'Inactive'}
                            </SettingsBadge>
                            {release.activatedAt ? (
                              <p className="text-xs text-[#637786]">
                                Activated {formatDateTime(release.activatedAt)}
                              </p>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-[#637786]">
                          <div className="space-y-1">
                            <p>{release.originalFileName ?? release.downloadFileName}</p>
                            <p className="text-xs">{formatBytes(release.byteSize)}</p>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleDownload(release)}
                              className="btn btn-sm btn-primary btn-icon"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Download
                            </button>
                            {canWrite && !release.isActive ? (
                              <button
                                type="button"
                                onClick={() => void handleActivate(release)}
                                disabled={isActivatingId === release.id}
                                className="btn btn-sm btn-primary"
                              >
                                {isActivatingId === release.id ? 'Activating...' : 'Set Active'}
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </WmsCompactPanel>
          ) : null}
        </div>
      )}

      <WmsStoxReleaseFormModal
        open={isModalOpen}
        isSubmitting={isSubmitting}
        error={modalError}
        onClose={() => {
          if (isSubmitting) {
            return;
          }

          setIsModalOpen(false);
          setModalError(null);
        }}
        onCreate={handleUpload}
      />
    </SettingsPageFrame>
  );
}

function ReleaseMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <p className="card-label">{label}</p>
      <p className="card-value mt-1 text-sm">{value}</p>
    </div>
  );
}

function formatBytes(byteSize: number) {
  if (!Number.isFinite(byteSize) || byteSize <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(byteSize) / Math.log(1024)), units.length - 1);
  const value = byteSize / (1024 ** exponent);
  return `${value >= 10 || exponent === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[exponent]}`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null) {
    const maybeResponse = (error as {
      response?: {
        data?: {
          message?: string | string[];
        };
      };
      message?: string;
    }).response?.data?.message;

    if (Array.isArray(maybeResponse)) {
      return maybeResponse.join(', ');
    }

    if (typeof maybeResponse === 'string' && maybeResponse.trim()) {
      return maybeResponse;
    }

    const message = (error as { message?: string }).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return fallback;
}
