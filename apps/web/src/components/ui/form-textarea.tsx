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
            className="form-label"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={clsx(
            'input',
            error
              ? 'border-destructive bg-destructive/10'
              : 'border-[#E2E8F0] bg-surface hover:border-[#CBD5E1]',
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
