"use client";

import { useEffect, useState } from "react";
import { Check, Clipboard } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  code: string | null;
  helper?: string;
};

export function CreativeCodeField({ code, helper }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCopied(false);
  }, [code]);

  const copyCode = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
  };

  return (
    <div className="space-y-1.5">
      <span className="form-label">Code tag</span>
      <div className="input flex min-h-11 items-center justify-between gap-3 py-1.5">
        <code
          className={`min-w-0 truncate font-bold ${code ? "text-foreground" : "text-muted"}`}
        >
          {code ?? "Select a store"}
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
          disabled={!code}
          onClick={copyCode}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      {helper ? <p className="text-xs text-muted">{helper}</p> : null}
    </div>
  );
}
