'use client';

import { Menu } from 'lucide-react';

type WmsTopbarProps = {
  onOpenMobileNav: () => void;
};

export function WmsTopbar({ onOpenMobileNav }: WmsTopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex-shrink-0 bg-white px-3 py-1 sm:px-4 lg:px-5">
      <div className="flex min-h-[32px] items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenMobileNav}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm lg:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="h-10 lg:hidden" />
        </div>

        <div className="h-8" />
      </div>
    </header>
  );
}
