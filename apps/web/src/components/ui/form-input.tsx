import { InputHTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';

type FormInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  helper?: string;
  error?: string;
  labelClassName?: string;
  helperClassName?: string;
};

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, helper, error, className, labelClassName, helperClassName, id, ...props }, ref) => {
    const inputId = id || props.name;

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className={clsx('form-label', labelClassName)}
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={clsx(
            'input',
            error
              ? 'border-destructive bg-destructive-soft/50'
              : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1]',
            className
          )}
          {...props}
        />
        {(helper || error) && (
          <p
            className={clsx(
              'text-xs',
              error ? 'text-[#EF4444]' : 'text-[#94A3B8]',
              helperClassName
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
