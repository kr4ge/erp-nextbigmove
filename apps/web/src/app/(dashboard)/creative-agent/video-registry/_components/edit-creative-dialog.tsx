"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImageIcon, ImagePlus, Save, Trash2, Upload, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CreativeKind, UpdateVideoRegistryInput } from "../_types/video-registry";
import { isValidFacebookPostUrl } from "../_utils/facebook-post-url";
import { CreativeDetailsFields } from "./creative-details-fields";
import { useCreativeOptions } from "../_hooks/use-creative-options";

export type EditableCreative = {
  id: string;
  code: string;
  title: string;
  kind: CreativeKind;
  mediaUrl: string | null;
  format: string | null;
  hookType: string | null;
  angle: string | null;
  script: string | null;
  notes: string | null;
  thumbnailUrl?: string | null;
  thumbnailIsVideo?: boolean;
};

/** PNG/JPEG/WebP only — matches what the upload pipeline accepts server-side. */
const THUMBNAIL_ACCEPT = "image/png,image/jpeg,image/webp";
const THUMBNAIL_MAX_BYTES = 8 * 1024 * 1024;

type ThumbnailResult = { thumbnailUrl: string; thumbnailIsVideo: boolean };

type Props = {
  item: EditableCreative | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (id: string, input: UpdateVideoRegistryInput) => Promise<void>;
  /** A creative with no usable auto-captured cover can still get one, pasted in directly. */
  onUploadThumbnail: (id: string, file: File) => Promise<ThumbnailResult>;
  onRemoveThumbnail: (id: string) => Promise<void>;
};

function toForm(item: EditableCreative): UpdateVideoRegistryInput {
  return {
    kind: item.kind,
    title: item.title,
    mediaUrl: item.mediaUrl ?? "",
    format: item.format ?? "",
    hookType: item.hookType ?? "",
    angle: item.angle ?? "",
    script: item.script ?? "",
    notes: item.notes ?? "",
  };
}

export function EditCreativeDialog({ item, isSaving, onClose, onSave, onUploadThumbnail, onRemoveThumbnail }: Props) {
  const [form, setForm] = useState<UpdateVideoRegistryInput | null>(null);
  const { options: creativeOptions, addOption } = useCreativeOptions(form !== null);
  const [error, setError] = useState<string | null>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const [isThumbnailBusy, setIsThumbnailBusy] = useState(false);
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);
  const [isDraggingImage, setIsDraggingImage] = useState(false);

  // Keyed on id, not the whole item: a thumbnail upload replaces `item` with a
  // fresh reference (new thumbnailUrl) so the preview updates, but re-running
  // this on every such change would blow away whatever the user had already
  // typed into the still-open title/format/script fields.
  useEffect(() => {
    setForm(item ? toForm(item) : null);
    setError(null);
    setThumbnailError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  const uploadThumbnailFile = useCallback(async (file: File) => {
    if (!item) return;
    if (!THUMBNAIL_ACCEPT.split(",").includes(file.type)) {
      setThumbnailError("Use a PNG, JPEG, or WebP image.");
      return;
    }
    if (file.size > THUMBNAIL_MAX_BYTES) {
      setThumbnailError("Thumbnail image must be 8MB or smaller.");
      return;
    }
    setThumbnailError(null);
    setIsThumbnailBusy(true);
    try {
      await onUploadThumbnail(item.id, file);
    } catch (uploadError) {
      setThumbnailError(uploadError instanceof Error ? uploadError.message : "Unable to upload this thumbnail.");
    } finally {
      setIsThumbnailBusy(false);
    }
  }, [item, onUploadThumbnail]);

  // Paste anywhere in the dialog to set the thumbnail — no need to click into
  // a specific spot first. Only clipboard data carrying an actual image is
  // intercepted, so pasting text into Title/Notes/etc. is untouched.
  useEffect(() => {
    if (!item) return;
    const onWindowPaste = (event: ClipboardEvent) => {
      const imageItem = Array.from(event.clipboardData?.items ?? []).find((dataItem) => dataItem.type.startsWith("image/"));
      if (!imageItem) return;
      event.preventDefault();
      const file = imageItem.getAsFile();
      if (file) void uploadThumbnailFile(file);
    };
    window.addEventListener("paste", onWindowPaste);
    return () => window.removeEventListener("paste", onWindowPaste);
  }, [item, uploadThumbnailFile]);

  const isDirty = useMemo(() => Boolean(item && form && JSON.stringify(form) !== JSON.stringify(toForm(item))), [form, item]);
  if (!item || !form) return null;

  const setField = (field: keyof UpdateVideoRegistryInput, value: string) => {
    setForm((current) => current ? { ...current, [field]: value } : current);
  };

  const setKind = (nextKind: CreativeKind) => {
    setForm((current) => current ? {
      ...current,
      kind: nextKind,
      // A field the new kind does not show should not survive the switch.
      hookType: nextKind === "VIDEO" ? current.hookType : "",
      script: nextKind === "VIDEO" ? current.script : "",
    } : current);
  };

  const pickThumbnail = () => thumbnailInputRef.current?.click();

  // The whole dialog body accepts the drop, not just the small preview box:
  // missing a narrow target would otherwise make the browser navigate away and
  // open the dropped file, losing the unsaved edits behind it.
  const isFileDrag = (event: React.DragEvent) => Array.from(event.dataTransfer.types).includes("Files");

  const handleDragOver = (event: React.DragEvent) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    setIsDraggingImage(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    // Crossing into a child still counts as being inside the zone.
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setIsDraggingImage(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    setIsDraggingImage(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void uploadThumbnailFile(file);
  };

  const handleThumbnailFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // lets picking the same file again re-trigger onChange
    if (file) void uploadThumbnailFile(file);
  };

  const handleRemoveThumbnail = async () => {
    if (!item) return;
    setThumbnailError(null);
    setIsThumbnailBusy(true);
    try {
      await onRemoveThumbnail(item.id);
    } catch (removeError) {
      setThumbnailError(removeError instanceof Error ? removeError.message : "Unable to remove this thumbnail.");
    } finally {
      setIsThumbnailBusy(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError("Enter the title shown in the creative registry.");
    if (form.mediaUrl && !isValidFacebookPostUrl(form.mediaUrl)) return setError("Use a valid Facebook post link, such as https://www.facebook.com/.../posts/...");
    try {
      await onSave(item.id, {
        ...form,
        title: form.title.trim(),
        hookType: form.kind === "VIDEO" ? form.hookType : "",
        script: form.kind === "VIDEO" ? form.script : "",
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save this creative.");
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="flex max-h-[90vh] w-11/12 max-w-3xl flex-col overflow-hidden p-0 sm:max-w-3xl">
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-5">
            <DialogTitle className="mb-0">Edit creative</DialogTitle>
            <DialogDescription>
              <code className="font-semibold text-primary">{item.code}</code> · Save the requested changes before submitting or resubmitting for approval.
            </DialogDescription>
          </DialogHeader>
          <div
            className="min-h-0 flex-1 overflow-y-auto px-6 py-5"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="mb-4">
              <span className="form-label">Thumbnail</span>
              <div className={`mt-1.5 flex items-start gap-3 rounded-xl border border-dashed p-3 transition ${isDraggingImage ? "border-primary bg-primary-soft/40" : "border-border"}`}>
                <button
                  type="button"
                  onClick={pickThumbnail}
                  className="aspect-video w-32 shrink-0 overflow-hidden rounded-lg border border-border bg-background-secondary transition hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  aria-label={item.thumbnailUrl ? "Replace the thumbnail" : "Add a thumbnail"}
                >
                  {item.thumbnailUrl ? (
                    // Signed object-storage URL — intentionally bypasses Next's image proxy.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.thumbnailUrl} alt={`Thumbnail for ${item.title}`} className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted">
                      <ImagePlus className="h-5 w-5" />
                      <span className="text-xs-tight font-medium">Drop or paste</span>
                    </span>
                  )}
                </button>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" loading={isThumbnailBusy} iconLeft={<Upload className="h-3.5 w-3.5" />} onClick={pickThumbnail}>
                      {item.thumbnailUrl ? "Replace thumbnail" : "Upload thumbnail"}
                    </Button>
                    {item.thumbnailUrl ? (
                      <Button type="button" variant="ghost" size="sm" loading={isThumbnailBusy} iconLeft={<Trash2 className="h-3.5 w-3.5" />} onClick={() => void handleRemoveThumbnail()}>
                        Remove
                      </Button>
                    ) : null}
                  </div>
                  {/* Uploads take effect immediately — no "Save changes" needed — the same
                      way the Facebook link's auto-captured cover already does. */}
                  <p className="text-xs text-muted">
                    Drag an image anywhere into this dialog, paste one (Ctrl+V / ⌘V), or browse. PNG, JPEG, or WebP up to 8MB — it applies right away and overrides the Facebook post cover.
                  </p>
                  {thumbnailError ? <p className="text-xs text-destructive" role="alert">{thumbnailError}</p> : null}
                </div>
                <input ref={thumbnailInputRef} type="file" accept={THUMBNAIL_ACCEPT} className="hidden" onChange={handleThumbnailFile} />
              </div>
            </div>
            <div className="mb-4">
              <span className="form-label">Creative type</span>
              <div className="mt-1.5 inline-flex rounded-lg border border-border p-0.5" role="radiogroup" aria-label="Creative type">
                {(["VIDEO", "STATIC"] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    role="radio"
                    aria-checked={form.kind === kind}
                    onClick={() => setKind(kind)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${form.kind === kind ? "bg-primary-soft text-primary" : "text-muted hover:text-foreground"}`}
                  >
                    {kind === "VIDEO" ? <Video className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />}
                    {kind === "VIDEO" ? "Video" : "Static"}
                  </button>
                ))}
              </div>
              {/* The code's V/I letter is minted once and never reissued, so correcting
                  a wrong kind here never breaks an ad name already pasted into Meta. */}
              <p className="mt-1.5 text-xs text-muted">
                Fixes a wrong registration. <code className="font-semibold text-foreground">{item.code}</code> and any ad name already pasted into Meta stay unchanged.
              </p>
            </div>
            <CreativeDetailsFields kind={form.kind} options={creativeOptions} onCreateOption={addOption} value={form} onChange={setField} />
            {error ? <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive-soft p-3 text-sm text-destructive" role="alert">{error}</p> : null}
          </div>
          <DialogFooter className="shrink-0 border-t border-border bg-surface px-6 py-4">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={isSaving} disabled={!isDirty} iconLeft={<Save className="h-4 w-4" />}>Save changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
