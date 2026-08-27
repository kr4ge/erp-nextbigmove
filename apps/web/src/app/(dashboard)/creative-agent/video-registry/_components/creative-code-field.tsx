"use client";

import { useEffect, useState } from "react";
import { Check, Clipboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildAdName } from "../../assets/_components/copy-code-button";
import { validateCreativeTitle } from "../_utils/creative-title";

type Props = {
  code: string | null;
  customId?: string | null;
  title?: string | null;
  creator?: string | null;
  helper?: string;
};

/**
 * Shows the paste-ready Meta ad name, `title_creator_CODE`.
 *
 * Copy is deliberately blocked while the name would be wrong rather than
 * copying a partial value: a title that is blank or contains an underscore
 * produces a name that auto-matching cannot read back, and the failure would
 * only surface much later as an ad that never links to its creative.
 */
export function CreativeCodeField({ code, customId, title, creator, helper }: Props) {
  const [copied, setCopied] = useState(false);

  const trimmedTitle = title?.trim() ?? "";
  const titleError = validateCreativeTitle(trimmedTitle);
  // The item is required at enrollment, so a missing customId means the name
  // is not final yet — copying a half-name that maps to nothing helps nobody.
  const blocked = !code || !trimmedTitle || Boolean(titleError) || !customId?.trim();
  const adName = code ? buildAdName({ title: trimmedTitle, creator, code, customId }) : null;

  useEffect(() => {
    setCopied(false);
  }, [adName]);

  const copyCode = async () => {
    if (blocked || !adName) return;
    await navigator.clipboard.writeText(adName);
    setCopied(true);
  };

  const blockedReason = !code
    ? "Select a store"
    : !customId?.trim()
      ? "Choose the item this creative sells to complete the ad name."
      : titleError
        ? "Remove the underscore from the title to copy the ad name."
        : !trimmedTitle
          ? "Add a library title to copy the full ad name."
          : null;

  return (
    <div className="space-y-1.5">
      <span className="form-label">Ad name</span>
      <div className="input flex min-h-11 items-center justify-between gap-3 py-1.5">
        <code
          className={`min-w-0 truncate font-bold ${adName && !blocked ? "text-foreground" : "text-muted"}`}
        >
          {adName ?? "Select a store"}
        </code>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 border-0 text-primary"
          iconLeft={
            copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Clipboard className="h-4 w-4" />
            )
          }
          disabled={blocked}
          onClick={copyCode}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      {blockedReason ? (
        <p className="text-xs text-destructive">{blockedReason}</p>
      ) : helper ? (
        <p className="text-xs text-muted">{helper}</p>
      ) : null}
    </div>
  );
}
