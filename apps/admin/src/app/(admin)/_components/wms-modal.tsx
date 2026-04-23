'use client';

import { X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type WmsModalProps = {
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

export function WmsModal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  panelClassName,
  bodyClassName,
  footerClassName,
}: WmsModalProps) {
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  if (!open) {
    return null;
  }

  if (!portalReady) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[120] overflow-y-auto bg-[#0f2330]/34 backdrop-blur-[1.5px]">
      <div className="flex min-h-[100dvh] items-center justify-center px-3 py-4 sm:px-5 sm:py-6">
        <div
          className={`relative flex w-[min(96vw,1120px)] max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-2xl border border-[#dce4ea] bg-white shadow-[0_38px_82px_-44px_rgba(18,56,75,0.52)] sm:max-h-[calc(100dvh-3rem)] ${
            panelClassName ?? ''
          }`}
        >
          <div className="flex items-start justify-between gap-3 border-b border-[#e6edf1] px-4 py-2.5">
            <div className="min-w-0">
              <h2 className="truncate text-[1.04rem] font-semibold tracking-tight text-[#12384b]">{title}</h2>
              {description ? <p className="mt-0.5 truncate text-[12px] text-[#637786]">{description}</p> : null}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#d7e0e7] bg-[#fbfcfc] text-[#567383] transition hover:border-[#c8d6df] hover:bg-white"
              aria-label="Close modal"
            >
              <X className="h-[15px] w-[15px]" />
            </button>
          </div>

          <div className={`min-h-0 flex-1 overflow-y-auto px-4 py-3 ${bodyClassName ?? ''}`}>{children}</div>

          {footer ? (
            <div className={`border-t border-[#e6edf1] px-4 py-2.5 ${footerClassName ?? ''}`}>{footer}</div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
