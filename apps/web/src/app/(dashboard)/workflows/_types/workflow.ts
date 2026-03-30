export interface WorkflowItem {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  schedule?: string;
  config: WorkflowConfig;
  createdAt: string;
  updatedAt: string;
  teamId?: string | null;
}

export interface WorkflowDateRange {
  type?: 'rolling' | 'relative' | 'absolute' | string;
  offsetDays?: number;
  days?: number;
  since?: string;
  until?: string;
}

export interface WorkflowSourceConfig {
  enabled?: boolean;
  dateRange?: WorkflowDateRange;
}

export interface WorkflowConfig {
  dateRange?: WorkflowDateRange;
  sources?: {
    meta?: WorkflowSourceConfig;
    pos?: WorkflowSourceConfig;
  };
  [key: string]: unknown;
}

export interface WorkflowTeam {
  id: string;
  name: string;
}
