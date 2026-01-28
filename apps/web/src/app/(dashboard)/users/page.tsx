'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SectionCard } from '@/components/ui/section-card';
import { FormInput } from '@/components/ui/form-input';
import { FormSelect } from '@/components/ui/form-select';
import { EmptyState } from '@/components/ui/emptystate';
import { Users as UsersIcon } from 'lucide-react';

type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  defaultTeamId?: string | null;
  createdAt?: string;
  userRoleAssignments?: {
    roleId: string;
    teamId: string | null;
    role?: { id: string; name: string; key: string };
  }[];
};

type Team = {
  id: string;
  name: string;
};

type Role = {
  id: string;
  name: string;
  key: string;
  tenantId: string | null;
  isSystem: boolean;
  permissions?: string[];
};

const statusOptions = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'INVITED', label: 'Invited' },
  { value: 'SUSPENDED', label: 'Suspended' },
];

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<{ role?: string } | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const userStr = localStorage.getItem('user');
    if (userStr) {
      setUser(JSON.parse(userStr));
    }
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady || !user) {
      setIsCheckingPermissions(false);
      return;
    }

    // Check permissions by fetching user's effective permissions
    const checkPermissions = async () => {
      setIsCheckingPermissions(true);
      try {
        const response = await apiClient.get('/auth/permissions');
        const permissions = response.data.permissions || [];
        // Check if user has user.manage permission
        const hasPermission = permissions.includes('user.manage');
        setCanManage(hasPermission);
      } catch (error) {
        setCanManage(false);
      } finally {
        setIsCheckingPermissions(false);
      }
    };

    checkPermissions();
  }, [isReady, user]);

  const { data: users, isLoading, isError } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await apiClient.get('/users');
      return res.data;
    },
    enabled: canManage && !isCheckingPermissions,
  });

  const { data: teams } = useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: async () => {
      const res = await apiClient.get('/teams');
      return res.data;
    },
    staleTime: 60_000,
    enabled: canManage && !isCheckingPermissions,
  });

  const { data: roles } = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: async () => {
      const res = await apiClient.get('/roles');
      return res.data;
    },
    staleTime: 60_000,
    enabled: canManage && !isCheckingPermissions,
  });

  const [drafts, setDrafts] = useState<Record<string, { role: string; status: string; defaultTeamId: string; roleId?: string }>>({});
  useEffect(() => {
    if (!users) return;
    const next: Record<string, { role: string; status: string; defaultTeamId: string; roleId?: string }> = {};
    users.forEach((u) => {
      next[u.id] = {
        role: u.role,
        status: u.status,
        defaultTeamId: u.defaultTeamId || '',
        roleId: u.userRoleAssignments?.find((a) => !a.teamId)?.roleId || '',
      };
    });
    setDrafts(next);
  }, [users]);

  const [createForm, setCreateForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'USER',
    teamId: '',
    roleId: '',
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/users', {
        firstName: createForm.firstName,
        lastName: createForm.lastName,
        email: createForm.email,
        password: createForm.password,
        role: createForm.role,
        teamId: createForm.teamId || undefined,
        roleId: createForm.roleId || undefined,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      setCreateForm({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        role: 'USER',
        teamId: '',
        roleId: '',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<User> & { roleId?: string } }) => {
      await apiClient.patch(`/users/${id}`, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/users/${id}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  if (!isReady || isCheckingPermissions) {
    return (
      <Card className="py-12 text-center text-[#475569]">
        Loading...
      </Card>
    );
  }

  if (!canManage) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Users"
          description="Manage users for this tenant."
        />
        <Card className="py-12 text-center text-[#475569]">
          You don&apos;t have permission to manage users.
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Tenant owner and admins can invite, edit, or remove users and set their default team."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Existing Users */}
        <div className="lg:col-span-2">
          <SectionCard title="Existing Users" noPadding>
            {isLoading && (
              <div className="p-6 text-[#475569]">Loading users...</div>
            )}

            {isError && (
              <div className="p-6 text-red-600">Failed to load users.</div>
            )}

            {!isLoading && !isError && users?.length === 0 && (
              <div className="p-6">
                <EmptyState
                  title="No users yet"
                  description="Invite your first teammate."
                  icon={<UsersIcon className="h-8 w-8" />}
                />
              </div>
            )}

            {!isLoading && !isError && users && users.length > 0 && (
              <div className="divide-y divide-[#E2E8F0]">
                {users.map((userItem) => {
                  const draft = drafts[userItem.id] || { role: userItem.role, status: userItem.status, defaultTeamId: userItem.defaultTeamId || '', roleId: '' };
                  const selectedRole = roles?.find((r) => r.id === draft.roleId);
                  const isTenantAdmin = selectedRole?.key === 'TENANT_ADMIN';

                  return (
                    <div key={userItem.id} className="flex flex-col gap-4 px-6 py-4 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-[#0F172A]">
                          {userItem.firstName} {userItem.lastName}
                        </p>
                        <p className="text-sm text-[#475569]">{userItem.email}</p>
                        <p className="mt-1 text-xs text-[#94A3B8]">
                          {userItem.role} · {userItem.status}
                        </p>
                        {userItem.userRoleAssignments && userItem.userRoleAssignments.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {userItem.userRoleAssignments
                              .filter((a) => !a.teamId)
                              .map((a) => (
                                <span
                                  key={`${a.roleId}-${a.teamId || 'tenant'}`}
                                  className="inline-flex items-center rounded-full bg-[#F1F5F9] px-2.5 py-1 text-xs font-medium text-[#475569]"
                                >
                                  {a.role?.name || a.roleId}
                                </span>
                              ))}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <select
                          className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                          value={draft.status}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [userItem.id]: { ...draft, status: e.target.value },
                            }))
                          }
                        >
                          {statusOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>

                        {isTenantAdmin ? (
                          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#94A3B8]">
                            All Teams
                          </div>
                        ) : (
                          <select
                            className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                            value={draft.defaultTeamId}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [userItem.id]: { ...draft, defaultTeamId: e.target.value },
                              }))
                            }
                          >
                            <option value="">No default team</option>
                            {teams?.map((team) => (
                              <option key={team.id} value={team.id}>
                                {team.name}
                              </option>
                            ))}
                          </select>
                        )}

                        <select
                          className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                          value={draft.roleId || ''}
                          onChange={(e) => {
                            const newRoleId = e.target.value;
                            const newSelectedRole = roles?.find((r) => r.id === newRoleId);
                            const newIsTenantAdmin = newSelectedRole?.key === 'TENANT_ADMIN';
                            setDrafts((prev) => ({
                              ...prev,
                              [userItem.id]: {
                                ...draft,
                                roleId: newRoleId,
                                defaultTeamId: newIsTenantAdmin ? '' : draft.defaultTeamId,
                              },
                            }));
                          }}
                        >
                          <option value="">No role</option>
                          {roles?.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name} {r.tenantId ? '' : '(default)'}
                            </option>
                          ))}
                        </select>

                        <Button
                          size="sm"
                          onClick={() =>
                            updateMutation.mutate({
                              id: userItem.id,
                              payload: {
                                status: draft.status,
                                defaultTeamId: draft.defaultTeamId || undefined,
                                roleId: draft.roleId || undefined,
                              },
                            })
                          }
                          disabled={updateMutation.isPending}
                          loading={updateMutation.isPending}
                        >
                          {updateMutation.isPending ? 'Saving...' : 'Save'}
                        </Button>

                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => deleteMutation.mutate(userItem.id)}
                          disabled={deleteMutation.isPending}
                          loading={deleteMutation.isPending}
                        >
                          {deleteMutation.isPending ? 'Removing...' : 'Remove'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Invite User Form */}
        <div>
          <SectionCard title="Invite User">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate();
              }}
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormInput
                  label="First name"
                  value={createForm.firstName}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, firstName: e.target.value }))}
                  required
                />
                <FormInput
                  label="Last name"
                  value={createForm.lastName}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, lastName: e.target.value }))}
                  required
                />
              </div>

              <FormInput
                type="email"
                label="Email"
                value={createForm.email}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
                required
              />

              <FormInput
                type="password"
                label="Password"
                value={createForm.password}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, password: e.target.value }))}
                required
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormSelect
                  label="Role"
                  value={createForm.roleId}
                  onChange={(e) => {
                    const newRoleId = e.target.value;
                    const selectedRole = roles?.find((r) => r.id === newRoleId);
                    const isTenantAdmin = selectedRole?.key === 'TENANT_ADMIN';
                    setCreateForm((prev) => ({
                      ...prev,
                      roleId: newRoleId,
                      teamId: isTenantAdmin ? '' : prev.teamId,
                    }));
                  }}
                  options={roles?.map((r) => ({
                    value: r.id,
                    label: `${r.name}${r.tenantId ? '' : ' (default)'}`,
                  })) || []}
                  placeholder="No role"
                />

                {(() => {
                  const selectedRole = roles?.find((r) => r.id === createForm.roleId);
                  const isTenantAdmin = selectedRole?.key === 'TENANT_ADMIN';
                  return isTenantAdmin ? (
                    <div className="space-y-1.5">
                      <label className="block text-sm font-semibold text-[#0F172A]">
                        Default team
                      </label>
                      <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2 text-sm text-[#94A3B8]">
                        All Teams (Tenant Admin)
                      </div>
                    </div>
                  ) : (
                    <FormSelect
                      label="Default team (optional)"
                      value={createForm.teamId}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, teamId: e.target.value }))}
                      options={teams?.map((team) => ({
                        value: team.id,
                        label: team.name,
                      })) || []}
                      placeholder="No default team"
                    />
                  );
                })()}
              </div>

              <Button
                type="submit"
                disabled={createMutation.isPending}
                loading={createMutation.isPending}
                className="w-full"
              >
                {createMutation.isPending ? 'Creating...' : 'Invite User'}
              </Button>

              {createMutation.isError && (
                <p className="text-sm text-red-600">Failed to create user. Check the details and try again.</p>
              )}
            </form>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
