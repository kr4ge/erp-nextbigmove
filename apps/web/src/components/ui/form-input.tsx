import { InputHTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';

type FormInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  helper?: string;
  error?: string;
};

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, helper, error, className, id, ...props }, ref) => {
    const inputId = id || props.name;

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-semibold text-[#0F172A]"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={clsx(
            'w-full rounded-xl border px-4 py-2 text-sm text-[#0F172A] placeholder:text-[#94A3B8]',
            'focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent',
            'transition-colors',
            error
              ? 'border-[#EF4444] bg-[#FEF2F2]'
              : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1]',
            className
          )}
          {...props}
        />
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

FormInput.displayName = 'FormInput';
