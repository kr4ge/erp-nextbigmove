'use client';

import { useCallback, useEffect, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { AlertBanner } from '@/components/ui/feedback';
import { daysAgo } from '../_lib/format';

/**
 * The strategy log.
 *
 * This is the memory the numbers do not have. A jump in CPP on the 14th means
 * nothing on its own; next to "raised the price on the 13th" it means
 * something.
 *
 * The result is written separately, later, because the whole point of a log is
 * the gap between deciding something and finding out whether it worked.
 */

const TAGS = [
  { value: 'OFFER', label: 'Offer' },
  { value: 'AD_COPY', label: 'Ad copy' },
  { value: 'TARGETING', label: 'Targeting' },
  { value: 'FB_STRATEGY', label: 'FB strategy' },
  { value: 'CREATIVE', label: 'Creative' },
  { value: 'PRICING', label: 'Pricing' },
  { value: 'OPS', label: 'Ops / fulfilment' },
  { value: 'OTHER', label: 'Other' },
];

const TAG_LABEL: Record<string, string> = Object.fromEntries(TAGS.map((t) => [t.value, t.label]));

interface StrategyEntry {
  id: string;
  date: string;
  title: string;
  description: string | null;
  tag: string;
  result: string | null;
  resultUpdatedAt: string | null;
  createdBy: { firstName: string | null; lastName: string | null; email: string | null } | null;
}

export function StrategySection({ canManage }: { canManage: boolean }) {
  const [entries, setEntries] = useState<StrategyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [date, setDate] = useState(() => daysAgo(0));
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tag, setTag] = useState('OTHER');
  const [saving, setSaving] = useState(false);

  const [resultFor, setResultFor] = useState<string | null>(null);
  const [resultText, setResultText] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<StrategyEntry[]>('/advertising/strategy');
      setEntries(response.data);
      setError('');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message || 'Could not load the strategy log.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!title.trim()) return;
    setSaving(true);
    setError('');
    try {
      await apiClient.post('/advertising/strategy', {
        date,
        title: title.trim(),
        description: description.trim() || undefined,
        tag,
      });
      setTitle('');
      setDescription('');
      setTag('OTHER');
      await load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e?.response?.data?.message || e?.message || 'The entry was not saved.');
    } finally {
      setSaving(false);
    }
  };

  const saveResult = async (id: string) => {
    if (!resultText.trim()) return;
    try {
      await apiClient.put(`/advertising/strategy/${id}/result`, { result: resultText.trim() });
      setResultFor(null);
      setResultText('');
      await load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message || 'The result was not saved.');
    }
  };

  const who = (entry: StrategyEntry) => {
    const name = [entry.createdBy?.firstName, entry.createdBy?.lastName].filter(Boolean).join(' ');
    return name || entry.createdBy?.email || 'someone';
  };

  return (
    <div className="flex flex-col gap-6">
      {canManage ? (
        <section className="panel panel-content">
          <div className="panel-header flex items-center gap-2">
            <ClipboardList className="panel-icon" />
            <h4 className="panel-title">Log a change</h4>
          </div>

          <div className="flex flex-col gap-4 p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1">
                <label className="form-label" htmlFor="st-date">Date it took effect</label>
                <input
                  id="st-date"
                  type="date"
                  className="input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className="form-label" htmlFor="st-title">What changed</label>
                <input
                  id="st-title"
                  className="input"
                  placeholder="Raised the bundle price to ₱1,290"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="form-label" htmlFor="st-desc">Detail and what you expect</label>
              <textarea
                id="st-desc"
                className="input min-h-20"
                placeholder="Testing whether committed buyers absorb it. Expect CPP up, cancels flat."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="form-label" htmlFor="st-tag">Kind</label>
                <select
                  id="st-tag"
                  className="input"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                >
                  {TAGS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <Button variant="primary" size="md" onClick={add} disabled={saving || !title.trim()}>
                {saving ? 'Saving…' : 'Log it'}
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {error ? <AlertBanner tone="error" message={error} /> : null}

      <section className="panel panel-content">
        <div className="panel-header flex items-center gap-2">
          <ClipboardList className="panel-icon" />
          <h4 className="panel-title">Strategy log ({entries.length})</h4>
        </div>

        <div className="flex flex-col gap-0 p-0">
          {loading ? (
            <p className="p-6 text-sm text-muted">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="p-6 text-sm text-muted">
              Nothing logged yet. The first entry is worth writing the next time you change
              anything — a price, an offer, a targeting stack.
            </p>
          ) : (
            entries.map((entry) => (
              <article key={entry.id} className="border-b border-border/10 p-5 last:border-b-0">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="pill pill-neutral">{TAG_LABEL[entry.tag] ?? entry.tag}</span>
                  <p className="text-sm-custom font-semibold text-foreground">{entry.title}</p>
                  <span className="text-xs text-muted">
                    {entry.date.slice(0, 10)} · {who(entry)}
                  </span>
                </div>

                {entry.description ? (
                  <p className="mt-2 max-w-prose text-sm text-muted">{entry.description}</p>
                ) : null}

                {entry.result ? (
                  <div className="mt-3 rounded-xl bg-secondary/30 p-3">
                    <p className="card-label">What happened</p>
                    <p className="mt-1 max-w-prose text-sm text-foreground">{entry.result}</p>
                  </div>
                ) : canManage ? (
                  resultFor === entry.id ? (
                    <div className="mt-3 flex flex-col gap-2">
                      <textarea
                        className="input min-h-16"
                        placeholder="CPP rose 12% but cancels dropped to 9%. Net contribution up."
                        value={resultText}
                        onChange={(e) => setResultText(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button variant="primary" size="sm" onClick={() => saveResult(entry.id)}>
                          Save result
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setResultFor(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setResultFor(entry.id);
                          setResultText('');
                        }}
                      >
                        Record what happened
                      </Button>
                    </div>
                  )
                ) : null}
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
