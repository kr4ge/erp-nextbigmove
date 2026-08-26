import apiClient from '@/lib/api-client';
import type { CreateStrategyEntryInput, StrategyEntry, StrategyLogResponse } from '../_types/creative-strategy';

function apiError(error: unknown, fallback: string): Error {
  const maybe = error as { response?: { data?: { message?: string } }; message?: string };
  return new Error(maybe?.response?.data?.message || maybe?.message || fallback);
}

export async function fetchStrategyLog(): Promise<StrategyLogResponse> {
  try { return (await apiClient.get<StrategyLogResponse>('/creative-agent/strategy')).data; }
  catch (error) { throw apiError(error, 'Unable to load the Strategy Log.'); }
}

export async function createStrategyEntry(input: CreateStrategyEntryInput): Promise<StrategyEntry> {
  const payload = {
    date: input.date,
    title: input.title,
    tag: input.tag,
    description: input.description || undefined,
    creativeCode: input.creativeCode || undefined,
  };
  try { return (await apiClient.post<StrategyEntry>('/creative-agent/strategy', payload)).data; }
  catch (error) { throw apiError(error, 'Could not save this entry.'); }
}

export async function recordStrategyResult(id: string, result: string): Promise<StrategyEntry> {
  try { return (await apiClient.patch<StrategyEntry>(`/creative-agent/strategy/${id}/result`, { result })).data; }
  catch (error) { throw apiError(error, 'Could not save the result.'); }
}

export async function deleteStrategyEntry(id: string): Promise<void> {
  try { await apiClient.delete(`/creative-agent/strategy/${id}`); }
  catch (error) { throw apiError(error, 'Could not delete this entry.'); }
}
