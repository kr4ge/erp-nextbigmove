'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent } from 'react';
import { ClipboardPaste, FileText, Sheet, Presentation, FileType2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import {
  fetchCreativeAiDocuments,
  removeCreativeAiDocument,
  uploadCreativeAiDocument,
} from '@/app/(dashboard)/creative-agent/video-registry/_services/creative-ai.service';
import type {
  CreativeAiDocument,
  CreativeAiDocumentScope,
  CreativeAiDocumentsResponse,
} from '@/app/(dashboard)/creative-agent/video-registry/_types/creative-ai';

/**
 * Documents the analysis consults: brand rules, claim sheets, playbooks.
 *
 * Files arrive three ways, because people have them in three places: dropped
 * from a folder, pasted from the clipboard (a copied file, or copied text
 * that becomes a text document), or browsed for. Several at once share one
 * scope, so a product's whole folder goes in as one action.
 *
 * Documents are material for the model to consult, never evidence. They stay
 * out of the knowledge base, and each one shows what it adds to every analysis
 * it applies to, so a forty-page PDF is a decision rather than a surprise.
 */

const SCOPES: Array<{ value: CreativeAiDocumentScope; label: string; hint: string }> = [
  { value: 'TENANT', label: 'Every store', hint: 'Compliance, brand voice, playbooks' },
  { value: 'STORE', label: 'One store', hint: 'Store rules, audience notes' },
  { value: 'PRODUCT', label: 'One product', hint: 'Claim sheets, ingredients, offers' },
];
const inputClass = 'h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:border-primary disabled:opacity-60';

type Pending = { key: string; file: File; title: string };

const bytes = (value: number) => (value < 1024 * 1024 ? `${Math.max(1, Math.round(value / 1024))} KB` : `${(value / (1024 * 1024)).toFixed(1)} MB`);
const tokens = (value: number) => (value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value));
const extensionOf = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';
const titleOf = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();

function FileIcon({ name, className = 'h-4 w-4' }: { name: string; className?: string }) {
  const ext = extensionOf(name);
  if (['xlsx', 'ods', 'csv'].includes(ext)) return <Sheet className={className} />;
  if (['pptx', 'odp'].includes(ext)) return <Presentation className={className} />;
  if (ext === 'pdf') return <FileType2 className={className} />;
  return <FileText className={className} />;
}

export function AiDocumentsPanel() {
  const { addToast } = useToast();
  const [data, setData] = useState<CreativeAiDocumentsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  /** The document whose X was clicked; its row turns into the question until answered. */
  const [confirming, setConfirming] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [scope, setScope] = useState<CreativeAiDocumentScope>('TENANT');
  const [storeConfigId, setStoreConfigId] = useState('');
  const [productName, setProductName] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await fetchCreativeAiDocuments());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load reference documents.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const accepted = useMemo(() => new Set<string>(data?.limits.acceptedExtensions ?? []), [data]);
  const accept = useMemo(() => [...accepted].map((ext) => `.${ext}`).join(','), [accepted]);
  const totalTokens = useMemo(() => (data?.documents ?? []).filter((doc) => doc.status === 'READY').reduce((sum, doc) => sum + doc.tokenEstimate, 0), [data]);
  const scopeReady = scope === 'TENANT' || (Boolean(storeConfigId) && (scope !== 'PRODUCT' || productName.trim().length > 0));
  const canSubmit = pending.length > 0 && scopeReady && !uploading;

  /** Files from any source go through one gate: type and size, with a reason when refused. */
  const enqueue = useCallback((files: File[]) => {
    if (!data) return;
    const maxBytes = data.limits.maxFileMb * 1024 * 1024;
    const next: Pending[] = [];
    const refused: string[] = [];
    for (const file of files) {
      if (!accepted.has(extensionOf(file.name))) refused.push(`${file.name}: unsupported type`);
      else if (file.size > maxBytes) refused.push(`${file.name}: over ${data.limits.maxFileMb} MB`);
      else next.push({ key: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`, file, title: titleOf(file.name) });
    }
    if (refused.length) addToast('error', refused.join('. '));
    if (next.length) setPending((current) => [...current, ...next]);
  }, [accepted, addToast, data]);

  /** Copied text becomes a text document; a copied file is taken as it is. */
  const onPaste = (event: ClipboardEvent<HTMLElement>) => {
    if (!data?.canManage) return;
    const files = Array.from(event.clipboardData.files ?? []);
    if (files.length) {
      event.preventDefault();
      enqueue(files);
      return;
    }
    const text = event.clipboardData.getData('text/plain').trim();
    if (text.length >= 20) {
      event.preventDefault();
      const firstLine = text.split('\n')[0].replace(/^#+\s*/, '').trim().slice(0, 80);
      const name = `${(firstLine || 'Pasted notes').replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'Pasted notes'}.txt`;
      enqueue([new File([text], name, { type: 'text/plain', lastModified: Date.now() })]);
    }
  };

  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragging(false);
    if (!data?.canManage) return;
    enqueue(Array.from(event.dataTransfer.files ?? []));
  };

  const upload = async () => {
    if (!canSubmit) return;
    setUploading(true);
    let added = 0;
    const failed: string[] = [];
    for (const item of pending) {
      try {
        const created = await uploadCreativeAiDocument({
          file: item.file,
          scope,
          storeConfigId: scope === 'TENANT' ? undefined : storeConfigId,
          productName: scope === 'PRODUCT' ? productName.trim() : undefined,
          title: item.title.trim() || undefined,
        });
        if (created.status === 'READY') added += 1;
        else failed.push(`${created.title}: ${created.statusNote ?? 'no readable text'}`);
      } catch (err) {
        failed.push(`${item.title}: ${err instanceof Error ? err.message : 'upload failed'}`);
      }
    }
    setUploading(false);
    setPending([]);
    if (fileInput.current) fileInput.current.value = '';
    if (added) addToast('success', added === 1 ? 'Document added.' : `${added} documents added.`);
    if (failed.length) addToast('error', failed.join(' · '));
    await load();
  };

  const remove = async (doc: CreativeAiDocument) => {
    setRemoving(doc.id);
    try {
      await removeCreativeAiDocument(doc.id);
      addToast('success', `${doc.title} removed.`);
      await load();
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Unable to remove the document.');
    } finally {
      setRemoving(null);
      setConfirming(null);
    }
  };

  return (
    <section className="panel p-5" onPaste={onPaste}>
      <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Reference documents</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">Brand rules, claim sheets, playbooks. The analysis consults them and names them when they matter. They are not evidence and never enter the knowledge base.</p>
        </div>
        {data && data.documents.length > 0 ? (
          <p className="shrink-0 text-xs tabular-nums text-muted">{data.documents.length} document{data.documents.length === 1 ? '' : 's'} · about {tokens(totalTokens)} tokens if all apply</p>
        ) : null}
      </div>

      {error ? <p className="mb-4 rounded-lg bg-destructive-soft px-3 py-2 text-sm text-destructive">{error}</p> : null}

      {data?.canManage ? (
        <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          {/* Where files come in. One surface, three ways in. */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Add documents: drop files here, paste, or browse"
            onClick={() => fileInput.current?.click()}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fileInput.current?.click(); } }}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`flex min-h-[11rem] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${dragging ? 'border-primary bg-primary-soft/40' : 'border-border bg-background-secondary/40 hover:border-primary/50 hover:bg-background-secondary/70'}`}
          >
            <input ref={fileInput} id="ai-document-files" type="file" multiple accept={accept} className="sr-only" onChange={(event) => { enqueue(Array.from(event.target.files ?? [])); event.target.value = ''; }} disabled={uploading} />
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-primary shadow-sm"><Upload className="h-5 w-5" /></div>
            <p className="mt-3 text-sm font-medium text-foreground">Drop files here, or <span className="text-primary underline-offset-2 hover:underline">browse</span></p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted"><ClipboardPaste className="h-3.5 w-3.5" /> Or paste: a copied file, or copied text becomes a text document</p>
            <p className="mt-3 text-[11px] text-faint">PDF, Word, Excel, PowerPoint, text · up to {data.limits.maxFileMb} MB each · scanned PDFs and picture-only slides have no text to read</p>
          </div>

          {/* Who the documents are for, then the queue and the one action. */}
          <div className="flex flex-col gap-3">
            <div>
              <span className="mb-1.5 block text-xs font-medium text-muted">Applies to</span>
              <div className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-background-secondary p-1" role="radiogroup" aria-label="Applies to">
                {SCOPES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={scope === option.value}
                    title={option.hint}
                    onClick={() => setScope(option.value)}
                    className={`h-8 rounded-md text-xs font-medium transition ${scope === option.value ? 'bg-surface text-foreground shadow-sm' : 'text-muted hover:text-foreground'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-muted">{SCOPES.find((option) => option.value === scope)?.hint}</p>
            </div>
            {scope !== 'TENANT' ? (
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Store</span>
                <select id="ai-document-store" className={inputClass} value={storeConfigId} onChange={(event) => setStoreConfigId(event.target.value)} disabled={uploading}>
                  <option value="">Choose a store…</option>
                  {data.stores.map((store) => <option key={store.value} value={store.value}>{store.label}</option>)}
                </select>
              </label>
            ) : null}
            {scope === 'PRODUCT' ? (
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Product</span>
                <input id="ai-document-product" className={inputClass} value={productName} placeholder="Exactly as registered on the creative" onChange={(event) => setProductName(event.target.value)} disabled={uploading} />
              </label>
            ) : null}

            {pending.length > 0 ? (
              <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
                {pending.map((item) => (
                  <li key={item.key} className="flex items-center gap-2.5 px-3 py-2">
                    <FileIcon name={item.file.name} className="h-4 w-4 shrink-0 text-muted" />
                    <input
                      aria-label={`Title for ${item.file.name}`}
                      className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-faint"
                      value={item.title}
                      placeholder={titleOf(item.file.name)}
                      maxLength={160}
                      disabled={uploading}
                      onChange={(event) => setPending((current) => current.map((entry) => (entry.key === item.key ? { ...entry, title: event.target.value } : entry)))}
                    />
                    <span className="shrink-0 text-[11px] tabular-nums text-muted">{bytes(item.file.size)}</span>
                    <button type="button" aria-label={`Remove ${item.file.name}`} disabled={uploading} onClick={() => setPending((current) => current.filter((entry) => entry.key !== item.key))} className="rounded p-1 text-muted transition hover:text-foreground disabled:opacity-50"><X className="h-3.5 w-3.5" /></button>
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="mt-auto flex items-center justify-between gap-3">
              <p className="text-[11px] text-muted">{pending.length === 0 ? 'Nothing queued yet.' : !scopeReady ? (scope === 'PRODUCT' ? 'Choose the store and name the product.' : 'Choose the store.') : `Ready to add ${pending.length} file${pending.length === 1 ? '' : 's'}.`}</p>
              <Button type="button" size="sm" iconLeft={<Upload className="h-4 w-4" />} loading={uploading} disabled={!canSubmit} onClick={() => void upload()}>
                {pending.length > 1 ? `Add ${pending.length} documents` : 'Add document'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {!data ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted"><Spinner /> Loading…</div>
      ) : data.documents.length === 0 ? (
        <p className="py-2 text-center text-sm text-muted">No documents yet. Analyses judge on the knowledge base and the craft rubric alone.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {data.documents.map((doc) => (
            <li key={doc.id} className="flex items-start gap-3 px-4 py-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background-secondary text-muted"><FileIcon name={doc.fileName} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="truncate text-sm font-medium text-foreground">{doc.title}</p>
                  {doc.version > 1 ? <span className="text-[11px] text-muted">v{doc.version}</span> : null}
                  {doc.status === 'READY'
                    ? <span className="pill border-none bg-success-soft/40 text-success">Ready</span>
                    : <span className="pill border-none bg-warning-soft/50 text-warning" title={doc.statusNote ?? undefined}>{doc.status === 'FAILED' ? 'Unreadable' : 'No text'}</span>}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {SCOPES.find((option) => option.value === doc.scope)?.label}
                  {doc.storeName ? ` · ${doc.storeName}` : ''}
                  {doc.productName ? ` · ${doc.productName}` : ''}
                  {' · '}{bytes(doc.byteSize)}
                  {doc.status === 'READY' ? ` · adds ${tokens(doc.tokenEstimate)} tokens` : ''}
                  {' · '}{new Date(doc.createdAt).toLocaleDateString()}{doc.uploadedBy ? ` by ${doc.uploadedBy}` : ''}
                </p>
                {doc.statusNote ? <p className="mt-1 text-xs text-warning">{doc.statusNote}</p> : doc.excerpt && doc.status === 'READY' ? <p className="mt-1 line-clamp-1 text-xs text-faint">{doc.excerpt}</p> : null}
              </div>
              {data.canManage ? (
                confirming === doc.id ? (
                  <div className="flex shrink-0 items-center gap-2 rounded-lg border border-destructive/30 bg-destructive-soft px-3 py-1.5 text-xs">
                    <span className="text-destructive">Remove? Analyses stop consulting it.</span>
                    <Button type="button" size="sm" variant="danger" loading={removing === doc.id} onClick={() => void remove(doc)}>Remove</Button>
                    <Button type="button" size="sm" variant="ghost" disabled={removing === doc.id} onClick={() => setConfirming(null)}>Keep</Button>
                  </div>
                ) : (
                  <button type="button" className="shrink-0 rounded-md p-1.5 text-muted transition hover:bg-destructive-soft hover:text-destructive" aria-label={`Remove ${doc.title}`} title="Remove" onClick={() => setConfirming(doc.id)}>
                    <X className="h-4 w-4" />
                  </button>
                )
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
