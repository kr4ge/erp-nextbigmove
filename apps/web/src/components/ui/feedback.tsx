import type { ReactNode } from 'react';
import clsx from 'clsx';
import { Card } from './card';

type FeedbackTone = 'info' | 'success' | 'warning' | 'error';

const toneStyles: Record<FeedbackTone, string> = {
  info: 'border-info/40 bg-info-soft text-info',
  success: 'border-success/40 bg-emerald-success-soft text-success',
  warning: 'border-warning/40 bg-amber-warning-soft text-warning',
  error: 'border-destructive/40 bg-destructive-soft/30 text-destructive',
};

interface AlertBannerProps {
  message: ReactNode;
  tone?: FeedbackTone;
  className?: string;
}

export function AlertBanner({ message, tone = 'info', className }: AlertBannerProps) {
  if (!message) return null;
  return (
    <div
      className={clsx(
        'rounded-2xl border px-4 py-3 text-sm',
        toneStyles[tone],
        className,
      )}
    >
      {message}
    </div>
  );
}

interface LoadingCardProps {
  label?: string;
  className?: string;
}

export function LoadingCard({ label = 'Loading...', className }: LoadingCardProps) {
  return (
    <Card className={clsx('py-12 text-center text-[#475569]', className)}>
      {label}
    </Card>
  );
}
