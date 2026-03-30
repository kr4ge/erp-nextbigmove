import { useEffect } from 'react';
import { workflowSocket } from '@/lib/socket-client';
import type { TenantSocketPayload } from '../_types/confirmation';

type UseConfirmationRealtimeOptions = {
  onRefresh: () => void;
  pollMs?: number;
};

export function useConfirmationRealtime({ onRefresh, pollMs = 15000 }: UseConfirmationRealtimeOptions) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const tenantId = localStorage.getItem('current_tenant_id');
    if (!tenantId) return;

    let teamId: string | null = null;
    const teamIdsRaw = localStorage.getItem('current_team_ids');
    const singleTeam = localStorage.getItem('current_team_id');
    if (teamIdsRaw) {
      try {
        const parsed = JSON.parse(teamIdsRaw);
        if (Array.isArray(parsed) && parsed.length === 1) {
          teamId = parsed[0];
        }
      } catch {
        // ignore invalid JSON
      }
    } else if (singleTeam && singleTeam !== 'ALL_TEAMS') {
      teamId = singleTeam;
    }

    const socket = workflowSocket.connect();
    socket.emit('subscribe:tenant', { tenantId, teamId });

    const handler = (payload: TenantSocketPayload) => {
      if (!payload || payload.tenantId !== tenantId) return;
      if (teamId && payload.teamId && payload.teamId !== teamId) return;
      onRefresh();
    };

    socket.on('orders:confirmation:updated', handler);
    socket.on('marketing:updated', handler);

    return () => {
      socket.off('orders:confirmation:updated', handler);
      socket.off('marketing:updated', handler);
    };
  }, [onRefresh]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        onRefresh();
      }
    }, pollMs);

    return () => clearInterval(interval);
  }, [onRefresh, pollMs]);
}
