import apiClient from '@/lib/api-client';
import type { WorkflowItem, WorkflowTeam } from '../_types/workflow';

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
};
