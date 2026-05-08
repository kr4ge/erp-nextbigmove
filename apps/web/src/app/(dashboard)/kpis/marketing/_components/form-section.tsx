import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import clsx from 'clsx';
import { type ReactNode } from 'react';

type FormSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
  actionLabel: string;
  onAction: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'card' | 'plain';
  footerHint?: string;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  secondaryActionDisabled?: boolean;
};

export function FormSection({
  title,
  description,
  children,
  actionLabel,
  onAction,
  loading,
  disabled,
  variant = 'card',
  footerHint = 'Applies to selected team and date window.',
  secondaryActionLabel,
  onSecondaryAction,
  secondaryActionDisabled,
}: FormSectionProps) {
  const content = (
    <div
      className={clsx(
        'space-y-3 rounded-lg border border-slate-200 p-3',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {description ? <p className="text-xs text-slate-600">{description}</p> : null}
        </div>
      </div>
      <div>
        {children}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
        <p className="text-xs text-slate-500">{footerHint}</p>
        <div className="flex items-center gap-2">
          {secondaryActionLabel && onSecondaryAction ? (
            <Button
              variant="outline"
              className="h-9 rounded-lg"
              disabled={secondaryActionDisabled || loading}
              onClick={onSecondaryAction}
            >
              {secondaryActionLabel}
            </Button>
          ) : null}
          <Button
            className="btn btn-primary-soft"
            loading={loading}
            disabled={disabled}
            onClick={onAction}
          >
            {actionLabel}
          </Button>
        </div>
      </div>
    </div>
  );

  if (variant === 'plain') {
    return <section>{content}</section>;
  }

  return (
    <Card padding="sm">
      {content}
    </Card>
  );
}
