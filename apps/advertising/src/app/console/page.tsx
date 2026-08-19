'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CalendarRange, RefreshCcw } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { AlertBanner } from '@/components/ui/feedback';
import { daysAgo } from './_lib/format';
import type { AdAccountRow, Position } from './_lib/types';
import { AccountsSection } from './_sections/accounts';
import { AssetsSection } from './_sections/assets';
import { DashboardSection } from './_sections/dashboard';
import { ImportSection } from './_sections/import-report';
import { LibrarySection } from './_sections/library';
import { PerformanceSection } from './_sections/performance';
import { SettingsSection } from './_sections/settings';
import { StrategySection } from './_sections/strategy';

/** Sections that read the period. The rest ignore the date range entirely. */
const PERIOD_SECTIONS = new Set(['overview', 'performance', 'accounts', 'assets']);

function ConsoleBody() {
  const searchParams = useSearchParams();
  const section = searchParams.get('section') || 'overview';

  const [startDate, setStartDate] = useState(() => daysAgo(30));
  const [endDate, setEndDate] = useState(() => daysAgo(0));

  const [position, setPosition] = useState<Position | null>(null);
  const [accounts, setAccounts] = useState<AdAccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [verdict, setVerdict] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [evaluateError, setEvaluateError] = useState('');

  const [permissions, setPermissions] = useState<string[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('permissions');
      if (raw) setPermissions(JSON.parse(raw));
      const user = localStorage.getItem('user');
      if (user) setIsSuperAdmin(JSON.parse(user)?.role === 'SUPER_ADMIN');
    } catch {
      // An unreadable cache just means fewer buttons, not a broken console.
    }
  }, []);

  const can = (permission: string) => isSuperAdmin || permissions.includes(permission);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [positionResponse, accountsResponse] = await Promise.all([
        apiClient.get<Position>('/advertising/position', { params: { startDate, endDate } }),
        apiClient.get<AdAccountRow[]>('/advertising/accounts', { params: { startDate, endDate } }),
      ]);
      setPosition(positionResponse.data);
      setAccounts(accountsResponse.data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e?.response?.data?.message || e?.message || 'Could not load advertising data.');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    load();
  }, [load]);

  const runEvaluator = async () => {
    setEvaluating(true);
    setEvaluateError('');
    setVerdict('');
    try {
      const response = await apiClient.post('/advertising/evaluate', null, {
        params: { startDate, endDate },
      });
      setVerdict(response.data.verdict);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setEvaluateError(e?.response?.data?.message || e?.message || 'The evaluator could not run.');
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {PERIOD_SECTIONS.has(section) ? (
        <section className="panel panel-content">
          <div className="panel-header flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-2">
              <CalendarRange className="panel-icon" />
              <h4 className="panel-title">Period</h4>
            </div>
            <div className="ml-auto shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={load}
                disabled={loading}
                iconLeft={<RefreshCcw className="h-4 w-4" />}
              >
                Refresh
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3 p-3">
            <div className="flex flex-col gap-1">
              <label className="form-label" htmlFor="adv-start">From</label>
              <input
                id="adv-start"
                type="date"
                className="input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="form-label" htmlFor="adv-end">To</label>
              <input
                id="adv-end"
                type="date"
                className="input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </section>
      ) : null}

      {error ? <AlertBanner tone="error" message={error} /> : null}

      {section === 'overview' ? (
        <DashboardSection
          position={position}
          canEvaluate={can('advertising.evaluate')}
          verdict={verdict}
          evaluating={evaluating}
          evaluateError={evaluateError}
          onEvaluate={runEvaluator}
        />
      ) : null}

      {section === 'performance' ? (
        <PerformanceSection position={position} loading={loading} />
      ) : null}

      {section === 'import' ? <ImportSection onImported={load} /> : null}

      {section === 'accounts' ? <AccountsSection accounts={accounts} loading={loading} /> : null}

      {section === 'settings' ? <SettingsSection canManage={can('advertising.manage')} /> : null}

      {section === 'library' ? <LibrarySection canManage={can('advertising.manage')} /> : null}

      {section === 'assets' ? (
        <AssetsSection
          canManage={can('advertising.manage')}
          startDate={startDate}
          endDate={endDate}
        />
      ) : null}

      {section === 'strategy' ? (
        <StrategySection canManage={can('advertising.manage')} />
      ) : null}
    </div>
  );
}

export default function ConsolePage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted">Loading…</div>}>
      <ConsoleBody />
    </Suspense>
  );
}
