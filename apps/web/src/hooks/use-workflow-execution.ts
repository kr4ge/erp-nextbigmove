'use client';

import { useEffect } from 'react';
import { workflowSocket } from '@/lib/socket-client';
import { useExecutionStore } from '@/stores/workflow-execution-store';

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
        isLive: true,
      });
      addEvent(executionId, {
        timestamp: new Date().toISOString(),
        event: 'date_started',
        data,
      });
    });

    socket.on('execution:meta_fetched', (data) => {
      setExecution(executionId, { metaFetched: (execution?.metaFetched || 0) + data.count });
      addEvent(executionId, { timestamp: new Date().toISOString(), event: 'meta_fetched', data });
    });

    socket.on('execution:pos_fetched', (data) => {
      setExecution(executionId, { posFetched: (execution?.posFetched || 0) + data.count });
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

  return execution;
}
