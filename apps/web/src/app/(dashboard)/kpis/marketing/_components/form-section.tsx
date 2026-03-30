import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { type ReactNode } from 'react';

type FormSectionProps = {
  title: string;
  description: string;
  children: ReactNode;
  actionLabel: string;
  onAction: () => void;
  loading?: boolean;
  disabled?: boolean;
};

export function FormSection({
  title,
  description,
  children,
  actionLabel,
  onAction,
  loading,
  disabled,
}: FormSectionProps) {
  return (
    <Card>
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-600">{description}</p>
        </div>
        {children}
        <div className="flex justify-end">
          <Button loading={loading} disabled={disabled} onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      </div>
    </Card>
  );
}
