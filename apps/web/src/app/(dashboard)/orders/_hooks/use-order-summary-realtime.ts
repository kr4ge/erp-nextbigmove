'use client';

import { useEffect, useRef } from 'react';
import { workflowSocket } from '@/lib/socket-client';

type OrderSummaryRealtimePayload = {
  tenantId?: string;
};

type UseOrderSummaryRealtimeOptions = {
  enabled?: boolean;
  onUpdate: (payload: OrderSummaryRealtimePayload) => void;
  tenantId?: string | null;
};

export function useOrderSummaryRealtime({
  enabled = true,
  onUpdate,
  tenantId,
}: UseOrderSummaryRealtimeOptions) {
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return;
    }

    const scopedTenantId = tenantId ?? localStorage.getItem('current_tenant_id');
    if (!scopedTenantId) {
      return;
    }

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
        // Ignore malformed local storage payloads.
      }
    } else if (singleTeam && singleTeam !== 'ALL_TEAMS') {
      teamId = singleTeam;
    }

    const socket = workflowSocket.connect();
    socket.emit('subscribe:tenant', { tenantId: scopedTenantId, teamId });

    const handler = (payload: OrderSummaryRealtimePayload) => {
      if (!payload || payload.tenantId !== scopedTenantId) {
        return;
      }

      onUpdateRef.current(payload);
    };

    socket.on('orders:summary:aging:updated', handler);

    return () => {
      socket.off('orders:summary:aging:updated', handler);
    };
  }, [enabled, tenantId]);
}
