'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SectionCard } from '@/components/ui/section-card';
import { FormInput } from '@/components/ui/form-input';
import { FormTextarea } from '@/components/ui/form-textarea';
import { EmptyState } from '@/components/ui/emptystate';
import { Shield } from 'lucide-react';

type Role = {
  id: string;
  name: string;
  key: string;
  description?: string | null;
  isSystem: boolean;
  tenantId: string | null;
  permissions?: string[];
};

type Permission = {
  id: string;
  key: string;
  description?: string | null;
};

export default function RolesPage() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<{ role?: string } | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { name: string; description: string; permissionKeys: string[] }>>({});
  const [canManage, setCanManage] = useState(false);
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(true);
  const [isReady, setIsReady] = useState(false);

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
        // Check if user has permission.assign permission
        const hasPermission = permissions.includes('permission.assign');
        setCanManage(hasPermission);
      } catch (error) {
        setCanManage(false);
      } finally {
        setIsCheckingPermissions(false);
      }
    };

    checkPermissions();
  }, [isReady, user]);

  const { data: roles, isLoading, isError } = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: async () => {
      const res = await apiClient.get('/roles');
      return res.data;
    },
    enabled: canManage && !isCheckingPermissions,
  });

  useEffect(() => {
    if (!roles) return;
    const next: Record<string, { name: string; description: string; permissionKeys: string[] }> = {};
    roles.forEach((r) => {
      next[r.id] = {
        name: r.name,
        description: r.description || '',
        permissionKeys: r.permissions || [],
      };
    });
    setDrafts(next);
  }, [roles]);

  const { data: permissions } = useQuery<Permission[]>({
    queryKey: ['permissions'],
    queryFn: async () => {
      const res = await apiClient.get('/roles/permissions');
      return res.data;
    },
    enabled: canManage && !isCheckingPermissions,
  });

  const [createForm, setCreateForm] = useState({
    name: '',
    key: '',
    description: '',
    permissionKeys: [] as string[],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/roles', {
        name: createForm.name,
        key: createForm.key,
        description: createForm.description,
        permissionKeys: createForm.permissionKeys,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['roles'] });
      setCreateForm({ name: '', key: '', description: '', permissionKeys: [] });
    },
  });

  const [editing, setEditing] = useState<string | null>(null);
  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<Role> & { permissionKeys?: string[] } }) => {
      const response = await apiClient.patch(`/roles/${id}`, payload);
      return response;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['roles'] });
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/roles/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['roles'] });
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
          title="Roles"
          description="Create and manage roles for this tenant."
        />
        <Card className="py-12 text-center text-[#475569]">
          You don&apos;t have permission to manage roles.
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & Permissions"
        description="Create tenant-specific roles or use defaults; assign permissions granularly."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Existing Roles */}
        <div className="lg:col-span-2">
          <SectionCard title="Existing Roles" noPadding>
            {isLoading && (
              <div className="p-6 text-[#475569]">Loading roles...</div>
            )}

            {isError && (
              <div className="p-6 text-red-600">Failed to load roles.</div>
            )}

            {!isLoading && !isError && roles?.length === 0 && (
              <div className="p-6">
                <EmptyState
                  title="No roles yet"
                  description="Create one to get started."
                  icon={<Shield className="h-8 w-8" />}
                />
              </div>
            )}

            {!isLoading && !isError && roles && roles.length > 0 && (
              <div className="divide-y divide-[#E2E8F0]">
                {roles.map((role) => {
                  const isEditing = editing === role.id;
                  const draft = drafts[role.id] || { name: role.name, description: role.description || '', permissionKeys: role.permissions || [] };

                  return (
                    <div key={role.id} className="space-y-4 px-6 py-4">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                          <p className="font-medium text-[#0F172A]">
                            {role.name}{' '}
                            <span className="text-xs text-[#94A3B8]">
                              {role.tenantId ? '(tenant)' : '(default)'} {role.isSystem ? '· system' : ''}
                            </span>
                          </p>
                          <p className="text-sm text-[#475569]">{role.description}</p>
                          <p className="break-all text-xs text-[#94A3B8]">{role.key}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setEditing(isEditing ? null : role.id)}
                          >
                            {isEditing ? 'Cancel' : 'Edit'}
                          </Button>
                          {!role.isSystem && (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => deleteMutation.mutate(role.id)}
                              disabled={deleteMutation.isPending}
                              loading={deleteMutation.isPending}
                            >
                              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                            </Button>
                          )}
                        </div>
                      </div>

                      {isEditing && (
                        <div className="space-y-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <FormInput
                              label="Name"
                              value={draft.name}
                              onChange={(e) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [role.id]: { ...draft, name: e.target.value },
                                }))
                              }
                            />
                            <FormInput
                              label="Description"
                              value={draft.description}
                              onChange={(e) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [role.id]: { ...draft, description: e.target.value },
                                }))
                              }
                            />
                          </div>

                          <div className="space-y-2">
                            <p className="text-sm font-semibold text-[#0F172A]">Permissions</p>
                            <div className="grid max-h-52 grid-cols-1 gap-2 overflow-auto sm:grid-cols-2 md:grid-cols-3">
                              {permissions?.map((p) => {
                                const checked = draft.permissionKeys.includes(p.key);
                                return (
                                  <label key={p.id} className="flex items-center gap-2 text-sm text-[#0F172A]">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      className="h-4 w-4 rounded border-[#E2E8F0] text-[#2563EB] focus:ring-[#2563EB]"
                                      onChange={() => {
                                        setDrafts((prev) => ({
                                          ...prev,
                                          [role.id]: {
                                            ...draft,
                                            permissionKeys: checked
                                              ? draft.permissionKeys.filter((k) => k !== p.key)
                                              : [...draft.permissionKeys, p.key],
                                          },
                                        }));
                                      }}
                                    />
                                    <span>{p.key}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>

                          <Button
                            onClick={() =>
                              updateMutation.mutate({
                                id: role.id,
                                payload: {
                                  name: draft.name,
                                  description: draft.description,
                                  permissionKeys: draft.permissionKeys,
                                },
                              })
                            }
                            disabled={updateMutation.isPending}
                            loading={updateMutation.isPending}
                          >
                            {updateMutation.isPending ? 'Saving...' : 'Save changes'}
                          </Button>

                          {updateMutation.isError && (
                            <p className="text-sm text-red-600">Failed to update role. Check console for details.</p>
                          )}
                        </div>
                      )}

                      {!isEditing && role.permissions && role.permissions.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {role.permissions.map((perm) => (
                            <span
                              key={perm}
                              className="inline-flex items-center rounded-full bg-[#F1F5F9] px-2.5 py-1 text-xs font-medium text-[#475569]"
                            >
                              {perm}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Create Role Form */}
        <div>
          <SectionCard title="Create Role">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate();
              }}
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormInput
                  label="Name"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
                <FormInput
                  label="Key"
                  value={createForm.key}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, key: e.target.value }))}
                  required
                />
              </div>

              <FormTextarea
                label="Description"
                value={createForm.description}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))}
              />

              <div className="space-y-2">
                <p className="text-sm font-semibold text-[#0F172A]">Permissions</p>
                <div className="grid max-h-56 grid-cols-1 gap-2 overflow-auto rounded-xl border border-[#E2E8F0] p-3 sm:grid-cols-2">
                  {permissions?.map((p) => {
                    const checked = createForm.permissionKeys.includes(p.key);
                    return (
                      <label key={p.id} className="flex items-center gap-2 text-sm text-[#0F172A]">
                        <input
                          type="checkbox"
                          checked={checked}
                          className="h-4 w-4 rounded border-[#E2E8F0] text-[#2563EB] focus:ring-[#2563EB]"
                          onChange={() =>
                            setCreateForm((prev) => ({
                              ...prev,
                              permissionKeys: checked
                                ? prev.permissionKeys.filter((k) => k !== p.key)
                                : [...prev.permissionKeys, p.key],
                            }))
                          }
                        />
                        <span>{p.key}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <Button
                type="submit"
                disabled={createMutation.isPending}
                loading={createMutation.isPending}
                className="w-full"
              >
                {createMutation.isPending ? 'Creating...' : 'Create Role'}
              </Button>

              {createMutation.isError && (
                <p className="text-sm text-red-600">Failed to create role. Check details and try again.</p>
              )}
            </form>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
