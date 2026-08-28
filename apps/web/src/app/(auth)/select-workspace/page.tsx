'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { getCurrentTenantId, getMemberships, type Membership } from '@/lib/session';
import { switchTenant } from '@/lib/tenant-switch';

/**
 * Shown after login only to users who belong to more than one tenant. The
 * token already points at the last-active tenant, so picking that one is a
 * plain redirect; picking another reissues the session for it.
 */
export default function SelectWorkspacePage() {
  const router = useRouter();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const list = getMemberships();
    if (list.length < 2) { router.replace('/dashboard'); return; }
    setMemberships(list);
    setCurrentId(getCurrentTenantId());
  }, [router]);

  const choose = async (tenantId: string) => {
    setBusyId(tenantId);
    setError(null);
    if (tenantId === currentId) { router.replace('/dashboard'); return; }
    try {
      await switchTenant(tenantId);
    } catch (switchError: any) {
      setBusyId(null);
      setError(switchError?.response?.data?.message ?? 'Could not open that workspace.');
    }
  };

  if (memberships.length < 2) return null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="panel w-full max-w-md shadow-card">
        <div className="border-b border-border/40 px-6 py-5">
          <h1 className="text-lg-loose font-semibold">Choose a workspace</h1>
          <p className="mt-1 text-sm text-muted">You belong to more than one. You can switch any time from the header.</p>
        </div>
        <ul className="divide-y divide-border/40">
          {memberships.map((m) => (
            <li key={m.tenantId}>
              <button
                type="button"
                disabled={busyId !== null}
                onClick={() => choose(m.tenantId)}
                className="flex w-full items-center gap-3 px-6 py-4 text-left transition hover:bg-secondary/30 disabled:opacity-60"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <Building2 className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{m.name}</span>
                  {m.tenantId === currentId ? <span className="text-xs text-muted">Last used</span> : null}
                </span>
                {busyId === m.tenantId ? <span className="text-xs text-muted">Opening…</span> : null}
              </button>
            </li>
          ))}
        </ul>
        {error ? <p className="px-6 py-3 text-sm text-destructive">{error}</p> : null}
      </div>
    </main>
  );
}
