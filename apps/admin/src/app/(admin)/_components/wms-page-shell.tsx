import type { ReactNode } from 'react';

type WmsPageShellProps = {
  title: string;
  breadcrumb?: string;
  description?: string;
  actions?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function WmsPageShell({
  title,
  breadcrumb,
  description,
  actions,
  toolbar,
  children,
  className = '',
}: WmsPageShellProps) {
  return (
    <div className={`min-w-0 space-y-4 ${className}`.trim()}>
      <header className="space-y-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            {breadcrumb ? (
              <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[#8193a0]">
                {breadcrumb}
              </p>
            ) : null}
            <h1 className={`${breadcrumb ? 'mt-2' : ''} wms-page-title font-medium tracking-tight text-[#12384b]`}>
              {title}
            </h1>
            {description ? (
              <p className="mt-2 max-w-[760px] text-sm leading-6 text-[#5f7483]">{description}</p>
            ) : null}
          </div>

          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>

        {toolbar ? (
          <div className="rounded-[20px] border border-[#dce4ea] bg-white px-4 py-3">
            {toolbar}
          </div>
        ) : null}
      </header>

      {children}
    </div>
  );
}
