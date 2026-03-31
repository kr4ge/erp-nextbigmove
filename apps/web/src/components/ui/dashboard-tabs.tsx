import type { ReactNode } from 'react';
import clsx from 'clsx';

export type DashboardTabItem<T extends string> = {
  value: T;
  label: string;
  icon?: ReactNode;
  badge?: string | number;
};

type DashboardTabsProps<T extends string> = {
  value: T;
  items: DashboardTabItem<T>[];
  onValueChange: (value: T) => void;
  className?: string;
};

export function DashboardTabs<T extends string>({
  value,
  items,
  onValueChange,
  className,
}: DashboardTabsProps<T>) {
  return (
    <div className={clsx('overflow-x-auto', className)}>
      <div className="inline-flex min-w-max items-center gap-1 rounded-xl border border-slate-200 bg-slate-50/80 p-1">
        {items.map((item) => {
          const active = item.value === value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onValueChange(item.value)}
              className={clsx(
                'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors',
                active
                  ? 'bg-white text-orange-700 shadow-sm ring-1 ring-orange-100'
                  : 'text-slate-500 hover:bg-white hover:text-slate-800',
              )}
            >
              {item.icon ? <span className="text-current">{item.icon}</span> : null}
              <span>{item.label}</span>
              {item.badge !== undefined && item.badge !== null ? (
                <span
                  className={clsx(
                    'rounded-full px-1.5 py-px text-[10px] font-medium tabular-nums',
                    active ? 'bg-orange-100 text-orange-700' : 'bg-slate-200/80 text-slate-500',
                  )}
                >
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
