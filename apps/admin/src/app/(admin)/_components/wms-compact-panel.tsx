import type { ReactNode } from 'react';

type WmsCompactPanelProps = {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
  headerActions?: ReactNode;
  /** Use "flush" to render without card chrome (no border, bg, padding, shadow). */
  variant?: 'card' | 'flush';
};

export function WmsCompactPanel({
  title,
  eyebrow,
  children,
  className = '',
  headerActions,
  variant = 'card',
}: WmsCompactPanelProps) {
  const isCard = variant === 'card';

  return (
    <section
      className={
        isCard
          ? `min-w-0 wms-surface border border-[#dce4ea] bg-white shadow-[0_24px_60px_-42px_rgba(18,56,75,0.36)] ${className}`.trim()
          : className || undefined
      }
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          {eyebrow ? (
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#8193a0]">{eyebrow}</p>
          ) : null}
          <h2 className={`${eyebrow ? 'mt-2.5' : ''} wms-section-title font-medium tracking-tight text-[#12384b]`}>
            {title}
          </h2>
        </div>
        {headerActions ? <div className="shrink-0">{headerActions}</div> : null}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}
