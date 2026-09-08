'use client';

import { useCallback, useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { Button } from '@/components/ui/button';

type AiSettingStatus =
  | { configured: false }
  | { configured: true; keyLast4: string; updatedAt: string; updatedBy: string | null };

/**
 * The Anthropic key, write-only: it is encrypted server-side and only its last
 * four characters ever come back. Powers Creative Insights (one analysis per day,
 * always human-clicked) and the variant generator.
 */
export default function AiSettingsPage() {
  const [status, setStatus] = useState<AiSettingStatus | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try { setStatus((await apiClient.get<AiSettingStatus>('/ai-settings')).data); }
    catch (err) {
      const maybe = err as { response?: { status?: number; data?: { message?: string } } };
      setError(maybe.response?.status === 403
        ? 'Only the main admin (tenant.manage) can manage the AI key.'
        : maybe.response?.data?.message || 'Unable to load AI settings.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const next = (await apiClient.put<AiSettingStatus>('/ai-settings', { apiKey: draft })).data;
      setStatus(next);
      setDraft('');
      setNotice('Key saved. Creative Insights analysis and variant generation are now live.');
    } catch (err) {
      const maybe = err as { response?: { data?: { message?: string } }; message?: string };
      setError(maybe.response?.data?.message || maybe.message || 'Unable to save the key.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('Remove the Anthropic key? Creative Insights analysis and variant generation will stop working until a new one is saved.')) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      setStatus((await apiClient.delete<AiSettingStatus>('/ai-settings')).data);
      setNotice('Key removed.');
    } catch (err) {
      const maybe = err as { response?: { data?: { message?: string } }; message?: string };
      setError(maybe.response?.data?.message || maybe.message || 'Unable to remove the key.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <KeyRound className="h-4 w-4 text-primary" /> Anthropic API key
        </h2>
        <p className="mt-1 text-sm text-muted">
          Powers the Creative Insights analysis (limited to one run per day, always started by a person — nothing sends on a schedule)
          and the variant generator. The key is encrypted with this workspace&apos;s own key and is never shown again after saving.
        </p>
      </div>

      {error ? <p className="rounded-xl border border-destructive/40 bg-destructive-soft/30 px-4 py-3 text-sm text-destructive">{error}</p> : null}
      {notice ? <p className="rounded-xl border border-success/40 bg-success-soft/40 px-4 py-3 text-sm text-success">{notice}</p> : null}

      <div className="panel panel-content p-5">
        {status?.configured ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Configured — key ending in ····{status.keyLast4}</p>
              <p className="mt-0.5 text-xs text-muted">
                Saved {new Date(status.updatedAt).toLocaleString('en-PH')}{status.updatedBy ? ` by ${status.updatedBy}` : ''}
              </p>
            </div>
            <Button variant="danger" size="sm" onClick={remove} disabled={busy}>Remove key</Button>
          </div>
        ) : status ? (
          <p className="text-sm text-muted">No key saved yet. Paste one below to turn on the AI features.</p>
        ) : (
          <p className="text-sm text-muted">Loading…</p>
        )}
      </div>

      <form onSubmit={save} className="panel panel-content p-5">
        <label className="form-label" htmlFor="ai-key">{status?.configured ? 'Replace key' : 'API key'}</label>
        <div className="mt-1 flex gap-2">
          <input
            id="ai-key"
            type="password"
            autoComplete="off"
            className="input flex-1"
            placeholder="sk-ant-…"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <Button type="submit" variant="primary" disabled={busy || draft.trim().length < 20}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted">
          Get one at console.anthropic.com → API keys. Usage is billed to that Anthropic account.
        </p>
      </form>
    </div>
  );
}
