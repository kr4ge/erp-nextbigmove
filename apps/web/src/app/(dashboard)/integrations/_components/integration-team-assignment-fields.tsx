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

  return (
    <>
      <div>
        <label className="block text-sm font-semibold text-[#0F172A]">Team</label>
        <select
          value={teamId || 'ALL_TEAMS'}
          onChange={(e) => onTeamIdChange(e.target.value)}
          disabled={!isAdmin}
          className="mt-2 w-full rounded-xl border border-[#E2E8F0] px-4 py-2 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
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
          <label className="block text-sm font-semibold text-[#0F172A]">Share with teams</label>
          <div className="mt-2 space-y-2 rounded-xl border border-[#E2E8F0] px-4 py-3">
            {shareableTeams.length === 0 ? (
              <p className="text-sm text-slate-500">No other teams available</p>
            ) : (
              shareableTeams.map((team) => (
                <label key={team.id} className="flex items-center gap-2 text-sm text-[#0F172A]">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
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

