import { ReactNode } from 'react';

type Props = {
  title: string;
  description?: string;
  breadcrumbs?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({ title, description, breadcrumbs, actions }: Props) {
  return (
    <div className="mb-8 flex flex-col gap-4 border-b border-[#E2E8F0] pb-4">
      {breadcrumbs && <div className="text-sm text-[#475569]">{breadcrumbs}</div>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">{title}</h1>
          {description && <p className="mt-2 text-sm text-[#475569]">{description}</p>}
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
    </div>
  );
}
