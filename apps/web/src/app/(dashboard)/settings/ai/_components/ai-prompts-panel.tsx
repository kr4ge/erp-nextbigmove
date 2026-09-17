'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, History, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CreativeAiPromptSetting, CreativeAiPromptVersion } from '../../../creative-agent/video-registry/_types/creative-ai';
import { activateCreativeAiPromptVersion, fetchCreativeAiPromptVersions } from '../../../creative-agent/video-registry/_services/creative-ai.service';

/**
 * The two analysis prompts, editable as text.
 *
 * This follows how prompt-management tools work: the wording is the
 * advertiser's, saved as a new version on every edit; the system fills
 * {{VARIABLES}} at run time and appends a fixed block (the files to read, the
 * attribute vocabulary, the output rule) that keeps every result parseable and
 * comparable. Both halves are shown so nobody is surprised by what the model
 * actually receives.
 */
export function AiPromptsPanel({
  prompts,
  canEdit,
  savingKind,
  onSave,
  onReset,
  onActivated,
}: {
  prompts: { runningAnalyst: CreativeAiPromptSetting; newReviewer: CreativeAiPromptSetting };
  canEdit: boolean;
  savingKind: string | null;
  onSave: (kind: CreativeAiPromptSetting['kind'], body: string, note: string) => void;
  onReset: (kind: CreativeAiPromptSetting['kind']) => void;
  onActivated: (setting: CreativeAiPromptSetting) => void;
}) {
  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-base font-semibold">Analysis prompts</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Which prompt runs is decided from the creative's own data: one that has spent and delivered in
          Meta gets Prompt 1, one that has not gets Prompt 2. Every save is a new version and each
          analysis records the version that judged it, so you can always see what the model was told
          and roll back.
        </p>
      </header>
      <PromptEditor setting={prompts.runningAnalyst} canEdit={canEdit} saving={savingKind === 'RUNNING_ANALYST'} onSave={onSave} onReset={onReset} onActivated={onActivated} />
      <PromptEditor setting={prompts.newReviewer} canEdit={canEdit} saving={savingKind === 'NEW_REVIEWER'} onSave={onSave} onReset={onReset} onActivated={onActivated} />
    </section>
  );
}

function PromptEditor({
  setting,
  canEdit,
  saving,
  onSave,
  onReset,
  onActivated,
}: {
  setting: CreativeAiPromptSetting;
  canEdit: boolean;
  saving: boolean;
  onSave: (kind: CreativeAiPromptSetting['kind'], body: string, note: string) => void;
  onReset: (kind: CreativeAiPromptSetting['kind']) => void;
  onActivated: (setting: CreativeAiPromptSetting) => void;
}) {
  const [draft, setDraft] = useState(setting.body);
  const [note, setNote] = useState('');
  const [showAppendix, setShowAppendix] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [versions, setVersions] = useState<CreativeAiPromptVersion[] | null>(null);
  const [activating, setActivating] = useState<number | null>(null);

  useEffect(() => {
    setDraft(setting.body);
    setNote('');
  }, [setting.body, setting.version]);

  const dirty = draft.trim() !== setting.body.trim();
  const unknown = findUnknownTokens(draft, setting.variables.map((variable) => variable.token));

  const loadHistory = async () => {
    setShowHistory((open) => !open);
    if (versions === null) setVersions(await fetchCreativeAiPromptVersions(setting.kind).catch(() => []));
  };

  const activate = async (version: number) => {
    setActivating(version);
    try {
      const updated = await activateCreativeAiPromptVersion(setting.kind, version);
      onActivated(updated);
      setVersions(await fetchCreativeAiPromptVersions(setting.kind).catch(() => []));
    } finally {
      setActivating(null);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{setting.label}</h3>
          <p className="mt-0.5 text-xs text-muted">{setting.purpose}</p>
        </div>
        <span className="rounded bg-muted-soft px-2 py-0.5 text-xs text-muted">
          {setting.isDefault
            ? 'Built-in default'
            : `v${setting.version}${setting.updatedBy ? ` · ${setting.updatedBy}` : ''}${setting.updatedAt ? ` · ${new Date(setting.updatedAt).toLocaleDateString()}` : ''}`}
        </span>
      </header>

      <div className="mb-2 flex flex-wrap gap-1.5">
        {setting.variables.map((variable) => (
          <span
            key={variable.token}
            title={variable.description}
            className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${variable.required ? 'bg-primary-soft text-primary' : 'bg-muted-soft text-muted'}`}
          >
            {`{{${variable.token}}}`}
            {variable.required ? ' · always included' : ''}
          </span>
        ))}
      </div>

      <textarea
        id={`prompt-${setting.kind}`}
        className="input min-h-[420px] w-full resize-y font-mono text-[12.5px] leading-relaxed"
        value={draft}
        disabled={!canEdit}
        spellCheck={false}
        onChange={(event) => setDraft(event.target.value)}
      />

      {unknown.length > 0 ? (
        <p className="mt-2 text-xs text-warning">
          Nothing will fill {unknown.map((token) => `{{${token}}}`).join(', ')}. It will appear in the prompt as typed.
        </p>
      ) : null}

      <button type="button" className="mt-3 flex items-center gap-1.5 text-xs text-muted hover:text-foreground" onClick={() => setShowAppendix((open) => !open)}>
        <ChevronDown className={`h-3.5 w-3.5 transition ${showAppendix ? 'rotate-180' : ''}`} />
        What the system adds after your text (not editable)
      </button>
      {showAppendix ? (
        <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-muted-soft p-3 font-mono text-[11.5px] leading-relaxed text-muted whitespace-pre-wrap">{setting.appendix}</pre>
      ) : null}

      {canEdit ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            className="input h-9 flex-1 text-xs"
            placeholder="What changed and why (shown in history)"
            value={note}
            maxLength={300}
            onChange={(event) => setNote(event.target.value)}
          />
          <Button type="button" loading={saving} disabled={!dirty || !draft.trim()} onClick={() => onSave(setting.kind, draft, note)}>
            Save as new version
          </Button>
          {dirty ? (
            <Button type="button" variant="ghost" onClick={() => setDraft(setting.body)}>
              Discard
            </Button>
          ) : null}
          {!setting.isDefault ? (
            <Button type="button" variant="ghost" iconLeft={<RotateCcw className="h-3.5 w-3.5" />} onClick={() => onReset(setting.kind)}>
              Reset to default
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted">Prompts are maintained by whoever manages creative performance.</p>
      )}

      {setting.latestVersion > 0 ? (
        <div className="mt-4 border-t border-border pt-3">
          <button type="button" className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground" onClick={() => void loadHistory()}>
            <History className="h-3.5 w-3.5" />
            Version history ({setting.latestVersion})
          </button>
          {showHistory && versions ? (
            <ul className="mt-2 space-y-1">
              {versions.map((version) => (
                <li key={version.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs odd:bg-muted-soft/50">
                  <span>
                    <span className="font-medium">v{version.version}</span>
                    {version.isActive ? <span className="ml-2 rounded bg-success-soft/50 px-1.5 py-0.5 text-[10px] text-success">active</span> : null}
                    <span className="ml-2 text-muted">{version.note ?? 'no note'}</span>
                  </span>
                  <span className="flex items-center gap-2 text-muted">
                    {version.createdBy ?? 'unknown'} · {new Date(version.createdAt).toLocaleString()}
                    {canEdit && !version.isActive ? (
                      <Button type="button" size="sm" variant="ghost" loading={activating === version.version} onClick={() => void activate(version.version)}>
                        Use this
                      </Button>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function findUnknownTokens(body: string, known: string[]): string[] {
  const allowed = new Set(known);
  const seen = new Set<string>();
  for (const match of body.matchAll(/\{\{\s*([A-Z][A-Z0-9_]*)\s*\}\}/g)) {
    if (!allowed.has(match[1])) seen.add(match[1]);
  }
  return [...seen];
}
