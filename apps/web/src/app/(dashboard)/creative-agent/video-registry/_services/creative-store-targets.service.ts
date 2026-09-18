import axios from 'axios';
import apiClient from '@/lib/api-client';

export type CreativeStoreTargetValues = {
  hookRatePct: number | null;
  holdRatePct: number | null;
  ctrPct: number | null;
  cpp: number | null;
  arPct: number | null;
  maxCancellationPct: number | null;
  maxRtsPct: number | null;
  note: string | null;
};

export type CreativeStoreTargets = {
  storeConfigId: string;
  posStoreId: string | null;
  name: string;
  codePrefix?: string;
  targets: (CreativeStoreTargetValues & { updatedAt: string | null; updatedBy: string | null }) | null;
  isSet: boolean;
};

function targetError(error: unknown, fallback: string): Error {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    return new Error(Array.isArray(message) ? message.join(', ') : message || fallback);
  }
  return error instanceof Error ? error : new Error(fallback);
}

export async function fetchAllStoreTargets(): Promise<CreativeStoreTargets[]> {
  try {
    const { data } = await apiClient.get<CreativeStoreTargets[]>('/creative-agent/stores/targets');
    return data;
  } catch (error) {
    throw targetError(error, 'Unable to load store targets.');
  }
}

export async function saveStoreTargets(storeConfigId: string, values: CreativeStoreTargetValues): Promise<CreativeStoreTargets> {
  try {
    const { data } = await apiClient.put<CreativeStoreTargets>(`/creative-agent/stores/${storeConfigId}/targets`, values);
    return data;
  } catch (error) {
    throw targetError(error, 'Unable to save the store targets.');
  }
}
