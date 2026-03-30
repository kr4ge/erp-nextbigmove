import { HTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  padding?: "sm" | "md" | "lg";
  footer?: ReactNode;
};

const paddings = { sm: "p-4", md: "p-6", lg: "p-8" };

export function Card({
  padding = "md",
  footer,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={clsx(
        "rounded-2xl border border-slate-200 bg-white shadow-sm",
        className,
      )}
      {...rest}
    >
      <div className={paddings[padding]}>{children}</div>
      {footer && (
        <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 rounded-b-2xl">
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
  tone?: "default" | "success" | "warning" | "danger";
  className?: string;
  bodyClassName?: string;
  labelClassName?: string;
  valueClassName?: string;
  helperClassName?: string;
  iconClassName?: string;
};

const tones = {
  default: "text-orange-600 bg-orange-50",
  success: "text-emerald-600 bg-emerald-50",
  warning: "text-amber-500 bg-amber-50",
  danger: "text-red-500 bg-red-50",
};

export function MetricCard({
  label,
  value,
  helper,
  icon,
  tone = "default",
  className,
  bodyClassName,
  labelClassName,
  valueClassName,
  helperClassName,
  iconClassName,
}: MetricCardProps) {
  return (
    <Card padding="md" className={className}>
      <div
        className={clsx(
          "flex items-start justify-between gap-3",
          bodyClassName,
        )}
      >
        <div className="min-w-0">
          <p className={clsx("text-sm text-slate-600", labelClassName)}>
            {label}
          </p>
          <p
            className={clsx(
              "mt-2 text-2xl font-semibold tabular-nums text-slate-900",
              valueClassName,
            )}
          >
            {value}
          </p>
          {helper && (
            <p className={clsx("mt-1 text-xs text-slate-400", helperClassName)}>
              {helper}
            </p>
          )}
        </div>
        {icon && (
          <div
            className={clsx(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              tones[tone],
              iconClassName,
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
