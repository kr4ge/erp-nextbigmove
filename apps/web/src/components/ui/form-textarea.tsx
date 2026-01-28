import { TextareaHTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';

type FormTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  helper?: string;
  error?: string;
};

export const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({ label, helper, error, className, id, ...props }, ref) => {
    const textareaId = id || props.name;

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-semibold text-[#0F172A]"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={clsx(
            'w-full rounded-xl border px-4 py-2 text-sm text-[#0F172A] placeholder:text-[#94A3B8]',
            'focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent',
            'transition-colors resize-none',
            error
              ? 'border-[#EF4444] bg-[#FEF2F2]'
              : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1]',
            className
          )}
          rows={4}
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

FormTextarea.displayName = 'FormTextarea';
