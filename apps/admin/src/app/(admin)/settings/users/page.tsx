'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { WmsPageHeader } from '../../_components/wms-page-header';
import { WmsSectionCard } from '../../_components/wms-section-card';
import {
  createWmsUser,
  deleteWmsUser,
  fetchWmsRolesForUsers,
  fetchWmsUsers,
  updateWmsUser,
} from './_services/users.service';
import type { WmsUserForm } from './_types/users';

const EMPTY_FORM: WmsUserForm = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  status: 'ACTIVE',
  roleId: '',
};

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : '—';
}

export default function WmsSettingsUsersPage() {
  const queryClient = useQueryClient();
  const usersQuery = useQuery({
    queryKey: ['wms-settings-users'],
    queryFn: fetchWmsUsers,
  });
  const rolesQuery = useQuery({
    queryKey: ['wms-settings-roles-options'],
    queryFn: fetchWmsRolesForUsers,
  });

  const [createForm, setCreateForm] = useState<WmsUserForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<WmsUserForm>(EMPTY_FORM);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => createWmsUser(createForm),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['wms-settings-users'] });
      setCreateForm(EMPTY_FORM);
      setMessage('Operator created.');
      setError(null);
    },
    onError: (mutationError: unknown) => {
      setError(mutationError instanceof Error ? mutationError.message : 'Unable to create operator.');
      setMessage(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<WmsUserForm> }) =>
      updateWmsUser(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['wms-settings-users'] });
      setEditingId(null);
      setEditForm(EMPTY_FORM);
      setMessage('Operator updated.');
      setError(null);
    },
    onError: (mutationError: unknown) => {
      setError(mutationError instanceof Error ? mutationError.message : 'Unable to update operator.');
      setMessage(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWmsUser,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['wms-settings-users'] });
      setMessage('Operator removed.');
      setError(null);
    },
    onError: (mutationError: unknown) => {
      setError(mutationError instanceof Error ? mutationError.message : 'Unable to remove operator.');
      setMessage(null);
    },
  });

  const users = usersQuery.data || [];
  const roles = useMemo(() => rolesQuery.data || [], [rolesQuery.data]);

  return (
    <div className="space-y-6">
      <WmsPageHeader
        title="Users"
        description="Global WMS operators and internal access."
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_360px]">
        <WmsSectionCard
          title="Operator Directory"
          icon={<ShieldCheck className="h-3.5 w-3.5" />}
          metadata={`${users.length} operators`}
        >
          {usersQuery.isLoading ? (
            <div className="py-12 text-center text-sm text-slate-500">Loading operators...</div>
          ) : users.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
              No operators yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <th className="pb-3 pr-6">Operator</th>
                    <th className="pb-3 pr-6">Role</th>
                    <th className="pb-3 pr-6">Status</th>
                    <th className="pb-3 pr-6">Last Login</th>
                    <th className="pb-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((user) => (
                    <tr key={user.id} className="align-top">
                      <td className="py-4 pr-6">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">
                            {[user.firstName, user.lastName].filter(Boolean).join(' ') || user.email}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">{user.email}</p>
                        </div>
                      </td>
                      <td className="py-4 pr-6 text-sm font-medium text-slate-700">
                        {user.role === 'SUPER_ADMIN' ? 'SuperAdmin' : user.assignedRole?.name || '—'}
                      </td>
                      <td className="py-4 pr-6">
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                          {user.status}
                        </span>
                      </td>
                      <td className="py-4 pr-6 text-sm text-slate-500">{formatDate(user.lastLoginAt)}</td>
                      <td className="py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(user.id);
                              setEditForm({
                                firstName: user.firstName || '',
                                lastName: user.lastName || '',
                                email: user.email,
                                password: '',
                                status: user.status as WmsUserForm['status'],
                                roleId: user.assignedRole?.id || '',
                              });
                            }}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:border-orange-200 hover:text-orange-700"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                            Edit
                          </button>
                          {user.role !== 'SUPER_ADMIN' ? (
                            <button
                              type="button"
                              onClick={() => deleteMutation.mutate(user.id)}
                              className="inline-flex items-center gap-2 rounded-full border border-rose-200 px-3 py-1.5 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </WmsSectionCard>

        <div className="space-y-6">
          <WmsSectionCard title="Create" icon={<Plus className="h-3.5 w-3.5" />}>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  placeholder="First name"
                  value={createForm.firstName}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, firstName: event.target.value }))}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                />
                <input
                  placeholder="Last name"
                  value={createForm.lastName}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, lastName: event.target.value }))}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                />
              </div>
              <input
                placeholder="Email"
                value={createForm.email}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, email: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
              />
              <input
                placeholder="Password"
                type="password"
                value={createForm.password}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, password: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <select
                  value={createForm.roleId}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, roleId: event.target.value }))}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                >
                  <option value="">Select role</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
                <select
                  value={createForm.status}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      status: event.target.value as WmsUserForm['status'],
                    }))
                  }
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INVITED">Invited</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="SUSPENDED">Suspended</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {createMutation.isPending ? 'Creating...' : 'Create Operator'}
              </button>
            </div>
          </WmsSectionCard>

          {editingId ? (
            <WmsSectionCard title="Edit" icon={<MoreHorizontal className="h-3.5 w-3.5" />}>
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <input
                    placeholder="First name"
                    value={editForm.firstName}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, firstName: event.target.value }))}
                    className="rounded-2xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                  />
                  <input
                    placeholder="Last name"
                    value={editForm.lastName}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, lastName: event.target.value }))}
                    className="rounded-2xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                  />
                </div>
                <input
                  placeholder="Email"
                  value={editForm.email}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, email: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                />
                <input
                  placeholder="New password"
                  type="password"
                  value={editForm.password}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, password: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <select
                    value={editForm.roleId}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, roleId: event.target.value }))}
                    className="rounded-2xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                  >
                    <option value="">Select role</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={editForm.status}
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        status: event.target.value as WmsUserForm['status'],
                      }))
                    }
                    className="rounded-2xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INVITED">Invited</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="SUSPENDED">Suspended</option>
                  </select>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => updateMutation.mutate({ id: editingId, payload: editForm })}
                    disabled={updateMutation.isPending}
                    className="inline-flex flex-1 items-center justify-center rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {updateMutation.isPending ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setEditForm(EMPTY_FORM);
                    }}
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
