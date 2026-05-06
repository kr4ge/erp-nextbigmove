import type { AuthResponse, BootstrapResponse, DeviceIdentity } from '@/src/features/auth/types';
import { apiRequest } from '@/src/shared/services/http';

export function loginRequest(params: {
  email: string;
  password: string;
  device: DeviceIdentity;
}) {
  return apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: {
      email: params.email,
      password: params.password,
    },
    device: params.device,
  });
}

export function refreshSessionRequest(params: {
  refreshToken: string;
  device: DeviceIdentity;
}) {
  return apiRequest<AuthResponse>('/auth/refresh', {
    method: 'POST',
    body: {
      refreshToken: params.refreshToken,
    },
    device: params.device,
  });
}

export function fetchBootstrapRequest(params: {
  accessToken: string;
  device: DeviceIdentity;
  tenantId?: string | null;
}) {
  return apiRequest<BootstrapResponse>('/wms/mobile/bootstrap', {
    method: 'GET',
    token: params.accessToken,
    device: params.device,
    tenantId: params.tenantId,
  });
}

export async function logoutRequest(params: {
  accessToken: string;
  device: DeviceIdentity;
}) {
  try {
    await apiRequest('/auth/logout', {
      method: 'POST',
      token: params.accessToken,
      device: params.device,
    });
  } catch {
    // Logging out should still clear local state if the API call fails.
  }
}
