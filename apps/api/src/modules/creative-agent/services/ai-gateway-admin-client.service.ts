import { Injectable } from '@nestjs/common';

export type AiProviderKey = 'CLAUDE' | 'CODEX';

export type AiProviderStatus = {
  provider: AiProviderKey;
  available: boolean;
  connected: boolean;
  authMethod: string | null;
  accountLabel: string | null;
  planType: string | null;
  message: string;
  models: Array<{
    id: string;
    label: string;
    supportedEfforts: Array<'LOW' | 'MEDIUM' | 'HIGH' | 'XHIGH' | 'MAX'>;
    defaultEffort: 'LOW' | 'MEDIUM' | 'HIGH' | 'XHIGH' | 'MAX';
  }>;
  usage?: unknown;
};

@Injectable()
export class AiGatewayAdminClientService {
  async providers(tenantId: string): Promise<AiProviderStatus[]> {
    const response = await this.request<{ providers: AiProviderStatus[] }>(tenantId, '/admin/providers');
    return response.providers;
  }

  test(tenantId: string, provider: AiProviderKey) {
    return this.request<{ ok: boolean; message: string }>(tenantId, `/admin/providers/${provider.toLowerCase()}/test`, {
      method: 'POST',
    });
  }

  startLogin(tenantId: string, provider: AiProviderKey) {
    return this.request<{
      loginId: string | null;
      status: 'CONNECTED' | 'WAITING' | 'FAILED';
      verificationUrl?: string;
      userCode?: string;
      expiresAt?: string;
      message: string;
    }>(tenantId, `/admin/providers/${provider.toLowerCase()}/login`, { method: 'POST' });
  }

  loginStatus(tenantId: string, provider: AiProviderKey, loginId: string) {
    return this.request<{
      loginId: string;
      status: 'CONNECTED' | 'WAITING' | 'FAILED';
      verificationUrl?: string;
      userCode?: string;
      expiresAt?: string;
      message: string;
    }>(tenantId, `/admin/providers/${provider.toLowerCase()}/login/${encodeURIComponent(loginId)}`);
  }

  submitLoginCode(tenantId: string, provider: AiProviderKey, loginId: string, code: string) {
    return this.request<{
      loginId: string;
      status: 'CONNECTED' | 'WAITING' | 'FAILED';
      verificationUrl?: string;
      userCode?: string;
      expiresAt?: string;
      message: string;
    }>(tenantId, `/admin/providers/${provider.toLowerCase()}/login/${encodeURIComponent(loginId)}/code`, {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  logout(tenantId: string, provider: AiProviderKey) {
    return this.request<{ ok: boolean; message: string }>(tenantId, `/admin/providers/${provider.toLowerCase()}/logout`, {
      method: 'POST',
    });
  }

  private baseUrl() {
    const explicit = process.env.CLAUDEBOX_HTTP_URL?.trim();
    if (explicit) return explicit.replace(/\/$/, '');
    const websocket = process.env.CLAUDEBOX_WS_URL?.trim();
    if (!websocket) throw new Error('CLAUDEBOX_HTTP_URL or CLAUDEBOX_WS_URL is required');
    const parsed = new URL(websocket);
    parsed.protocol = parsed.protocol === 'wss:' ? 'https:' : 'http:';
    parsed.pathname = '';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  }

  private async request<T>(tenantId: string, path: string, init: RequestInit = {}): Promise<T> {
    const apiKey = process.env.CLAUDEBOX_API_KEY?.trim();
    if (!apiKey) throw new Error('CLAUDEBOX_API_KEY is required');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(`${this.baseUrl()}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'X-Claudebox-Tenant-Id': tenantId,
          ...(init.headers || {}),
        },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(body?.message || body?.error || `AI gateway returned ${response.status}`));
      }
      return body as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}
