import axios from 'axios';
import apiClient from '@/lib/api-client';
import type {
  CreativeOption,
  CreativeOptionField,
  CreativeOptions, CreativeReviewComment, CreativeStatusDimension, CreativeStoreOption, CreateVideoRegistryInput, GetVideoRegistryParams, LinkCreativeAliasInput, UpdateVideoRegistryInput, VideoRegistryItem, VideoRegistryResponse } from '../_types/video-registry';

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
export type StoreEnrollmentItem = { variationId: string; customId: string; name: string };

/** Items the store sells; the customId becomes the ad name's first segment. */
export async function fetchStoreEnrollmentItems(storeId: string): Promise<StoreEnrollmentItem[]> {
  const { data } = await apiClient.get<{ items: StoreEnrollmentItem[] }>(
    `/creative-agent/stores/${storeId}/items`,
  );
  return data.items;
}

export async function createVideoRegistryItem(input: CreateVideoRegistryInput): Promise<VideoRegistryItem> {
  // Explicit whitelist: every field the enroll DTO accepts must be listed here
  // or it never leaves the browser, however correct the form state is.
  const payload = { storeId: input.storeId, variationId: input.variationId, kind: input.kind, title: input.title, submitForApproval: input.submitForApproval, mediaUrl: input.mediaUrl || undefined, format: input.format || undefined, hookType: input.hookType || undefined, angle: input.angle || undefined, remixOfCode: input.remixOfCode || undefined, script: input.script || undefined, notes: input.notes || undefined };
  const enrollsMetaAd = Boolean(input.accountId && input.adId && input.adName);
  try {
    return (enrollsMetaAd
      ? await apiClient.post<VideoRegistryItem>('/creative-agent/unregistered/enroll', { ...payload, requestedCode: input.requestedCode, adName: input.adName, accountId: input.accountId, adId: input.adId })
      : await apiClient.post<VideoRegistryItem>('/creative-agent/creatives', payload)).data;
  } catch (error) { throw apiError(error, 'Unable to enroll this creative.'); }
}
/**
 * The single-creative endpoint returns the DETAIL shape: no `metrics`, because
 * those are computed per date range by the library listing. Typing it as a full
 * VideoRegistryItem once let a caller hand it to a metrics-rendering dialog,
 * which then crashed on `metrics.spend`.
 */
export type VideoRegistryItemDetail = Omit<VideoRegistryItem, 'metrics'>;
export async function fetchVideoRegistryItem(id: string): Promise<VideoRegistryItemDetail> {
  try { return (await apiClient.get<VideoRegistryItemDetail>(`/creative-agent/creatives/${id}`)).data; }
  catch (error) { throw apiError(error, 'Unable to load this creative.'); }
}
export async function updateVideoRegistryItem(id: string, input: UpdateVideoRegistryInput): Promise<VideoRegistryItem> {
  try { return (await apiClient.patch<VideoRegistryItem>(`/creative-agent/creatives/${id}`, input)).data; }
  catch (error) { throw apiError(error, 'Unable to update this creative.'); }
}
export type ThumbnailUploadResult = { thumbnailUrl: string; thumbnailIsVideo: boolean };
/** For a creative with no usable auto-captured cover — pastes an image in directly. */
export async function uploadCreativeThumbnail(id: string, file: File): Promise<ThumbnailUploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  try {
    return (await apiClient.post<ThumbnailUploadResult>(`/creative-agent/creatives/${id}/thumbnail`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })).data;
  } catch (error) { throw apiError(error, 'Unable to upload this thumbnail.'); }
}
export async function removeCreativeThumbnail(id: string): Promise<{ thumbnailUrl: null; thumbnailIsVideo: false }> {
  try { return (await apiClient.delete(`/creative-agent/creatives/${id}/thumbnail`)).data; }
  catch (error) { throw apiError(error, 'Unable to remove this thumbnail.'); }
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
/** For a wrong link: detaches one Meta ad from whichever creative it is linked to. */
export async function unlinkCreativeMetaAd(accountId: string, adId: string) {
  try { return (await apiClient.post('/creative-agent/meta-links/unlink', { accountId, adId })).data; }
  catch (error) { throw apiError(error, 'Unable to unlink this Meta ad.'); }
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

/** Tenant-wide hook types and formats: defaults plus what this tenant added. */
export async function fetchCreativeOptions(): Promise<CreativeOptions> {
  const { data } = await apiClient.get<CreativeOptions>('/creative-agent/options');
  return data;
}

/** Add a value for everyone in the tenant; returns the stored option. */
export async function createCreativeOption(field: CreativeOptionField, label: string): Promise<CreativeOption> {
  try {
    const { data } = await apiClient.post<CreativeOption>('/creative-agent/options', { field, label });
    return data;
  } catch (error) { throw apiError(error, 'Unable to add that option.'); }
}
