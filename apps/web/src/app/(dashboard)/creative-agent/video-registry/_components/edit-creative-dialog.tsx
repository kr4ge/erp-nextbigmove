"use client";

import { useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";
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
  script: string | null;
  notes: string | null;
};

type Props = {
  item: EditableCreative | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (id: string, input: UpdateVideoRegistryInput) => Promise<void>;
};

function toForm(item: EditableCreative): UpdateVideoRegistryInput {
  return {
    title: item.title,
    mediaUrl: item.mediaUrl ?? "",
    format: item.format ?? "",
    hookType: item.hookType ?? "",
    script: item.script ?? "",
    notes: item.notes ?? "",
  };
}

export function EditCreativeDialog({ item, isSaving, onClose, onSave }: Props) {
  const [form, setForm] = useState<UpdateVideoRegistryInput | null>(null);
  const { options: creativeOptions, addOption } = useCreativeOptions(form !== null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(item ? toForm(item) : null);
    setError(null);
  }, [item]);

  const isDirty = useMemo(() => Boolean(item && form && JSON.stringify(form) !== JSON.stringify(toForm(item))), [form, item]);
  if (!item || !form) return null;

  const setField = (field: keyof UpdateVideoRegistryInput, value: string) => {
    setForm((current) => current ? { ...current, [field]: value } : current);
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
        hookType: item.kind === "VIDEO" ? form.hookType : "",
        script: item.kind === "VIDEO" ? form.script : "",
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
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <CreativeDetailsFields kind={item.kind} options={creativeOptions} onCreateOption={addOption} value={form} onChange={setField} />
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
