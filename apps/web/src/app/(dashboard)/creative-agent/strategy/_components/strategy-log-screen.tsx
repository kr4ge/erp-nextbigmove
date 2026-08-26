'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormInput } from '@/components/ui/form-input';
import { FormSelect } from '@/components/ui/form-select';
import { FormTextarea } from '@/components/ui/form-textarea';
import { PageHeader } from '@/components/ui/page-header';
import { PanelHeader } from '../../overview/_components/overview-ui';
import {
  createStrategyEntry,
  deleteStrategyEntry,
  fetchStrategyLog,
  recordStrategyResult,
} from '../_services/creative-strategy.service';
import type { StrategyEntry, StrategyLogResponse, StrategyTagOption } from '../_types/creative-strategy';

/** Tag colours by intent, not one hue per value: the creative-craft moves share
 *  the primary tone and the commercial ones the warning tone, so the timeline
 *  reads as two kinds of change rather than nine unrelated labels. */
const TAG_CLASS: Record<string, string> = {
  NEW_CREATIVE: 'border-success/30 bg-success-soft/40 text-success',
  ANGLE: 'pill-primary',
  HOOK: 'pill-primary',
  SCRIPT: 'pill-primary',
  FORMAT: 'pill-primary',
  AD_COPY: 'border-warning/30 bg-warning-soft/60 text-warning',
  OFFER: 'border-warning/30 bg-warning-soft/60 text-warning',
  TARGETING: 'border-warning/30 bg-warning-soft/60 text-warning',
  OTHER: 'pill-neutral',
};

function formatDate(ymd: string): string {
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${ymd}T00:00:00.000Z`));
}

function tagLabel(tag: string, options: StrategyTagOption[]): string {
  return options.find((option) => option.value === tag)?.label ?? tag;
}

export function StrategyLogScreen() {
  const [data, setData] = useState<StrategyLogResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [date, setDate] = useState('');
  const [tag, setTag] = useState('NEW_CREATIVE');
  const [customTag, setCustomTag] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [creativeCode, setCreativeCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [resultFor, setResultFor] = useState<string | null>(null);
  const [resultDraft, setResultDraft] = useState('');
  const [savingResult, setSavingResult] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const next = await fetchStrategyLog();
      setData(next);
      setDate((current) => current || next.today);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the Strategy Log.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const tags = data?.tags ?? [];
  const entries = data?.entries ?? [];
  const loggedCount = useMemo(() => entries.filter((entry) => entry.result).length, [entries]);

  const save = async () => {
    if (!title.trim()) {
      setFormError('Give the change a short title.');
      return;
    }
    // A typed-in type on "Other" becomes the tag itself, so the vocabulary can
    // grow without waiting on a release.
    const finalTag = tag === 'OTHER' && customTag.trim() ? customTag.trim() : tag;
    setSaving(true);
    setFormError(null);
    try {
      const entry = await createStrategyEntry({
        date: date || data?.today || '',
        title: title.trim(),
        description: description.trim(),
        tag: finalTag,
        creativeCode: creativeCode.trim(),
      });
      setData((current) => (current ? { ...current, entries: [entry, ...current.entries] } : current));
      setTitle('');
      setDescription('');
      setCreativeCode('');
      setCustomTag('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save this entry.');
    } finally {
      setSaving(false);
    }
  };

  const saveResult = async (id: string) => {
    setSavingResult(true);
    setFormError(null);
    try {
      const updated = await recordStrategyResult(id, resultDraft.trim());
      setData((current) => (current
        ? { ...current, entries: current.entries.map((entry) => (entry.id === id ? updated : entry)) }
        : current));
      setResultFor(null);
      setResultDraft('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save the result.');
    } finally {
      setSavingResult(false);
    }
  };

  const remove = async (id: string) => {
    const previous = data;
    setData((current) => (current
      ? { ...current, entries: current.entries.filter((entry) => entry.id !== id) }
      : current));
    try {
      await deleteStrategyEntry(id);
    } catch (err) {
      setData(previous);
      setFormError(err instanceof Error ? err.message : 'Could not delete this entry.');
    }
  };

  return (
    <div className="mx-auto max-w-screen-lg">
      <PageHeader
        title="Strategy Log"
        description="What you changed, when it took effect, and what happened after — so a move in the numbers can be explained instead of guessed at."
        breadcrumbs="Creative Workspace"
      />

      <div className="space-y-4">
        {error ? (
          <div className="panel panel-content p-6 text-center">
            <p className="text-sm font-semibold text-foreground">The Strategy Log could not load</p>
            <p className="mt-1 text-sm text-muted">{error}</p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={load}>Try again</Button>
          </div>
        ) : null}

        <section className="panel panel-content border-primary/30 shadow-card">
          <PanelHeader
            title="What have you changed?"
            description="Every meaningful move — a new angle, a different hook, a reworked script, an offer change. Enrolling a creative logs itself; everything else is this box."
          />
          <div className="space-y-4 p-5">
            <div className="grid gap-4 md:grid-cols-[200px_200px_1fr]">
              <FormInput
                name="date"
                type="date"
                label="Date it took effect"
                value={date}
                max={data?.today}
                onChange={(event) => setDate(event.target.value)}
              />
              <FormSelect
                name="tag"
                label="Type"
                value={tag}
                onChange={(event) => setTag(event.target.value)}
                options={tags as StrategyTagOption[]}
              />
              <FormInput
                name="creativeCode"
                label="Creative code"
                value={creativeCode}
                onChange={(event) => setCreativeCode(event.target.value.toUpperCase())}
                placeholder="e.g. TB-V0001 — leave blank if it is not about one creative"
              />
            </div>

            {tag === 'OTHER' ? (
              <FormInput
                name="customTag"
                label="Specify the type"
                value={customTag}
                onChange={(event) => setCustomTag(event.target.value)}
                placeholder="e.g. THUMBNAIL"
              />
            ) : null}

            <FormInput
              name="title"
              label="What changed"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) save(); }}
              placeholder="e.g. Swapped the opening 3s to a guilt hook on all picky-eater videos"
            />

            <FormTextarea
              name="description"
              label="Details"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What you expected it to do, which creatives or campaigns it touched, anything worth remembering later."
              className="min-h-20"
            />

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={save} loading={saving} iconLeft={<ClipboardList className="h-4 w-4" />}>
                Log this change
              </Button>
              {formError ? <span className="text-sm text-destructive">{formError}</span> : null}
              <span className="ml-auto text-xs text-muted">⌘/Ctrl + Enter to save</span>
            </div>
          </div>
        </section>

        <section className="panel panel-content shadow-card">
          <PanelHeader
            title="Timeline"
            description={
              entries.length
                ? `${entries.length} logged · ${loggedCount} with a recorded outcome. Creative Insights reads the last 60 days of this when it runs your analysis.`
                : 'Creative Insights reads the last 60 days of this when it runs your analysis.'
            }
          />
          <div className="p-5">
            {isLoading ? (
              <p className="py-8 text-center text-sm text-muted">Loading the log…</p>
            ) : entries.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <p className="text-sm font-semibold text-foreground">Nothing logged yet</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted">
                  Add your first change above. Even a small tweak helps — the log is what lets an analysis
                  say <em>why</em> a creative moved instead of only that it did.
                </p>
              </div>
            ) : (
              <ol className="relative space-y-3 border-l-2 border-border pl-5">
                {entries.map((entry) => (
                  <li key={entry.id} className="relative">
                    <span className="absolute -left-[27px] top-3 h-3 w-3 rounded-full border-2 border-surface bg-primary" />
                    <EntryCard
                      entry={entry}
                      tags={tags}
                      showAuthor={Boolean(data?.showsOthers)}
                      isEditing={resultFor === entry.id}
                      resultDraft={resultDraft}
                      savingResult={savingResult}
                      onEdit={() => { setResultFor(entry.id); setResultDraft(entry.result ?? ''); setFormError(null); }}
                      onCancel={() => { setResultFor(null); setResultDraft(''); }}
                      onDraftChange={setResultDraft}
                      onSaveResult={() => saveResult(entry.id)}
                      onDelete={() => remove(entry.id)}
                    />
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function EntryCard({
  entry, tags, showAuthor, isEditing, resultDraft, savingResult,
  onEdit, onCancel, onDraftChange, onSaveResult, onDelete,
}: {
  entry: StrategyEntry;
  tags: StrategyTagOption[];
  showAuthor: boolean;
  isEditing: boolean;
  resultDraft: string;
  savingResult: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onDraftChange: (value: string) => void;
  onSaveResult: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`pill ${TAG_CLASS[entry.tag] ?? TAG_CLASS.OTHER}`}>
              {tagLabel(entry.tag, tags)}
            </span>
            <span className="text-xs font-medium text-muted">{formatDate(entry.date)}</span>
            {entry.creativeCode ? (
              <span className="font-mono text-xs font-semibold text-primary">{entry.creativeCode}</span>
            ) : null}
            {entry.source === 'AUTO_ENROLMENT' ? (
              <span className="pill pill-neutral" title="Written by the registry when this creative was enrolled">
                Auto
              </span>
            ) : null}
            {entry.result ? (
              <span className="pill border-success/30 bg-success-soft/40 text-success">
                Result logged
              </span>
            ) : null}
            {showAuthor ? <span className="text-xs text-muted">· {entry.author.name}</span> : null}
          </div>
          <h3 className="mt-1.5 text-sm font-semibold text-foreground">{entry.title}</h3>
          {entry.description ? (
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted">{entry.description}</p>
          ) : null}
        </div>
        {entry.isMine ? (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onEdit}
              className="rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary-soft"
            >
              {entry.result ? 'Update result' : 'Add result'}
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label={`Delete ${entry.title}`}
              className="rounded-md p-1.5 text-muted opacity-0 transition-opacity hover:text-destructive focus:opacity-100 group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
      </div>

      {entry.result && !isEditing ? (
        <div className="mt-3 rounded-lg border border-success/30 bg-success-soft/20 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-success">Result</p>
          <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{entry.result}</p>
        </div>
      ) : null}

      {isEditing ? (
        <div className="mt-3 rounded-lg border border-primary/30 bg-primary-soft/40 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-primary">What happened after this change?</p>
          <FormTextarea
            name={`result-${entry.id}`}
            label=""
            value={resultDraft}
            autoFocus
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder="e.g. TB-V0007 hit 34 orders at 26% AR% in its first two weeks — the guilt hook held where the demo open faded."
            className="mt-2 min-h-20"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={onSaveResult} loading={savingResult}>Save result</Button>
            <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted">
              <Sparkles className="h-3 w-3" /> Feeds Creative Insights
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
