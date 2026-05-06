'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { readStoredAdminUser, readStoredPermissions, type StoredAdminUser } from '@/lib/admin-session';
import {
  hasAnyAdminPermission,
  WMS_ROLES_READ_PERMISSIONS,
  WMS_ROLES_WRITE_PERMISSIONS,
} from '@/lib/wms-permissions';
import {
  SettingsBadge,
  SettingsNotice,
  SettingsPageFrame,
  SettingsStatCard,
} from '../_components/settings-panels';
import { WmsRoleFormModal } from '../_components/wms-role-form-modal';
import {
  createWmsSettingsRole,
  deleteWmsSettingsRole,
  fetchWmsSettingsRoleOptions,
  fetchWmsSettingsRoles,
  updateWmsSettingsRole,
} from '../_services/settings.service';
import type {
  CreateWmsSettingsRoleInput,
  UpdateWmsSettingsRoleInput,
  WmsSettingsRole,
  WmsSettingsRoleOptions,
  WmsSettingsRolesResponse,
} from '../_types/settings';

type RoleModalState = {
  open: boolean;
  mode: 'create' | 'edit';
  role: WmsSettingsRole | null;
};

export default function SettingsRolesPage() {
  const [user, setUser] = useState<StoredAdminUser | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [data, setData] = useState<WmsSettingsRolesResponse | null>(null);
  const [options, setOptions] = useState<WmsSettingsRoleOptions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modal, setModal] = useState<RoleModalState>({
    open: false,
    mode: 'create',
    role: null,
  });

  useEffect(() => {
    setUser(readStoredAdminUser());
    setPermissions(readStoredPermissions());
    setHasHydrated(true);
  }, []);

  const canReadRoles = useMemo(
    () => hasAnyAdminPermission(user?.role, permissions, WMS_ROLES_READ_PERMISSIONS),
    [permissions, user?.role],
  );
  const canWriteRoles = useMemo(
    () => hasAnyAdminPermission(user?.role, permissions, WMS_ROLES_WRITE_PERMISSIONS),
    [permissions, user?.role],
  );

  const loadRoles = useCallback(async () => {
    const [rolesResponse, optionsResponse] = await Promise.all([
      fetchWmsSettingsRoles(),
      fetchWmsSettingsRoleOptions(),
    ]);
    setData(rolesResponse);
    setOptions(optionsResponse);
  }, []);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    if (!user || !canReadRoles) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    loadRoles()
      .then(() => {
        if (isMounted) {
          setError(null);
        }
      })
      .catch(() => {
        if (isMounted) {
          setError('Unable to load WMS roles.');
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
  }, [canReadRoles, hasHydrated, loadRoles, user]);

  const closeModal = () => {
    setModal({ open: false, mode: 'create', role: null });
    setModalError(null);
  };

  const openCreateModal = () => {
    setModal({ open: true, mode: 'create', role: null });
    setModalError(null);
  };

  const openEditModal = (role: WmsSettingsRole) => {
    setModal({ open: true, mode: 'edit', role });
    setModalError(null);
  };

  const handleCreate = async (input: CreateWmsSettingsRoleInput) => {
    setIsSubmitting(true);
    setModalError(null);
    try {
      await createWmsSettingsRole(input);
      await loadRoles();
      closeModal();
    } catch (error: unknown) {
      setModalError(getErrorMessage(error, 'Unable to create WMS role.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (id: string, input: UpdateWmsSettingsRoleInput) => {
    setIsSubmitting(true);
    setModalError(null);
    try {
      await updateWmsSettingsRole(id, input);
      await loadRoles();
      closeModal();
    } catch (error: unknown) {
      setModalError(getErrorMessage(error, 'Unable to update WMS role.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (role: WmsSettingsRole) => {
    if (!window.confirm(`Delete ${role.name}? This is only allowed when no users use it.`)) {
      return;
    }

    setError(null);
    try {
      await deleteWmsSettingsRole(role.id);
      await loadRoles();
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Unable to delete WMS role.'));
    }
  };

  return (
    <SettingsPageFrame
      eyebrow="WMS Settings"
      title="Roles"
      description="These role definitions are WMS-only. ERP roles and ERP tenant permissions are not mixed into this view."
      actions={
        canWriteRoles ? (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex h-10 items-center rounded-full bg-[#12384b] px-4 text-[13px] font-semibold text-white transition hover:bg-[#0f3040]"
          >
            Create role
          </button>
        ) : null
      }
    >
      {!hasHydrated ? (
        <SettingsNotice title="Loading roles" message="Checking your WMS role permissions." />
      ) : !canReadRoles ? (
        <SettingsNotice
          tone="danger"
          title="Access blocked"
          message="Your WMS role does not include role settings access."
        />
      ) : error ? (
        <SettingsNotice tone="danger" title="Unable to load roles" message={error} />
      ) : isLoading ? (
        <SettingsNotice title="Loading roles" message="Fetching WMS role definitions and permissions." />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <SettingsStatCard label="WMS Roles" value={data?.roles.length ?? 0} tone="blue" />
            <SettingsStatCard label="WMS Permissions" value={data?.permissions.length ?? 0} tone="gold" />
            <SettingsStatCard
              label="Scope"
              value="WMS"
              tone="neutral"
            />
          </div>

          {data?.roles.length ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {data.roles.map((role) => (
                <RoleCard
                  key={role.id}
                  role={role}
                  canWrite={canWriteRoles}
                  onEdit={openEditModal}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          ) : (
            <SettingsNotice title="No WMS roles" message="No WMS role definitions are available in this scope." />
          )}
        </div>
      )}

      <WmsRoleFormModal
        open={modal.open}
        mode={modal.mode}
        role={modal.role}
        options={options}
        isSubmitting={isSubmitting}
        error={modalError}
        onClose={closeModal}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
      />
    </SettingsPageFrame>
  );
}

function RoleCard({
  role,
  canWrite,
  onEdit,
  onDelete,
}: {
  role: WmsSettingsRole;
  canWrite: boolean;
  onEdit: (role: WmsSettingsRole) => void;
  onDelete: (role: WmsSettingsRole) => void;
}) {
  const canMutate = canWrite && !role.isSystem;

  return (
    <article className="rounded-[26px] border border-[#dce4ea] bg-white px-5 py-5 shadow-[0_24px_70px_-50px_rgba(18,56,75,0.45)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#12384b]">{role.name}</h2>
            {role.isSystem ? <SettingsBadge tone="success">System</SettingsBadge> : <SettingsBadge>Custom</SettingsBadge>}
          </div>
          <p className="mt-1 font-mono text-xs text-[#7b8e9c]">{role.key}</p>
          {role.description ? <p className="mt-3 text-sm leading-6 text-[#637786]">{role.description}</p> : null}
        </div>
        <SettingsBadge tone="warning">WMS</SettingsBadge>
      </div>

      {canWrite ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canMutate}
            onClick={() => onEdit(role)}
            className="rounded-full border border-[#d7e0e7] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#12384b] transition hover:bg-[#f8fafb] disabled:cursor-not-allowed disabled:opacity-45"
          >
            Edit
          </button>
          <button
            type="button"
            disabled={!canMutate || role.assignedUserCount > 0}
            onClick={() => onDelete(role)}
            className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Delete
          </button>
        </div>
      ) : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <MiniStat label="Permissions" value={role.permissionCount} />
        <MiniStat label="Users" value={role.assignedUserCount} />
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {role.permissions.slice(0, 10).map((permission) => (
          <SettingsBadge key={permission.key}>{permission.key}</SettingsBadge>
        ))}
        {role.permissions.length > 10 ? (
          <SettingsBadge tone="warning">+{role.permissions.length - 10} more</SettingsBadge>
        ) : null}
      </div>
    </article>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  if (
    typeof error === 'object'
    && error !== null
    && 'response' in error
    && typeof (error as { response?: unknown }).response === 'object'
    && (error as { response?: { data?: unknown } }).response?.data
    && typeof (error as { response?: { data?: { message?: unknown } } }).response?.data?.message === 'string'
  ) {
    return (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? fallback;
  }

  return fallback;
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[16px] border border-[#dce4ea] bg-[#fbfcfc] px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8293a0]">{label}</p>
      <p className="mt-1 text-lg font-semibold text-[#12384b]">{value}</p>
    </div>
  );
}
