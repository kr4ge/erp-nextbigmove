import axios from 'axios';
import apiClient from '@/lib/api-client';
import type {
  CreativeAiPromptConfig,
  CreativeAiPromptKind,
  CreativeAiPromptSetting,
  CreativeAiPromptVersion,
  CreativeAiRun,
  CreativeAiRunsResponse,
  CreativeAiConfig,
  CreativeAiProvider,
  CreativeAiProviderLogin,
  StartCreativeAiRunInput,
  UpdateCreativeAiConfigInput,
  CreativeAiRunFrame,
} from '../_types/creative-ai';

function creativeAiError(error: unknown, fallback: string): Error {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    return new Error(Array.isArray(message) ? message.join(', ') : message || fallback);
  }
  return error instanceof Error ? error : new Error(fallback);
}

export async function startCreativeAiRun(input: StartCreativeAiRunInput): Promise<CreativeAiRun> {
  const form = new FormData();
  form.append('creativeId', input.creativeId);
  form.append('startDate', input.startDate);
  form.append('endDate', input.endDate);
  if (input.provider) form.append('provider', input.provider);
  if (input.model) form.append('model', input.model);
  if (input.effort) form.append('effort', input.effort);
  if (input.video) form.append('video', input.video);

  try {
    const { data } = await apiClient.post<CreativeAiRun>('/creative-agent/ai/runs', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  } catch (error) {
    throw creativeAiError(error, 'Unable to start the video analysis.');
  }
}

export async function fetchCreativeAiConfig(): Promise<CreativeAiConfig> {
  try {
    const { data } = await apiClient.get<CreativeAiConfig>('/creative-agent/ai/config');
    return data;
  } catch (error) {
    throw creativeAiError(error, 'Unable to load AI provider settings.');
  }
}

export async function updateCreativeAiConfig(input: UpdateCreativeAiConfigInput): Promise<CreativeAiConfig['policy']> {
  try {
    const { data } = await apiClient.patch<CreativeAiConfig['policy']>('/creative-agent/ai/config', input);
    return data;
  } catch (error) {
    throw creativeAiError(error, 'Unable to save AI defaults.');
  }
}

export async function fetchCreativeAiPrompts(): Promise<CreativeAiPromptConfig> {
  try {
    const { data } = await apiClient.get<CreativeAiPromptConfig>('/creative-agent/ai/config/prompts');
    return data;
  } catch (error) {
    throw creativeAiError(error, 'Unable to load the analysis prompts.');
  }
}

export async function updateCreativeAiPrompt(kind: CreativeAiPromptKind, input: { body: string; note?: string }): Promise<CreativeAiPromptSetting> {
  try {
    const { data } = await apiClient.patch<CreativeAiPromptSetting>(`/creative-agent/ai/config/prompts/${kind}`, input);
    return data;
  } catch (error) {
    throw creativeAiError(error, 'Unable to save the prompt.');
  }
}

export async function resetCreativeAiPrompt(kind: CreativeAiPromptKind): Promise<CreativeAiPromptSetting> {
  try {
    const { data } = await apiClient.post<CreativeAiPromptSetting>(`/creative-agent/ai/config/prompts/${kind}/reset`);
    return data;
  } catch (error) {
    throw creativeAiError(error, 'Unable to reset the prompt.');
  }
}

export async function fetchCreativeAiPromptVersions(kind: CreativeAiPromptKind): Promise<CreativeAiPromptVersion[]> {
  try {
    const { data } = await apiClient.get<CreativeAiPromptVersion[]>(`/creative-agent/ai/config/prompts/${kind}/versions`);
    return data;
  } catch (error) {
    throw creativeAiError(error, 'Unable to load the prompt history.');
  }
}

export async function activateCreativeAiPromptVersion(kind: CreativeAiPromptKind, version: number): Promise<CreativeAiPromptSetting> {
  try {
    const { data } = await apiClient.post<CreativeAiPromptSetting>(`/creative-agent/ai/config/prompts/${kind}/versions/${version}/activate`);
    return data;
  } catch (error) {
    throw creativeAiError(error, 'Unable to switch prompt version.');
  }
}

export async function testCreativeAiProvider(provider: CreativeAiProvider): Promise<{ ok: boolean; message: string }> {
  try {
    const { data } = await apiClient.post<{ ok: boolean; message: string }>(`/creative-agent/ai/providers/${provider.toLowerCase()}/test`);
    return data;
  } catch (error) {
    throw creativeAiError(error, `Unable to test ${provider === 'CLAUDE' ? 'Claude' : 'Codex'}.`);
  }
}

export async function startCreativeAiProviderLogin(provider: CreativeAiProvider): Promise<CreativeAiProviderLogin> {
  try {
    const { data } = await apiClient.post<CreativeAiProviderLogin>(`/creative-agent/ai/providers/${provider.toLowerCase()}/login`);
    return data;
  } catch (error) {
    throw creativeAiError(error, `Unable to start ${provider === 'CLAUDE' ? 'Claude' : 'Codex'} sign-in.`);
  }
}

export async function fetchCreativeAiProviderLogin(
  provider: CreativeAiProvider,
  loginId: string,
): Promise<CreativeAiProviderLogin> {
  try {
    const { data } = await apiClient.get<CreativeAiProviderLogin>(`/creative-agent/ai/providers/${provider.toLowerCase()}/login/${encodeURIComponent(loginId)}`);
    return data;
  } catch (error) {
    throw creativeAiError(error, 'Unable to check sign-in progress.');
  }
}

export async function submitCreativeAiProviderLoginCode(
  provider: CreativeAiProvider,
  loginId: string,
  code: string,
): Promise<CreativeAiProviderLogin> {
  try {
    const { data } = await apiClient.post<CreativeAiProviderLogin>(`/creative-agent/ai/providers/${provider.toLowerCase()}/login/${encodeURIComponent(loginId)}/code`, { code });
    return data;
  } catch (error) {
    throw creativeAiError(error, 'Unable to submit the authorization code.');
  }
}

export async function logoutCreativeAiProvider(provider: CreativeAiProvider): Promise<{ ok: boolean; message: string }> {
  try {
    const { data } = await apiClient.post<{ ok: boolean; message: string }>(`/creative-agent/ai/providers/${provider.toLowerCase()}/logout`);
    return data;
  } catch (error) {
    throw creativeAiError(error, `Unable to disconnect ${provider === 'CLAUDE' ? 'Claude' : 'Codex'}.`);
  }
}

export async function fetchCreativeAiRuns(creativeId: string): Promise<CreativeAiRunsResponse> {
  try {
    const { data } = await apiClient.get<CreativeAiRunsResponse>('/creative-agent/ai/runs', {
      params: { creativeId, page: 1, pageSize: 10 },
    });
    return data;
  } catch (error) {
    throw creativeAiError(error, 'Unable to load previous video analyses.');
  }
}

export async function fetchCreativeAiRun(runId: string): Promise<CreativeAiRun> {
  try {
    const { data } = await apiClient.get<CreativeAiRun>(`/creative-agent/ai/runs/${runId}`);
    return data;
  } catch (error) {
    throw creativeAiError(error, 'Unable to refresh the video analysis.');
  }
}

export async function cancelCreativeAiRun(runId: string): Promise<CreativeAiRun> {
  try {
    const { data } = await apiClient.post<CreativeAiRun>(`/creative-agent/ai/runs/${runId}/cancel`);
    return data;
  } catch (error) {
    throw creativeAiError(error, 'Unable to cancel the video analysis.');
  }
}

/** The stored scene thumbnails of a finished run, signed for display. */
export async function fetchCreativeAiRunFrames(runId: string): Promise<CreativeAiRunFrame[]> {
  try {
    const { data } = await apiClient.get<CreativeAiRunFrame[]>(`/creative-agent/ai/runs/${runId}/frames`);
    return data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.message;
      throw new Error(Array.isArray(message) ? message.join(', ') : message || 'Unable to load the scene thumbnails.');
    }
    throw error instanceof Error ? error : new Error('Unable to load the scene thumbnails.');
  }
}
