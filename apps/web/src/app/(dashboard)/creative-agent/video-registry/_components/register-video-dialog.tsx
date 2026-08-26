"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ImageIcon, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormInput } from "@/components/ui/form-input";
import { FormSelect } from "@/components/ui/form-select";
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
import { CreativeCodeField } from "./creative-code-field";
import { CreativeDetailsFields } from "./creative-details-fields";

type Props = {
  open: boolean;
  stores: RegistryOption[];
  seed: UnregisteredMetaCreative | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (input: CreateVideoRegistryInput) => Promise<VideoRegistryItem>;
};

const EMPTY_FORM = {
  storeId: "",
  title: "",
  mediaUrl: "",
  format: "",
  hookType: "",
  script: "",
  notes: "",
};

export function RegisterVideoDialog({
  open,
  stores,
  seed,
  isSaving,
  onClose,
  onSubmit,
}: Props) {
  const [step, setStep] = useState<"kind" | "details">("kind");
  const [creatorName, setCreatorName] = useState<string | null>(null);

  useEffect(() => {
    setCreatorName(readCurrentUserName());
  }, []);
  const [kind, setKind] = useState<CreativeKind | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const seedStoreId = useMemo(() => {
    if (!seed) return "";
    if (seed.store?.id) return seed.store.id;
    return (
      stores.find((store) => store.label === seed.store?.name)?.value ?? ""
    );
  }, [stores, seed]);
  const selectedStore = useMemo(
    () => stores.find((store) => store.value === form.storeId) ?? null,
    [form.storeId, stores],
  );
  const codePreview = seed?.code ?? selectedStore?.nextCode ?? null;

  useEffect(() => {
    if (!open) return;
    setStep("kind");
    setKind(null);
    setForm({ ...EMPTY_FORM, storeId: seedStoreId });
    setError(null);
  }, [open, seedStoreId, seed?.key]);

  const setField = (field: keyof typeof EMPTY_FORM, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const selectKind = (nextKind: CreativeKind) => {
    setKind(nextKind);
    setForm((current) => ({
      ...current,
      format: "",
      hookType: "",
      script: "",
    }));
    setStep("details");
    setError(null);
  };

  const submitCreative = async (submitForApproval: boolean) => {
    setError(null);
    if (!kind)
      return setError(
        "Choose whether you are enrolling a video or static creative.",
      );
    if (!form.storeId)
      return setError("Choose the store that owns this creative.");
    if (!form.title.trim())
      return setError("Enter the title shown in the video library.");
    const titleError = validateCreativeTitle(form.title);
    if (titleError) return setError(titleError);
    if (form.mediaUrl && !isValidFacebookPostUrl(form.mediaUrl)) {
      return setError(
        "Use a valid Facebook post link, such as https://www.facebook.com/.../posts/...",
      );
    }
    try {
      await onSubmit({
        ...form,
        kind,
        submitForApproval,
        hookType: kind === "VIDEO" ? form.hookType : "",
        script: kind === "VIDEO" ? form.script : undefined,
        requestedCode: seed?.code ?? undefined,
        unregisteredKey: seed?.key,
        adName: seed?.adName,
        accountId: seed?.accountId,
        adId: seed?.adId,
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to register this video.",
      );
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    void submitCreative(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent className="flex max-h-[90vh] w-11/12 max-w-5xl flex-col overflow-hidden p-0 sm:max-w-5xl">
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <DialogHeader className="shrink-0 border-b border-border px-6 py-5 sm:px-8">
              <DialogTitle className="mb-0">Enroll a creative</DialogTitle>
              <DialogDescription>
                {step === "kind"
                  ? "Choose the creative type first. The metadata and performance fields will adapt to it."
                  : `Add the ${kind === "VIDEO" ? "video" : "static"} metadata and Facebook post link.`}
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 sm:px-8">
              <ol
                className="grid grid-cols-2 gap-2"
                aria-label="Enrollment progress"
              >
                <li
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold ${step === "kind" ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-success/30 bg-success-soft/40 text-success"}`}
                >
                  1. Creative type
                </li>
                <li
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold ${step === "details" ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-border bg-background-secondary text-muted"}`}
                >
                  2. Details
                </li>
              </ol>

              {step === "kind" ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => selectKind("VIDEO")}
                    className="group min-h-40 rounded-xl border border-border bg-surface p-5 text-left transition hover:border-primary hover:bg-primary-soft/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-info-soft text-info">
                      <Video className="h-5 w-5" />
                    </span>
                    <span className="mt-5 block text-lg font-semibold text-foreground">
                      Video
                    </span>
                    <span className="mt-1 block text-sm text-muted">
                      Track hook, hold, completion, and click-through
                      performance.
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => selectKind("STATIC")}
                    className="group min-h-40 rounded-xl border border-border bg-surface p-5 text-left transition hover:border-primary hover:bg-primary-soft/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-warning-soft text-warning">
                      <ImageIcon className="h-5 w-5" />
                    </span>
                    <span className="mt-5 block text-lg font-semibold text-foreground">
                      Static
                    </span>
                    <span className="mt-1 block text-sm text-muted">
                      Track spend and click-through without video-only metrics.
                    </span>
                  </button>
                </div>
              ) : (
                <div className="mt-5 space-y-5">
                  <div className="flex flex-col gap-3 rounded-xl border border-border bg-background-secondary/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-2 text-sm text-foreground">
                      {kind === "VIDEO" ? (
                        <Video className="h-4 w-4 shrink-0 text-primary" />
                      ) : (
                        <ImageIcon className="h-4 w-4 shrink-0 text-primary" />
                      )}
                      <span className="font-semibold">
                        {kind === "VIDEO" ? "Video" : "Static"}
                      </span>
                      <span className="text-muted">·</span>
                      <span className="truncate text-muted">
                        {codePreview
                          ? `Next code ${codePreview}`
                          : "Choose a store to preview the code"}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="self-start text-xs font-semibold text-primary hover:underline sm:self-auto"
                      onClick={() => setStep("kind")}
                    >
                      Change type
                    </button>
                  </div>

                  {seed ? (
                    <div className="rounded-xl border border-info/30 bg-info-soft px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-info">
                        Meta ad selected
                      </p>
                      <p className="mt-1 break-words text-sm font-semibold text-foreground">
                        {seed.adName}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        Ad ID{" "}
                        <code className="font-semibold text-foreground">
                          {seed.adId}
                        </code>{" "}
                        will be connected to this registry record.
                      </p>
                    </div>
                  ) : null}

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="lg:col-span-2">
                      <FormSelect
                        name="storeId"
                        label="Store"
                        value={form.storeId}
                        onChange={(event) =>
                          setField("storeId", event.target.value)
                        }
                        options={stores}
                        placeholder="Choose the store"
                        helper="The registry creates the code prefix automatically from the store name."
                        required
                      />
                    </div>
                    <FormInput
                      name="title"
                      label="Library title"
                      value={form.title}
                      onChange={(event) =>
                        setField("title", event.target.value)
                      }
                      placeholder={
                        kind === "VIDEO"
                          ? "e.g. Picky Eater Opening Hook V3"
                          : "e.g. Lunchbox Benefit Graphic V2"
                      }
                      error={validateCreativeTitle(form.title) ?? undefined}
                      required
                    />
                    <CreativeCodeField
                      code={codePreview}
                      title={form.title}
                      creator={creatorName}
                      helper="Paste this exact value as the Meta ad name. The code at the end is what links the ad back to this creative."
                    />
                  </div>

                  <CreativeDetailsFields
                    kind={kind as CreativeKind}
                    value={form}
                    onChange={(field, value) => setField(field, value)}
                    showTitle={false}
                    showPerformanceStatus
                  />
                </div>
              )}

              {error ? (
                <p
                  className="mt-4 rounded-xl border border-destructive/30 bg-destructive-soft p-3 text-sm text-destructive"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}
            </div>

            <DialogFooter className="shrink-0 border-t border-border bg-surface px-6 py-4 sm:px-8">
              {step === "details" ? (
                <Button
                  type="button"
                  variant="ghost"
                  iconLeft={<ArrowLeft className="h-4 w-4" />}
                  onClick={() => {
                    setStep("kind");
                    setError(null);
                  }}
                >
                  Back
                </Button>
              ) : (
                <Button type="button" variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
              )}
              {step === "details" ? (
                <Button type="submit" loading={isSaving}>Register creative</Button>
              ) : null}
            </DialogFooter>
          </form>
      </DialogContent>
    </Dialog>
  );
}
