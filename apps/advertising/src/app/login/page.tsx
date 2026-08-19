'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Megaphone } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { AlertBanner } from '@/components/ui/feedback';

/**
 * The console's own front door.
 *
 * Same accounts as the ERP — this is not a second user directory. What is
 * separate is the session: the console runs on its own origin, so signing in
 * here does not sign you in there, and signing out of one leaves the other
 * alone.
 *
 * It also refuses people who cannot use it. Letting someone in to an empty
 * console and leaving them to work out why is worse than saying so at the door.
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (token) router.push('/console');
    else setCheckingSession(false);
  }, [router]);

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const response = await apiClient.post('/auth/login', {
        email: email.trim().toLowerCase(),
        password,
      });

      const { accessToken, refreshToken, tenant, user } = response.data;

      // Hold the tokens only long enough to ask what this account may do. If it
      // may not do anything here, nothing is left behind.
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('refresh_token', refreshToken);
      if (tenant?.id) localStorage.setItem('current_tenant_id', tenant.id);
      localStorage.setItem('user', JSON.stringify(user));

      let permissions: string[] = [];
      try {
        const perms = await apiClient.get('/auth/permissions', { params: { workspace: 'erp' } });
        permissions = perms.data.permissions || [];
      } catch {
        permissions = [];
      }

      if (user?.role !== 'SUPER_ADMIN' && !permissions.includes('advertising.read')) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('current_tenant_id');
        localStorage.removeItem('user');
        setError('This account does not have advertising access. Ask an admin to grant it.');
        return;
      }

      localStorage.setItem('permissions', JSON.stringify(permissions));
      router.push('/console');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e?.response?.data?.message || e?.message || 'Sign in failed. Check your details.');
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingSession) return null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft">
            <Megaphone className="h-5 w-5 text-primary" />
          </span>
          <div>
            <h1 className="text-xl-loose font-semibold tracking-tight text-foreground">
              Advertising Console
            </h1>
            <p className="text-sm text-muted">Ad verdicts, spend, and the evaluator</p>
          </div>
        </div>

        <form onSubmit={signIn} className="panel panel-content">
          <div className="flex flex-col gap-4 p-5">
            {error ? <AlertBanner tone="error" message={error} /> : null}

            <div className="flex flex-col gap-1">
              <label className="form-label" htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="form-label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button variant="primary" size="lg" type="submit" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>

            <p className="text-sm text-muted">
              Uses your ERP account. This console keeps its own session — signing out here does not
              sign you out of the ERP.
            </p>
          </div>
        </form>
      </div>
    </main>
  );
}
