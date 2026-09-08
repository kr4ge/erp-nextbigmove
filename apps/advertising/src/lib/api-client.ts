import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add auth token and tenant ID
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('access_token');
      const tenantId = localStorage.getItem('current_tenant_id');
      const teamIdsRaw = localStorage.getItem('current_team_ids');
      const singleTeam = localStorage.getItem('current_team_id');
      let activeTeamIds: string[] = [];

      if (teamIdsRaw) {
        try {
          const parsed = JSON.parse(teamIdsRaw);
          if (Array.isArray(parsed)) {
            activeTeamIds = parsed.filter((t) => typeof t === 'string' && t.length > 0);
          }
        } catch {
          // ignore parse errors
        }
      } else if (singleTeam) {
        activeTeamIds = singleTeam === 'ALL_TEAMS' ? [] : [singleTeam];
      }

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      if (tenantId) {
        config.headers['X-Tenant-ID'] = tenantId;
      }

      if (activeTeamIds.length > 0) {
        config.headers['X-Team-ID'] = activeTeamIds.join(',');
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - Handle auth errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('current_tenant_id');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
