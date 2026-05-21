'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

type WmsInlineNoticeTone = 'success' | 'error' | 'info';

type WmsInlineNoticeProps = {
  tone?: WmsInlineNoticeTone;
  children: ReactNode;
  className?: string;
  dismissible?: boolean;
  autoDismissMs?: number;
  onDismiss?: () => void;
};

const TONE_CLASS_NAMES: Record<WmsInlineNoticeTone, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  error: 'border-rose-200 bg-rose-50 text-rose-700',
  info: 'border-[#dce4ea] bg-[#fbfcfc] text-[#4d6677]',
};

export function WmsInlineNotice({
  tone = 'info',
  children,
  className = '',
  dismissible = false,
  autoDismissMs,
  onDismiss,
}: WmsInlineNoticeProps) {
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    setIsHidden(false);
  }, [tone, children, className, dismissible, autoDismissMs]);

  useEffect(() => {
    if (!dismissible || !autoDismissMs || isHidden) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsHidden(true);
      onDismiss?.();
    }, autoDismissMs);

    return () => window.clearTimeout(timeoutId);
  }, [autoDismissMs, dismissible, isHidden, onDismiss]);

  if (isHidden) {
    return null;
  }

  return (
    <div className={`rounded-[18px] border px-4 py-3 text-sm ${TONE_CLASS_NAMES[tone]} ${className}`.trim()}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">{children}</div>

        {dismissible ? (
          <button
            type="button"
            onClick={() => {
              setIsHidden(true);
              onDismiss?.();
            }}
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition hover:bg-black/5"
            aria-label="Close notice"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
