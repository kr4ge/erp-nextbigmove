import type { ReactNode } from 'react';

type WmsWorkspaceCardProps = {
  title: string;
  actions?: ReactNode;
  filters?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function WmsWorkspaceCard({
  title,
  actions,
  filters,
  children,
  footer,
  className = '',
  contentClassName = '',
}: WmsWorkspaceCardProps) {
  return (
    <section className={`min-w-0 overflow-hidden rounded-[20px] border border-[#dce4ea] bg-white ${className}`.trim()}>
      <div className="flex flex-col gap-3 border-b border-[#e7edf2] px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="min-w-0 text-[1.1rem] font-semibold tracking-tight text-[#12384b]">{title}</h2>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>

      {filters ? (
        <div className="border-b border-[#e7edf2] bg-[#fcfdfd] px-4 py-3">
          {filters}
        </div>
      ) : null}

      <div className={contentClassName}>{children}</div>

      {footer ? (
        <div className="border-t border-[#e7edf2] bg-white px-4 py-3">
          {footer}
        </div>
      ) : null}
    </section>
  );
}
