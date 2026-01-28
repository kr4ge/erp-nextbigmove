import { ReactNode } from 'react';
import clsx from 'clsx';

type DataListProps = {
  children: ReactNode;
  className?: string;
};

export function DataList({ children, className }: DataListProps) {
  return (
    <div className={clsx('divide-y divide-[#E2E8F0]', className)}>
      {children}
    </div>
  );
}

type DataListItemProps = {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
};

export function DataListItem({
  children,
  className,
  onClick,
  hoverable = true,
}: DataListItemProps) {
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      onClick={onClick}
      className={clsx(
        'flex w-full items-center justify-between px-6 py-4 text-left',
        hoverable && 'hover:bg-[#F8FAFC] transition-colors',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {children}
    </Component>
  );
}

type DataListContentProps = {
  title: string;
  description?: string;
  meta?: string;
};

export function DataListContent({ title, description, meta }: DataListContentProps) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium text-[#0F172A]">{title}</p>
      {description && (
        <p className="mt-0.5 truncate text-sm text-[#475569]">{description}</p>
      )}
      {meta && <p className="mt-1 text-xs text-[#94A3B8]">{meta}</p>}
    </div>
  );
}

type DataListActionsProps = {
  children: ReactNode;
};

export function DataListActions({ children }: DataListActionsProps) {
  return <div className="ml-4 flex items-center gap-2">{children}</div>;
}
