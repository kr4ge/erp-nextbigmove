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
