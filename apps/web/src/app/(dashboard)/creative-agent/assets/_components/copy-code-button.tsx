'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

/**
 * Builds the paste-ready Meta ad name: `title_creator_CODE`.
 *
 * The code is what makes attribution roll up, so it is always present and
 * always exact; the title and creator ride in front only to make the ad
 * legible inside the ad platform. Empty parts are dropped rather than leaving
 * a dangling separator.
 */
export function buildAdName(parts: { title?: string | null; creator?: string | null; code: string }): string {
  return [parts.title?.trim(), parts.creator?.trim(), parts.code.trim()]
    .filter((part): part is string => Boolean(part))
    .join('_');
}

/**
 * Copies the full ad name for a creative. One button produces a complete,
 * paste-ready value — which removes the most common failure in the whole
 * system: pasting a title and forgetting to append the code, silently
 * breaking attribution for that creative forever.
 */
export function CopyCodeButton({ code, title, creator, className = '' }: {
  code: string;
  title?: string | null;
  creator?: string | null;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const adName = buildAdName({ title, creator, code });

  return (
    <button
      type="button"
      onClick={async (event) => {
        event.stopPropagation();
        try {
          await navigator.clipboard.writeText(adName);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch { /* clipboard unavailable */ }
      }}
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-secondary/40 hover:text-foreground ${className}`}
      aria-label={`Copy ad name ${adName}`}
      title={`Copy "${adName}"`}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}
