import { SelectHTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';

type FormSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  helper?: string;
  error?: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
};

export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(
  ({ label, helper, error, options, placeholder, className, id, ...props }, ref) => {
    const selectId = id || props.name;

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-semibold text-[#0F172A]"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={clsx(
            'w-full rounded-xl border px-4 py-2 text-sm text-[#0F172A]',
            'focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent',
            'transition-colors appearance-none bg-no-repeat bg-right',
            'bg-[url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3E%3Cpath stroke=\'%2394A3B8\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3E%3C/svg%3E")]',
            'bg-[length:1.5rem_1.5rem] pr-10',
            error
              ? 'border-[#EF4444] bg-[#FEF2F2]'
              : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1]',
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {(helper || error) && (
          <p
            className={clsx(
              'text-xs',
              error ? 'text-[#EF4444]' : 'text-[#94A3B8]'
            )}
          >
            {error || helper}
          </p>
        )}
      </div>
    );
  }
);

FormSelect.displayName = 'FormSelect';
