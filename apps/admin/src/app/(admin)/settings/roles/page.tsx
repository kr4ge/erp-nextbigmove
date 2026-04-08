'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { WmsPageHeader } from '../../_components/wms-page-header';
import { WmsSectionCard } from '../../_components/wms-section-card';
import {
  createWmsRole,
  deleteWmsRole,
  fetchWmsPermissions,
  fetchWmsRoles,
  updateWmsRole,
} from './_services/roles.service';

type RoleDraft = {
  name: string;
  key: string;
  description: string;
  permissionKeys: string[];
};

const EMPTY_ROLE: RoleDraft = {
  name: '',
  key: '',
  description: '',
  permissionKeys: [],
};

export default function WmsSettingsRolesPage() {
  const queryClient = useQueryClient();
  const rolesQuery = useQuery({
    queryKey: ['wms-settings-roles'],
    queryFn: fetchWmsRoles,
  });
  const permissionsQuery = useQuery({
    queryKey: ['wms-settings-permissions'],
    queryFn: fetchWmsPermissions,
  });

  const [createForm, setCreateForm] = useState<RoleDraft>(EMPTY_ROLE);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<RoleDraft>(EMPTY_ROLE);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!editingRoleId || !rolesQuery.data) return;
    const role = rolesQuery.data.find((item) => item.id === editingRoleId);
    if (!role) return;
    setEditingDraft({
      name: role.name,
      key: role.key,
      description: role.description || '',
      permissionKeys: role.permissions || [],
    });
  }, [editingRoleId, rolesQuery.data]);

  const createMutation = useMutation({
    mutationFn: () => createWmsRole(createForm),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['wms-settings-roles'] });
      setCreateForm(EMPTY_ROLE);
      setMessage('Role created.');
      setError(null);
    },
    onError: (mutationError: unknown) => {
      setError(mutationError instanceof Error ? mutationError.message : 'Unable to create role.');
      setMessage(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<RoleDraft> }) =>
      updateWmsRole(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['wms-settings-roles'] });
      setEditingRoleId(null);
      setMessage('Role updated.');
      setError(null);
    },
    onError: (mutationError: unknown) => {
      setError(mutationError instanceof Error ? mutationError.message : 'Unable to update role.');
      setMessage(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWmsRole,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['wms-settings-roles'] });
      setMessage('Role removed.');
      setError(null);
    },
    onError: (mutationError: unknown) => {
      setError(mutationError instanceof Error ? mutationError.message : 'Unable to remove role.');
      setMessage(null);
    },
  });

  const togglePermission = (
    target: RoleDraft,
    setter: (next: RoleDraft) => void,
    key: string,
  ) => {
    const exists = target.permissionKeys.includes(key);
    setter({
      ...target,
      permissionKeys: exists
        ? target.permissionKeys.filter((item) => item !== key)
        : [...target.permissionKeys, key],
    });
  };

  const roles = rolesQuery.data || [];
  const permissions = permissionsQuery.data || [];

  return (
    <div className="space-y-6">
      <WmsPageHeader
        title="Roles"
        description="Global WMS role definitions and permissions."
        eyebrow="Settings"
      />

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 shadow-sm">
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_380px]">
        <WmsSectionCard
          title="Role Directory"
          icon={<ShieldCheck className="h-3.5 w-3.5" />}
          metadata={`${roles.length} roles`}
        >
          {rolesQuery.isLoading ? (
            <div className="py-12 text-center text-sm text-slate-500">Loading roles...</div>
          ) : (
            <div className="space-y-4">
              {roles.map((role) => (
                <div key={role.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{role.name}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{role.key}</p>
                      {role.description ? (
                        <p className="mt-2 text-sm text-slate-500">{role.description}</p>
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingRoleId(role.id)}
                        className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:border-orange-200 hover:text-orange-700"
                      >
                        Edit
                      </button>
                      {!role.isSystem ? (
                        <button
                          type="button"
                          onClick={() => deleteMutation.mutate(role.id)}
                          className="inline-flex items-center gap-2 rounded-full border border-rose-200 px-3 py-1.5 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {role.permissions.length > 0 ? (
                      role.permissions.map((permission) => (
                        <span
                          key={permission}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600"
                        >
                          {permission}
                        </span>
                      ))
                    ) : (
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500">
                        No permissions
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </WmsSectionCard>

        <div className="space-y-6">
          <WmsSectionCard title="Create" icon={<Plus className="h-3.5 w-3.5" />}>
            <div className="space-y-4">
              <input
                placeholder="Role name"
                value={createForm.name}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
              />
              <input
                placeholder="ROLE_KEY"
                value={createForm.key}
                onChange={(event) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    key: event.target.value.toUpperCase().replace(/[^A-Z0-9]+/g, '_'),
                  }))
                }
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
              />
              <textarea
                placeholder="Description"
                value={createForm.description}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))}
                className="min-h-[96px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
              />
              <div className="grid max-h-72 gap-2 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
                {permissions.map((permission) => (
                  <label key={permission.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={createForm.permissionKeys.includes(permission.key)}
                      onChange={() => togglePermission(createForm, setCreateForm, permission.key)}
                    />
                    <span>{permission.key}</span>
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {createMutation.isPending ? 'Creating...' : 'Create Role'}
              </button>
            </div>
          </WmsSectionCard>

          {editingRoleId ? (
            <WmsSectionCard title="Edit" icon={<ShieldCheck className="h-3.5 w-3.5" />}>
              <div className="space-y-4">
                <input
                  placeholder="Role name"
                  value={editingDraft.name}
                  onChange={(event) => setEditingDraft((prev) => ({ ...prev, name: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                />
                <input
                  disabled
                  value={editingDraft.key}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 shadow-sm outline-none"
                />
                <textarea
                  placeholder="Description"
                  value={editingDraft.description}
                  onChange={(event) => setEditingDraft((prev) => ({ ...prev, description: event.target.value }))}
                  className="min-h-[96px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                />
                <div className="grid max-h-72 gap-2 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  {permissions.map((permission) => (
                    <label key={permission.id} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={editingDraft.permissionKeys.includes(permission.key)}
                        onChange={() => togglePermission(editingDraft, setEditingDraft, permission.key)}
                      />
                      <span>{permission.key}</span>
                    </label>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      updateMutation.mutate({
                        id: editingRoleId,
                        payload: {
                          name: editingDraft.name,
                          description: editingDraft.description,
                          permissionKeys: editingDraft.permissionKeys,
                        },
                      })
                    }
                    disabled={updateMutation.isPending}
                    className="inline-flex flex-1 items-center justify-center rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {updateMutation.isPending ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingRoleId(null)}
                    className="inline-flex flex-1 items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-orange-200 hover:text-orange-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </WmsSectionCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}
