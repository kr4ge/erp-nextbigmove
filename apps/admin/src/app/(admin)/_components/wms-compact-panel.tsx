import clsx from 'clsx';
import type { ReactNode } from 'react';

type WmsCompactPanelProps = {
  title: string;
  eyebrow?: string;
  meta?: string,
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  headerActions?: ReactNode;
  /** Use "flush" to render without card chrome (no border, bg, padding, shadow). */
  variant?: 'card' | 'flush';
};

export function WmsCompactPanel({
  title,
  meta,
  icon,
  children,
  className = '',
  headerActions,
  variant = 'card',
}: WmsCompactPanelProps) {
  const isCard = variant === 'card';

  return (
    <section
      className={
        isCard
          ? clsx(`panel panel-content`, className)
          : className || undefined
      }
    >
      <div className={isCard ? 'panel-header' : 'flex items-start justify-between gap-4'}>
        <div className="flex min-w-0 items-center gap-2">
          {icon ? icon : null}
          <h4 className="panel-title">{title}</h4>
        </div>
          {meta ?
           <span className="ml-auto hidden min-w-0 text-xs-tight text-slate-500 sm:inline">{meta}</span>
          : null}
        {headerActions ? <div className="ml-auto shrink-0">{headerActions}</div> : null}
      </div>
      <div className={isCard ? 'p-3' : 'mt-3'}>{children}</div>
    </section>
  );
}
