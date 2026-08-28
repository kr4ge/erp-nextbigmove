'use client';

import apiClient from '@/lib/api-client';
import { applySession } from '@/lib/session';

/**
 * Move this session to another tenant the user belongs to. The server reissues
 * the token for that tenant after checking membership; everything downstream
 * — roles, teams, stores — re-resolves from the new tenant on reload.
 */
export async function switchTenant(tenantId: string): Promise<void> {
  const { data } = await apiClient.post(`/auth/switch-tenant/${tenantId}`);
  applySession(data);
  // A tenant switch is never an impersonation.
  window.localStorage.removeItem('impersonating_user');
  window.location.href = '/dashboard';
}
