'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormInput } from '@/components/ui/form-input';
import { FormSelect } from '@/components/ui/form-select';
import { EmptyState } from '@/components/ui/emptystate';
import { DataTable } from '@/components/data-table/data-table';
import { useDataTable } from '@/hooks/use-data-table';
import { type ColumnDef } from '@tanstack/react-table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Plus, Users as UsersIcon } from 'lucide-react';

type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  defaultTeamId?: string | null;
  createdAt?: string;
  lastLoginAt?: string | null;
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

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [createForm, setCreateForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'USER',
    teamId: '',
    roleId: '',
  });
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    status: 'ACTIVE',
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
      setCreateOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<User> & { roleId?: string } }) => {
      await apiClient.patch(`/users/${id}`, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditOpen(false);
      setEditingUser(null);
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

  const teamMap = useMemo(() => {
    return new Map((teams || []).map((team) => [team.id, team.name]));
  }, [teams]);

  const getTenantRole = (userItem: User) =>
    userItem.userRoleAssignments?.find((assignment) => !assignment.teamId)?.role;

  const isTenantAdmin = (userItem: User) => getTenantRole(userItem)?.key === 'TENANT_ADMIN';

  const getRoleLabel = (userItem: User) => getTenantRole(userItem)?.name || userItem.role || '—';

  const getTeamLabel = (userItem: User) => {
    if (isTenantAdmin(userItem)) return 'All Teams';
    if (!userItem.defaultTeamId) return '—';
    return teamMap.get(userItem.defaultTeamId) || '—';
  };

  const openEditModal = (userItem: User) => {
    const tenantAssignment = userItem.userRoleAssignments?.find(
      (assignment) => !assignment.teamId,
    );
    setEditingUser(userItem);
    setEditForm({
      firstName: userItem.firstName || '',
      lastName: userItem.lastName || '',
      email: userItem.email || '',
      status: userItem.status || 'ACTIVE',
      roleId: tenantAssignment?.roleId || '',
      teamId: userItem.defaultTeamId || '',
    });
    setEditOpen(true);
  };

  const formatLastLogin = (value?: string | null) =>
    value ? new Date(value).toLocaleString() : '—';

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      INACTIVE: 'bg-slate-100 text-slate-600 border-slate-200',
      INVITED: 'bg-amber-50 text-amber-700 border-amber-200',
      SUSPENDED: 'bg-rose-50 text-rose-700 border-rose-200',
    };
    return (
      <span
        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}
      >
        {statusOptions.find((opt) => opt.value === status)?.label || status}
      </span>
    );
  };

  const columns = useMemo<ColumnDef<User>[]>(
    () => [
      {
        id: 'user',
        header: 'User',
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-[#0F172A]">
              {row.original.firstName} {row.original.lastName}
            </p>
            <p className="text-xs text-[#64748B]">{row.original.email}</p>
          </div>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => statusBadge(row.original.status),
      },
      {
        id: 'team',
        header: 'Team',
        cell: ({ row }) => (
          <span className="text-sm text-[#0F172A]">{getTeamLabel(row.original)}</span>
        ),
      },
      {
        id: 'role',
        header: 'User Role',
        cell: ({ row }) => (
          <span className="inline-flex items-center rounded-full bg-[#F1F5F9] px-2.5 py-1 text-xs font-semibold text-[#475569]">
            {getRoleLabel(row.original)}
          </span>
        ),
      },
      {
        id: 'last_login',
        header: 'Last Login',
        cell: ({ row }) => (
          <span className="text-sm text-[#475569]">
            {formatLastLogin(row.original.lastLoginAt)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem onClick={() => openEditModal(row.original)}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  const confirmed = window.confirm(
                    `Delete ${row.original.firstName} ${row.original.lastName}?`,
                  );
                  if (confirmed) deleteMutation.mutate(row.original.id);
                }}
                className="text-rose-600 focus:text-rose-600"
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [deleteMutation, teamMap],
  );

  const { table } = useDataTable({
    data: users || [],
    columns,
    initialState: {
      pagination: { pageIndex: 0, pageSize: 10 },
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

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-600">
            All Users: <span className="font-semibold text-slate-900">{users?.length ?? 0}</span>
          </div>
          <Button
            iconLeft={<Plus className="h-4 w-4" />}
            onClick={() => setCreateOpen(true)}
          >
            Add new user
          </Button>
        </div>

        <div className="mt-4">
          {isLoading && (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
              Loading users...
            </div>
          )}

          {isError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-700">
              Failed to load users.
            </div>
          )}

          {!isLoading && !isError && users?.length === 0 && (
            <EmptyState
              title="No users yet"
              description="Invite your first teammate."
              icon={<UsersIcon className="h-8 w-8" />}
            />
          )}

          {!isLoading && !isError && users && users.length > 0 && (
            <DataTable table={table} />
          )}
        </div>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
          </DialogHeader>
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
                  const isAdmin = selectedRole?.key === 'TENANT_ADMIN';
                  setCreateForm((prev) => ({
                    ...prev,
                    roleId: newRoleId,
                    teamId: isAdmin ? '' : prev.teamId,
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
                const isAdmin = selectedRole?.key === 'TENANT_ADMIN';
                return isAdmin ? (
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

            {createMutation.isError && (
              <p className="text-sm text-rose-600">Failed to create user. Check the details and try again.</p>
            )}

            <DialogFooter className="gap-2 sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                loading={createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating...' : 'Create User'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditingUser(null);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!editingUser) return;
              const selectedRole = roles?.find((r) => r.id === editForm.roleId);
              const isAdmin = selectedRole?.key === 'TENANT_ADMIN';
              updateMutation.mutate({
                id: editingUser.id,
                payload: {
                  firstName: editForm.firstName,
                  lastName: editForm.lastName,
                  status: editForm.status,
                  roleId: editForm.roleId || undefined,
                  defaultTeamId: isAdmin ? undefined : editForm.teamId || undefined,
                },
              });
            }}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormInput
                label="First name"
                value={editForm.firstName}
                onChange={(e) => setEditForm((prev) => ({ ...prev, firstName: e.target.value }))}
                required
              />
              <FormInput
                label="Last name"
                value={editForm.lastName}
                onChange={(e) => setEditForm((prev) => ({ ...prev, lastName: e.target.value }))}
                required
              />
            </div>

            <FormInput label="Email" value={editForm.email} readOnly />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormSelect
                label="Status"
                value={editForm.status}
                onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value }))}
                options={statusOptions.map((opt) => ({ value: opt.value, label: opt.label }))}
              />

              <FormSelect
                label="Role"
                value={editForm.roleId}
                onChange={(e) => {
                  const newRoleId = e.target.value;
                  const selectedRole = roles?.find((r) => r.id === newRoleId);
                  const isAdmin = selectedRole?.key === 'TENANT_ADMIN';
                  setEditForm((prev) => ({
                    ...prev,
                    roleId: newRoleId,
                    teamId: isAdmin ? '' : prev.teamId,
                  }));
                }}
                options={roles?.map((r) => ({
                  value: r.id,
                  label: `${r.name}${r.tenantId ? '' : ' (default)'}`,
                })) || []}
                placeholder="No role"
              />
            </div>

            {(() => {
              const selectedRole = roles?.find((r) => r.id === editForm.roleId);
              const isAdmin = selectedRole?.key === 'TENANT_ADMIN';
              return isAdmin ? (
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
                  value={editForm.teamId}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, teamId: e.target.value }))}
                  options={teams?.map((team) => ({
                    value: team.id,
                    label: team.name,
                  })) || []}
                  placeholder="No default team"
                />
              );
            })()}

            {updateMutation.isError && (
              <p className="text-sm text-rose-600">Failed to update user. Try again.</p>
            )}

            <DialogFooter className="gap-2 sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                loading={updateMutation.isPending}
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
