"use client";

import { useEffect, useState } from "react";
import { Check, Clipboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AD_TAG_SEPARATOR, buildAdTag } from "../_utils/ad-tag";

type Props = {
  /** The registry code — the only part Meta matching actually reads. */
  code: string | null;
  /** Library title as typed; the tag updates live with it. */
  title?: string;
  /** The person enrolling — their name rides along so an ad can be traced to an owner. */
  editor?: string;
  helper?: string;
};

/**
 * The Ad Tag: the full string to paste as the Meta ad name, assembled from the
 * title, the editor, and the registry code.
 *
 * The parts are rendered separately so the shape stays legible while the title
 * is still empty — a lone code gives no hint that two more fields belong in
 * front of it.
 */
export function CreativeCodeField({ code, title = "", editor = "", helper }: Props) {
  const [copied, setCopied] = useState(false);
  const trimmedTitle = title.trim();
  const adTag = code ? buildAdTag({ title: trimmedTitle, editor, code }) : null;

  useEffect(() => {
    setCopied(false);
  }, [adTag]);

  const copyTag = async () => {
    if (!adTag) return;
    await navigator.clipboard.writeText(adTag);
    setCopied(true);
  };

  return (
    <div className="space-y-1.5">
      <span className="form-label">Ad tag</span>
      <div className="input flex min-h-11 items-center justify-between gap-3 py-1.5">
        <code className="min-w-0 truncate text-sm">
          {code ? (
            <>
              <span className={trimmedTitle ? "text-foreground" : "text-muted"}>
                {trimmedTitle || "Library title"}
              </span>
              <span className="text-muted">{AD_TAG_SEPARATOR}</span>
              <span className={editor ? "text-foreground" : "text-muted"}>
                {editor || "Editor"}
              </span>
              <span className="text-muted">{AD_TAG_SEPARATOR}</span>
              <span className="font-bold text-foreground">{code}</span>
            </>
          ) : (
            <span className="text-muted">Select a store</span>
          )}
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
          disabled={!adTag}
          onClick={copyTag}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      {helper ? <p className="text-xs text-muted">{helper}</p> : null}
    </div>
  );
}
