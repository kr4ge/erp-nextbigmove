import { API_BASE_URL, STOX_CLIENT_PLATFORM } from '@/src/shared/config/env';
import type { DeviceIdentity } from '@/src/features/auth/types';

type RequestOptions = {
  method?: 'GET' | 'POST';
  token?: string | null;
  body?: unknown;
  device?: DeviceIdentity | null;
  tenantId?: string | null;
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
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Platform': STOX_CLIENT_PLATFORM,
      ...(options.device?.id ? { 'X-Device-ID': options.device.id } : {}),
      ...(options.device?.name ? { 'X-Device-Name': options.device.name } : {}),
      ...(options.tenantId ? { 'X-Tenant-ID': options.tenantId } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

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
