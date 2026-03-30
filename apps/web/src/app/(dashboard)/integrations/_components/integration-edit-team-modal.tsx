'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IntegrationTeamAssignmentFields } from './integration-team-assignment-fields';
import type { TeamOption } from '../_types/integration-management';

interface IntegrationEditTeamModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  teams: TeamOption[];
  isAdmin: boolean;
  canShareIntegrations: boolean;
  teamId: string;
  sharedTeamIds: string[];
  ownerTeamId: string | null;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onTeamIdChange: (teamId: string) => void;
  onToggleSharedTeam: (teamId: string) => void;
}

export function IntegrationEditTeamModal({
  isOpen,
  isSubmitting,
  teams,
  isAdmin,
  canShareIntegrations,
  teamId,
  sharedTeamIds,
  ownerTeamId,
  onClose,
  onSubmit,
  onTeamIdChange,
  onToggleSharedTeam,
}: IntegrationEditTeamModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase text-[#94A3B8]">Update Integration</p>
            <h2 className="text-xl font-semibold text-[#0F172A]">Assign Team</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} iconLeft={<X className="h-4 w-4" />} />
        </div>

        <form onSubmit={onSubmit} className="space-y-4 px-6 py-4">
          <IntegrationTeamAssignmentFields
            teamId={teamId}
            teams={teams}
            isAdmin={isAdmin}
            canShareIntegrations={canShareIntegrations}
            sharedTeamIds={sharedTeamIds}
            ownerTeamId={ownerTeamId}
            onTeamIdChange={onTeamIdChange}
            onToggleSharedTeam={onToggleSharedTeam}
          />

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="ghost" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} loading={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

