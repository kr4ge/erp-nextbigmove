'use client';

import { useEffect } from 'react';
import { workflowSocket } from '@/lib/socket-client';
import { useExecutionStore } from '@/stores/workflow-execution-store';
import apiClient from '@/lib/api-client';

export function useWorkflowExecution(executionId: string) {
  const execution = useExecutionStore((state) => state.executions[executionId]);
  const setExecution = useExecutionStore((state) => state.setExecution);
  const addEvent = useExecutionStore((state) => state.addEvent);

  useEffect(() => {
    const socket = workflowSocket.connect();

    workflowSocket.subscribeToExecution(executionId);

    socket.on('execution:started', (data) => {
      setExecution(executionId, { status: 'RUNNING', isLive: true });
      addEvent(executionId, { timestamp: new Date().toISOString(), event: 'started', data });
    });

    socket.on('execution:progress', (data) => {
      setExecution(executionId, {
        progress: data.progress,
        dayProgress: data.dayProgress,
        totalDays: data.dayProgress?.totalDays ?? execution?.totalDays,
        isLive: true,
      });
      addEvent(executionId, { timestamp: new Date().toISOString(), event: 'progress', data });
    });

    socket.on('execution:date_started', (data) => {
      setExecution(executionId, {
        activeDay: data.day,
        totalDays: data.totalDays ?? execution?.totalDays,
        currentDate: data.date,
        metaProcessed: 0,
        posProcessed: 0,
        metaTotal: data.metaTotal ?? execution?.metaTotal,
        posTotal: data.posTotal ?? execution?.posTotal,
        isLive: true,
      });
      addEvent(executionId, {
        timestamp: new Date().toISOString(),
        event: 'date_started',
        data,
      });
    });

    socket.on('execution:meta_fetched', (data) => {
      const current = useExecutionStore.getState().executions[executionId];
      setExecution(executionId, {
        metaFetched: (current?.metaFetched || 0) + (data.count || 0),
        metaProcessed: (current?.metaProcessed || 0) + (data.processed || 0),
        metaTotal: data.total ?? current?.metaTotal,
      });
      addEvent(executionId, { timestamp: new Date().toISOString(), event: 'meta_fetched', data });
    });

    socket.on('execution:pos_fetched', (data) => {
      const current = useExecutionStore.getState().executions[executionId];
      setExecution(executionId, {
        posFetched: (current?.posFetched || 0) + (data.count || 0),
        posProcessed: (current?.posProcessed || 0) + (data.processed || 0),
        posTotal: data.total ?? current?.posTotal,
      });
      addEvent(executionId, { timestamp: new Date().toISOString(), event: 'pos_fetched', data });
    });

    socket.on('execution:completed', (data) => {
      setExecution(executionId, { status: 'COMPLETED', isLive: false });
      addEvent(executionId, { timestamp: new Date().toISOString(), event: 'completed', data });
    });

    socket.on('execution:failed', (data) => {
      setExecution(executionId, { status: 'FAILED', isLive: false });
      addEvent(executionId, { timestamp: new Date().toISOString(), event: 'failed', data });
    });

    return () => {
      socket.off('execution:started');
      socket.off('execution:progress');
      socket.off('execution:date_started');
      socket.off('execution:meta_fetched');
      socket.off('execution:pos_fetched');
      socket.off('execution:completed');
      socket.off('execution:failed');
      workflowSocket.disconnect();
    };
  }, [executionId, setExecution, addEvent]);

  // Hydrate from API so refresh keeps counts/logs
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const [execRes, logsRes] = await Promise.all([
          apiClient.get(`/workflows/executions/${executionId}`),
          apiClient.get(`/workflows/executions/${executionId}/logs`, {
            params: { limit: 200 },
          }),
        ]);
        if (!isMounted) return;
        const exec = execRes.data;
        setExecution(executionId, {
          status: exec.status,
          totalDays: exec.totalDays,
          metaFetched: exec.metaFetched,
          posFetched: exec.posFetched,
          metaProcessed: exec.metaProcessed,
          posProcessed: exec.posProcessed,
          metaTotal: exec.metaTotal,
          posTotal: exec.posTotal,
          currentDate: exec.currentDate ?? exec.dateRangeSince ?? undefined,
        });
        const logs = Array.isArray(logsRes.data) ? logsRes.data : [];
        if (logs.length > 0) {
          setExecution(executionId, {
            events: logs.map((l: any) => ({
              timestamp: l.createdAt || l.timestamp || new Date().toISOString(),
              event: l.event || 'log',
              data: l.metadata ?? l.message ?? l,
            })),
          });
        }
      } catch {
        // ignore hydrate errors; live socket will still update
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [executionId, setExecution]);

  return execution;
}
