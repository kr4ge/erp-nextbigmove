import clsx from 'clsx';

/**
 * A minimal loading spinner for "the value is on its way" states — a ring with
 * a transparent top edge, spun. Inherits currentColor so it tints to context;
 * respects reduced-motion by holding still rather than vanishing.
 */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={clsx(
        'inline-block animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none',
        className ?? 'h-4 w-4',
      )}
    />
  );
}
