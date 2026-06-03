'use client';

import { useEffect, useRef } from 'react';
import { workflowSocket } from '@/lib/socket-client';

type StockRequestRealtimePayload = {
  tenantId?: string;
  batchId?: string;
};

type UseStockRequestRealtimeOptions = {
  enabled?: boolean;
  onUpdate: (payload: StockRequestRealtimePayload) => void;
  tenantId?: string | null;
};

export function useStockRequestRealtime({
  enabled = true,
  onUpdate,
  tenantId,
}: UseStockRequestRealtimeOptions) {
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

    const handler = (payload: StockRequestRealtimePayload) => {
      if (!payload || payload.tenantId !== scopedTenantId) {
        return;
      }

      onUpdateRef.current(payload);
    };

    socket.on('stock-requests:updated', handler);

    return () => {
      socket.off('stock-requests:updated', handler);
    };
  }, [enabled, tenantId]);
}
