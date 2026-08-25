'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

/**
 * Copies the exact canonical creative code — e.g. NRO-V0001 — never a
 * bracketed or decorated variant. Pasting this as the Meta ad name is what
 * makes attribution roll up automatically.
 */
export function CopyCodeButton({ code, className = '' }: { code: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async (event) => {
        event.stopPropagation();
        try {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch { /* clipboard unavailable */ }
      }}
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-secondary/40 hover:text-foreground ${className}`}
      aria-label={`Copy creative code ${code}`}
      title={`Copy ${code}`}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}
