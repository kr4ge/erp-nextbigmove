'use client';

import apiClient from '@/lib/api-client';

const IMPERSONATION_KEY = 'impersonating_user';

export type ImpersonationBanner = {
  name: string;
  email: string;
};

/**
 * Who is currently being viewed, if anyone.
 *
 * Kept alongside the token rather than derived from it: the banner has to
 * render before any request completes, and decoding a JWT client-side to drive
 * UI invites treating its claims as trusted. The server is still the authority
 * — this only decides whether to show the banner.
 */
export function getImpersonation(): ImpersonationBanner | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(IMPERSONATION_KEY);
    return raw ? (JSON.parse(raw) as ImpersonationBanner) : null;
  } catch {
    return null;
  }
}

/** Swap the session to the target user and reload into their view. */
export async function startImpersonation(userId: string): Promise<void> {
  const { data } = await apiClient.post(`/auth/impersonate/${userId}`);
  applySession(data);
  window.localStorage.setItem(IMPERSONATION_KEY, JSON.stringify({
    name: [data.user?.firstName, data.user?.lastName].filter(Boolean).join(' ') || data.user?.email,
    email: data.user?.email ?? '',
  }));
  window.location.href = '/dashboard';
}

/** Hand the session back to the admin who started it. */
export async function stopImpersonation(): Promise<void> {
  // The flag is cleared only after the swap succeeds. Clearing it first — or in
  // a finally — hides the banner while the token is still the impersonated one,
  // which strands the admin in that session with no way back.
  const { data } = await apiClient.post('/auth/impersonate/stop');
  applySession(data);
  window.localStorage.removeItem(IMPERSONATION_KEY);
  window.location.href = '/settings/users';
}

function applySession(data: any) {
  if (data?.accessToken) window.localStorage.setItem('access_token', data.accessToken);
  if (data?.refreshToken) window.localStorage.setItem('refresh_token', data.refreshToken);
  if (data?.user) window.localStorage.setItem('user', JSON.stringify(data.user));
  if (data?.tenant) window.localStorage.setItem('tenant', JSON.stringify(data.tenant));
  // Team selection belongs to the previous identity.
  window.localStorage.removeItem('current_team_id');
  window.localStorage.removeItem('current_team_ids');
}
