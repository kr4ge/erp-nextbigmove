export const WORKFLOW_QUEUE = 'workflow-execution';
export const MANUAL_META_UPLOAD_QUEUE = 'manual-meta-upload';
export const MANUAL_META_UPLOAD_JOB = 'manual-meta-upload.process';

export interface WorkflowJobData {
  executionId: string;
  tenantId: string;
  workflowId: string;
}

export interface ManualMetaUploadJobData {
  tenantId: string;
  integrationId?: string;
  allowedTeams: string[];
  isAdmin: boolean;
  filePath: string;
  originalFileName: string;
}
