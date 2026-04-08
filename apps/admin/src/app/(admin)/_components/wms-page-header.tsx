import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type WmsPageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: string;
  className?: string;
};

export function WmsPageHeader({
  title,
  description,
  actions,
  eyebrow = 'WMS Workspace',
  className,
}: WmsPageHeaderProps) {
  return (
    <header
      className={cn(
        'flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between',
        className,
      )}
    >
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-600">
          {eyebrow}
        </p>
        <div className="space-y-0.5">
          <h1 className="text-[1.85rem] font-semibold tracking-tight text-slate-950">
            {title}
          </h1>
          {description ? (
            <p className="max-w-2xl text-[0.82rem] text-slate-500">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex items-center gap-2.5">{actions}</div> : null}
    </header>
  );
}
