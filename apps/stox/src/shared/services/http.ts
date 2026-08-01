import { API_BASE_URL, STOX_CLIENT_PLATFORM } from '@/src/shared/config/env';
import type { DeviceIdentity } from '@/src/features/auth/types';

type RequestOptions = {
  method?: 'GET' | 'POST';
  token?: string | null;
  body?: unknown;
  device?: DeviceIdentity | null;
  tenantId?: string | null;
  timeoutMs?: number;
  headers?: Record<string, string>;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}) {
  const controller = options.timeoutMs ? new AbortController() : null;
  const timeout = controller
    ? setTimeout(() => controller.abort(), options.timeoutMs)
    : null;
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Platform': STOX_CLIENT_PLATFORM,
        ...(options.device?.id ? { 'X-Device-ID': options.device.id } : {}),
        ...(options.device?.name ? { 'X-Device-Name': options.device.name } : {}),
        ...(options.tenantId ? { 'X-Tenant-ID': options.tenantId } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller?.signal,
    });
  } catch (error) {
    if (controller?.signal.aborted) {
      throw new ApiError('The scan is taking too long. Rescan the same unit safely to check its status.', 408);
    }

    throw error;
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }

  const text = await response.text();
  const payload = text ? tryParseJson(text) : null;

  if (!response.ok) {
    throw new ApiError(readErrorMessage(payload) || `Request failed with ${response.status}`, response.status);
  }

  return payload as T;
}

function tryParseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function readErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const message = (payload as { message?: unknown }).message;
  if (typeof message === 'string') {
    return message;
  }

  if (Array.isArray(message) && typeof message[0] === 'string') {
    return message[0];
  }

  return null;
}
