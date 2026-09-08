'use client';

import { useCallback, useEffect, useState } from 'react';
import { BookMarked, Search, Trash2 } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { AlertBanner } from '@/components/ui/feedback';

/**
 * The swipe file.
 *
 * Entries are written by hand. B.E.K.S fills its equivalent by scraping the
 * Meta Ad Library, which is a project of its own — so this stores what a
 * scraper would produce without pretending to be one.
 *
 * The note is the point. A saved ad with no reason attached is a bookmark, and
 * nobody has ever gone back through a folder of bookmarks.
 */

const FORMATS = [
  { value: 'VIDEO', label: 'Video' },
  { value: 'IMAGE', label: 'Image' },
  { value: 'CAROUSEL', label: 'Carousel' },
  { value: 'OTHER', label: 'Other' },
];

interface LibraryEntry {
  id: string;
  pageName: string;
  sourceUrl: string | null;
  format: string;
  headline: string | null;
  bodyCopy: string | null;
  ctaText: string | null;
  notes: string | null;
  tags: string[];
  createdBy: { firstName: string | null; lastName: string | null; email: string | null } | null;
}

export function LibrarySection({ canManage }: { canManage: boolean }) {
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const [pageName, setPageName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [format, setFormat] = useState('VIDEO');
  const [headline, setHeadline] = useState('');
  const [bodyCopy, setBodyCopy] = useState('');
  const [ctaText, setCtaText] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');

  const load = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      const response = await apiClient.get<LibraryEntry[]>('/advertising/library', {
        params: q ? { q } : {},
      });
      setEntries(response.data);
      setError('');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message || 'Could not load the swipe file.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!pageName.trim()) return;
    setSaving(true);
    setError('');
    try {
      await apiClient.post('/advertising/library', {
        pageName: pageName.trim(),
        sourceUrl: sourceUrl.trim() || undefined,
        format,
        headline: headline.trim() || undefined,
        bodyCopy: bodyCopy.trim() || undefined,
        ctaText: ctaText.trim() || undefined,
        notes: notes.trim() || undefined,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      });
      setPageName('');
      setSourceUrl('');
      setHeadline('');
      setBodyCopy('');
      setCtaText('');
      setNotes('');
      setTags('');
      setAdding(false);
      await load(query || undefined);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e?.response?.data?.message || e?.message || 'The entry was not saved.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await apiClient.delete(`/advertising/library/${id}`);
      await load(query || undefined);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message || 'The entry was not removed.');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="panel panel-content">
        <div className="panel-header flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2">
            <BookMarked className="panel-icon" />
            <h4 className="panel-title">Swipe file ({entries.length})</h4>
          </div>
          {canManage ? (
            <div className="ml-auto shrink-0">
              <Button variant="primary" size="sm" onClick={() => setAdding((a) => !a)}>
                {adding ? 'Cancel' : 'Save an ad'}
              </Button>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-end gap-3 p-3">
          <div className="flex min-w-60 flex-1 flex-col gap-1">
            <label className="form-label" htmlFor="lib-q">Search</label>
            <input
              id="lib-q"
              className="input"
              placeholder="A brand, a phrase, a tag, or why you kept it"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') load(query || undefined);
              }}
            />
          </div>
          <Button
            variant="ghost"
            size="md"
            onClick={() => load(query || undefined)}
            iconLeft={<Search className="h-4 w-4" />}
          >
            Search
          </Button>
        </div>
      </section>

      {error ? <AlertBanner tone="error" message={error} /> : null}

      {adding && canManage ? (
        <section className="panel panel-content">
          <div className="panel-header flex items-center gap-2">
            <BookMarked className="panel-icon" />
            <h4 className="panel-title">Save an ad</h4>
          </div>

          <div className="flex flex-col gap-4 p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1">
                <label className="form-label" htmlFor="lib-page">Whose ad</label>
                <input
                  id="lib-page"
                  className="input"
                  placeholder="Rival Skincare PH"
                  value={pageName}
                  onChange={(e) => setPageName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="form-label" htmlFor="lib-format">Format</label>
                <select
                  id="lib-format"
                  className="input"
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                >
                  {FORMATS.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="form-label" htmlFor="lib-cta">Button</label>
                <input
                  id="lib-cta"
                  className="input"
                  placeholder="Shop Now"
                  value={ctaText}
                  onChange={(e) => setCtaText(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="form-label" htmlFor="lib-url">Where you found it</label>
              <input
                id="lib-url"
                className="input"
                placeholder="https://www.facebook.com/ads/library/?id=…"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="form-label" htmlFor="lib-headline">Headline or hook</label>
              <input
                id="lib-headline"
                className="input"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="form-label" htmlFor="lib-body">Copy</label>
              <textarea
                id="lib-body"
                className="input min-h-20"
                value={bodyCopy}
                onChange={(e) => setBodyCopy(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="form-label" htmlFor="lib-notes">Why you kept it</label>
              <textarea
                id="lib-notes"
                className="input min-h-20"
                placeholder="Opens on the objection, not the product. First 2 seconds are a face, no logo."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="form-label" htmlFor="lib-tags">Tags</label>
              <input
                id="lib-tags"
                className="input"
                placeholder="hook:objection, ugc, no-logo-open"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
              <p className="text-xs text-muted">Separate with commas</p>
            </div>

            <div>
              <Button
                variant="primary"
                size="md"
                onClick={save}
                disabled={saving || !pageName.trim()}
              >
                {saving ? 'Saving…' : 'Save to swipe file'}
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="panel panel-content">
        <div className="flex flex-col">
          {loading ? (
            <p className="p-6 text-sm text-muted">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="p-6 text-sm text-muted">
              Nothing saved yet. The next competitor ad that makes you stop scrolling is worth
              keeping — with a line about why it worked on you.
            </p>
          ) : (
            entries.map((entry) => (
              <article key={entry.id} className="border-b border-border/10 p-5 last:border-b-0">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <p className="text-sm-custom font-semibold text-foreground">
                        {entry.pageName}
                      </p>
                      <span className="pill pill-neutral">{entry.format}</span>
                      {entry.ctaText ? (
                        <span className="text-xs text-muted">{entry.ctaText}</span>
                      ) : null}
                    </div>

                    {entry.headline ? (
                      <p className="mt-2 max-w-prose text-sm font-medium text-foreground">
                        &ldquo;{entry.headline}&rdquo;
                      </p>
                    ) : null}
                    {entry.bodyCopy ? (
                      <p className="mt-1 max-w-prose text-sm text-muted">{entry.bodyCopy}</p>
                    ) : null}

                    {entry.notes ? (
                      <div className="mt-3 rounded-xl bg-secondary/30 p-3">
                        <p className="card-label">Why it was kept</p>
                        <p className="mt-1 max-w-prose text-sm text-foreground">{entry.notes}</p>
                      </div>
                    ) : null}

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {entry.tags.map((tag) => (
                        <span key={tag} className="pill pill-info">{tag}</span>
                      ))}
                      {entry.sourceUrl ? (
                        <a
                          className="text-xs"
                          href={entry.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View the original
                        </a>
                      ) : null}
                    </div>
                  </div>

                  {canManage ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(entry.id)}
                      iconLeft={<Trash2 className="h-4 w-4" />}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
