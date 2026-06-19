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
            className="form-label"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={clsx(
            'input',
            error
              ? 'border-[#EF4444] bg-[#FEF2F2]'
              : 'border-[#E2E8F0] bg-surface dark:border-border hover:border-[#CBD5E1]',
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
