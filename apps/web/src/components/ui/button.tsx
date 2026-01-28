import { ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center font-semibold rounded-xl transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed';
const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-base',
};
const variants: Record<Variant, string> = {
  primary:
    'bg-[#2563EB] text-white hover:bg-[#1d4fd8] active:bg-[#1b46c3] focus:ring-[#2563EB] ring-offset-white',
  secondary:
    'bg-[#F1F5F9] text-[#0F172A] hover:bg-[#E2E8F0] active:bg-[#CBD5E1] focus:ring-[#2563EB] ring-offset-white',
  outline:
    'border border-[#E2E8F0] text-[#0F172A] bg-white hover:bg-[#F8FAFC] active:bg-[#E2E8F0] focus:ring-[#2563EB] ring-offset-white',
  ghost:
    'text-[#0F172A] hover:bg-[#F8FAFC] active:bg-[#E2E8F0] focus:ring-[#2563EB] ring-offset-white',
  danger:
    'bg-[#EF4444] text-white hover:bg-[#dc2626] active:bg-[#b91c1c] focus:ring-[#EF4444] ring-offset-white',
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  iconLeft,
  iconRight,
  children,
  className,
  ...rest
}: Props) {
  return (
    <button
      className={clsx(base, sizes[size], variants[variant], className)}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading ? (
        <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
      ) : (
        iconLeft && <span className="mr-2">{iconLeft}</span>
      )}
      <span>{children}</span>
      {iconRight && !loading && <span className="ml-2">{iconRight}</span>}
    </button>
  );
}
