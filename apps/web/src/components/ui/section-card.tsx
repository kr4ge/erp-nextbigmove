import { HTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

type SectionCardProps = HTMLAttributes<HTMLDivElement> & {
  title?: string;
  description?: string;
  actions?: ReactNode;
  noPadding?: boolean;
};

export function SectionCard({
  title,
  description,
  actions,
  noPadding = false,
  className,
  children,
  ...rest
}: SectionCardProps) {
  const hasHeader = title || description || actions;

  return (
    <div
      className={clsx(
        'rounded-2xl border border-[#E2E8F0] bg-white shadow-sm',
        className
      )}
      {...rest}
    >
      {hasHeader && (
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
          <div>
            {title && (
              <h2 className="text-lg font-semibold text-[#0F172A]">{title}</h2>
            )}
            {description && (
              <p className="mt-1 text-sm text-[#475569]">{description}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={noPadding ? '' : 'p-6'}>{children}</div>
    </div>
  );
}
