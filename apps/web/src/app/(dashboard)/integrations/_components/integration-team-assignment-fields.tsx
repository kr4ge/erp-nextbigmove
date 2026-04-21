'use client';

import type { TeamOption } from '../_types/integration-management';

interface IntegrationTeamAssignmentFieldsProps {
  teamId: string;
  teams: TeamOption[];
  isAdmin: boolean;
  canShareIntegrations: boolean;
  sharedTeamIds: string[];
  ownerTeamId: string | null;
  onTeamIdChange: (teamId: string) => void;
  onToggleSharedTeam: (teamId: string) => void;
}

export function IntegrationTeamAssignmentFields({
  teamId,
  teams,
  isAdmin,
  canShareIntegrations,
  sharedTeamIds,
  ownerTeamId,
  onTeamIdChange,
  onToggleSharedTeam,
}: IntegrationTeamAssignmentFieldsProps) {
  const shareableTeams = teams.filter((team) => team.id !== ownerTeamId);
  const labelClass = 'form-label';
  const controlClass =
    'mt-2 input';

  return (
    <>
      <div>
        <label className={labelClass}>Team</label>
        <select
          value={teamId || 'ALL_TEAMS'}
          onChange={(e) => onTeamIdChange(e.target.value)}
          disabled={!isAdmin}
          className={controlClass}
        >
          {isAdmin && <option value="ALL_TEAMS">All teams (admin)</option>}
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </div>

      {canShareIntegrations && (
        <div>
          <label className={labelClass}>Share with teams</label>
          <div className="mt-2 space-y-2 rounded-2xl border border-border/60 bg-surface px-4 py-3">
            {shareableTeams.length === 0 ? (
              <p className="text-sm text-slate-500">No other teams available</p>
            ) : (
              shareableTeams.map((team) => (
                <label key={team.id} className="flex items-center gap-2 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 accent-primary focus:ring-orange-500"
                    checked={sharedTeamIds.includes(team.id)}
                    onChange={() => onToggleSharedTeam(team.id)}
                  />
                  <span>{team.name}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}

