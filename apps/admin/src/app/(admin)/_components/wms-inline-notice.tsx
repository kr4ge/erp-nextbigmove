import type { ReactNode } from 'react';

type WmsInlineNoticeTone = 'success' | 'error' | 'info';

type WmsInlineNoticeProps = {
  tone?: WmsInlineNoticeTone;
  children: ReactNode;
  className?: string;
};

const TONE_CLASS_NAMES: Record<WmsInlineNoticeTone, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  error: 'border-rose-200 bg-rose-50 text-rose-700',
  info: 'border-[#dce4ea] bg-[#fbfcfc] text-[#4d6677]',
};

export function WmsInlineNotice({
  tone = 'info',
  children,
  className = '',
}: WmsInlineNoticeProps) {
  return (
    <div className={`rounded-[18px] border px-4 py-3 text-sm ${TONE_CLASS_NAMES[tone]} ${className}`.trim()}>
      {children}
    </div>
  );
}
