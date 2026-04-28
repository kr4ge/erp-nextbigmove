import apiClient from '@/lib/api-client';
import type { WorkflowItem, WorkflowTeam } from '../_types/workflow';
import type {
  WorkflowManualMetaUploadJobStatus,
  WorkflowManualMetaUploadResult,
  WorkflowManualMetaUploadRow,
  WorkflowMetaIntegrationOption,
} from '../_types/manual-meta-upload';

function getAuthHeaders() {
  if (typeof window === 'undefined') return undefined;
  const token = localStorage.getItem('access_token');
  if (!token) return undefined;
  return { Authorization: `Bearer ${token}` };
}

function toTeamNameMap(teams: WorkflowTeam[]) {
  const map: Record<string, string> = {};
  teams.forEach((team) => {
    if (team.id && team.name) {
      map[team.id] = team.name;
    }
  });
  return map;
}

function toIntegrationList(payload: unknown): WorkflowMetaIntegrationOption[] {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { data?: unknown })?.data)
    ? ((payload as { data?: unknown[] }).data ?? [])
    : [];

  return list
    .filter((item): item is { id: string; name: string; provider?: string; teamId?: string | null } =>
      Boolean(item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string'),
    )
    .filter((item) => item.provider === 'META_ADS')
    .map((item) => ({
      id: item.id,
      name: item.name,
      teamId: item.teamId ?? null,
    }));
}

export const workflowsService = {
  async fetchWorkflows() {
    const response = await apiClient.get<WorkflowItem[]>('/workflows');
    return Array.isArray(response.data) ? response.data : [];
  },

  async fetchTeamNameMap() {
    const headers = getAuthHeaders();
    if (!headers) return {};

    try {
      const response = await apiClient.get<WorkflowTeam[]>('/teams', { headers });
      return toTeamNameMap(Array.isArray(response.data) ? response.data : []);
    } catch {
      const response = await apiClient.get<WorkflowTeam[]>('/teams/my-teams', { headers });
      return toTeamNameMap(Array.isArray(response.data) ? response.data : []);
    }
  },

  async triggerWorkflow(workflowId: string) {
    await apiClient.post(`/workflows/${workflowId}/trigger`, {});
  },

  async fetchMetaIntegrations() {
    const response = await apiClient.get('/integrations');
    return toIntegrationList(response.data);
  },

  async uploadManualMeta(payload: {
    integrationId?: string;
    rows: WorkflowManualMetaUploadRow[];
  }) {
    const response = await apiClient.post<WorkflowManualMetaUploadResult>(
      '/workflows/meta-upload',
      payload,
    );
    return response.data;
  },

  async uploadManualMetaFile(payload: {
    integrationId?: string;
    file: File;
  }) {
    const form = new FormData();
    form.append('file', payload.file);
    if (payload.integrationId) {
      form.append('integrationId', payload.integrationId);
    }

    const response = await apiClient.post<{ jobId: string }>(
      '/workflows/meta-upload-file',
      form,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    );
    return response.data;
  },

  async fetchManualMetaUploadJobStatus(jobId: string) {
    const response = await apiClient.get<WorkflowManualMetaUploadJobStatus>(
      `/workflows/meta-upload-jobs/${jobId}`,
    );
    return response.data;
  },
};
