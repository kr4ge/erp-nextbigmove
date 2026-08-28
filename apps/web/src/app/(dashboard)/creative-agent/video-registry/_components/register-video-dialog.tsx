"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ImageIcon, Plus, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormInput } from "@/components/ui/form-input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type {
  CreativeKind,
  CreateVideoRegistryInput,
  RegistryOption,
  UnregisteredMetaCreative,
  VideoRegistryItem,
} from "../_types/video-registry";
import { isValidFacebookPostUrl } from "../_utils/facebook-post-url";
import { validateCreativeTitle } from "../_utils/creative-title";
import { readCurrentUserName } from "../_utils/current-user-name";
import { useCreativeOptions } from "../_hooks/use-creative-options";
import {
  fetchStoreEnrollmentItems,
  type StoreEnrollmentItem,
} from "../_services/video-registry.service";
import { buildAdName } from "../../assets/_components/copy-code-button";
import { CreativeCodeField } from "./creative-code-field";
import { CreativeDetailsFields } from "./creative-details-fields";

type Props = {
  open: boolean;
  stores: RegistryOption[];
  seed: UnregisteredMetaCreative | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (input: CreateVideoRegistryInput) => Promise<VideoRegistryItem>;
  /** Fired once after every entry in the batch is registered. */
  onRegistered?: (count: number) => void;
  /** The viewer's creator segment as the server computed it (tenant-unique). */
  creatorLabel?: string | null;
};

const EMPTY_FORM = {
  storeId: "",
  variationId: "",
  title: "",
  mediaUrl: "",
  format: "",
  hookType: "",
  script: "",
  notes: "",
};
type FormState = typeof EMPTY_FORM;

/**
 * One creative in the batch. Only one entry is expanded at a time; the rest
 * collapse to their ad name so a long batch stays readable.
 */
type Entry = {
  id: string;
  kind: CreativeKind;
  form: FormState;
  error: string | null;
};

let entrySeq = 0;
const newEntry = (kind: CreativeKind, storeId: string): Entry => ({
  id: `entry-${++entrySeq}`,
  kind,
  form: { ...EMPTY_FORM, storeId },
  error: null,
});

/**
 * Preview codes for later entries in the same store. The server mints the
 * real code at save time; this only keeps the preview honest when two
 * creatives in one batch share a prefix.
 */
function offsetCode(code: string, by: number): string {
  if (by === 0) return code;
  const match = code.match(/^(.*-V)(\d+)$/);
  if (!match) return code;
  return `${match[1]}${String(Number(match[2]) + by).padStart(match[2].length, "0")}`;
}

export function RegisterVideoDialog({
  open,
  stores,
  seed,
  isSaving,
  onClose,
  onSubmit,
  onRegistered,
  creatorLabel,
}: Props) {
  // The server label knows about namesakes in the tenant; the local first
  // name only bridges the moment before the registry response arrives.
  const [localCreator, setLocalCreator] = useState<string | null>(null);
  const { options: creativeOptions, addOption } = useCreativeOptions(open);
  useEffect(() => { setLocalCreator(readCurrentUserName()); }, []);
  const creatorName = creatorLabel ?? localCreator;

  const [entries, setEntries] = useState<Entry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const seedStoreId = useMemo(() => {
    if (!seed) return "";
    if (seed.store?.id) return seed.store.id;
    return stores.find((store) => store.label === seed.store?.name)?.value ?? "";
  }, [stores, seed]);

  // Items per store, cached: a batch usually reuses one store many times.
  const [itemsByStore, setItemsByStore] = useState<Record<string, StoreEnrollmentItem[]>>({});
  const [loadingStores, setLoadingStores] = useState<Record<string, boolean>>({});
  const ensureItems = (storeId: string) => {
    if (!storeId || itemsByStore[storeId] || loadingStores[storeId]) return;
    setLoadingStores((current) => ({ ...current, [storeId]: true }));
    fetchStoreEnrollmentItems(storeId)
      .then((list) => setItemsByStore((current) => ({ ...current, [storeId]: list })))
      .catch(() => setItemsByStore((current) => ({ ...current, [storeId]: [] })))
      .finally(() => setLoadingStores((current) => ({ ...current, [storeId]: false })));
  };

  useEffect(() => {
    if (!open) return;
    const storeId = seedStoreId || (stores.length === 1 ? stores[0].value : "");
    const first = newEntry("VIDEO", storeId);
    setEntries([first]);
    setActiveId(first.id);
    setError(null);
    setSubmitting(false);
    if (storeId) ensureItems(storeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, seedStoreId, seed?.key]);

  const updateEntry = (id: string, patch: (entry: Entry) => Entry) =>
    setEntries((current) => current.map((entry) => (entry.id === id ? patch(entry) : entry)));

  const setField = (id: string, field: keyof FormState, value: string) => {
    if (field === "storeId") ensureItems(value);
    updateEntry(id, (entry) => ({
      ...entry,
      error: null,
      form: field === "storeId"
        ? { ...entry.form, storeId: value, variationId: "" }
        : { ...entry.form, [field]: value },
    }));
  };

  const setKind = (id: string, kind: CreativeKind) =>
    updateEntry(id, (entry) => entry.kind === kind ? entry : ({
      ...entry, kind, form: { ...entry.form, format: "", hookType: "", script: "" },
    }));

  // ---- derived, per entry ----
  const storeOf = (entry: Entry) => stores.find((store) => store.value === entry.form.storeId) ?? null;
  const itemsOf = (entry: Entry) => itemsByStore[entry.form.storeId] ?? [];
  const itemOf = (entry: Entry) => itemsOf(entry).find((item) => item.variationId === entry.form.variationId) ?? null;
  const codeOf = (entry: Entry, index: number) => {
    if (seed?.code) return seed.code;
    const next = storeOf(entry)?.nextCode;
    if (!next) return null;
    const priorSameStore = entries.slice(0, index).filter((other) => other.form.storeId === entry.form.storeId).length;
    return offsetCode(next, priorSameStore);
  };
  const adNameOf = (entry: Entry, index: number) => {
    const code = codeOf(entry, index);
    if (!code) return null;
    return buildAdName({ customId: itemOf(entry)?.customId ?? null, title: entry.form.title, code, creator: creatorName });
  };
  /** The required set for a paste-ready ad name — the gate for adding another. */
  const problemOf = (entry: Entry, index: number): string | null => {
    if (!entry.form.storeId) return "Choose the store that owns this creative.";
    if (!entry.form.variationId) return "Choose the item this creative advertises.";
    if (!entry.form.title.trim()) return "Enter the library title.";
    const titleError = validateCreativeTitle(entry.form.title);
    if (titleError) return titleError;
    if (!codeOf(entry, index)) return "Choose a store to mint the code.";
    if (entry.form.mediaUrl && !isValidFacebookPostUrl(entry.form.mediaUrl)) {
      return "Use a valid Facebook post link, such as https://www.facebook.com/.../posts/...";
    }
    return null;
  };

  // A new or reopened entry may render below the fold of the scrolling body;
  // bring it into view so the animation is actually seen.
  useEffect(() => {
    if (!activeId) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById(activeId)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeId]);

  const activeIndex = entries.findIndex((entry) => entry.id === activeId);
  const activeEntry = activeIndex >= 0 ? entries[activeIndex] : null;
  const canAddAnother = Boolean(activeEntry) && !seed && problemOf(activeEntry!, activeIndex) === null;

  const addAnother = () => {
    if (!activeEntry || !canAddAnother) return;
    const next = newEntry(activeEntry.kind, activeEntry.form.storeId);
    setEntries((current) => [...current, next]);
    setActiveId(next.id);
  };

  const removeEntry = (id: string) => {
    setEntries((current) => {
      const remaining = current.filter((entry) => entry.id !== id);
      if (activeId === id) setActiveId(remaining[remaining.length - 1]?.id ?? null);
      return remaining;
    });
  };

  const submitAll = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    for (let index = 0; index < entries.length; index += 1) {
      const problem = problemOf(entries[index], index);
      if (problem) {
        setActiveId(entries[index].id);
        updateEntry(entries[index].id, (entry) => ({ ...entry, error: problem }));
        return;
      }
    }

    setSubmitting(true);
    let done = 0;
    // Sequential on purpose: codes are minted per store in order, and a
    // failure must stop at a known point rather than half-register a batch.
    for (const entry of [...entries]) {
      try {
        await onSubmit({
          ...entry.form,
          kind: entry.kind,
          submitForApproval: false,
          hookType: entry.kind === "VIDEO" ? entry.form.hookType : "",
          script: entry.kind === "VIDEO" ? entry.form.script : undefined,
          requestedCode: seed?.code ?? undefined,
          unregisteredKey: seed?.key,
          adName: seed?.adName,
          accountId: seed?.accountId,
          adId: seed?.adId,
        });
        done += 1;
        // Registered entries leave the list so a retry cannot duplicate them.
        setEntries((current) => current.filter((other) => other.id !== entry.id));
      } catch (submitError) {
        const message = submitError instanceof Error ? submitError.message : "Unable to register this creative.";
        setActiveId(entry.id);
        updateEntry(entry.id, (other) => ({ ...other, error: message }));
        setSubmitting(false);
        if (done > 0) onRegistered?.(done);
        return;
      }
    }
    setSubmitting(false);
    onRegistered?.(done);
    onClose();
  };

  const busy = isSaving || submitting;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="flex max-h-[92vh] w-11/12 max-w-5xl flex-col overflow-hidden p-0 sm:max-w-5xl">
        <form onSubmit={submitAll} className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-border px-4 py-2.5">
            <DialogTitle className="mb-0 text-base font-semibold">Enroll creatives</DialogTitle>
            <DialogDescription className="text-xs text-muted">
              Fill one, add another — each needs a store, an item and a title first.
            </DialogDescription>
          </div>

          {/* Density layer: the shared input/label primitives are sized for
              single forms; a batch dialog needs the same fields at a tighter
              rhythm without changing them everywhere. Standard scale only. */}
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3 [&_.input]:min-h-10 [&_.input]:rounded-xl [&_.input]:px-3 [&_.input]:py-2 [&_.input]:text-sm [&_.read-only-input]:min-h-10 [&_.read-only-input]:rounded-xl [&_.read-only-input]:px-3 [&_.read-only-input]:py-2 [&_.read-only-input]:text-sm [&_.form-label]:tracking-wide">
            {seed ? (
              <div className="rounded-xl border border-info/30 bg-info-soft px-3 py-2 text-sm">
                <span className="font-semibold text-info">Meta ad selected · </span>
                <span className="font-semibold text-foreground">{seed.adName}</span>
                <span className="text-muted"> · ad {seed.adId} links to this record.</span>
              </div>
            ) : null}

            {entries.map((entry, index) => {
              const isActive = entry.id === activeId;
              const adName = adNameOf(entry, index);
              const store = storeOf(entry);
              const items = itemsOf(entry);
              const loading = Boolean(loadingStores[entry.form.storeId]);

              if (!isActive) {
                return (
                  <div
                    key={entry.id}
                    className={`animate-enter flex items-center gap-3 rounded-xl border px-3 py-1.5 transition hover:border-primary/50 hover:bg-secondary/30 ${entry.error ? "border-destructive/40 bg-destructive-soft/40" : "border-border bg-background-secondary/40"}`}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveId(entry.id)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      aria-label="Edit this creative"
                    >
                      {entry.kind === "VIDEO"
                        ? <Video className="h-4 w-4 shrink-0 text-primary" />
                        : <ImageIcon className="h-4 w-4 shrink-0 text-primary" />}
                      <span className="min-w-0">
                        <code className="block truncate text-sm font-semibold text-foreground">
                          {adName ?? (entry.form.title || "Untitled creative")}
                        </code>
                        <span className="block truncate text-xs text-muted">
                          {[store?.label, itemOf(entry)?.name, entry.form.hookType, entry.form.format].filter(Boolean).join(" · ")}
                          {entry.error ? <span className="text-destructive"> · {entry.error}</span> : null}
                        </span>
                      </span>
                      <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted" />
                    </button>
                    {entries.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeEntry(entry.id)}
                        className="shrink-0 rounded-lg p-1 text-muted hover:bg-secondary/40 hover:text-foreground"
                        aria-label="Remove this creative"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                );
              }

              return (
                <div key={entry.id} id={entry.id} className="animate-enter-emphasis space-y-2.5 rounded-xl border border-primary/40 bg-surface p-3">
                  {/* Kind + code preview in one slim row */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="inline-flex rounded-lg border border-border p-0.5" role="radiogroup" aria-label="Creative type">
                      {(["VIDEO", "STATIC"] as const).map((kind) => (
                        <button
                          key={kind}
                          type="button"
                          role="radio"
                          aria-checked={entry.kind === kind}
                          onClick={() => setKind(entry.id, kind)}
                          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${entry.kind === kind ? "bg-primary-soft text-primary" : "text-muted hover:text-foreground"}`}
                        >
                          {kind === "VIDEO" ? <Video className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />}
                          {kind === "VIDEO" ? "Video" : "Static"}
                        </button>
                      ))}
                    </div>
                    <span className="text-xs text-muted">
                      {codeOf(entry, index) ? <>Code <code className="font-semibold text-foreground">{codeOf(entry, index)}</code></> : "Choose a store to preview the code"}
                    </span>
                    {entries.length > 1 ? (
                      <button type="button" onClick={() => removeEntry(entry.id)} className="rounded-lg p-1 text-muted hover:bg-secondary/40 hover:text-foreground" aria-label="Remove this creative">
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>

                  <div className="grid gap-x-3 gap-y-2.5 lg:grid-cols-2">
                    <SearchableSelect
                      name={`storeId-${entry.id}`}
                      label="Store"
                      selectTitle="Select store"
                      value={entry.form.storeId}
                      onChange={(next) => setField(entry.id, "storeId", next)}
                      options={stores}
                      placeholder="Choose the store"
                      required
                    />
                    <SearchableSelect
                      name={`variationId-${entry.id}`}
                      label="Item this creative sells"
                      selectTitle="Select item"
                      value={entry.form.variationId}
                      onChange={(next) => setField(entry.id, "variationId", next)}
                      options={items.map((item) => ({ value: item.variationId, label: item.name }))}
                      placeholder={!entry.form.storeId ? "Choose the store first" : loading ? "Loading items…" : items.length === 0 ? "No items with a custom ID" : "Choose the item"}
                      disabled={!entry.form.storeId || loading || items.length === 0}
                      helper="Its Pancake custom ID leads the ad name and becomes the mapping."
                      required
                    />
                    <FormInput
                      name={`title-${entry.id}`}
                      label="Library title"
                      value={entry.form.title}
                      onChange={(event) => setField(entry.id, "title", event.target.value)}
                      placeholder={entry.kind === "VIDEO" ? "e.g. Picky Eater Opening Hook V3" : "e.g. Lunchbox Benefit Graphic V2"}
                      error={validateCreativeTitle(entry.form.title) ?? undefined}
                      required
                    />
                    <CreativeCodeField
                      code={codeOf(entry, index)}
                      customId={itemOf(entry)?.customId ?? null}
                      title={entry.form.title}
                      creator={creatorName}
                      helper="Paste as the Meta ad name; the code inside links the ad back here."
                    />
                  </div>

                  <CreativeDetailsFields
                    kind={entry.kind}
                    options={creativeOptions}
                    onCreateOption={addOption}
                    value={entry.form}
                    onChange={(field, value) => setField(entry.id, field, value)}
                    showTitle={false}
                    showPerformanceStatus
                  />

                  {entry.error ? (
                    <p className="rounded-xl border border-destructive/30 bg-destructive-soft p-2.5 text-sm text-destructive" role="alert">
                      {entry.error}
                    </p>
                  ) : null}
                </div>
              );
            })}

            {!seed ? (
              <button
                type="button"
                onClick={addAnother}
                disabled={!canAddAnother || busy}
                title={canAddAnother ? undefined : "Finish the store, item and title of the current creative first"}
                className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2 text-sm font-semibold text-primary transition hover:border-primary hover:bg-primary-soft/30 active:bg-primary-soft/60 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Add new creative
              </button>
            ) : null}

            {error ? (
              <p className="rounded-xl border border-destructive/30 bg-destructive-soft p-3 text-sm text-destructive" role="alert">{error}</p>
            ) : null}
          </div>

          <DialogFooter className="shrink-0 border-t border-border bg-surface px-4 py-2.5">
            <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button type="submit" loading={busy}>
              {entries.length > 1 ? `Register ${entries.length} creatives` : "Register creative"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
