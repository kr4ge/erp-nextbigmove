import type { ReactNode } from 'react';

type WmsSectionCardProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function WmsSectionCard({
  title,
  eyebrow,
  description,
  actions,
  children,
  className = '',
  contentClassName = '',
}: WmsSectionCardProps) {
  return (
    <section className={`min-w-0 overflow-hidden rounded-[20px] border border-[#dce4ea] bg-white ${className}`.trim()}>
      <div className="flex flex-col gap-3 border-b border-[#e7edf2] px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8193a0]">
              {eyebrow}
            </p>
          ) : null}
          <h2 className={`${eyebrow ? 'mt-1.5' : ''} text-[1.1rem] font-semibold tracking-tight text-[#12384b]`}>
            {title}
          </h2>
          {description ? (
            <p className="mt-1.5 max-w-[760px] text-[13px] leading-5 text-[#6f8290]">{description}</p>
          ) : null}
        </div>

        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>

      <div className={contentClassName}>{children}</div>
    </section>
  );
}
