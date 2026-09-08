'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { LogOut, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ConsoleUser {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
  tenantId?: string | null;
}

/**
 * The console's shape, in the order a day is worked: read where you stand, look
 * at the ads, then what they were made of, then the housekeeping.
 */
const NAV = [
  { section: 'overview', label: 'Dashboard' },
  { section: 'performance', label: 'Performance' },
  { section: 'assets', label: 'Assets' },
  { section: 'library', label: 'Ads Library' },
  { section: 'import', label: 'Import Report' },
  { section: 'accounts', label: 'Accounts & Payments' },
  { section: 'strategy', label: 'Strategy Log' },
  { section: 'settings', label: 'Settings' },
];

function Sidebar() {
  const searchParams = useSearchParams();
  const current = searchParams.get('section') || 'overview';

  return (
    <nav className="flex gap-1 overflow-x-auto lg:w-56 lg:shrink-0 lg:flex-col lg:overflow-visible">
      {NAV.map((item) => {
        const active = item.section === current;
        return (
          <Link
            key={item.section}
            href={`/console?section=${item.section}`}
            aria-current={active ? 'page' : undefined}
            className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm transition ${
              active
                ? 'bg-surface font-semibold text-foreground shadow-sm'
                : 'text-muted hover:bg-secondary/30 hover:text-foreground'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<ConsoleUser | null>(null);
  const [ready, setReady] = useState(false);

  // A platform account belongs to no tenant, and the API's tenant-scoped
  // endpoints have no way to be told which one to read — X-Tenant-ID is honoured
  // only by the WMS guards. So there is nothing to show such an account here,
  // and pretending otherwise with a workspace picker would be a lie.
  const isPlatformAdmin = user?.role === 'SUPER_ADMIN' && !user?.tenantId;

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.replace('/login');
      return;
    }
    try {
      const raw = localStorage.getItem('user');
      if (raw) setUser(JSON.parse(raw));
    } catch {
      // A malformed cache is not worth blocking the console over.
    }
    setReady(true);
  }, [router]);

  const signOut = () => {
    ['access_token', 'refresh_token', 'current_tenant_id', 'user', 'permissions'].forEach((key) =>
      localStorage.removeItem(key),
    );
    router.replace('/login');
  };

  // Nothing renders until the token check settles, so a signed-out visitor never
  // sees a flash of the console behind the redirect.
  if (!ready) return null;

  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || '';

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/20 bg-surface">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft">
              <Megaphone className="h-4 w-4 text-primary" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold tracking-tight text-foreground">
                Advertising Console
              </p>
              {name ? <p className="truncate text-xs text-muted">{name}</p> : null}
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            iconLeft={<LogOut className="h-4 w-4" />}
          >
            Sign out
          </Button>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row">
        {isPlatformAdmin ? null : (
          <Suspense fallback={null}>
            <Sidebar />
          </Suspense>
        )}

        <main className="min-w-0 flex-1">
          {isPlatformAdmin ? (
            <div className="panel panel-content">
              <div className="p-6">
                <h2 className="text-base font-semibold text-foreground">
                  This account has no workspace
                </h2>
                <p className="mt-1 max-w-prose text-sm text-muted">
                  Platform accounts are not tied to an advertiser, and the reporting endpoints are
                  tenant-scoped. Sign in with an account that belongs to the workspace whose ads you
                  want to read.
                </p>
              </div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
