'use client';

import { useEffect, useState } from 'react';
import apiClient from '@/lib/api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { AlertBanner, LoadingCard } from '@/components/ui/feedback';
import { FormInput } from '@/components/ui/form-input';
import { FormTextarea } from '@/components/ui/form-textarea';
import { DataList, DataListItem, DataListContent, DataListActions } from '@/components/ui/data-list';
import { EmptyState } from '@/components/ui/emptystate';
import { useToast } from '@/components/ui/toast';
import { ConfirmActionDialog } from '../_components/confirm-action-dialog';
import { PlusCircle, Users } from 'lucide-react';

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

const parseTeamError = (error: unknown, fallback: string) => {
  const err = error as { response?: { data?: { message?: string } }; message?: string };
  return err?.response?.data?.message || err?.message || fallback;
};

export default function TeamsPage() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
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
        const response = await apiClient.get('/auth/permissions', {
          params: { workspace: 'erp' },
        });
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
      addToast('success', 'Team created successfully.');
    },
    onError: (error: unknown) => {
      addToast('error', parseTeamError(error, 'Failed to create team'));
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
      addToast('success', 'Team updated successfully.');
    },
    onError: (error: unknown) => {
      addToast('error', parseTeamError(error, 'Failed to update team'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (teamId: string) => {
      await apiClient.delete(`/teams/${teamId}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['teams'] });
      setDeleteError(null);
      setTeamToDelete(null);
      addToast('success', 'Team deleted successfully.');
    },
    onError: (error: unknown) => {
      const message = parseTeamError(error, 'Failed to delete team');
      setDeleteError(message);
      addToast('error', message);
    },
  });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [teamToDelete, setTeamToDelete] = useState<Team | null>(null);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);

  if (!isReady || isCheckingPermissions) {
    return <LoadingCard label="Loading teams..." />;
  }

  if (!canManage) {
    return (
      <div className="space-y-6">
        <AlertBanner tone="warning" message="You don't have permission to manage teams." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Existing Teams */}
        <div className="lg:col-span-2">
          <section className="panel panel-content overflow-hidden">
            <div className="panel-header">
              <Users className="h-3.5 w-3.5 text-primary" />
              <h2 className="panel-title">Existing Teams</h2>
            </div>
            {deleteError && (
              <div className="px-6 py-3">
                <AlertBanner tone="error" message={deleteError} />
              </div>
            )}

            {isLoading && (
              <div className="p-6">
                <LoadingCard label="Loading teams..." />
              </div>
            )}

            {isError && (
              <div className="p-6">
                <AlertBanner tone="error" message="Failed to load teams." />
              </div>
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
                        onClick={() => setTeamToDelete(team)}
                        disabled={deleteMutation.isPending}
                        loading={deleteMutation.isPending && teamToDelete?.id === team.id}
                      >
                        {deleteMutation.isPending && teamToDelete?.id === team.id ? 'Deleting...' : 'Delete'}
                      </Button>
                    </DataListActions>
                  </DataListItem>
                ))}
              </DataList>
            )}
          </section>
        </div>

        {/* Create Team Form */}
        <div>
          <section className="panel panel-content">
            <div className="panel-header">
              <PlusCircle className="h-3.5 w-3.5 text-primary" />
              <h2 className="panel-title">{editingTeam ? 'Edit Team' : 'Create Team'}</h2>
            </div>
            <div className="p-4">
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
                <AlertBanner tone="error" message="Failed to save team." />
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
            </div>
          </section>
        </div>
      </div>

      <ConfirmActionDialog
        open={Boolean(teamToDelete)}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) {
            setTeamToDelete(null);
          }
        }}
        title="Delete Team"
        description={
          teamToDelete
            ? `Are you sure you want to delete "${teamToDelete.name}"? This action cannot be undone.`
            : 'Are you sure you want to delete this team?'
        }
        confirmLabel="Delete team"
        cancelLabel="Cancel"
        isConfirming={deleteMutation.isPending}
        onConfirm={() => {
          if (!teamToDelete) return;
          deleteMutation.mutate(teamToDelete.id);
        }}
      />
    </div>
  );
}
