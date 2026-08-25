import axios from 'axios';
import apiClient from '@/lib/api-client';
import type { CreativeAssetComment, CreativeAssetsParams, CreativeAssetsResponse } from '../_types/creative-assets';

function apiError(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    return Array.isArray(message) ? message.join(', ') : message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

export async function fetchCreativeAssets(params: CreativeAssetsParams) {
  try { return (await apiClient.get<CreativeAssetsResponse>('/creative-agent/assets', { params })).data; }
  catch (error) { throw new Error(apiError(error, 'Unable to load Creative Assets.')); }
}

export async function fetchCreativeAssetComments(creativeId: string) {
  try { return (await apiClient.get<CreativeAssetComment[]>(`/creative-agent/creatives/${creativeId}/comments`)).data; }
  catch (error) { throw new Error(apiError(error, 'Unable to load creative feedback.')); }
}

export async function addCreativeAssetComment(creativeId: string, message: string) {
  try { return (await apiClient.post<CreativeAssetComment>(`/creative-agent/creatives/${creativeId}/comments`, { message })).data; }
  catch (error) { throw new Error(apiError(error, 'Unable to save feedback.')); }
}
