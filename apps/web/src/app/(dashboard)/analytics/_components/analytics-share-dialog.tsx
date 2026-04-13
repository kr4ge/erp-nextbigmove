'use client';

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

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
      <DialogContent
        className="w-[min(92vw,28rem)] max-w-sm p-4 sm:p-4"
        closeButtonClassName="right-3 top-3 rounded-md p-1.5 opacity-90 hover:bg-slate-100 [&_svg]:h-5 [&_svg]:w-5"
      >
        <div className="space-y-6">
          <DialogHeader className="space-y-1 pr-8">
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            {loading ? (
              <p className="text-sm text-slate-600">Loading teams...</p>
            ) : teams.length === 0 ? (
              <p className="text-sm text-slate-600">No teams available to share.</p>
            ) : (
              <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:rgb(148_163_184_/_0.45)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-400/40">
                {selectableTeams.map((team) => (
                  <label
                    key={team.id}
                    className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-slate-50/55 px-2.5 py-2 text-sm text-slate-800"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 accent-orange-500 checked:border-orange-500 checked:bg-orange-500 focus:ring-2 focus:ring-orange-200"
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

          <DialogFooter className="mt-2 flex-row justify-end gap-2 sm:space-x-0">
            <Button
              onClick={() => onOpenChange(false)}
              variant="outline"
              size="sm"
              className="min-w-[92px]"
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={onSave}
              variant="secondary"
              size="sm"
              className="min-w-[92px] !border !border-orange-200 !bg-orange-50 !text-orange-700 hover:!bg-orange-100 focus:!ring-orange-300"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
