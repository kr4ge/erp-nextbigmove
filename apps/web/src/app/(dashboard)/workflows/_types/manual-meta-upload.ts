export interface WorkflowMetaIntegrationOption {
  id: string;
  name: string;
  teamId?: string | null;
}

export interface WorkflowManualMetaUploadRow {
  accountId: string;
  campaignId: string;
  campaignName: string;
  adsetId: string;
  adsetName?: string;
  adId: string;
  adName: string;
  dateCreated?: string;
  amountSpent: number;
  linkClicks: number;
  clicks: number;
  impressions: number;
  websitePurchases: number;
  reportingStarts: string;
  reportingEnds: string;
}

export interface WorkflowManualMetaUploadResult {
  rowsReceived: number;
  insightsUpserted: number;
  datesProcessed: string[];
  reconcileMarketingCompleted: boolean;
  reconcileSalesCompleted: boolean;
}

export type WorkflowManualMetaUploadStage =
  | 'QUEUED'
  | 'PARSING'
  | 'IMPORTING'
  | 'RECONCILING'
  | 'COMPLETED'
  | 'FAILED';

export interface WorkflowManualMetaUploadJobProgress {
  stage: WorkflowManualMetaUploadStage;
  message: string;
  processedRows: number;
  totalRows: number | null;
  insightsUpserted: number;
  datesProcessed: string[];
  percent: number | null;
  failedReason?: string | null;
}

export interface WorkflowManualMetaUploadJobStatus {
  jobId: string;
  state: string;
  progress: WorkflowManualMetaUploadJobProgress;
  failedReason: string | null;
  result: WorkflowManualMetaUploadResult | null;
  createdAt: string | null;
  processedAt: string | null;
  finishedAt: string | null;
}
