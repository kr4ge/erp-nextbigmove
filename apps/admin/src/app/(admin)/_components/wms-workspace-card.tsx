import clsx from 'clsx';
import type { ReactNode } from 'react';

type WmsWorkspaceCardProps = {
  title: string;
  icon?: ReactNode,
  actions?: ReactNode;
  filters?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function WmsWorkspaceCard({
  title,
  icon,
  actions,
  filters,
  children,
  footer,
  className = '',
  contentClassName = '',
}: WmsWorkspaceCardProps) {
  return (
    <section
      className={clsx(
        'panel panel-content',
        className,
      )}
    >
      <div className="panel-header flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {icon}
          <h2 className="panel-title">{title}</h2>
        </div>

        {actions ? (
          <div className="flex shrink-0 items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>

      {filters ? (
        <div className="w-full min-w-0 border-b border-border/10 bg-secondary/20 px-4 py-3">
          {filters}
        </div>
      ) : null}

      <div className={clsx('panel-content', contentClassName)}>{children}</div>

      {footer ? (
        <div className="border-t border-border/10 bg-surface px-4 py-3">
          {footer}
        </div>
      ) : null}
    </section>
  );
}
