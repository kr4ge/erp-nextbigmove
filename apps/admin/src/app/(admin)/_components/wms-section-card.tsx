import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type WmsSectionCardProps = {
  title: string;
  icon?: ReactNode;
  metadata?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
  className?: string;
};

export function WmsSectionCard({
  title,
  icon,
  metadata,
  children,
  bodyClassName,
  className,
}: WmsSectionCardProps) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm',
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2.5">
        {icon ? <span className="text-orange-500">{icon}</span> : null}
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">
          {title}
        </h2>
        {metadata ? (
          <div className="ml-auto text-[11px] text-slate-500">{metadata}</div>
        ) : null}
      </div>
      <div className={cn('p-3', bodyClassName)}>{children}</div>
    </section>
  );
}
