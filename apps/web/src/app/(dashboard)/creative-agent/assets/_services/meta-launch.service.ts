import axios from 'axios';
import apiClient from '@/lib/api-client';
import type { DraftBatch, HandoffParams, HandoffResponse, PreflightInput, PreflightResult } from '../_types/meta-launch';

function handoffError(error: unknown, fallback: string): Error {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    return new Error(Array.isArray(message) ? message.join(' ') : message || fallback);
  }
  return error instanceof Error ? error : new Error(fallback);
}

export async function fetchHandoff(params: HandoffParams): Promise<HandoffResponse> {
  try {
    const { data } = await apiClient.get<HandoffResponse>('/creative-agent/handoff', {
      params: {
        storeId: params.storeId || undefined,
        tag: params.tag || undefined,
        sent: params.sent,
        query: params.query.trim() || undefined,
        page: params.page,
        pageSize: params.pageSize,
      },
    });
    return data;
  } catch (error) {
    throw handoffError(error, 'Unable to load the handoff queue.');
  }
}

export async function preflightSend(input: PreflightInput): Promise<PreflightResult> {
  try {
    const { data } = await apiClient.post<PreflightResult>('/creative-agent/handoff/preflight', input);
    return data;
  } catch (error) {
    throw handoffError(error, 'Unable to check this batch.');
  }
}

export async function sendToMeta(input: PreflightInput): Promise<DraftBatch> {
  try {
    const { data } = await apiClient.post<DraftBatch>('/creative-agent/handoff/send', input);
    return data;
  } catch (error) {
    throw handoffError(error, 'Unable to send this batch to Meta.');
  }
}

export async function fetchDraftBatches(params: { storeId?: string; take?: number } = {}): Promise<DraftBatch[]> {
  try {
    const { data } = await apiClient.get<DraftBatch[]>('/creative-agent/handoff/batches', {
      params: { storeId: params.storeId || undefined, take: params.take ?? 20 },
    });
    return data;
  } catch (error) {
    throw handoffError(error, 'Unable to load recent sends.');
  }
}

export async function fetchDraftBatch(id: string): Promise<DraftBatch> {
  try {
    const { data } = await apiClient.get<DraftBatch>(`/creative-agent/handoff/batches/${id}`);
    return data;
  } catch (error) {
    throw handoffError(error, 'Unable to load that send.');
  }
}

export async function retryDraftBatch(id: string): Promise<DraftBatch> {
  try {
    const { data } = await apiClient.post<DraftBatch>(`/creative-agent/handoff/batches/${id}/retry`);
    return data;
  } catch (error) {
    throw handoffError(error, 'Unable to retry that send.');
  }
}
