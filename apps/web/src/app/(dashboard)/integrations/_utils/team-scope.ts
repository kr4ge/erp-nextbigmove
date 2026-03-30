export const getSelectedTeamIdsFromStorage = () => {
  if (typeof window === 'undefined') return [];

  const raw = localStorage.getItem('current_team_ids');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((teamId): teamId is string => typeof teamId === 'string' && teamId.length > 0);
      }
    } catch {
      // ignore invalid storage payload
    }
  }

  const single = localStorage.getItem('current_team_id');
  return single && single !== 'ALL_TEAMS' ? [single] : [];
};

export const getTeamScopeFromEvent = (event: Event): string[] => {
  const detail = (event as CustomEvent).detail;
  return Array.isArray(detail)
    ? detail.filter((teamId): teamId is string => typeof teamId === 'string' && teamId.length > 0)
    : [];
};
