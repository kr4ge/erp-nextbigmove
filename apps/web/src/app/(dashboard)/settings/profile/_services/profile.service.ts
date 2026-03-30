import apiClient from '@/lib/api-client';
import type { Profile } from '../_types/profile';

interface MyRoleResponse {
  roles?: Array<{
    name?: string;
    key?: string;
  }>;
}

interface TeamLike {
  id: string;
  name?: string;
}

export const profileService = {
  async fetchMe() {
    const response = await apiClient.get('/auth/me');
    const payload = response.data as { user?: Profile } | Profile;
    return ('user' in payload ? payload.user : payload) as Profile | null;
  },

  async fetchRoleNames() {
    const response = await apiClient.get<MyRoleResponse>('/auth/my-role');
    const roles = Array.isArray(response?.data?.roles) ? response.data.roles : [];
    return roles
      .map((role) => role.name || role.key)
      .filter((value): value is string => Boolean(value));
  },

  async fetchMyTeams() {
    const response = await apiClient.get<TeamLike[]>('/teams/my-teams');
    return Array.isArray(response.data) ? response.data : [];
  },

  async updateProfile(payload: Record<string, unknown>) {
    const response = await apiClient.patch('/auth/profile', payload);
    const body = response.data as { user?: Profile };
    return body.user || null;
  },
};
