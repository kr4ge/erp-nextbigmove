'use client';

/** A tenant this identity may work in, as returned by the API. */
export type Membership = { tenantId: string; name: string; slug: string | null; status: string };

/**
 * Install an auth response as the browser session. Used by login, tenant
 * switching, and impersonation so all three agree on what "signed in" means.
 * Team selection belongs to the previous tenant/identity and is always cleared.
 */
export function applySession(data: any): void {
  if (typeof window === 'undefined') return;
  const ls = window.localStorage;
  if (data?.accessToken) ls.setItem('access_token', data.accessToken);
  if (data?.refreshToken) ls.setItem('refresh_token', data.refreshToken);
  if (data?.user) ls.setItem('user', JSON.stringify(data.user));
  if (data?.tenant) {
    ls.setItem('tenant', JSON.stringify(data.tenant));
    if (data.tenant.id) ls.setItem('current_tenant_id', data.tenant.id);
  }
  if (Array.isArray(data?.memberships)) ls.setItem('memberships', JSON.stringify(data.memberships));
  ls.removeItem('current_team_id');
  ls.removeItem('current_team_ids');
}

export function getMemberships(): Membership[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem('memberships');
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getCurrentTenantId(): string | null {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage.getItem('current_tenant_id'); } catch { return null; }
}
