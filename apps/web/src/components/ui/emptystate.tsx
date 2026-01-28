import { ReactNode } from 'react';
import { Button } from './button';

type Props = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
};

export function EmptyState({ title, description, actionLabel, onAction, icon }: Props) {
  return (
    <div className="rounded-2xl border border-dashed border-[#E2E8F0] bg-white p-10 text-center">
      {icon && <div className="mx-auto mb-4 h-12 w-12 text-[#2563EB]">{icon}</div>}
      <h3 className="text-lg font-semibold text-[#0F172A]">{title}</h3>
      <p className="mt-2 text-sm text-[#475569]">{description}</p>
      {actionLabel && onAction && (
        <div className="mt-6 flex justify-center">
          <Button onClick={onAction}>{actionLabel}</Button>
        </div>
      )}
    </div>
  );
}
