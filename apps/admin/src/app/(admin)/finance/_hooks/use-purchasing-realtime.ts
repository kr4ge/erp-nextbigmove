'use client';

import { useEffect, useRef } from 'react';
import { workflowSocket } from '@/lib/socket-client';

type PurchasingRealtimePayload = {
  tenantId?: string;
  batchId?: string;
};

type UsePurchasingRealtimeOptions = {
  enabled?: boolean;
  tenantId?: string | null;
  onUpdate: (payload: PurchasingRealtimePayload) => void;
};

export function usePurchasingRealtime({
  enabled = true,
  tenantId,
  onUpdate,
}: UsePurchasingRealtimeOptions) {
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

    const socket = workflowSocket.connect();
    socket.emit('subscribe:tenant', { tenantId: scopedTenantId, teamId: null });

    const handler = (payload: PurchasingRealtimePayload) => {
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
