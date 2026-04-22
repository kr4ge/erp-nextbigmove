import type { ReactNode } from 'react';

type WmsFormFieldProps = {
  label: string;
  hint?: string;
  children: ReactNode;
};

export function WmsFormField({ label, hint, children }: WmsFormFieldProps) {
  return (
    <label className="block space-y-2">
      <div>
        <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#6c8190]">{label}</span>
        {hint ? <p className="mt-1 text-[12px] text-[#8397a4]">{hint}</p> : null}
      </div>
      {children}
    </label>
  );
}
