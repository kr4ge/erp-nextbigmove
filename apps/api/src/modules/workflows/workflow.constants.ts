export const WORKFLOW_QUEUE = 'workflow-execution';

export interface WorkflowJobData {
  executionId: string;
  tenantId: string;
  workflowId: string;
}
