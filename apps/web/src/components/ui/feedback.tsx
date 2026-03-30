import clsx from 'clsx';
import { Card } from './card';

type FeedbackTone = 'info' | 'success' | 'warning' | 'error';

const toneStyles: Record<FeedbackTone, string> = {
  info: 'border-blue-200 bg-blue-50 text-blue-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  error: 'border-red-200 bg-red-50 text-red-700',
};

interface AlertBannerProps {
  message: string;
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
