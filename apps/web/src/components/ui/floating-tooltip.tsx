'use client';

import * as PopoverPrimitive from '@radix-ui/react-popover';
import {
  useId,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

type FloatingTooltipProps = {
  ariaLabel: string;
  children: ReactNode;
  content: ReactNode;
  contentClassName?: string;
  triggerClassName?: string;
};

/**
 * Hover/focus help rendered in a body-level portal. Radix handles viewport
 * collision and side flipping, so a tooltip cannot be clipped by a card's
 * overflow boundary or disappear beyond the edge of the screen.
 */
export function FloatingTooltip({
  ariaLabel,
  children,
  content,
  contentClassName = '',
  triggerClassName = '',
}: FloatingTooltipProps) {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape') {
      setOpen(false);
      event.currentTarget.blur();
    }
  };

  return (
    <PopoverPrimitive.Root open={open}>
      <PopoverPrimitive.Anchor asChild>
        <button
          type="button"
          className={triggerClassName}
          aria-label={ariaLabel}
          aria-describedby={open ? tooltipId : undefined}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onClick={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        >
          {children}
        </button>
      </PopoverPrimitive.Anchor>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          id={tooltipId}
          role="tooltip"
          side="top"
          align="center"
          sideOffset={8}
          collisionPadding={8}
          avoidCollisions
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onEscapeKeyDown={() => setOpen(false)}
          className={`pointer-events-none z-[100] w-60 max-w-[calc(100vw-1rem)] rounded-lg border border-border bg-surface px-3 py-2 text-left text-xs-tight font-normal normal-case leading-snug tracking-normal text-muted shadow-card ${contentClassName}`.trim()}
        >
          {content}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
