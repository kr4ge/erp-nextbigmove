"use client";

import { ChevronDown, ExternalLink } from "lucide-react";
import { FormInput } from "@/components/ui/form-input";
import { validateCreativeTitle } from "../_utils/creative-title";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { FormTextarea } from "@/components/ui/form-textarea";
import {
  HOOK_TYPE_OPTIONS,
  STATIC_FORMAT_OPTIONS,
  VIDEO_FORMAT_OPTIONS,
} from "../_constants/video-registry.constants";
import type { CreativeKind, CreativeOptionField, CreativeOptions, UpdateVideoRegistryInput } from "../_types/video-registry";
import { isValidFacebookPostUrl } from "../_utils/facebook-post-url";

/**
 * Custom entries are stored the way the fixed options are (UPPER_SNAKE), so
 * filters and pills that humanize a value treat them identically.
 */
function toOptionValue(text: string): string {
  return text.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function humanize(value: string): string {
  return value.toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/** A custom value the user typed earlier must still render as the selection. */
function withCurrent(options: Array<{ value: string; label: string }>, current: string | null | undefined) {
  if (!current || options.some((o) => o.value === current)) return options;
  return [...options, { value: current, label: humanize(current) }];
}

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
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 [&::-webkit-details-marker]:hidden">
        <ChevronDown className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
        <span className="form-label">{label}</span>
        <span className="ml-auto text-xs text-muted">{filled ? "Added" : "Optional"}</span>
      </summary>
      <div className="border-t border-border/60 p-3 pt-2">{children}</div>
    </details>
  );
}

type Props = {
  kind: CreativeKind;
  value: CreativeDetailsValue;
  onChange: (field: keyof CreativeDetailsValue, value: string) => void;
  showTitle?: boolean;
  showPerformanceStatus?: boolean;
  /** Tenant option lists; the built-in constants apply until these load. */
  options?: CreativeOptions | null;
  /** Persist a new value tenant-wide; resolves to the stored value to select. */
  onCreateOption?: (field: CreativeOptionField, label: string) => Promise<string>;
};

export function CreativeDetailsFields({
  kind,
  value,
  onChange,
  showTitle = true,
  showPerformanceStatus = false,
  options,
  onCreateOption,
}: Props) {
  // Persist first so the value exists for the whole tenant, then select it.
  // Without a persister (older callers) the value is still usable locally.
  const createAndSelect = async (field: CreativeOptionField, key: "hookType" | "format", text: string) => {
    const value = onCreateOption
      ? await onCreateOption(field, text).catch(() => toOptionValue(text))
      : toOptionValue(text);
    onChange(key, value);
  };
  return (
    <div className="space-y-3">
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

      <div className={`grid gap-3 ${kind === "VIDEO" ? (showPerformanceStatus ? "md:grid-cols-3" : "md:grid-cols-2") : "md:grid-cols-2"}`}>
        {kind === "VIDEO" ? (
          <SearchableSelect
            name="hookType"
            label="Hook type"
            selectTitle="Select hook type"
            value={value.hookType}
            onChange={(next) => onChange("hookType", next)}
            options={withCurrent(options?.hookTypes ?? HOOK_TYPE_OPTIONS, value.hookType)}
            placeholder="Choose hook"
            allowCustom
            customLabel="hook type"
            onCreate={(text) => void createAndSelect("HOOK_TYPE", "hookType", text)}
          />
        ) : null}
        <SearchableSelect
          name="format"
          label={`${kind === "VIDEO" ? "Video" : "Static"} format`}
          selectTitle="Select format"
          value={value.format}
          onChange={(next) => onChange("format", next)}
          options={withCurrent(
            kind === "VIDEO" ? (options?.videoFormats ?? VIDEO_FORMAT_OPTIONS) : (options?.staticFormats ?? STATIC_FORMAT_OPTIONS),
            value.format,
          )}
          placeholder="Choose format"
          allowCustom
          customLabel={kind === "VIDEO" ? "video format" : "static format"}
          onCreate={(text) => void createAndSelect(kind === "VIDEO" ? "VIDEO_FORMAT" : "STATIC_FORMAT", "format", text)}
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
        helper="Optional. Public Facebook post link; clear it to remove the current source."
      />

      {/* Both optional and collapsed by default; side by side so two closed
          rows cost one row of height. Static has only notes. */}
      <div className={kind === "VIDEO" ? "grid gap-2.5 lg:grid-cols-2" : ""}>
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
      </div>

      {value.mediaUrl && isValidFacebookPostUrl(value.mediaUrl) ? (
        <a href={value.mediaUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
          Open Facebook post <ExternalLink className="h-3.5 w-3.5" />
        </a>
      ) : null}
    </div>
  );
}
