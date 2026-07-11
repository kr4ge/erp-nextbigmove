'use client';

import { Archive, ChevronDown, Settings2, Shuffle } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState, type ReactNode } from 'react';

type InventoryBulkActionsMenuProps = {
  selectedCount: number;
  canAdjust: boolean;
  canArchive: boolean;
  canTransfer: boolean;
  adjustDisabledReason?: string | null;
  archiveDisabledReason?: string | null;
  transferDisabledReason?: string | null;
  onAdjust: () => void;
  onArchive: () => void;
  onTransfer: () => void;
};

export function InventoryBulkActionsMenu({
  selectedCount,
  canAdjust,
  canArchive,
  canTransfer,
  adjustDisabledReason,
  archiveDisabledReason,
  transferDisabledReason,
  onAdjust,
  onArchive,
  onTransfer,
}: InventoryBulkActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return;
    }

    const updatePosition = () => {
      if (!triggerRef.current) {
        return;
      }

      const rect = triggerRef.current.getBoundingClientRect();
      const menuWidth = 236;
      const viewportPadding = 12;

      setMenuStyle({
        top: rect.bottom + 8,
        left: Math.min(
          window.innerWidth - menuWidth - viewportPadding,
          Math.max(viewportPadding, rect.right - menuWidth),
        ),
        width: menuWidth,
      });
    };

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    updatePosition();
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (selectedCount === 0) {
      setOpen(false);
    }
  }, [selectedCount]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-9 items-center gap-2 rounded-xl bg-primary px-3.5 text-[12px] font-semibold text-white transition hover:bg-[#0f3242]"
      >
        Action
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      {open && menuStyle
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={{
                position: 'fixed',
                top: menuStyle.top,
                left: menuStyle.left,
                width: menuStyle.width,
              }}
              className="z-[120] rounded-[18px] border border-[#dce4ea] bg-white p-1.5 shadow-[0_24px_60px_-36px_rgba(18,56,75,0.45)]"
            >
              <MenuItem
                icon={<Shuffle className="h-3.5 w-3.5" />}
                label="Transfer to store"
                disabled={!canTransfer}
                hint={transferDisabledReason ?? null}
                onSelect={() => {
                  setOpen(false);
                  onTransfer();
                }}
              />
              <MenuItem
                icon={<Settings2 className="h-3.5 w-3.5" />}
                label="Adjust selected"
                disabled={!canAdjust}
                hint={adjustDisabledReason ?? null}
                onSelect={() => {
                  setOpen(false);
                  onAdjust();
                }}
              />
              <MenuItem
                icon={<Archive className="h-3.5 w-3.5" />}
                label="Archive selected"
                disabled={!canArchive}
                hint={archiveDisabledReason ?? null}
                destructive={canArchive}
                onSelect={() => {
                  setOpen(false);
                  onArchive();
                }}
              />
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function MenuItem({
  destructive = false,
  disabled,
  hint,
  icon,
  label,
  onSelect,
}: {
  destructive?: boolean;
  disabled: boolean;
  hint: string | null;
  icon: ReactNode;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onSelect}
      className={`flex w-full items-start gap-3 rounded-[14px] px-3 py-2.5 text-left transition ${
        disabled
          ? 'cursor-not-allowed opacity-50'
          : destructive
            ? 'hover:bg-rose-50'
            : 'hover:bg-[#f5f8fa]'
      }`}
    >
      <span className={`mt-0.5 ${destructive && !disabled ? 'text-rose-700' : 'text-[#5f7483]'}`}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[13px] font-semibold ${destructive && !disabled ? 'text-rose-700' : 'text-primary'}`}>
          {label}
        </span>
        {hint ? (
          <span className="mt-0.5 block text-[11px] leading-4 text-[#708391]">
            {hint}
          </span>
        ) : null}
      </span>
    </button>
  );
}
