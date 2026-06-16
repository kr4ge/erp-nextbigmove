'use client';

import { X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type WmsSidePanelProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  panelClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
};

export function WmsSidePanel({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  panelClassName,
  bodyClassName,
  footerClassName,
}: WmsSidePanelProps) {
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  if (!open || !portalReady) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[120] bg-[#0f2330]/22 backdrop-blur-[2px]">
      <div className="flex min-h-[100dvh] justify-end">
        <div
          className={`relative flex h-[100dvh] w-[min(96vw,640px)] flex-col overflow-hidden border-l border-[#dce4ea] bg-[#f8fbfc] shadow-[-24px_0_64px_-32px_rgba(18,56,75,0.44)] ${panelClassName ?? ''}`}
        >
          <div className="flex items-start justify-between gap-4 border-b border-[#e6edf1] bg-white px-6 py-5">
            <div className="min-w-0">
              <h2 className="truncate text-[18px] font-semibold tracking-[-0.02em] text-primary md:text-[19px]">{title}</h2>
              {description ? <p className="mt-1 text-[13px] text-[#637786]">{description}</p> : null}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#d7e0e7] bg-[#fbfcfc] text-[#567383] transition hover:border-[#c8d6df] hover:bg-white"
              aria-label="Close panel"
            >
              <X className="h-[18px] w-[18px]" />
            </button>
          </div>

          <div className={`min-h-0 flex-1 overflow-y-auto px-6 py-5 ${bodyClassName ?? ''}`}>{children}</div>

          {footer ? (
            <div className={`border-t border-[#e6edf1] bg-white px-6 py-4 ${footerClassName ?? ''}`}>{footer}</div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
