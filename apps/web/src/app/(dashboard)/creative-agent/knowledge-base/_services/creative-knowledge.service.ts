import axios from 'axios';
import apiClient from '@/lib/api-client';
import type {
  EnrollmentReview,
  GateCalibration,
  KnowledgeCoverage,
  KnowledgeEntry,
  KnowledgeEntryDetail,
  KnowledgeLabel,
} from '../_types/creative-knowledge';

function knowledgeError(error: unknown, fallback: string): Error {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    return new Error(Array.isArray(message) ? message.join(', ') : message || fallback);
  }
  return error instanceof Error ? error : new Error(fallback);
}

export async function fetchKnowledgeEntries(params: {
  storeId?: string;
  label?: KnowledgeLabel;
  includeRetired?: boolean;
  take?: number;
  skip?: number;
}): Promise<{ total: number; items: KnowledgeEntry[] }> {
  try {
    const { data } = await apiClient.get<{ total: number; items: KnowledgeEntry[] }>(
      '/creative-agent/knowledge/entries',
      { params },
    );
    return data;
  } catch (error) {
    throw knowledgeError(error, 'Unable to load the knowledge base.');
  }
}

export async function fetchKnowledgeEntry(id: string): Promise<KnowledgeEntryDetail> {
  try {
    const { data } = await apiClient.get<KnowledgeEntryDetail>(`/creative-agent/knowledge/entries/${id}`);
    return data;
  } catch (error) {
    throw knowledgeError(error, 'Unable to load that knowledge entry.');
  }
}

export async function fetchKnowledgeCoverage(storeId?: string): Promise<KnowledgeCoverage[]> {
  try {
    const { data } = await apiClient.get<KnowledgeCoverage[]>('/creative-agent/knowledge/coverage', {
      params: storeId ? { storeId } : undefined,
    });
    return data;
  } catch (error) {
    throw knowledgeError(error, 'Unable to load knowledge base coverage.');
  }
}

export async function promoteKnowledgeEntry(
  creativeId: string,
  input: { runId?: string; label?: KnowledgeLabel; labelRationale?: string } = {},
): Promise<KnowledgeEntry> {
  try {
    const { data } = await apiClient.post<KnowledgeEntry>(
      `/creative-agent/knowledge/entries/${creativeId}`,
      input,
    );
    return data;
  } catch (error) {
    throw knowledgeError(error, 'Unable to add this creative to the knowledge base.');
  }
}

export async function retireKnowledgeEntry(id: string): Promise<KnowledgeEntry> {
  try {
    const { data } = await apiClient.post<KnowledgeEntry>(`/creative-agent/knowledge/entries/${id}/retire`);
    return data;
  } catch (error) {
    throw knowledgeError(error, 'Unable to retire that entry.');
  }
}

export async function restoreKnowledgeEntry(id: string): Promise<KnowledgeEntry> {
  try {
    const { data } = await apiClient.post<KnowledgeEntry>(`/creative-agent/knowledge/entries/${id}/restore`);
    return data;
  } catch (error) {
    throw knowledgeError(error, 'Unable to restore that entry.');
  }
}

export async function requestEnrollmentReview(input: {
  creativeId: string;
  runId?: string;
  shadow?: boolean;
}): Promise<EnrollmentReview> {
  try {
    const { data } = await apiClient.post<EnrollmentReview>('/creative-agent/knowledge/reviews', input);
    return data;
  } catch (error) {
    throw knowledgeError(error, 'Unable to request a gate review.');
  }
}

export async function fetchEnrollmentReviews(params: {
  storeId?: string;
  creativeId?: string;
  pendingOnly?: boolean;
  take?: number;
} = {}): Promise<EnrollmentReview[]> {
  try {
    const { data } = await apiClient.get<EnrollmentReview[]>('/creative-agent/knowledge/reviews', { params });
    return data;
  } catch (error) {
    throw knowledgeError(error, 'Unable to load gate reviews.');
  }
}

export async function decideEnrollmentReview(
  id: string,
  input: { outcome: 'ACCEPTED' | 'OVERRIDDEN'; notes?: string },
): Promise<EnrollmentReview> {
  try {
    const { data } = await apiClient.post<EnrollmentReview>(
      `/creative-agent/knowledge/reviews/${id}/decide`,
      input,
    );
    return data;
  } catch (error) {
    throw knowledgeError(error, 'Unable to record that decision.');
  }
}

export async function fetchGateCalibration(storeId?: string): Promise<GateCalibration> {
  try {
    const { data } = await apiClient.get<GateCalibration>('/creative-agent/knowledge/reviews/calibration', {
      params: storeId ? { storeId } : undefined,
    });
    return data;
  } catch (error) {
    throw knowledgeError(error, 'Unable to load gate calibration.');
  }
}
