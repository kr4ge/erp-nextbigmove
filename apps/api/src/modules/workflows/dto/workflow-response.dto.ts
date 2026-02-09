export class WorkflowResponseDto {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  enabled: boolean;
  schedule?: string;
  config: any; // JSON config
  teamId?: string | null;
  sharedTeamIds: string[];
  lastRunAt?: Date | null;
  nextRunAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;

  constructor(workflow: any) {
    this.id = workflow.id;
    this.tenantId = workflow.tenantId;
    this.name = workflow.name;
    this.description = workflow.description;
    this.enabled = workflow.enabled;
    this.schedule = workflow.schedule;
    this.config = workflow.config || {};
    this.teamId = workflow.teamId ?? null;
    this.sharedTeamIds = Array.isArray(workflow.sharedTeams)
      ? workflow.sharedTeams.map((st: any) => st.teamId)
      : [];
    this.lastRunAt = workflow.lastRunAt ?? null;
    this.nextRunAt = workflow.nextRunAt ?? null;
    this.createdAt = workflow.createdAt;
    this.updatedAt = workflow.updatedAt;
  }
}

export class WorkflowExecutionResponseDto {
  id: string;
  workflowId: string;
  tenantId: string;
  status: string; // PENDING, RUNNING, COMPLETED, FAILED, CANCELLED
  triggerType: string; // MANUAL, SCHEDULED
  dateRangeSince?: string;
  dateRangeUntil?: string;
  totalDays: number;
  daysProcessed: number;
  metaFetched: number;
  posFetched: number;
  metaProcessed?: number;
  posProcessed?: number;
  metaTotal?: number;
  posTotal?: number;
  currentDate?: string | null;
  errors: any[]; // Array of error objects
  statusLabel?: string;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number; // milliseconds
  createdAt: Date;
  updatedAt: Date;

  constructor(execution: any) {
    this.id = execution.id;
    this.workflowId = execution.workflowId;
    this.tenantId = execution.tenantId;
    this.status = execution.status;
    this.triggerType = execution.triggerType;
    this.dateRangeSince = execution.dateRangeSince;
    this.dateRangeUntil = execution.dateRangeUntil;
    this.totalDays = execution.totalDays;
    this.daysProcessed = execution.daysProcessed;
    this.metaFetched = execution.metaFetched;
    this.posFetched = execution.posFetched;
    this.metaProcessed = execution.metaProcessed;
    this.posProcessed = execution.posProcessed;
    this.metaTotal = execution.metaTotal;
    this.posTotal = execution.posTotal;
    this.currentDate = execution.currentDate ?? null;
    this.errors = execution.errors || [];
    this.statusLabel =
      execution.status === 'COMPLETED' && this.errors.length > 0
        ? 'COMPLETED_WITH_ERRORS'
        : execution.status;
    this.startedAt = execution.startedAt;
    this.completedAt = execution.completedAt;
    this.duration = execution.duration;
    this.createdAt = execution.createdAt;
    this.updatedAt = execution.updatedAt;
  }
}
