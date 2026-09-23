import axios from 'axios';
import apiClient from '@/lib/api-client';

export type CreativeStoreTargetValues = {
  hookRatePct: number | null;
  holdRatePct: number | null;
  ctrPct: number | null;
  /** Where an order stops making money. A ceiling, not an ambition. */
  breakevenCpp: number | null;
  /** What a good creative should achieve, comfortably under break-even. */
  cpp: number | null;
  /** Proven headroom: below this, put more budget behind it. */
  scaleCpp: number | null;
  /** Above this the creative loses money faster than it can recover. */
  killCpp: number | null;
  arPct: number | null;
  scaleArPct: number | null;
  killArPct: number | null;
  maxCancellationPct: number | null;
  maxRtsPct: number | null;
  note: string | null;
};

/** What the ERP would derive from the store's own reconciled orders. */
export type DerivedBreakeven = { breakevenCpp: number | null; deliveredOrders: number; days: number };

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

export async function fetchDerivedBreakeven(storeConfigId: string): Promise<DerivedBreakeven> {
  try {
    const { data } = await apiClient.get<DerivedBreakeven>(`/creative-agent/stores/${storeConfigId}/targets/derived`);
    return data;
  } catch {
    // A missing reference figure must never block the form.
    return { breakevenCpp: null, deliveredOrders: 0, days: 90 };
  }
}
