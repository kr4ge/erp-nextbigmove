import apiClient from '@/lib/api-client';

export const fetchTeamNameMap = async () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  if (!token) return {};

  const response = await apiClient
    .get('/teams/my-teams', { headers: { Authorization: `Bearer ${token}` } })
    .catch(() => apiClient.get('/teams', { headers: { Authorization: `Bearer ${token}` } }));

  const teams = Array.isArray(response?.data) ? response.data : [];
  return teams.reduce<Record<string, string>>((acc, team) => {
    if (
      team &&
      typeof team === 'object' &&
      'id' in team &&
      'name' in team &&
      typeof team.id === 'string' &&
      typeof team.name === 'string'
    ) {
      acc[team.id] = team.name;
    }
    return acc;
  }, {});
};
