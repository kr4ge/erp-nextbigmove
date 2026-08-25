import apiClient from '@/lib/api-client';
import type { InsightQueueResponse, InsightRun, VariantsResponse } from '../_types/ads-insight';

function apiError(error: unknown, fallback: string): Error {
  const maybe = error as { response?: { data?: { message?: string } }; message?: string };
  return new Error(maybe?.response?.data?.message || maybe?.message || fallback);
}

export async function fetchInsightQueue(): Promise<InsightQueueResponse> {
  try { return (await apiClient.get<InsightQueueResponse>('/creative-agent/insights')).data; }
  catch (error) { throw apiError(error, 'Unable to load Ads Insight.'); }
}

export async function runDiagnose(): Promise<InsightRun> {
  try { return (await apiClient.post<InsightRun>('/creative-agent/insights/diagnose')).data; }
  catch (error) { throw apiError(error, 'Analysis failed.'); }
}

export async function generateVariants(creativeId: string): Promise<VariantsResponse> {
  try { return (await apiClient.post<VariantsResponse>('/creative-agent/insights/variants', { creativeId })).data; }
  catch (error) { throw apiError(error, 'Variant generation failed.'); }
}
