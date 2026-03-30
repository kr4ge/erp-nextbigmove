'use client';

import { create } from 'zustand';

interface ExecutionEvent {
  timestamp: string;
  event: string;
  data: unknown;
}

interface ExecutionState {
  status?: string;
  progress?: { current: number; total: number };
  activeDay?: number;
  totalDays?: number;
  currentDate?: string;
  dayProgress?: { completedDays: number; totalDays: number };
  metaFetched?: number;
  posFetched?: number;
  metaProcessed?: number;
  posProcessed?: number;
  metaTotal?: number;
  posTotal?: number;
  events?: ExecutionEvent[];
  isLive?: boolean;
}

interface ExecutionStore {
  executions: Record<string, ExecutionState>;
  setExecution: (executionId: string, data: Partial<ExecutionState>) => void;
  addEvent: (executionId: string, event: ExecutionEvent) => void;
  clearExecution: (executionId: string) => void;
}

export const useExecutionStore = create<ExecutionStore>((set) => ({
  executions: {},
  setExecution: (executionId, data) =>
    set((state) => ({
      executions: {
        ...state.executions,
        [executionId]: { ...state.executions[executionId], ...data },
      },
    })),
  addEvent: (executionId, event) =>
    set((state) => ({
      executions: {
        ...state.executions,
        [executionId]: {
          ...state.executions[executionId],
          events: [...(state.executions[executionId]?.events || []), event],
        },
      },
    })),
  clearExecution: (executionId) =>
    set((state) => {
      const rest = { ...state.executions };
      delete rest[executionId];
      return { executions: rest };
    }),
}));
