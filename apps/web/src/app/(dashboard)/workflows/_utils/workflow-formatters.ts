import type { WorkflowItem } from '../_types/workflow';

export function getDateRangeLabel(workflow: WorkflowItem) {
  const dateRange =
    workflow.config?.dateRange ||
    workflow.config?.sources?.meta?.dateRange ||
    workflow.config?.sources?.pos?.dateRange;

  if (!dateRange) return 'Not configured';

  switch (dateRange.type) {
    case 'rolling':
      return `Yesterday (Rolling, offset ${dateRange.offsetDays ?? 0})`;
    case 'relative':
      return `Last ${dateRange.days} days (Relative)`;
    case 'absolute':
      return `${dateRange.since} to ${dateRange.until} (Absolute)`;
    default:
      return 'Unknown';
  }
}

export const getSelectedTeamIds = () => {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem('current_team_ids');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((teamId) => typeof teamId === 'string' && teamId.length > 0);
      }
    } catch {
      // ignore invalid storage value
    }
  }

  const single = localStorage.getItem('current_team_id');
  return single && single !== 'ALL_TEAMS' ? [single] : [];
};
