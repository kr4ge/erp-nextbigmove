'use client';

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type ShareTeam = {
  id: string;
  name: string;
};

type AnalyticsShareDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  loading: boolean;
  saving: boolean;
  teams: ShareTeam[];
  currentTeamId: string | null;
  selectedTeamIds: string[];
  onToggleTeam: (teamId: string) => void;
  onSave: () => void;
};

export function AnalyticsShareDialog({
  open,
  onOpenChange,
  title,
  loading,
  saving,
  teams,
  currentTeamId,
  selectedTeamIds,
  onToggleTeam,
  onSave,
}: AnalyticsShareDialogProps) {
  const selectableTeams = teams.filter((team) => team.id !== currentTeamId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-slate-600">Loading teams…</p>
          ) : teams.length === 0 ? (
            <p className="text-sm text-slate-600">No teams available to share.</p>
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {selectableTeams.map((team) => (
                <label key={team.id} className="flex items-center gap-2 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    checked={selectedTeamIds.includes(team.id)}
                    onChange={() => onToggleTeam(team.id)}
                  />
                  <span>{team.name}</span>
                </label>
              ))}
              {selectableTeams.length === 0 ? (
                <p className="text-sm text-slate-600">No other teams to share with.</p>
              ) : null}
            </div>
          )}
        </div>
        <DialogFooter className="mt-4">
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
