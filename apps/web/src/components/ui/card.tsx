import { HTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

type CardProps = HTMLAttributes<HTMLDivElement> & {
  padding?: 'sm' | 'md' | 'lg';
  footer?: ReactNode;
};

const paddings = { sm: 'p-4', md: 'p-6', lg: 'p-8' };

export function Card({ padding = 'md', footer, className, children, ...rest }: CardProps) {
  return (
    <div
      className={clsx(
        'rounded-2xl border border-[#E2E8F0] bg-white shadow-sm',
        className
      )}
      {...rest}
    >
      <div className={paddings[padding]}>{children}</div>
      {footer && (
        <div className="border-t border-[#E2E8F0] bg-[#F8FAFC] px-6 py-4 rounded-b-2xl">
          {footer}
        </div>
      )}
    </div>
  );
}

type MetricCardProps = {
  label: string;
  value: string | number;
  helper?: string;
  icon?: ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'danger';
};

const tones = {
  default: 'text-[#2563EB] bg-[#EFF6FF]',
  success: 'text-[#10B981] bg-[#ECFDF3]',
  warning: 'text-[#F59E0B] bg-[#FFFBEB]',
  danger: 'text-[#EF4444] bg-[#FEF2F2]',
};

export function MetricCard({ label, value, helper, icon, tone = 'default' }: MetricCardProps) {
  return (
    <Card padding="md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-[#475569]">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{value}</p>
          {helper && <p className="mt-1 text-xs text-[#94A3B8]">{helper}</p>}
        </div>
        {icon && (
          <div className={clsx('h-10 w-10 rounded-xl flex items-center justify-center', tones[tone])}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
