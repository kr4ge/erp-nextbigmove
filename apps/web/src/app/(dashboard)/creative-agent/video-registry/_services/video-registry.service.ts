import axios from 'axios';
import apiClient from '@/lib/api-client';
import type { CreativeReviewComment, CreativeStatusDimension, CreativeStoreOption, CreateVideoRegistryInput, GetVideoRegistryParams, LinkCreativeAliasInput, UpdateVideoRegistryInput, VideoRegistryItem, VideoRegistryResponse } from '../_types/video-registry';

function apiError(error: unknown, fallback: string): Error {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    return new Error(Array.isArray(message) ? message.join(', ') : message || fallback);
  }
  return error instanceof Error ? error : new Error(fallback);
}

export async function fetchVideoRegistry(params: GetVideoRegistryParams): Promise<VideoRegistryResponse> {
  const query = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== ''),
  );
  try { return (await apiClient.get<VideoRegistryResponse>('/creative-agent/library', { params: query })).data; }
  catch (error) { throw apiError(error, 'Unable to load the video registry.'); }
}
export async function fetchCreativeStores(): Promise<CreativeStoreOption[]> {
  try { return (await apiClient.get<CreativeStoreOption[]>('/creative-agent/stores')).data; }
  catch (error) { throw apiError(error, 'Unable to load POS stores.'); }
}
export async function createVideoRegistryItem(input: CreateVideoRegistryInput): Promise<VideoRegistryItem> {
  const payload = { storeId: input.storeId, kind: input.kind, title: input.title, submitForApproval: input.submitForApproval, mediaUrl: input.mediaUrl || undefined, format: input.format || undefined, hookType: input.hookType || undefined, script: input.script || undefined, notes: input.notes || undefined };
  const enrollsMetaAd = Boolean(input.accountId && input.adId && input.adName);
  try {
    return (enrollsMetaAd
      ? await apiClient.post<VideoRegistryItem>('/creative-agent/unregistered/enroll', { ...payload, requestedCode: input.requestedCode, adName: input.adName, accountId: input.accountId, adId: input.adId })
      : await apiClient.post<VideoRegistryItem>('/creative-agent/creatives', payload)).data;
  } catch (error) { throw apiError(error, 'Unable to enroll this creative.'); }
}
export async function fetchVideoRegistryItem(id: string): Promise<VideoRegistryItem> {
  try { return (await apiClient.get<VideoRegistryItem>(`/creative-agent/creatives/${id}`)).data; }
  catch (error) { throw apiError(error, 'Unable to load this creative.'); }
}
export async function updateVideoRegistryItem(id: string, input: UpdateVideoRegistryInput): Promise<VideoRegistryItem> {
  try { return (await apiClient.patch<VideoRegistryItem>(`/creative-agent/creatives/${id}`, input)).data; }
  catch (error) { throw apiError(error, 'Unable to update this creative.'); }
}
export async function createCreativeAlias(creativeId: string, alias: string) {
  try { return (await apiClient.post(`/creative-agent/creatives/${creativeId}/aliases`, { alias })).data; }
  catch (error) { throw apiError(error, 'Unable to create this alias.'); }
}
export async function linkCreativeAlias(input: LinkCreativeAliasInput) {
  try { return (await apiClient.post('/creative-agent/unregistered/link', { creativeId: input.creativeId, alias: input.alias, accountId: input.accountId, adId: input.adId })).data; }
  catch (error) { throw apiError(error, 'Unable to link this Meta ad.'); }
}
export async function removeCreativeAlias(creativeId: string, aliasId: string) {
  try { return (await apiClient.delete(`/creative-agent/creatives/${creativeId}/aliases/${aliasId}`)).data; }
  catch (error) { throw apiError(error, 'Unable to remove this alias.'); }
}
export async function transitionCreativeStatus(id: string, dimension: CreativeStatusDimension, toStatus: string, reason?: string) {
  try { return (await apiClient.post(`/creative-agent/creatives/${id}/status-transitions`, { dimension, toStatus, reason })).data; }
  catch (error) { throw apiError(error, 'Unable to update the creative status.'); }
}
export async function fetchCreativeEvents(id: string) {
  try { return (await apiClient.get(`/creative-agent/creatives/${id}/events`)).data; }
  catch (error) { throw apiError(error, 'Unable to load creative history.'); }
}
export async function fetchCreativeReviewComments(id: string) {
  try { return (await apiClient.get<CreativeReviewComment[]>(`/creative-agent/creatives/${id}/comments`)).data; }
  catch (error) { throw apiError(error, 'Unable to load creative feedback.'); }
}
