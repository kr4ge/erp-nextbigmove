import { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  breadcrumbs?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
}: Props) {
  return (
    <div className="mb-6 flex flex-col gap-3 border-b border-slate-200 pb-3">
      {breadcrumbs && (
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {breadcrumbs}
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-muted">{description}</p>
          )}
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
    </div>
  );
}
