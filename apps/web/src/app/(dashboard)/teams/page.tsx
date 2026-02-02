'use client';

import { useEffect, useState } from 'react';
import apiClient from '@/lib/api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SectionCard } from '@/components/ui/section-card';
import { FormInput } from '@/components/ui/form-input';
import { FormTextarea } from '@/components/ui/form-textarea';
import { DataList, DataListItem, DataListContent, DataListActions } from '@/components/ui/data-list';
import { EmptyState } from '@/components/ui/emptystate';
import { Users } from 'lucide-react';

type Team = {
  id: string;
  name: string;
  description?: string | null;
  status?: string;
  createdAt?: string;
};

type User = {
  role?: string;
};

export default function TeamsPage() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
        // Allow manage/delete if role includes team.manage or team.delete
        const hasPermission = permissions.includes('team.manage') || permissions.includes('team.delete');
        setCanManage(hasPermission);
      } catch (error) {
        setCanManage(false);
      } finally {
        setIsCheckingPermissions(false);
      }
    };

    checkPermissions();
  }, [isReady, user]);

  const { data: teams, isLoading, isError } = useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: async () => {
      const res = await apiClient.get('/teams');
      return res.data;
    },
    enabled: canManage && !isCheckingPermissions,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: { name: string; description?: string }) => {
      await apiClient.post('/teams', payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['teams'] });
      setName('');
      setDescription('');
      setEditingTeam(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; name: string; description?: string }) => {
      await apiClient.patch(`/teams/${payload.id}`, { name: payload.name, description: payload.description });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['teams'] });
      setName('');
      setDescription('');
      setEditingTeam(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (teamId: string) => {
      await apiClient.delete(`/teams/${teamId}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['teams'] });
      setDeleteError(null);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Failed to delete team';
      setDeleteError(msg);
    },
  });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [teamToDelete, setTeamToDelete] = useState<string | null>(null);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);

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
        <Card className="py-12 text-center text-[#475569]">
          You don&apos;t have permission to manage teams.
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Existing Teams */}
        <div className="lg:col-span-2">
          <SectionCard title="Existing Teams" noPadding>
            {deleteError && (
              <div className="border-b border-red-200 bg-red-50 px-6 py-3 text-sm text-red-700">
                {deleteError}
              </div>
            )}

            {isLoading && (
              <div className="p-6 text-[#475569]">Loading teams...</div>
            )}

            {isError && (
              <div className="p-6 text-red-600">Failed to load teams.</div>
            )}

            {!isLoading && !isError && teams?.length === 0 && (
              <div className="p-6">
                <EmptyState
                  title="No teams yet"
                  description="Create one to get started."
                  icon={<Users className="h-8 w-8" />}
                />
              </div>
            )}

            {!isLoading && !isError && teams && teams.length > 0 && (
              <DataList>
                {teams.map((team) => (
                  <DataListItem key={team.id}>
                    <DataListContent
                      title={team.name}
                      description={team.description || undefined}
                      meta={`${team.status || 'ACTIVE'} · ${team.createdAt ? new Date(team.createdAt).toLocaleString() : ''}`}
                    />
                    <DataListActions>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setEditingTeam(team);
                          setName(team.name);
                          setDescription(team.description || '');
                        }}
                        className="mr-2"
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          setTeamToDelete(team.id);
                          deleteMutation.mutate(team.id);
                        }}
                        disabled={deleteMutation.isPending && teamToDelete === team.id}
                        loading={deleteMutation.isPending && teamToDelete === team.id}
                      >
                        {deleteMutation.isPending && teamToDelete === team.id ? 'Deleting...' : 'Delete'}
                      </Button>
                    </DataListActions>
                  </DataListItem>
                ))}
              </DataList>
            )}
          </SectionCard>
        </div>

        {/* Create Team Form */}
        <div>
          <SectionCard title={editingTeam ? 'Edit Team' : 'Create Team'}>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (editingTeam) {
                  updateMutation.mutate({ id: editingTeam.id, name, description });
                } else {
                  createMutation.mutate({ name, description });
                }
              }}
            >
              <FormInput
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />

              <FormTextarea
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />

              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                loading={createMutation.isPending || updateMutation.isPending}
                className="w-full"
              >
                {editingTeam
                  ? updateMutation.isPending
                    ? 'Saving...'
                    : 'Save Changes'
                  : createMutation.isPending
                  ? 'Creating...'
                  : 'Create Team'}
              </Button>

              {(createMutation.isError || updateMutation.isError) && (
                <p className="text-sm text-red-600">Failed to create team.</p>
              )}
              {editingTeam && (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setEditingTeam(null);
                    setName('');
                    setDescription('');
                  }}
                >
                  Cancel
                </Button>
              )}
            </form>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
