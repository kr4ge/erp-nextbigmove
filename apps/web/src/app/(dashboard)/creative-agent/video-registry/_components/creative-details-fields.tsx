"use client";

import { ChevronDown, ExternalLink } from "lucide-react";
import { FormInput } from "@/components/ui/form-input";
import { validateCreativeTitle } from "../_utils/creative-title";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextarea } from "@/components/ui/form-textarea";
import {
  HOOK_TYPE_OPTIONS,
  STATIC_FORMAT_OPTIONS,
  VIDEO_FORMAT_OPTIONS,
} from "../_constants/video-registry.constants";
import type { CreativeKind, UpdateVideoRegistryInput } from "../_types/video-registry";
import { isValidFacebookPostUrl } from "../_utils/facebook-post-url";

export type CreativeDetailsValue = UpdateVideoRegistryInput;

/**
 * Long free-text fields collapse by default so the dialog stays short; the
 * summary shows a filled/empty hint so nothing hides silently.
 */
function CollapsibleField({ label, filled, children }: {
  label: string;
  filled: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-xl border border-border bg-surface" open={filled}>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <ChevronDown className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
        <span className="form-label">{label}</span>
        <span className="ml-auto text-xs text-muted">{filled ? "Added" : "Optional"}</span>
      </summary>
      <div className="border-t border-border/60 p-4 pt-3">{children}</div>
    </details>
  );
}

type Props = {
  kind: CreativeKind;
  value: CreativeDetailsValue;
  onChange: (field: keyof CreativeDetailsValue, value: string) => void;
  showTitle?: boolean;
  showPerformanceStatus?: boolean;
};

export function CreativeDetailsFields({
  kind,
  value,
  onChange,
  showTitle = true,
  showPerformanceStatus = false,
}: Props) {
  return (
    <div className="space-y-5">
      {showTitle ? (
        <FormInput
          name="title"
          label="Library title"
          value={value.title}
          onChange={(event) => onChange("title", event.target.value)}
          placeholder={kind === "VIDEO" ? "e.g. Picky Eater Opening Hook V3" : "e.g. Lunchbox Benefit Graphic V2"}
          error={validateCreativeTitle(value.title) ?? undefined}
          required
        />
      ) : null}

      <div className={`grid gap-4 ${kind === "VIDEO" ? (showPerformanceStatus ? "md:grid-cols-3" : "md:grid-cols-2") : "md:grid-cols-2"}`}>
        {kind === "VIDEO" ? (
          <FormSelect
            name="hookType"
            label="Hook type"
            value={value.hookType}
            onChange={(event) => onChange("hookType", event.target.value)}
            options={HOOK_TYPE_OPTIONS}
            placeholder="Choose hook"
          />
        ) : null}
        <FormSelect
          name="format"
          label={`${kind === "VIDEO" ? "Video" : "Static"} format`}
          value={value.format}
          onChange={(event) => onChange("format", event.target.value)}
          options={kind === "VIDEO" ? VIDEO_FORMAT_OPTIONS : STATIC_FORMAT_OPTIONS}
          placeholder="Choose format"
        />
        {showPerformanceStatus ? (
          <FormInput name="status" label="Performance status" value="Draft" readOnly className="read-only-input" />
        ) : null}
      </div>

      <FormInput
        name="mediaUrl"
        type="url"
        label="Facebook post link"
        value={value.mediaUrl}
        onChange={(event) => onChange("mediaUrl", event.target.value)}
        placeholder="https://www.facebook.com/.../posts/..."
        helper="Optional. Paste the public Facebook post link for this creative. Clear this field to remove the current source."
      />

      {kind === "VIDEO" ? (
        <CollapsibleField label="Ad copy" filled={Boolean(value.script?.trim())}>
          <FormTextarea
            name="script"
            label=""
            value={value.script ?? ""}
            onChange={(event) => onChange("script", event.target.value)}
            placeholder="Paste the ad copy that runs with this creative..."
            className="min-h-32"
          />
        </CollapsibleField>
      ) : null}

      <CollapsibleField label="Internal notes" filled={Boolean(value.notes?.trim())}>
        <FormTextarea
          name="notes"
          label=""
          value={value.notes ?? ""}
          onChange={(event) => onChange("notes", event.target.value)}
          placeholder="Add revision notes, variants, or context..."
          className="min-h-24"
        />
      </CollapsibleField>

      {value.mediaUrl && isValidFacebookPostUrl(value.mediaUrl) ? (
        <a href={value.mediaUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
          Open Facebook post <ExternalLink className="h-3.5 w-3.5" />
        </a>
      ) : null}
    </div>
  );
}
