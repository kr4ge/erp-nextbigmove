import { useEffect, useRef } from 'react';
import { workflowSocket } from '@/lib/socket-client';

type WorkflowTenantPayload = {
  tenantId?: string;
  teamId?: string | null;
};

function resolveTenantScope() {
  if (typeof window === 'undefined') {
    return { tenantId: null as string | null, teamId: null as string | null };
  }

  const tenantId = localStorage.getItem('current_tenant_id');
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
      // ignore parse errors from malformed local storage payloads
    }
  } else if (singleTeam && singleTeam !== 'ALL_TEAMS') {
    teamId = singleTeam;
  }

  return { tenantId, teamId };
}

function parseWorkflowPayload(value: unknown): WorkflowTenantPayload | null {
  if (!value || typeof value !== 'object') return null;
  return value as WorkflowTenantPayload;
}

export function useWorkflowTenantEvent(
  eventName: string,
  onEvent: (payload: WorkflowTenantPayload) => void,
) {
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    const { tenantId, teamId } = resolveTenantScope();
    if (!tenantId) return;

    const socket = workflowSocket.connect();
    socket.emit('subscribe:tenant', { tenantId, teamId });

    const handler = (rawPayload: unknown) => {
      const payload = parseWorkflowPayload(rawPayload);
      if (!payload || payload.tenantId !== tenantId) return;
      if (teamId && payload.teamId && payload.teamId !== teamId) return;
      onEventRef.current(payload);
    };

    socket.on(eventName, handler);
    return () => {
      socket.off(eventName, handler);
    };
  }, [eventName]);
}
