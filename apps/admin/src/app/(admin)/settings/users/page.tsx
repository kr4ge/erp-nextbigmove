'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { readStoredAdminUser, readStoredPermissions, type StoredAdminUser } from '@/lib/admin-session';
import {
  hasAnyAdminPermission,
  WMS_USERS_READ_PERMISSIONS,
  WMS_USERS_WRITE_PERMISSIONS,
} from '@/lib/wms-permissions';
import {
  SettingsBadge,
  SettingsNotice,
  SettingsPageFrame,
  SettingsStatCard,
} from '../_components/settings-panels';
import { WmsUserFormModal } from '../_components/wms-user-form-modal';
import {
  createWmsSettingsUser,
  deactivateWmsSettingsUser,
  fetchWmsSettingsUserOptions,
  fetchWmsSettingsUsers,
  updateWmsSettingsUser,
} from '../_services/settings.service';
import type {
  CreateWmsSettingsUserInput,
  UpdateWmsSettingsUserInput,
  WmsSettingsUser,
  WmsSettingsUserOptions,
  WmsSettingsUsersResponse,
} from '../_types/settings';

type UserModalState = {
  open: boolean;
  mode: 'create' | 'edit';
  user: WmsSettingsUser | null;
};

export default function SettingsUsersPage() {
  const [user, setUser] = useState<StoredAdminUser | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [data, setData] = useState<WmsSettingsUsersResponse | null>(null);
  const [options, setOptions] = useState<WmsSettingsUserOptions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modal, setModal] = useState<UserModalState>({
    open: false,
    mode: 'create',
    user: null,
  });

  useEffect(() => {
    setUser(readStoredAdminUser());
    setPermissions(readStoredPermissions());
    setHasHydrated(true);
  }, []);

  const canReadUsers = useMemo(
    () => hasAnyAdminPermission(user?.role, permissions, WMS_USERS_READ_PERMISSIONS),
    [permissions, user?.role],
  );
  const canWriteUsers = useMemo(
    () => hasAnyAdminPermission(user?.role, permissions, WMS_USERS_WRITE_PERMISSIONS),
    [permissions, user?.role],
  );

  const loadUsers = useCallback(async () => {
    const [usersResponse, optionsResponse] = await Promise.all([
      fetchWmsSettingsUsers(),
      fetchWmsSettingsUserOptions(),
    ]);
    setData(usersResponse);
    setOptions(optionsResponse);
  }, []);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    if (!user || !canReadUsers) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    loadUsers()
      .then(() => {
        if (isMounted) {
          setError(null);
        }
      })
      .catch(() => {
        if (isMounted) {
          setError('Unable to load WMS users.');
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
  }, [canReadUsers, hasHydrated, loadUsers, user]);

  const assignedRoles = data?.users.reduce((total, item) => total + item.wmsRoles.length, 0) ?? 0;

  const refreshOptions = useCallback(async () => {
    try {
      const optionsResponse = await fetchWmsSettingsUserOptions();
      setOptions(optionsResponse);
    } catch {
      setModalError('Unable to refresh WMS role options.');
    }
  }, []);

  const closeModal = () => {
    setModal({ open: false, mode: 'create', user: null });
    setModalError(null);
  };

  const openCreateModal = () => {
    setModal({ open: true, mode: 'create', user: null });
    setModalError(null);
    void refreshOptions();
  };

  const openEditModal = (targetUser: WmsSettingsUser) => {
    setModal({ open: true, mode: 'edit', user: targetUser });
    setModalError(null);
    void refreshOptions();
  };

  const handleCreate = async (input: CreateWmsSettingsUserInput) => {
    setIsSubmitting(true);
    setModalError(null);
    try {
      await createWmsSettingsUser(input);
      await loadUsers();
      closeModal();
    } catch (error: unknown) {
      setModalError(getErrorMessage(error, 'Unable to create WMS staff user.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (id: string, input: UpdateWmsSettingsUserInput) => {
    setIsSubmitting(true);
    setModalError(null);
    try {
      await updateWmsSettingsUser(id, input);
      await loadUsers();
      closeModal();
    } catch (error: unknown) {
      setModalError(getErrorMessage(error, 'Unable to update WMS staff user.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivate = async (targetUser: WmsSettingsUser) => {
    if (!window.confirm(`Deactivate ${targetUser.displayName}? They will no longer be able to log in.`)) {
      return;
    }

    setError(null);
    try {
      await deactivateWmsSettingsUser(targetUser.id);
      await loadUsers();
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Unable to deactivate WMS staff user.'));
    }
  };

  return (
    <SettingsPageFrame
      eyebrow="WMS Settings"
      title="Users"
      description="These are WMS staff accounts. ERP tenant users without WMS workspace roles are intentionally excluded."
      actions={
        canWriteUsers ? (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex h-10 items-center rounded-full bg-[#12384b] px-4 text-[13px] font-semibold text-white transition hover:bg-[#0f3040]"
          >
            Create staff
          </button>
        ) : null
      }
    >
      {!hasHydrated ? (
        <SettingsNotice title="Loading users" message="Checking your WMS user permissions." />
      ) : !canReadUsers ? (
        <SettingsNotice
          tone="danger"
          title="Access blocked"
          message="Your WMS role does not include user settings access."
        />
      ) : error ? (
        <SettingsNotice tone="danger" title="Unable to load users" message={error} />
      ) : isLoading ? (
        <SettingsNotice title="Loading users" message="Fetching WMS staff accounts and role assignments." />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <SettingsStatCard label="WMS Staff" value={data?.users.length ?? 0} tone="blue" />
            <SettingsStatCard label="Role Assignments" value={assignedRoles} tone="gold" />
            <SettingsStatCard
              label="Scope"
              value="WMS"
              tone="neutral"
            />
          </div>

          {data?.users.length ? (
            <div className="overflow-hidden rounded-[26px] border border-[#dce4ea] bg-white shadow-[0_24px_70px_-50px_rgba(18,56,75,0.45)]">
              <div className="overflow-x-auto">
                <table className="min-w-[760px] w-full border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-[#fbfcfc] text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7b8e9c]">
                      <th className="px-5 py-4">Staff</th>
                      <th className="px-5 py-4">WMS Roles</th>
                      <th className="px-5 py-4">Last Login</th>
                      <th className="px-5 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf2f6]">
                    {data.users.map((item) => (
                      <UserRow
                        key={item.id}
                        user={item}
                        canWrite={canWriteUsers}
                        onEdit={openEditModal}
                        onDeactivate={handleDeactivate}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <SettingsNotice
              title="No WMS staff"
              message="No account has a WMS workspace role assignment in this scope yet."
            />
          )}
        </div>
      )}

      <WmsUserFormModal
        open={modal.open}
        mode={modal.mode}
        user={modal.user}
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

function UserRow({
  user,
  canWrite,
  onEdit,
  onDeactivate,
}: {
  user: WmsSettingsUser;
  canWrite: boolean;
  onEdit: (user: WmsSettingsUser) => void;
  onDeactivate: (user: WmsSettingsUser) => void;
}) {
  return (
    <tr className="text-sm text-[#12384b]">
      <td className="px-5 py-4 align-top">
        <p className="font-semibold">{user.displayName}</p>
        <p className="mt-1 text-xs text-[#6f8290]">{user.email}</p>
        {user.employeeId ? <p className="mt-1 text-xs text-[#8a9aa6]">{user.employeeId}</p> : null}
      </td>
      <td className="px-5 py-4 align-top">
        <div className="flex flex-wrap gap-1.5">
          {user.wmsRoles.map((assignment) => (
            <SettingsBadge key={assignment.assignmentId} tone="success">
              {assignment.role.name}
            </SettingsBadge>
          ))}
          {user.directPermissions.length ? (
            <SettingsBadge tone="warning">{user.directPermissions.length} direct</SettingsBadge>
          ) : null}
        </div>
      </td>
      <td className="px-5 py-4 align-top text-[#4f6777]">{formatDateTime(user.lastLoginAt)}</td>
      <td className="px-5 py-4 align-top">
        <SettingsBadge tone={user.status === 'ACTIVE' ? 'success' : 'neutral'}>{user.status}</SettingsBadge>
        {canWrite ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onEdit(user)}
              className="rounded-full border border-[#d7e0e7] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#12384b] transition hover:bg-[#f8fafb]"
            >
              Edit
            </button>
            {user.status !== 'INACTIVE' ? (
              <button
                type="button"
                onClick={() => onDeactivate(user)}
                className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100"
              >
                Deactivate
              </button>
            ) : null}
          </div>
        ) : null}
      </td>
    </tr>
  );
}

function formatDateTime(value: string | null) {
  if (!value) {
    return 'Never';
  }

  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
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
